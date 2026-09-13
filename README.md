# INTEL MARCHÉS // CLASSIFIÉ

A classified-intelligence-terminal styled dashboard (glitch title, scanlines,
matrix rain, a DEFCON-style risk gauge, a hotspot map, a live ticker, and an
interactive command-line console) for tracking news and data that moves
financial markets. **The site's UI is in French.** This README (developer
docs) is in English.

Unlike the first version, this one is wired to **real, live public data** —
no sample placeholders in production:

| Data | Source | Notes |
|---|---|---|
| Headlines (8 categories) | Google Actualités (RSS), `hl=fr` | Real, clickable, refreshed every 5 min |
| Crypto prices (BTC/ETH/SOL/XRP) | CoinGecko | Real, refreshed every 60 s |
| FX rates (EUR→USD/GBP/JPY/CHF) | Frankfurter.dev (ECB reference rates) | Real, daily |
| Indices, VIX, oil, gold | Yahoo Finance chart API | Real, refreshed every 60 s |
| Risk gauge | Computed live from the VIX | Not a fixed value — see thresholds below |
| Macro calendar (Fed/ECB/NFP/CPI) | Hardcoded, but from verified real dates | See sources at the bottom of `data.js` |
| Hotspot map | Curated editorial list | Static — not a live feed |

No API keys required for any of this — all sources are free, public, no-auth
endpoints. That's also the one real caveat, explained below.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Architecture

```
index.html          Page structure (French UI strings)
assets/style.css     Visual system + the new terminal-console input styling
assets/script.js      Rendering, refresh loops, VIX-based risk gauge,
                       command-line console (aide/statut/actualiser/...)
assets/data.js         All data fetching: proxy chain, caching, per-source
                       fetchXxx() functions, the hardcoded macro calendar
```

### Why a CORS proxy chain?

Google News RSS, and Yahoo Finance's chart API, don't send
`Access-Control-Allow-Origin` headers, so a browser can't call them directly
from a static site. `assets/data.js` routes those two sources through a
small chain of free public CORS proxies (`api.allorigins.win`,
`api.codetabs.com`, `cors.eu.org`), tried in order, each with a timeout and
one retry pass. CoinGecko and Frankfurter.dev *do* send proper CORS headers,
so those are called directly — no proxy needed.

**These proxies are free, third-party, and have no uptime guarantee.** In
testing they mostly worked well, but occasionally returned 500s or briefly
rate-limited under bursts of concurrent requests. The code defends against
this on three levels:

1. **A global concurrency semaphore** (`PROXY_CONCURRENCY = 2` in
   `data.js`) — at most 2 proxy requests are ever in flight at once, across
   *all* features combined, so indices and news don't stampede the proxy
   together on page load.
2. **`localStorage` caching per source** — a successful fetch is cached;
   if the next live fetch fails, the last good value (up to a few hours
   old) is served instead, and the UI marks it "CACHE" rather than "EN
   DIRECT".
3. **A tiny bundled French fallback feed** (`FALLBACK_FEED` in `data.js`)
   — shown only if both the live fetch and the cache are empty (e.g. first
   visit, proxies down), clearly labeled `ARCHIVE LOCALE` so it's never
   mistaken for live content.

For a production deployment where reliability matters more, swap the proxy
chain for a small serverless function you control (Cloudflare Worker,
Vercel/Netlify function) that fetches these feeds server-side — same shape
of data, no dependency on third-party CORS proxies.

### The console

The "CONSOLE SYSTÈME" panel is a real command line, not just decoration.
Type into it:

- `aide` — list commands
- `statut` — live/cache/offline status of every data source
- `actualiser` — force a full resync
- `niveau` — explains the current risk level and its VIX thresholds
- `matrice` — toggles the matrix-rain intensity
- `effacer` — clears the console
- `propos` — about this terminal

### Risk gauge thresholds (VIX-based)

```
VIX < 14        → FAIBLE      (LOW)
14 ≤ VIX < 19   → SURVEILLÉ   (GUARDED)
19 ≤ VIX < 25   → ÉLEVÉ       (ELEVATED)
25 ≤ VIX < 35   → SÉVÈRE      (HIGH)
VIX ≥ 35        → CRITIQUE    (SEVERE)
```

### Macro calendar dates

Hardcoded in `WATCHLIST` (`assets/data.js`) because these are pre-announced
official dates, not something that needs live polling. Verified against:
- [federalreserve.gov — FOMC meeting calendars](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
- [ecb.europa.eu — Governing Council meeting schedule](https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html)
- [bls.gov — CPI release schedule](https://www.bls.gov/schedule/news_release/cpi.htm)

Update these manually a few times a year when new schedules are published.

## Deploying

Static site, so GitHub Pages works out of the box — see repo Settings →
Pages → Deploy from branch.

## Disclaimer

This aggregates real public headlines and market data for situational
awareness — it is not a licensed data terminal and not investment advice.
Google News RSS results reflect whatever Google's index surfaces for each
query; always check the linked source before acting on anything.
