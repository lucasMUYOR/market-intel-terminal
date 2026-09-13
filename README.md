# INTEL MARCHÉS // CLASSIFIÉ

A dense, minimal financial-intelligence terminal — flat black, monospace,
tables instead of glossy cards, an auto-scrolling ticker, and a real
interactive command-line console. **The site's UI is in French.** This
README (developer docs) is in English.

No sample placeholders in production — everything renders from real, live
public data:

| Data | Source (priority order) | Notes |
|---|---|---|
| Headlines | **Marketaux** (FR, real sentiment) → **Finnhub** (EN) → Google Actualités via proxy → local archive | Real, clickable, refreshed every 5 min |
| Crypto prices (BTC/ETH/SOL/XRP) | CoinGecko | Real, refreshed every 60 s, no key |
| FX rates (EUR→USD/GBP/JPY/CHF) | Frankfurter.dev (ECB reference rates) | Real, daily, no key |
| Indices/commodities | **Twelve Data** (real indices) → Finnhub (ETF proxies) → Yahoo Finance via proxy | Real, refreshed every 60 s |
| VIX / risk gauge | Yahoo Finance via proxy, dedicated single request | Computed live — see thresholds below |
| Macro calendar (Fed/ECB/NFP/CPI) | Hardcoded, from verified real dates | See sources at the bottom of this doc |
| Hotspot table | Curated editorial list | Static, not a live feed |

None of the three optional keys (Finnhub, Twelve Data, Marketaux) are
required — the site works without any of them via the proxy fallback. Each
one just removes a specific weak point.

## Optional API keys (each fixes a specific weak point)

All three follow the same pattern: free signup, no credit card, then set the
key from the site's own console (bottom of the page) — never edit a file or
touch git for this, the key is stored only in that browser's `localStorage`
and sent only to that provider's API.

```
cle <service> <clé>        # ex: cle marketaux abcd1234...
cle <clé>                  # sans nom de service = finnhub (raccourci historique)
```

| Service | Fixes | Sign up | Free tier |
|---|---|---|---|
| **Marketaux** | News in *native* French (not Google's French-language index) + a real per-article sentiment score used for the impact level | [marketaux.com](https://www.marketaux.com) | 100 req/day |
| **Finnhub** | News reliability in general (proper CORS, no proxy) + ETF-proxy indices | [finnhub.io/register](https://finnhub.io/register) | 60 req/min |
| **Twelve Data** | Real index values (S&P 500 itself, not the SPY ETF) | [twelvedata.com/pricing](https://twelvedata.com/pricing) | 800 req/day, 8/min |

Priority when several are set: Marketaux > Finnhub for news; Twelve Data >
Finnhub > Yahoo-proxy for indices. Set just one, some, or all three.

### Why Finnhub was the first one added (fixes news reliability)

The single biggest reliability issue this project has is that **Google News
RSS and Yahoo Finance don't send CORS headers**, so a static site can't call
them directly — this build routes around that with a chain of free public
CORS proxies, and those proxies have no uptime guarantee. In testing, all
three went down simultaneously more than once.

**Finnhub is a real API built for direct browser calls** — it sends
`Access-Control-Allow-Origin: *` on every response, no proxy needed, so it
doesn't share that failure mode. Same is true of Marketaux and Twelve Data
(all three verified live during development — see git history for the raw
`curl` checks).

Without any key, the terminal still works via the free proxy-routed
fallback, but expect it to occasionally show the "ARCHIVE LOCALE" fallback
feed when the public proxies are having a bad day (they periodically are).

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
assets/data.js         All data fetching: Marketaux/Finnhub/Twelve Data,
                       CoinGecko, Frankfurter, Yahoo-via-proxy fallback,
                       caching, the macro calendar
```

### Reliability layers (why it should never look "empty")

1. **A keyed API first, in priority order, when configured** — Marketaux
   then Finnhub for news, Twelve Data then Finnhub for indices. These are
   real CORS-enabled APIs, not scraped through a proxy, so they just work
   as long as the key is valid and the free-tier quota isn't exhausted.
2. **Google Actualités / Yahoo Finance via a proxy chain as fallback** — 3
   public CORS proxies (`api.allorigins.win`, `api.codetabs.com`,
   `cors.eu.org`), tried in order, each with a timeout and one retry pass,
   and a global concurrency semaphore (`PROXY_CONCURRENCY = 2` in
   `data.js`) so no more than 2 proxy requests are ever in flight at once
   across the whole page.
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
- `cle [service] <clé>` — set an API key; `service` is `finnhub` (default),
  `twelvedata`, or `marketaux`
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
