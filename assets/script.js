/* ==========================================================================
   MARKET INTEL // CLASSIFIED — behavior layer
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------ Boot sequence */

  const BOOT_LINES = [
    "INITIALIZING MARKET INTEL TERMINAL v2.6",
    "----------------------------------------------------",
    "> establishing secure uplink ..................... OK",
    "> loading wire services ........................... OK",
    "> loading central bank comms channel .............. OK",
    "> loading geopolitical risk index ................. OK",
    "> loading options flow monitor .................... OK",
    "> decrypting classified briefing feed ............. OK",
    "----------------------------------------------------",
    "CLEARANCE VERIFIED — WELCOME, ANALYST",
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
      const speed = line.startsWith(">") ? 8 : 2;
      const iv = setInterval(() => {
        text += line[ci];
        el.textContent = text;
        ci++;
        if (ci >= line.length) {
          clearInterval(iv);
          text += "\n";
          el.textContent = text;
          li++;
          setTimeout(typeLine, 90);
        }
      }, speed);
    }
    typeLine();
  }

  /* ------------------------------------------------------------ Matrix rain */

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

  /* ------------------------------------------------------------ Clock */

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
    const id = "ANON-" + Math.floor(1000 + Math.random() * 9000);
    el.textContent = id;
  }

  /* ------------------------------------------------------------ Ticker */

  function renderTicker() {
    const track = document.getElementById("ticker-track");
    if (!track) return;
    const items = [...SAMPLE_TICKER, ...SAMPLE_TICKER]
      .map(
        (t) => `
      <div class="tick-item">
        <span class="lbl">${t.label}</span>
        <span class="val">${t.value}</span>
        <span class="delta ${t.up ? "up" : "down"}">${t.up ? "▲" : "▼"} ${t.delta}</span>
      </div>`
      )
      .join("");
    track.innerHTML = items;
  }

  /* ------------------------------------------------------------ Threat gauge */

  function renderThreat() {
    const wrap = document.getElementById("threat-segments");
    const valueEl = document.getElementById("threat-value");
    if (!wrap) return;
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
    valueEl.textContent = label;
    valueEl.style.color = colors[STATE.threatLevel];
  }

  /* ------------------------------------------------------------ Feed */

  const IMPACT_CLASS = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };
  let activeFilter = "ALL";
  let currentFeed = [];

  function impactClass(impact) {
    return IMPACT_CLASS[impact] || "low";
  }

  function maybeRedact(headline) {
    // purely cosmetic: turn a bracketed [REDACTED] token into a hoverable blackout bar
    return headline.replace(/\[REDACTED\]/g, '<span class="redact">REDACTED_VALUE</span>');
  }

  function renderFilters() {
    const row = document.getElementById("filter-row");
    if (!row) return;
    const cats = ["ALL", ...new Set(currentFeed.map((f) => f.category))];
    row.innerHTML = cats
      .map(
        (c) =>
          `<button class="filter-chip${c === activeFilter ? " active" : ""}" data-cat="${c}">${c}</button>`
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
      activeFilter === "ALL"
        ? currentFeed
        : currentFeed.filter((f) => f.category === activeFilter);

    list.innerHTML = items
      .map(
        (item) => `
      <article class="card ${impactClass(item.impact)}" data-id="${item.id}">
        <div class="card-top">
          <span class="card-cat">${item.category}</span>
          <span class="impact-pill ${impactClass(item.impact)}">${item.impact}</span>
        </div>
        <div class="card-headline">${maybeRedact(item.headline)}</div>
        <div class="card-tags">
          ${item.tags.map((t) => `<span class="tag">#${t}</span>`).join("")}
          <span class="tag" style="margin-left:auto;color:var(--text-faint)">${item.time} · ${item.source}</span>
        </div>
      </article>`
      )
      .join("");

    list.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("redact")) return; // let redact-hover-reveal work without opening modal
        const item = currentFeed.find((f) => f.id === card.dataset.id);
        if (item) openBrief(item);
      });
    });
  }

  function openBrief(item) {
    const overlay = document.getElementById("brief-overlay");
    const card = document.getElementById("brief-card");
    card.innerHTML = `
      <div class="brief-close" id="brief-close">✕ CLOSE</div>
      <div class="brief-meta">${item.category} · ${item.source} · ${item.time}</div>
      <h3>${maybeRedact(item.headline)}</h3>
      <div class="brief-body">${maybeRedact(item.brief)}</div>
      <div class="brief-stamp">CLASSIFIED</div>
    `;
    overlay.classList.add("open");
    document.getElementById("brief-close").addEventListener("click", closeBrief);
  }
  function closeBrief() {
    document.getElementById("brief-overlay").classList.remove("open");
  }

  /* ------------------------------------------------------------ Watchlist */

  function renderWatchlist() {
    const wrap = document.getElementById("watchlist");
    if (!wrap) return;
    wrap.innerHTML = WATCHLIST.map(
      (w, i) => `
      <div class="watch-item" data-target="${w.target}" data-idx="${i}">
        <div class="watch-top">
          <span>${w.label}</span>
          <span class="watch-tag">${w.tag}</span>
        </div>
        <div class="watch-timer" id="watch-timer-${i}">--:--:--:--</div>
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
        el.textContent = "LIVE NOW";
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    });
  }

  /* ------------------------------------------------------------ Map */

  function renderMap() {
    const wrap = document.getElementById("map-wrap");
    if (!wrap) return;

    const dots = HOTSPOTS.map((h) => {
      const cls = h.level === "CRITICAL" ? "" : h.level === "HIGH" ? "high" : "medium";
      return `
        <g class="hotspot ${cls}" transform="translate(${h.x} ${h.y})">
          <title>${h.name} — ${h.note}</title>
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
        <span><i class="legend-dot" style="background:var(--red)"></i>CRITICAL</span>
        <span><i class="legend-dot" style="background:var(--high)"></i>HIGH</span>
        <span><i class="legend-dot" style="background:var(--amber)"></i>MEDIUM</span>
      </div>
    `;
  }

  // Cheap "world" texture: a scattered dot-grid silhouette suggestion, not a real
  // map (keeps this file dependency-free). It reads as a tactical radar/grid.
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

  /* ------------------------------------------------------------ Terminal log */

  function runTerminalLog() {
    const log = document.getElementById("term-log");
    if (!log) return;
    let i = 0;
    function pushLine() {
      const line = document.createElement("div");
      line.textContent = TERMINAL_LOG_LINES[i % TERMINAL_LOG_LINES.length];
      log.appendChild(line);
      while (log.children.length > 8) log.removeChild(log.firstChild);
      i++;
    }
    pushLine();
    setInterval(pushLine, 2600);
  }

  /* ------------------------------------------------------------ Init */

  async function init() {
    runBoot();
    runMatrixRain();
    runClock();
    setSessionId();
    renderTicker();
    renderThreat();
    renderWatchlist();
    renderMap();
    runTerminalLog();

    currentFeed = await fetchIntelFeed();
    renderFilters();
    renderFeed();

    document.getElementById("brief-overlay").addEventListener("click", (e) => {
      if (e.target.id === "brief-overlay") closeBrief();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrief();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
