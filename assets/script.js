/* ==========================================================================
   INTEL MARCHÉS // CLASSIFIÉ — logique d'interface
   ========================================================================== */

(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  /* ------------------------------------------------------------ Séquence de démarrage */

  const BOOT_LINES = [
    "INITIALISATION DU TERMINAL INTEL MARCHÉS v3.0",
    "----------------------------------------------------",
    "> établissement de la liaison sécurisée ........... OK",
    "> connexion à Google Actualités (RSS) ............. OK",
    "> connexion à CoinGecko (crypto) .................. OK",
    "> connexion à Frankfurter / BCE (change) .......... OK",
    "> connexion à Yahoo Finance (indices) ............. OK",
    "> chargement de l'agenda macro (Fed / BCE) ........ OK",
    "> déchiffrement du flux de renseignement .......... OK",
    "----------------------------------------------------",
    "HABILITATION VÉRIFIÉE — BIENVENUE, ANALYSTE",
  ];

  function runBoot() {
    const el = document.getElementById("boot-text");
    const screen = document.getElementById("boot-screen");
    const app = document.getElementById("app");
    let text = "";
    let li = 0;

    function typeLine() {
      if (li >= BOOT_LINES.length) {
        setTimeout(() => {
          screen.classList.add("hide");
          app.hidden = false;
          setTimeout(() => screen.remove(), 600);
        }, 350);
        return;
      }
      const line = BOOT_LINES[li];
      let ci = 0;
      const speed = line.startsWith(">") ? 7 : 2;
      const iv = setInterval(() => {
        text += line[ci];
        el.textContent = text;
        ci++;
        if (ci >= line.length) {
          clearInterval(iv);
          text += "\n";
          el.textContent = text;
          li++;
          setTimeout(typeLine, 80);
        }
      }, speed);
    }
    typeLine();
  }

  /* ------------------------------------------------------------ Pluie de matrice */

  function runMatrixRain() {
    const canvas = document.getElementById("matrix-canvas");
    const ctx = canvas.getContext("2d");
    let w, h, cols, drops;
    const chars = "アイウエオカキクケコサシスセソ0123456789$€¥%+-".split("");

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cols = Math.floor(w / 16);
      drops = new Array(cols).fill(0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx.fillStyle = "rgba(5,7,10,0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#39ff88";
      ctx.font = "14px monospace";
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * 16, drops[i] * 16);
        if (drops[i] * 16 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ------------------------------------------------------------ Horloge */

  function runClock() {
    const clockEl = document.getElementById("clock");
    const footerClockEl = document.getElementById("footer-clock");
    function tick() {
      const now = new Date();
      const str = now.toISOString().slice(11, 19) + "Z";
      if (clockEl) clockEl.textContent = str;
      if (footerClockEl) footerClockEl.textContent = "SYNC " + str;
    }
    tick();
    setInterval(tick, 1000);
  }

  function setSessionId() {
    const el = document.getElementById("session-id");
    if (!el) return;
    el.textContent = "ANON-" + Math.floor(1000 + Math.random() * 9000);
  }

  /* ------------------------------------------------------------ Ticker (réel) */

  function fmtNum(n, digits = 2) {
    if (typeof n !== "number" || isNaN(n)) return "—";
    return n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  let tickerItems = [];

  async function refreshTicker() {
    const items = [];
    try {
      const { prices } = await fetchCrypto();
      const map = { bitcoin: "BTC/USD", ethereum: "ETH/USD", solana: "SOL/USD", ripple: "XRP/USD" };
      Object.entries(map).forEach(([id, label]) => {
        const p = prices[id];
        if (!p) return;
        items.push({
          label,
          value: "$" + fmtNum(p.usd, p.usd > 100 ? 0 : 4),
          up: p.usd_24h_change >= 0,
          delta: (p.usd_24h_change >= 0 ? "+" : "") + p.usd_24h_change.toFixed(2) + "%",
        });
      });
    } catch (e) { /* section ignorée si indisponible */ }

    try {
      const fx = await fetchFX();
      const r = fx.rates;
      items.push({ label: "EUR/USD", value: fmtNum(r.USD, 4), up: true, delta: "BCE" });
      items.push({ label: "EUR/GBP", value: fmtNum(r.GBP, 4), up: true, delta: "BCE" });
      items.push({ label: "EUR/JPY", value: fmtNum(r.JPY, 2), up: true, delta: "BCE" });
    } catch (e) { /* ignoré */ }

    try {
      const idx = await fetchIndices();
      idx.forEach((row) => {
        items.push({
          label: row.label,
          value: fmtNum(row.price, row.price > 1000 ? 0 : 2),
          up: row.changePct >= 0,
          delta: (row.changePct >= 0 ? "+" : "") + row.changePct.toFixed(2) + "%",
        });
      });
    } catch (e) { /* ignoré */ }

    if (items.length) tickerItems = items;
    renderTicker();
    renderThreat();
    updateGlobalStatus();
  }

  function renderTicker() {
    const track = document.getElementById("ticker-track");
    if (!track || !tickerItems.length) return;
    const doubled = [...tickerItems, ...tickerItems]
      .map(
        (t) => `
      <div class="tick-item">
        <span class="lbl">${escapeHtml(t.label)}</span>
        <span class="val">${escapeHtml(t.value)}</span>
        <span class="delta ${t.up ? "up" : "down"}">${t.up ? "▲" : "▼"} ${escapeHtml(t.delta)}</span>
      </div>`
      )
      .join("");
    track.innerHTML = doubled;
  }

  /* ------------------------------------------------------------ Jauge de risque (réelle, via VIX) */

  function renderThreat() {
    const wrap = document.getElementById("threat-segments");
    const valueEl = document.getElementById("threat-value");
    if (!wrap) return;

    const vix = tickerItems.find((t) => t.label === "VIX");
    if (vix) {
      const v = parseFloat(String(vix.value).replace(/[^\d.]/g, ""));
      if (!isNaN(v)) {
        if (v < 14) STATE.threatLevel = 0;
        else if (v < 19) STATE.threatLevel = 1;
        else if (v < 25) STATE.threatLevel = 2;
        else if (v < 35) STATE.threatLevel = 3;
        else STATE.threatLevel = 4;
      }
    }

    wrap.innerHTML = "";
    const colors = ["#39ff88", "#a3ff39", "#ffb020", "#ff7a3b", "#ff3b3b"];
    THREAT_LEVELS.forEach((lvl, i) => {
      const seg = document.createElement("div");
      seg.className = "threat-seg" + (i <= STATE.threatLevel ? " active" : "");
      seg.style.color = colors[i];
      if (i <= STATE.threatLevel) seg.style.background = colors[i];
      wrap.appendChild(seg);
    });
    const label = THREAT_LEVELS[STATE.threatLevel];
    valueEl.textContent = label + (vix ? ` (VIX ${vix.value})` : "");
    valueEl.style.color = colors[STATE.threatLevel];
  }

  /* ------------------------------------------------------------ Statut global */

  function updateGlobalStatus() {
    const dot = document.getElementById("global-dot");
    const label = document.getElementById("global-status");
    const statuses = Object.values(STATE.sourceStatus);
    const anyLive = statuses.includes("live");
    const allOffline = statuses.length > 0 && statuses.every((s) => s === "offline");
    if (allOffline) {
      dot.style.background = "var(--red)";
      dot.style.boxShadow = "0 0 8px var(--red)";
      label.textContent = "HORS LIGNE";
    } else if (anyLive) {
      dot.style.background = "var(--green)";
      dot.style.boxShadow = "0 0 8px var(--green)";
      label.textContent = "EN DIRECT";
    } else {
      dot.style.background = "var(--amber)";
      dot.style.boxShadow = "0 0 8px var(--amber)";
      label.textContent = "CACHE LOCAL";
    }
  }

  /* ------------------------------------------------------------ Flux d'actualités (réel) */

  const IMPACT_CLASS = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };
  const IMPACT_LABEL_FR = { CRITICAL: "CRITIQUE", HIGH: "ÉLEVÉ", MEDIUM: "MOYEN", LOW: "FAIBLE" };
  let activeFilter = "TOUS";
  let currentFeed = [];

  function impactClass(impact) {
    return IMPACT_CLASS[impact] || "low";
  }

  function renderFilters() {
    const row = document.getElementById("filter-row");
    if (!row) return;
    const cats = ["TOUS", ...new Set(currentFeed.map((f) => f.category))];
    row.innerHTML = cats
      .map(
        (c) =>
          `<button class="filter-chip${c === activeFilter ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
      )
      .join("");
    row.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.cat;
        renderFilters();
        renderFeed();
      });
    });
  }

  function renderFeed() {
    const list = document.getElementById("feed-list");
    if (!list) return;
    const items =
      activeFilter === "TOUS"
        ? currentFeed
        : currentFeed.filter((f) => f.category === activeFilter);

    if (!items.length) {
      list.innerHTML = `<div class="loading-line">■ aucune dépêche pour ce filtre pour le moment…</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (item) => `
      <article class="card ${impactClass(item.impact)}" data-id="${escapeHtml(item.id)}">
        <div class="card-top">
          <span class="card-cat">${escapeHtml(item.category)}</span>
          <span class="impact-pill ${impactClass(item.impact)}">${IMPACT_LABEL_FR[item.impact] || item.impact}</span>
        </div>
        <div class="card-headline">${escapeHtml(item.headline)}</div>
        <div class="card-tags">
          ${item.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}
          <span class="tag" style="margin-left:auto;color:var(--text-faint)">${escapeHtml(item.time)} · ${escapeHtml(item.source)}</span>
        </div>
      </article>`
      )
      .join("");

    list.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => {
        const item = currentFeed.find((f) => f.id === card.dataset.id);
        if (item) openBrief(item);
      });
    });
  }

  function openBrief(item) {
    const overlay = document.getElementById("brief-overlay");
    const card = document.getElementById("brief-card");
    card.innerHTML = `
      <div class="brief-close" id="brief-close">✕ FERMER</div>
      <div class="brief-meta">${escapeHtml(item.category)} · ${escapeHtml(item.source)} · ${escapeHtml(item.time)}</div>
      <h3>${escapeHtml(item.headline)}</h3>
      <div class="brief-body">${escapeHtml(item.brief)}</div>
      ${item.link ? `<div><a class="brief-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Lire l'article complet ↗</a></div>` : ""}
      <div class="brief-stamp">CLASSIFIÉ</div>
    `;
    overlay.classList.add("open");
    document.getElementById("brief-close").addEventListener("click", closeBrief);
  }
  function closeBrief() {
    document.getElementById("brief-overlay").classList.remove("open");
  }

  async function refreshFeed() {
    const list = document.getElementById("feed-list");
    const statusEl = document.getElementById("feed-status");
    try {
      currentFeed = await fetchIntelFeed();
      renderFilters();
      renderFeed();
      const anyLive = currentFeed.some((i) => STATE.sourceStatus[`news_${i.category}`] !== "cache");
      statusEl.innerHTML = `<span class="dot dot-live"></span> EN DIRECT — GOOGLE ACTUALITÉS (${currentFeed.length} dépêches)`;
    } catch (e) {
      if (!currentFeed.length) {
        currentFeed = FALLBACK_FEED;
        renderFilters();
        renderFeed();
      }
      statusEl.innerHTML = `<span class="dot" style="background:var(--red)"></span> HORS LIGNE — ARCHIVE LOCALE AFFICHÉE`;
    }
    updateGlobalStatus();
  }

  /* ------------------------------------------------------------ Agenda macro */

  function renderWatchlist() {
    const wrap = document.getElementById("watchlist");
    if (!wrap) return;
    wrap.innerHTML = WATCHLIST.map(
      (w, i) => `
      <div class="watch-item" data-target="${w.target}" data-idx="${i}">
        <div class="watch-top">
          <span>${escapeHtml(w.label)}</span>
          <span class="watch-tag">${escapeHtml(w.tag)}</span>
        </div>
        <div class="watch-timer" id="watch-timer-${i}">--j --:--:--</div>
      </div>`
    ).join("");
    updateCountdowns();
    setInterval(updateCountdowns, 1000);
  }

  function updateCountdowns() {
    WATCHLIST.forEach((w, i) => {
      const el = document.getElementById(`watch-timer-${i}`);
      if (!el) return;
      const diff = new Date(w.target).getTime() - Date.now();
      if (diff <= 0) {
        el.textContent = "EN COURS";
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${String(d).padStart(2, "0")}j ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    });
  }

  /* ------------------------------------------------------------ Carte */

  function renderMap() {
    const wrap = document.getElementById("map-wrap");
    if (!wrap) return;

    const dots = HOTSPOTS.map((h) => {
      const cls = h.level === "CRITICAL" ? "" : h.level === "HIGH" ? "high" : "medium";
      return `
        <g class="hotspot ${cls}" transform="translate(${h.x} ${h.y})">
          <title>${escapeHtml(h.name)} — ${escapeHtml(h.note)}</title>
          <circle class="pulse" r="3"></circle>
          <circle class="core" r="1.6"></circle>
        </g>`;
    }).join("");

    wrap.innerHTML = `
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="100" height="60" fill="none"/>
        ${worldDots()}
        ${dots}
      </svg>
      <div class="map-legend">
        <span><i class="legend-dot" style="background:var(--red)"></i>CRITIQUE</span>
        <span><i class="legend-dot" style="background:var(--high)"></i>ÉLEVÉ</span>
        <span><i class="legend-dot" style="background:var(--amber)"></i>MOYEN</span>
      </div>
    `;
  }

  // Texture "radar" bon marché : suggère une silhouette du monde par une
  // grille de points, sans dépendance externe. Look tactique assumé, ce
  // n'est pas une carte géographique précise.
  function worldDots() {
    let out = "";
    for (let x = 2; x < 100; x += 4) {
      for (let y = 2; y < 60; y += 4) {
        if (Math.random() > 0.55) {
          out += `<circle cx="${x}" cy="${y}" r="0.4" fill="#1f3a35" />`;
        }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ Journal système + console */

  const logHistory = [];

  function pushLog(text) {
    logHistory.push(text);
    const log = document.getElementById("term-log");
    if (!log) return;
    const line = document.createElement("div");
    line.textContent = text;
    log.appendChild(line);
    while (log.children.length > 10) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function runTerminalLog() {
    let i = 0;
    pushLog(TERMINAL_LOG_LINES[0]);
    setInterval(() => {
      i++;
      pushLog(TERMINAL_LOG_LINES[i % TERMINAL_LOG_LINES.length]);
    }, 4200);
  }

  const COMMANDS = {
    aide: () => [
      "commandes disponibles :",
      "  aide       — affiche cette liste",
      "  statut     — état des sources de données",
      "  actualiser — force une resynchronisation complète",
      "  niveau     — explique l'indice de risque actuel",
      "  effacer    — vide la console",
      "  matrice    — bascule l'intensité de la pluie de code",
      "  propos     — à propos de ce terminal",
    ],
    statut: () => {
      const s = STATE.sourceStatus;
      const line = (k, label) => `  ${label.padEnd(22, ".")} ${s[k] || "en attente"}`;
      return [
        "état des sources :",
        line("crypto", "CoinGecko"),
        line("fx", "Frankfurter/BCE"),
        line("indices", "Yahoo Finance"),
        ...NEWS_CATEGORIES.map((c) => line(`news_${c.key}`, c.key)),
      ];
    },
    actualiser: () => {
      pushLog("resynchronisation forcée demandée par l'analyste...");
      refreshAll();
      return ["resynchronisation lancée."];
    },
    niveau: () => [
      `niveau actuel : ${THREAT_LEVELS[STATE.threatLevel]}`,
      "calculé à partir du VIX (indice de volatilité CBOE) en direct :",
      "  < 14 FAIBLE · 14-19 SURVEILLÉ · 19-25 ÉLEVÉ · 25-35 SÉVÈRE · > 35 CRITIQUE",
    ],
    effacer: () => {
      const log = document.getElementById("term-log");
      if (log) log.innerHTML = "";
      return [];
    },
    matrice: () => {
      const c = document.getElementById("matrix-canvas");
      c.style.opacity = c.style.opacity === "0.4" ? "0.16" : "0.4";
      return ["intensité de la pluie de code ajustée."];
    },
    propos: () => [
      "INTEL MARCHÉS // CLASSIFIÉ — tableau de bord de veille financière.",
      "sources publiques et gratuites, agrégées côté client, sans clé API.",
      "pas un conseil en investissement.",
    ],
  };

  function runCommand(raw) {
    const cmd = raw.trim().toLowerCase();
    pushLog(`root@intel-marches:~$ ${raw}`);
    if (!cmd) return;
    const fn = COMMANDS[cmd];
    if (!fn) {
      pushLog(`commande inconnue : "${cmd}" — tapez "aide"`);
      return;
    }
    const out = fn() || [];
    out.forEach((l) => pushLog(l));
  }

  function wireTerminalInput() {
    const form = document.getElementById("term-form");
    const input = document.getElementById("term-input");
    if (!form || !input) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value;
      input.value = "";
      runCommand(val);
    });
  }

  /* ------------------------------------------------------------ Rafraîchissement global */

  async function refreshAll() {
    await Promise.allSettled([refreshTicker(), refreshFeed()]);
  }

  /* ------------------------------------------------------------ Initialisation */

  async function init() {
    runBoot();
    runMatrixRain();
    runClock();
    setSessionId();
    renderWatchlist();
    renderMap();
    runTerminalLog();
    wireTerminalInput();

    await refreshAll();

    document.getElementById("brief-overlay").addEventListener("click", (e) => {
      if (e.target.id === "brief-overlay") closeBrief();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrief();
    });

    // rafraîchissements périodiques : cotations toutes les 60 s, actualités toutes les 5 min
    setInterval(refreshTicker, 60_000);
    setInterval(refreshFeed, 5 * 60_000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
