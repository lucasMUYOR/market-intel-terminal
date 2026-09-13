# INTEL MARCHÉS // CLASSIFIÉ

A dense, minimal financial-intelligence terminal — flat black, monospace,
tables instead of glossy cards, an auto-scrolling ticker, and a real
interactive command-line console. **The site's UI is in French.** This
README (developer docs) is in English.

No sample placeholders in production — everything renders from real, live
public data:

| Data | Source | Notes |
|---|---|---|
| Headlines (4 categories) | **Finnhub** if a free API key is set, else Google Actualités (RSS) via proxy | Real, clickable, refreshed every 5 min |
| Crypto prices (BTC/ETH/SOL/XRP) | CoinGecko | Real, refreshed every 60 s, no key |
| FX rates (EUR→USD/GBP/JPY/CHF) | Frankfurter.dev (ECB reference rates) | Real, daily, no key |
| Indices/commodities | Finnhub (ETF proxies: SPY/QQQ/DIA/GLD/USO) if key set, else Yahoo Finance via proxy | Real, refreshed every 60 s |
| VIX / risk gauge | Yahoo Finance via proxy, dedicated single request | Computed live — see thresholds below |
| Macro calendar (Fed/ECB/NFP/CPI) | Hardcoded, from verified real dates | See sources at the bottom of this doc |
| Hotspot table | Curated editorial list | Static, not a live feed |

## Get a free Finnhub key (recommended — fixes news reliability)

The single biggest reliability issue this project has is that **Google News
RSS and Yahoo Finance don't send CORS headers**, so a static site can't call
them directly — this build routes around that with a chain of free public
CORS proxies, and those proxies have no uptime guarantee. In testing, all
three went down simultaneously more than once.

**Finnhub (finnhub.io) is a real API built for direct browser calls** — it
sends `Access-Control-Allow-Origin: *` on every response, no proxy needed,
so it doesn't share that failure mode. Free tier, no credit card, 60
requests/minute:

1. Sign up at **https://finnhub.io/register** (30 seconds)
2. Copy your API key from the dashboard
3. Open the site, click into the console at the bottom, and type:
   ```
   cle VOTRE_CLE_ICI
   ```
4. It's saved in that browser's `localStorage` — never sent anywhere except
   directly to Finnhub — and the terminal resyncs immediately using it for
   both news and market quotes.

Without a key, the terminal still works via the free proxy-routed fallback,
but expect it to occasionally show the "ARCHIVE LOCALE" fallback feed when
the public proxies are having a bad day (they periodically are).

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Architecture

```
index.html          Page structure (French UI strings), dense 3-column grid
assets/style.css     Flat/minimal terminal styling — no gradients, glow,
                       rounded corners, or decorative animation
assets/script.js      Rendering, refresh loops, VIX-based risk gauge,
                       command-line console (aide/statut/actualiser/cle/...)
assets/data.js         All data fetching: Finnhub, CoinGecko, Frankfurter,
                       Yahoo-via-proxy fallback, caching, the macro calendar
```

### Reliability layers (why it should never look "empty")

1. **Finnhub first, when a key is configured** — a real CORS-enabled API,
   not scraped through a proxy, so it just works.
2. **Google Actualités via a proxy chain as fallback** — 3 public CORS
   proxies (`api.allorigins.win`, `api.codetabs.com`, `cors.eu.org`), tried
   in order, each with a timeout and one retry pass, and a global
   concurrency semaphore (`PROXY_CONCURRENCY = 2` in `data.js`) so no more
   than 2 proxy requests are ever in flight at once across the whole page.
3. **`localStorage` caching per source** — a successful fetch is cached; if
   the next live fetch fails, the last good value is served instead and the
   UI marks it accordingly.
4. **A tiny bundled French fallback feed** (`FALLBACK_FEED` in `data.js`) —
   shown only if live *and* cache are both empty, clearly labeled `ARCHIVE
   LOCALE` so it's never mistaken for live content.

For a production deployment where reliability matters even more, swap the
proxy fallback for a small serverless function you control (Cloudflare
Worker, Vercel/Netlify function) — same shape of data, zero dependency on
third-party CORS proxies.

### The console

The console panel at the bottom is a real command line:

- `aide` — list commands
- `statut` — live/cache/offline status of every data source
- `actualiser` — force a full resync
- `niveau` — explains the current risk level and its VIX thresholds
- `cle <clé>` — set your Finnhub API key (see above)
- `effacer` — clears the console
- `propos` — about this terminal

### Risk gauge thresholds (real VIX)

```
VIX < 14        → FAIBLE      (LOW)
14 ≤ VIX < 19   → SURVEILLÉ   (GUARDED)
19 ≤ VIX < 25   → ÉLEVÉ       (ELEVATED)
25 ≤ VIX < 35   → SÉVÈRE      (HIGH)
VIX ≥ 35        → CRITIQUE    (SEVERE)
```
Fetched as a single dedicated request (not bundled with the indices table)
to stay light on the proxy chain — it's the one number the risk gauge needs.

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
Finnhub/Google News results reflect whatever each source surfaces for each
query/category; always check the linked source before acting on anything.
The indices table uses liquid ETFs (SPY, QQQ, DIA, GLD, USO) as proxies for
the underlying indices/commodities when using Finnhub's free tier, which
doesn't include raw index quotes.
