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
  function fmtNum(n, digits = 2) {
    if (typeof n !== "number" || isNaN(n)) return "—";
    return n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /* ------------------------------------------------------------ Horloge */

  function runClock() {
    const clockEl = document.getElementById("clock");
    const footerClockEl = document.getElementById("footer-clock");
    function tick() {
      const str = new Date().toISOString().slice(11, 19) + "Z";
      if (clockEl) clockEl.textContent = str;
      if (footerClockEl) footerClockEl.textContent = "SYNC " + str;
    }
    tick();
    setInterval(tick, 1000);
  }

  function setSessionId() {
    const el = document.getElementById("session-id");
    if (el) el.textContent = "ANON-" + Math.floor(1000 + Math.random() * 9000);
  }

  /* ------------------------------------------------------------ Ticker + tables marchés */

  let tickerItems = [];

  async function refreshMarkets() {
    const items = [];

    try {
      const { prices } = await fetchCrypto();
      const map = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", ripple: "XRP" };
      const rows = Object.entries(map).map(([id, label]) => {
        const p = prices[id];
        if (!p) return null;
        const row = { label, price: p.usd, changePct: p.usd_24h_change };
        items.push({ label: label + "/USD", value: "$" + fmtNum(p.usd, p.usd > 100 ? 0 : 4), up: p.usd_24h_change >= 0, delta: (p.usd_24h_change >= 0 ? "+" : "") + p.usd_24h_change.toFixed(2) + "%" });
        return row;
      }).filter(Boolean);
      renderTable("tbl-crypto", rows, (r) => [r.label, "$" + fmtNum(r.price, r.price > 100 ? 0 : 4), pct(r.changePct)]);
    } catch (e) {
      renderTableError("tbl-crypto");
    }

    try {
      const fx = await fetchFX();
      const r = fx.rates;
      const rows = [
        { label: "EUR/USD", value: r.USD, digits: 4 },
        { label: "EUR/GBP", value: r.GBP, digits: 4 },
        { label: "EUR/JPY", value: r.JPY, digits: 2 },
        { label: "EUR/CHF", value: r.CHF, digits: 4 },
      ];
      rows.forEach((row) => items.push({ label: row.label, value: fmtNum(row.value, row.digits), up: true, delta: "BCE" }));
      renderTable("tbl-fx", rows, (r) => [r.label, fmtNum(r.value, r.digits), ""]);
    } catch (e) {
      renderTableError("tbl-fx");
    }

    try {
      const idx = await fetchIndices();
      idx.forEach((row) => items.push({ label: row.label, value: fmtNum(row.price, row.price > 1000 ? 0 : 2), up: row.changePct >= 0, delta: (row.changePct >= 0 ? "+" : "") + row.changePct.toFixed(2) + "%" }));
      renderTable("tbl-indices", idx, (r) => [r.label, fmtNum(r.price, r.price > 1000 ? 0 : 2), pct(r.changePct)]);
    } catch (e) {
      renderTableError("tbl-indices");
    }

    try {
      const vix = await fetchVix();
      if (vix.price < 14) STATE.threatLevel = 0;
      else if (vix.price < 19) STATE.threatLevel = 1;
      else if (vix.price < 25) STATE.threatLevel = 2;
      else if (vix.price < 35) STATE.threatLevel = 3;
      else STATE.threatLevel = 4;
      renderThreat(vix.price);
    } catch (e) {
      renderThreat(null);
    }

    if (items.length) tickerItems = items;
    renderTicker();
    renderSources();
    updateGlobalStatus();
  }

  function pct(v) {
    return { text: (v >= 0 ? "+" : "") + v.toFixed(2) + "%", up: v >= 0 };
  }

  function renderTable(elId, rows, toCells) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!rows.length) { renderTableError(elId); return; }
    const trs = rows.map((r) => {
      const [label, val, delta] = toCells(r);
      const deltaHtml = delta && typeof delta === "object"
        ? `<span class="${delta.up ? "up" : "down"}">${escapeHtml(delta.text)}</span>`
        : `<span class="muted">${escapeHtml(delta || "")}</span>`;
      return `<tr><td class="lbl">${escapeHtml(label)}</td><td class="num">${escapeHtml(val)}</td><td class="num">${deltaHtml}</td></tr>`;
    }).join("");
    el.innerHTML = `<table class="dtable"><tbody>${trs}</tbody></table>`;
  }

  function renderTableError(elId) {
    const el = document.getElementById(elId);
    if (el && !el.dataset.filled) el.innerHTML = `<div class="loading-line">indisponible</div>`;
  }

  function renderTicker() {
    const track = document.getElementById("ticker-track");
    if (!track || !tickerItems.length) return;
    const doubled = [...tickerItems, ...tickerItems].map(
      (t) => `<div class="tick-item"><span class="lbl">${escapeHtml(t.label)}</span><span>${escapeHtml(t.value)}</span><span class="${t.up ? "up" : "down"}">${escapeHtml(t.delta)}</span></div>`
    ).join("");
    track.innerHTML = doubled;
  }

  /* ------------------------------------------------------------ Jauge de risque */

  function renderThreat(vixPrice) {
    const valueEl = document.getElementById("threat-value");
    if (!valueEl) return;
    const label = THREAT_LEVELS[STATE.threatLevel];
    valueEl.textContent = label + (vixPrice != null ? ` (VIX ${vixPrice.toFixed(1)})` : "");
    const colors = ["var(--low)", "var(--low)", "var(--med)", "var(--high)", "var(--crit)"];
    valueEl.style.color = colors[STATE.threatLevel];
  }

  /* ------------------------------------------------------------ Statut global + sources */

  function updateGlobalStatus() {
    const dot = document.getElementById("global-dot");
    const label = document.getElementById("global-status");
    const statuses = Object.values(STATE.sourceStatus);
    const anyLive = statuses.includes("live");
    const allOffline = statuses.length > 0 && statuses.every((s) => s === "offline");
    dot.className = "dot " + (allOffline ? "off" : anyLive ? "on" : "warn");
    label.textContent = allOffline ? "HORS LIGNE" : anyLive ? "EN DIRECT" : "CACHE";
  }

  function renderSources() {
    const el = document.getElementById("sources");
    if (!el) return;
    const engineLabel = { finnhub: "Finnhub", proxy: "Google Actu. (proxy)", archive: "Archive locale" }[STATE.newsEngine] || "…";
    const rows = [
      ["Actualités", engineLabel],
      ["Crypto", STATE.sourceStatus.crypto || "…"],
      ["Change", STATE.sourceStatus.fx || "…"],
      ["Indices", STATE.sourceStatus.indices || "…"],
      ["VIX", STATE.sourceStatus.vix || "…"],
      ["Clé Finnhub", getFinnhubKey() ? "configurée" : "absente (voir console)"],
    ];
    el.innerHTML = `<table class="dtable"><tbody>${rows.map(([k, v]) => `<tr><td class="lbl">${escapeHtml(k)}</td><td class="num muted">${escapeHtml(v)}</td></tr>`).join("")}</tbody></table>`;
  }

  /* ------------------------------------------------------------ Flux d'actualités */

  const IMPACT_CLASS = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };
  const IMPACT_LABEL_FR = { CRITICAL: "CRIT", HIGH: "ÉLEV", MEDIUM: "MOY", LOW: "FAIB" };
  let activeFilter = "TOUS";
  let currentFeed = [];

  function renderFilters() {
    const row = document.getElementById("filter-row");
    if (!row) return;
    const cats = ["TOUS", ...new Set(currentFeed.map((f) => f.category))];
    row.innerHTML = cats.map((c) =>
      `<button class="filter-chip${c === activeFilter ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");
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
    const items = activeFilter === "TOUS" ? currentFeed : currentFeed.filter((f) => f.category === activeFilter);
    if (!items.length) {
      list.innerHTML = `<div class="loading-line">aucune dépêche pour ce filtre</div>`;
      return;
    }
    list.innerHTML = items.map((item) => `
      <div class="frow" data-id="${escapeHtml(item.id)}">
        <span class="f-time">${escapeHtml(item.time)}</span>
        <span class="f-impact tag-lvl ${IMPACT_CLASS[item.impact] || "low"}">${IMPACT_LABEL_FR[item.impact] || item.impact}</span>
        <span class="f-cat">${escapeHtml(item.category)}</span>
        <span class="f-head">${escapeHtml(item.headline)}</span>
        <span class="f-src">${escapeHtml(item.source)}</span>
      </div>`
    ).join("");
    list.querySelectorAll(".frow").forEach((row) => {
      row.addEventListener("click", () => {
        const item = currentFeed.find((f) => f.id === row.dataset.id);
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
      ${item.link && item.link !== "#" ? `<div><a class="brief-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">lire l'article complet ↗</a></div>` : ""}
    `;
    overlay.classList.add("open");
    document.getElementById("brief-close").addEventListener("click", closeBrief);
  }
  function closeBrief() { document.getElementById("brief-overlay").classList.remove("open"); }

  async function refreshFeed() {
    const statusEl = document.getElementById("feed-status");
    try {
      currentFeed = await fetchIntelFeed();
      renderFilters();
      renderFeed();
      const engineLabel = { finnhub: "Finnhub", proxy: "Google Actualités" }[STATE.newsEngine] || "direct";
      statusEl.innerHTML = `<i class="dot on"></i>${currentFeed.length} dépêches — ${engineLabel}`;
    } catch (e) {
      STATE.sourceStatus.news = "offline";
      if (!currentFeed.length) {
        currentFeed = FALLBACK_FEED;
        STATE.newsEngine = "archive";
        renderFilters();
        renderFeed();
      }
      statusEl.innerHTML = `<i class="dot off"></i>hors ligne — archive locale`;
    }
    renderSources();
    updateGlobalStatus();
  }

  /* ------------------------------------------------------------ Agenda macro */

  function renderWatchlist() {
    const el = document.getElementById("watchlist");
    if (!el) return;
    const rows = WATCHLIST.map((w, i) =>
      `<tr><td class="lbl" title="${escapeHtml(w.tag)}">${escapeHtml(w.label)}</td><td class="num" id="watch-timer-${i}">--j</td></tr>`
    ).join("");
    el.innerHTML = `<table class="dtable"><tbody>${rows}</tbody></table>`;
    updateCountdowns();
    setInterval(updateCountdowns, 1000);
  }

  function updateCountdowns() {
    WATCHLIST.forEach((w, i) => {
      const el = document.getElementById(`watch-timer-${i}`);
      if (!el) return;
      const diff = new Date(w.target).getTime() - Date.now();
      if (diff <= 0) { el.textContent = "EN COURS"; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      el.textContent = d > 0 ? `${d}j ${h}h` : `${h}h ${m}m`;
    });
  }

  /* ------------------------------------------------------------ Points chauds */

  function renderHotspots() {
    const el = document.getElementById("hotspots");
    if (!el) return;
    const cls = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };
    const rows = HOTSPOTS.map((h) =>
      `<tr><td class="lbl" title="${escapeHtml(h.note)}">${escapeHtml(h.name)}</td><td class="num"><span class="tag-lvl ${cls[h.level] || "med"}">${escapeHtml(h.level)}</span></td></tr>`
    ).join("");
    el.innerHTML = `<table class="dtable"><tbody>${rows}</tbody></table>`;
  }

  /* ------------------------------------------------------------ Journal système + console */

  function pushLog(text) {
    const log = document.getElementById("term-log");
    if (!log) return;
    const line = document.createElement("div");
    line.textContent = text;
    log.appendChild(line);
    while (log.children.length > 8) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function runTerminalLog() {
    let i = 0;
    pushLog("terminal prêt.");
    setInterval(() => { pushLog(TERMINAL_LOG_LINES[i % TERMINAL_LOG_LINES.length]); i++; }, 5000);
  }

  const COMMANDS = {
    aide: () => [
      "commandes : aide, statut, actualiser, niveau, cle <clé finnhub>, effacer, propos",
    ],
    statut: () => {
      const s = STATE.sourceStatus;
      return [
        `actualités : ${STATE.newsEngine || "…"}`,
        `crypto : ${s.crypto || "…"} · change : ${s.fx || "…"} · indices : ${s.indices || "…"} · vix : ${s.vix || "…"}`,
        `clé finnhub : ${getFinnhubKey() ? "configurée" : "absente"}`,
      ];
    },
    actualiser: () => { refreshAll(); return ["resynchronisation lancée."]; },
    niveau: () => [
      `niveau actuel : ${THREAT_LEVELS[STATE.threatLevel]}`,
      "seuils VIX : <14 FAIBLE · 14-19 SURVEILLÉ · 19-25 ÉLEVÉ · 25-35 SÉVÈRE · >35 CRITIQUE",
    ],
    cle: (arg) => {
      if (!arg) return [`clé finnhub actuelle : ${getFinnhubKey() ? "configurée (masquée)" : "absente"}`, "usage : cle VOTRE_CLE  (obtenir une clé gratuite sur finnhub.io/register)"];
      setFinnhubKey(arg);
      refreshAll();
      return ["clé enregistrée localement (ce navigateur uniquement). resynchronisation en cours..."];
    },
    effacer: () => { const log = document.getElementById("term-log"); if (log) log.innerHTML = ""; return []; },
    propos: () => [
      "INTEL MARCHÉS // CLASSIFIÉ — veille financière temps réel.",
      "sources : Finnhub (ou Google Actualités en repli), CoinGecko, Frankfurter/BCE, Yahoo Finance.",
      "pas un conseil en investissement.",
    ],
  };

  function runCommand(raw) {
    const [cmd, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(" ");
    pushLog(`root@intel-marches:~$ ${raw}`);
    if (!cmd) return;
    const fn = COMMANDS[cmd.toLowerCase()];
    if (!fn) { pushLog(`commande inconnue : "${cmd}" — tapez "aide"`); return; }
    (fn(arg) || []).forEach(pushLog);
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
    await Promise.allSettled([refreshMarkets(), refreshFeed()]);
  }

  /* ------------------------------------------------------------ Initialisation */

  async function init() {
    runClock();
    setSessionId();
    renderWatchlist();
    renderHotspots();
    runTerminalLog();
    wireTerminalInput();
    renderSources();

    if (!getFinnhubKey()) {
      pushLog('astuce : "cle VOTRE_CLE" avec une clé gratuite de finnhub.io/register pour des actualités garanties.');
    }

    await refreshAll();

    document.getElementById("brief-overlay").addEventListener("click", (e) => {
      if (e.target.id === "brief-overlay") closeBrief();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBrief(); });

    setInterval(refreshMarkets, 60_000);
    setInterval(refreshFeed, 5 * 60_000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
