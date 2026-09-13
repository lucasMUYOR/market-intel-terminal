/* ==========================================================================
   COUCHE DE DONNÉES — SOURCES RÉELLES, EN DIRECT
   --------------------------------------------------------------------------
   Ce fichier fait le pont entre des API publiques et gratuites (sans clé) et
   l'interface (script.js). Chaque fonction fetchXxx() renvoie des données
   réelles quand c'est possible, retombe sur un cache local (localStorage) en
   cas d'échec réseau, puis sur un jeu de secours intégré en dernier recours
   — le terminal ne doit jamais rester vide.

   Sources utilisées (toutes publiques, sans clé API) :
     - Google Actualités (RSS)      → gros titres réels, multi-catégories
     - CoinGecko                    → prix crypto en temps réel
     - Frankfurter.dev (données BCE) → taux de change de référence
     - Yahoo Finance (chart API)    → indices, VIX, pétrole, or
     - Dates réelles de calendrier macro (Fed, BCE, NFP, CPI) — vérifiées via
       federalreserve.gov / ecb.europa.eu / bls.gov, codées en dur car ce
       sont des dates planifiées publiquement, pas des flux temps réel.

   Comme la plupart de ces API ne renvoient pas d'en-têtes CORS utilisables
   directement depuis un site statique, les requêtes passent par une chaîne
   de proxys CORS publics (voir PROXIES). Ces proxys tiers peuvent tomber ou
   être limités en débit — c'est pourquoi chaque fetch a un timeout, un
   repli en cascade, et un cache local avec horodatage.
   ========================================================================== */

const THREAT_LEVELS = ["FAIBLE", "SURVEILLÉ", "ÉLEVÉ", "SÉVÈRE", "CRITIQUE"];

const STATE = {
  threatLevel: 2,
  sourceStatus: {}, // { key: "live" | "cache" | "offline" }
  newsEngine: null, // "finnhub" | "proxy" | "archive" — quelle source a fourni le flux affiché
};

/* --------------------------------------------------------------- Clé Finnhub */
/* Finnhub (finnhub.io) est une vraie API pensée pour l'appel direct depuis
   un navigateur : elle renvoie Access-Control-Allow-Origin: * même sur les
   réponses d'erreur. Contrairement à un scraping RSS via proxy public, elle
   ne dépend d'aucune infrastructure tierce fragile. Inscription gratuite,
   sans carte bancaire, 60 requêtes/minute. Sans clé, le terminal retombe
   automatiquement sur le flux Google Actualités via proxy (moins fiable),
   puis sur l'archive locale. */
const FINNHUB_KEY_STORAGE = "mit_finnhub_key";

function getFinnhubKey() {
  try {
    return localStorage.getItem(FINNHUB_KEY_STORAGE) || "";
  } catch (e) {
    return "";
  }
}
function setFinnhubKey(key) {
  try {
    if (key) localStorage.setItem(FINNHUB_KEY_STORAGE, key.trim());
    else localStorage.removeItem(FINNHUB_KEY_STORAGE);
  } catch (e) { /* ignoré */ }
}

/* ------------------------------------------------------------------ Proxys */

const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://cors.eu.org/${url}`,
];

function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { promise: promise(ctrl.signal), ctrl, cleanup: () => clearTimeout(timer) };
}

/**
 * Verrou global (toutes sources confondues) limitant le nombre de requêtes
 * simultanées envoyées aux proxys CORS publics. Ces proxys gratuits et
 * partagés tolèrent mal les rafales — même si chaque fonction (indices,
 * actualités, …) limite déjà sa propre concurrence, elles peuvent toutes
 * se déclencher en même temps au chargement de la page. Ce sémaphore
 * garantit qu'au plus PROXY_CONCURRENCY requêtes proxy sont en vol, quelle
 * que soit la source qui les a demandées.
 */
const PROXY_CONCURRENCY = 2;
let proxyActive = 0;
const proxyQueue = [];
function acquireProxySlot() {
  if (proxyActive < PROXY_CONCURRENCY) {
    proxyActive++;
    return Promise.resolve();
  }
  return new Promise((resolve) => proxyQueue.push(resolve));
}
function releaseProxySlot() {
  const next = proxyQueue.shift();
  if (next) next();
  else proxyActive--;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAllProxiesOnce(url, asJson, timeout) {
  let lastErr;
  for (const build of PROXIES) {
    const target = build(url);
    const { promise, cleanup } = withTimeout((signal) => fetch(target, { signal }), timeout);
    try {
      const res = await promise;
      cleanup();
      if (!res.ok) throw new Error("HTTP " + res.status);
      return asJson ? await res.json() : await res.text();
    } catch (err) {
      cleanup();
      lastErr = err;
    }
  }
  throw lastErr || new Error("Tous les proxys ont échoué");
}

async function fetchViaProxies(url, { asJson = false, timeout = 8000 } = {}) {
  await acquireProxySlot();
  try {
    try {
      return await tryAllProxiesOnce(url, asJson, timeout);
    } catch (firstErr) {
      // Les proxys publics ont parfois des ratés transitoires (500, rate
      // limit) — une seconde passe après une courte pause suffit souvent.
      await sleep(1500);
      return await tryAllProxiesOnce(url, asJson, timeout);
    }
  } finally {
    releaseProxySlot();
  }
}

/**
 * Exécute fn sur chaque élément avec au plus `limit` appels concurrents —
 * les proxys CORS publics gratuits tolèrent mal une rafale de requêtes
 * parallèles (ils renvoient des erreurs ou du rate-limiting au-delà).
 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill(0).map(worker));
  return results;
}

async function fetchDirect(url, { asJson = false, timeout = 6000 } = {}) {
  const { promise, cleanup } = withTimeout((signal) => fetch(url, { signal }), timeout);
  const res = await promise;
  cleanup();
  if (!res.ok) throw new Error("HTTP " + res.status);
  return asJson ? await res.json() : await res.text();
}

/* ------------------------------------------------------------------ Cache */

const CACHE_PREFIX = "mit_cache_";

function cacheSet(key, data) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ t: Date.now(), data })
    );
  } catch (e) {
    /* stockage indisponible (navigation privée, etc.) — silencieux */
  }
}

function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (maxAgeMs && Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.data;
  } catch (e) {
    return null;
  }
}

async function withCache(key, freshMs, staleMs, loader) {
  try {
    const data = await loader();
    cacheSet(key, data);
    STATE.sourceStatus[key] = "live";
    return data;
  } catch (err) {
    const fresh = cacheGet(key, freshMs);
    if (fresh) {
      STATE.sourceStatus[key] = "live";
      return fresh;
    }
    const stale = cacheGet(key, staleMs);
    if (stale) {
      STATE.sourceStatus[key] = "cache";
      return stale;
    }
    STATE.sourceStatus[key] = "offline";
    throw err;
  }
}

/* ------------------------------------------------------------ Crypto (réel) */

async function fetchCrypto() {
  return withCache("crypto", 45_000, 3_600_000, async () => {
    const [prices, global] = await Promise.all([
      fetchDirect(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd&include_24hr_change=true",
        { asJson: true }
      ),
      fetchDirect("https://api.coingecko.com/api/v3/global", { asJson: true }),
    ]);
    return { prices, global: global.data };
  });
}

/* --------------------------------------------------------- Change (réel, BCE) */

async function fetchFX() {
  return withCache("fx", 6 * 3_600_000, 24 * 3_600_000, async () => {
    return fetchDirect(
      "https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP,JPY,CHF",
      { asJson: true }
    );
  });
}

/* -------------------------------------------------- Indices via Finnhub (réel) */
/* Le plan gratuit de Finnhub ne donne pas accès aux indices bruts (^GSPC…),
   réservés aux offres payantes — on utilise donc des ETF liquides comme
   proxys directement comparables (SPY suit le S&P 500 à un facteur ~10 près,
   etc.), avec la mention de l'ETF affichée pour rester honnête. */
const FINNHUB_QUOTE_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500 (SPY)" },
  { symbol: "QQQ", label: "NASDAQ 100 (QQQ)" },
  { symbol: "DIA", label: "DOW JONES (DIA)" },
  { symbol: "GLD", label: "OR (GLD)" },
  { symbol: "USO", label: "PÉTROLE (USO)" },
];

async function fetchIndicesFinnhub(key) {
  const results = await mapLimit(FINNHUB_QUOTE_SYMBOLS, 3, async ({ symbol, label }) => {
    try {
      const q = await fetchDirect(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
        { asJson: true, timeout: 6000 }
      );
      if (typeof q.c !== "number" || q.c === 0) return null;
      return { label, price: q.c, changePct: q.dp ?? 0 };
    } catch (e) {
      return null;
    }
  });
  const clean = results.filter(Boolean);
  if (!clean.length) throw new Error("Finnhub: aucune cotation");
  return clean;
}

/* --------------------------------------------------------- Indices (réel) */

const INDEX_SYMBOLS = [
  { symbol: "%5EGSPC", label: "S&P 500" },
  { symbol: "%5EIXIC", label: "NASDAQ" },
  { symbol: "%5EDJI", label: "DOW JONES" },
  { symbol: "%5EFCHI", label: "CAC 40" },
  { symbol: "%5EN225", label: "NIKKEI 225" },
  { symbol: "CL%3DF", label: "PÉTROLE WTI" },
  { symbol: "GC%3DF", label: "OR" },
];

async function fetchIndices() {
  return withCache("indices", 60_000, 3_600_000, async () => {
    const key = getFinnhubKey();
    if (key) {
      try {
        return await fetchIndicesFinnhub(key);
      } catch (e) {
        /* clé invalide ou Finnhub indisponible — on retombe sur Yahoo/proxy */
      }
    }
    const results = await mapLimit(INDEX_SYMBOLS, 3, async ({ symbol, label }) => {
      try {
        const data = await fetchViaProxies(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
          { asJson: true, timeout: 8000 }
        );
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;
        return {
          label,
          price: meta.regularMarketPrice,
          changePct: meta.regularMarketChangePercent ?? 0,
          currency: meta.currency,
        };
      } catch (e) {
        return null;
      }
    });
    const clean = results.filter(Boolean);
    if (!clean.length) throw new Error("Aucun indice récupéré");
    return clean;
  });
}

/* ----------------------------------------------------- VIX pour la jauge de risque */
/* Requête isolée et unique (pas mêlée aux 5-8 requêtes du tableau d'indices)
   pour rester légère sur la chaîne de proxys — c'est la seule valeur dont la
   jauge de risque a besoin. Note : un ETN comme VIXY n'a PAS la même échelle
   que l'indice VIX réel, donc on va chercher le vrai ^VIX, pas un proxy ETF. */
async function fetchVix() {
  return withCache("vix", 60_000, 3_600_000, async () => {
    const data = await fetchViaProxies(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX",
      { asJson: true, timeout: 8000 }
    );
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") throw new Error("VIX indisponible");
    return { price: meta.regularMarketPrice, changePct: meta.regularMarketChangePercent ?? 0 };
  });
}

/* -------------------------------------------------------- Actualités (réel) */

const NEWS_CATEGORIES = [
  { key: "BANQUES CENTRALES", query: "banque centrale taux directeur Fed BCE", baseline: "HIGH" },
  { key: "GÉOPOLITIQUE", query: "géopolitique tensions internationales marchés", baseline: "HIGH" },
  { key: "ÉNERGIE", query: "pétrole gaz OPEP énergie prix", baseline: "MEDIUM" },
  { key: "MARCHÉS ACTIONS", query: "bourse Wall Street CAC 40 actions marchés", baseline: "MEDIUM" },
  { key: "CRYPTO", query: "bitcoin crypto-monnaie marché", baseline: "MEDIUM" },
  { key: "MATIÈRES PREMIÈRES", query: "matières premières or métaux marché", baseline: "LOW" },
  { key: "CYBERSÉCURITÉ", query: "cyberattaque cybersécurité entreprises banques", baseline: "HIGH" },
  { key: "COMMERCE INTERNATIONAL", query: "commerce international tarifs douaniers exportations", baseline: "MEDIUM" },
];

const IMPACT_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const CRITICAL_WORDS = ["guerre", "krach", "effondrement", "invasion", "urgence", "défaut de paiement", "panique"];
const ESCALATE_WORDS = ["hausse des taux", "baisse des taux", "sanctions", "récession", "choc", "tensions", "rupture", "attaque", "alerte"];

function scoreImpact(title, baseline) {
  const t = title.toLowerCase();
  if (CRITICAL_WORDS.some((w) => t.includes(w))) return "CRITICAL";
  let level = IMPACT_RANK[baseline] ?? 1;
  if (ESCALATE_WORDS.some((w) => t.includes(w))) level = Math.min(level + 1, 3);
  return Object.keys(IMPACT_RANK).find((k) => IMPACT_RANK[k] === level) || baseline;
}

function relativeTimeFr(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

function parseGoogleNewsRSS(xmlText, category) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 6);
  return items.map((item, i) => {
    const rawTitle = item.querySelector("title")?.textContent || "";
    const sourceEl = item.querySelector("source");
    const sourceName = sourceEl?.textContent || "Google Actualités";
    const link = item.querySelector("link")?.textContent || "#";
    const pubDate = item.querySelector("pubDate")?.textContent || "";
    let headline = rawTitle;
    const suffix = " - " + sourceName;
    if (headline.endsWith(suffix)) headline = headline.slice(0, -suffix.length);
    return {
      id: `${category.key}-${i}-${Date.parse(pubDate) || i}`,
      category: category.key,
      impact: scoreImpact(headline, category.baseline),
      time: relativeTimeFr(pubDate),
      timestamp: Date.parse(pubDate) || 0,
      source: sourceName,
      headline,
      brief: `Dépêche réelle indexée via Google Actualités pour la catégorie ${category.key}. Cliquez « lire l'article complet » pour la source d'origine.`,
      link,
      tags: [category.key.split(" ")[0]],
      live: true,
    };
  });
}

/* Catégories Finnhub → étiquette française affichée + baseline d'impact.
   Finnhub renvoie ses dépêches en anglais (sources Reuters/AP/etc.) — le
   contenu reste réel et à jour, seule la langue de la dépêche elle-même
   n'est pas traduite (aucune traduction automatique fiable sans clé tierce). */
const FINNHUB_CATEGORIES = [
  { finnhub: "general", key: "ACTUALITÉS GÉNÉRALES", baseline: "MEDIUM" },
  { finnhub: "forex", key: "CHANGE & TAUX", baseline: "HIGH" },
  { finnhub: "crypto", key: "CRYPTO", baseline: "MEDIUM" },
  { finnhub: "merger", key: "FUSIONS & ACQUISITIONS", baseline: "MEDIUM" },
];

function relativeTimeFrFromEpoch(epochSeconds) {
  if (!epochSeconds) return "";
  return relativeTimeFr(new Date(epochSeconds * 1000).toISOString());
}

async function fetchFinnhubCategory(key, cat) {
  const url = `https://finnhub.io/api/v1/news?category=${cat.finnhub}&token=${key}`;
  const items = await fetchDirect(url, { asJson: true, timeout: 7000 });
  if (!Array.isArray(items) || !items.length) throw new Error("Finnhub: catégorie vide");
  return items.slice(0, 8).map((it, i) => ({
    id: `fh-${cat.finnhub}-${it.id || i}`,
    category: cat.key,
    impact: scoreImpact(it.headline || "", cat.baseline),
    time: relativeTimeFrFromEpoch(it.datetime),
    timestamp: (it.datetime || 0) * 1000,
    source: it.source || "Finnhub",
    headline: it.headline || "",
    brief: it.summary || "Aucun résumé fourni par la source.",
    link: it.url || "#",
    tags: [cat.key.split(" ")[0].replace(/[&,]/g, "")],
    live: true,
  }));
}

async function fetchIntelFeedFinnhub(key) {
  const results = await mapLimit(FINNHUB_CATEGORIES, 2, async (cat) => {
    try {
      return await fetchFinnhubCategory(key, cat);
    } catch (e) {
      return [];
    }
  });
  const merged = results.flat();
  if (!merged.length) throw new Error("Finnhub: aucune dépêche");
  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return merged;
}

async function fetchNewsCategory(category) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(category.query)}&hl=fr&gl=FR&ceid=FR:fr`;
  return withCache(`news_${category.key}`, 5 * 60_000, 6 * 3_600_000, async () => {
    const xml = await fetchViaProxies(url, { timeout: 9000 });
    const parsed = parseGoogleNewsRSS(xml, category);
    if (!parsed.length) throw new Error("Flux vide");
    return parsed;
  });
}

/* Dernier recours : si le live ET le cache local échouent tous les deux
   (proxy public en panne, première visite hors ligne...), on affiche ceci
   plutôt qu'un panneau vide — clairement marqué comme archive, pas du direct. */
const FALLBACK_FEED = [
  {
    id: "arc-1", category: "BANQUES CENTRALES", impact: "HIGH", time: "archive",
    source: "ARCHIVE LOCALE", headline: "La Fed et la BCE sous surveillance rapprochée des marchés de taux",
    brief: "Contenu d'archive affiché car les flux en direct sont temporairement injoignables. Réessayez dans quelques instants ou tapez « actualiser » dans la console.",
    tags: ["TAUX"], live: false,
  },
  {
    id: "arc-2", category: "GÉOPOLITIQUE", impact: "HIGH", time: "archive",
    source: "ARCHIVE LOCALE", headline: "Tensions géopolitiques persistantes sur les corridors énergétiques mondiaux",
    brief: "Contenu d'archive — connexion aux flux réels indisponible pour le moment.",
    tags: ["RISQUE"], live: false,
  },
  {
    id: "arc-3", category: "ÉNERGIE", impact: "MEDIUM", time: "archive",
    source: "ARCHIVE LOCALE", headline: "Marchés pétroliers attentifs aux décisions de production de l'OPEP+",
    brief: "Contenu d'archive — connexion aux flux réels indisponible pour le moment.",
    tags: ["ÉNERGIE"], live: false,
  },
  {
    id: "arc-4", category: "MARCHÉS ACTIONS", impact: "MEDIUM", time: "archive",
    source: "ARCHIVE LOCALE", headline: "Wall Street et les places européennes évoluent au gré des résultats d'entreprises",
    brief: "Contenu d'archive — connexion aux flux réels indisponible pour le moment.",
    tags: ["ACTIONS"], live: false,
  },
  {
    id: "arc-5", category: "CRYPTO", impact: "MEDIUM", time: "archive",
    source: "ARCHIVE LOCALE", headline: "Le bitcoin et les grandes cryptomonnaies restent sous forte volatilité",
    brief: "Contenu d'archive — connexion aux flux réels indisponible pour le moment.",
    tags: ["CRYPTO"], live: false,
  },
];

async function fetchIntelFeed() {
  const key = getFinnhubKey();
  if (key) {
    try {
      const feed = await fetchIntelFeedFinnhub(key);
      STATE.newsEngine = "finnhub";
      STATE.sourceStatus.news = "live";
      return feed;
    } catch (e) {
      /* clé invalide/épuisée ou Finnhub indisponible — on retombe sur le proxy */
    }
  }

  const results = await mapLimit(NEWS_CATEGORIES, 3, async (cat) => {
    try {
      return await fetchNewsCategory(cat);
    } catch (e) {
      return [];
    }
  });
  const merged = results.flat();
  if (!merged.length) throw new Error("Toutes les catégories ont échoué");
  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  STATE.newsEngine = "proxy";
  STATE.sourceStatus.news = "live";
  return merged;
}

/* --------------------------------------------------- Agenda macro (réel, dates vérifiées) */
/* Sources : federalreserve.gov/monetarypolicy/fomccalendars.htm,
   ecb.europa.eu/press/calendars/mgcgc, bls.gov (calendrier CPI 2026). */

const WATCHLIST = [
  { label: "DÉCISION DE TAUX — FOMC (FED)", target: "2026-09-16T18:00:00Z", tag: "TAUX" },
  { label: "RAPPORT EMPLOI US (NFP)", target: "2026-10-02T12:30:00Z", tag: "EMPLOI" },
  { label: "INFLATION US (CPI, SEPT.)", target: "2026-10-14T12:30:00Z", tag: "INFLATION" },
  { label: "RÉUNION BCE — TAUX DIRECTEURS", target: "2026-10-29T13:15:00Z", tag: "TAUX" },
  { label: "FOMC (FED) — RÉUNION SUIVANTE", target: "2026-10-28T18:00:00Z", tag: "TAUX" },
];

/* -------------------------------------------------- Carte des points chauds */
/* Zones à risque suivies par les desks macro/géopolitique — évaluation
   éditoriale statique (pas un flux temps réel), utile comme repère visuel. */

const HOTSPOTS = [
  { name: "DÉTROIT D'ORMUZ", x: 63.5, y: 44, note: "Verrou pétrolier — activité navale accrue", level: "HIGH" },
  { name: "DÉTROIT DE TAÏWAN", x: 79.5, y: 46, note: "Corridor à risque pour la chaîne semi-conducteurs", level: "MEDIUM" },
  { name: "WASHINGTON D.C.", x: 27, y: 34, note: "Épicentre politique Fed / budget fédéral", level: "CRITICAL" },
  { name: "BRUXELLES", x: 47.5, y: 27, note: "BCE / coordination budgétaire européenne", level: "MEDIUM" },
  { name: "CANAL DE SUEZ", x: 54, y: 42, note: "Verrou du commerce mondial", level: "MEDIUM" },
  { name: "MER DE CHINE MÉRIDIONALE", x: 77, y: 51, note: "Tensions sur les routes maritimes", level: "MEDIUM" },
  { name: "MOSCOU", x: 56, y: 24, note: "Risque sur la politique d'exportation énergétique", level: "HIGH" },
];

/* -------------------------------------------------------------- Journal système */

const TERMINAL_LOG_LINES = [
  "requête Finnhub / Google Actualités...",
  "requête CoinGecko [BTC, ETH, SOL, XRP]...",
  "synchronisation taux de référence BCE (Frankfurter)...",
  "récupération des indices...",
  "recalcul de l'indice de risque via le VIX...",
  "vérification du calendrier macro (Fed / BCE / BLS)...",
  "aucune anomalie détectée sur les flux...",
  "mise en cache locale des dernières données...",
];
