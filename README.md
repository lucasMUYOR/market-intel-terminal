# MARKET INTEL // CLASSIFIED

A "classified intelligence terminal" styled dashboard for tracking news that
moves financial markets — built to feel like the black-ops-briefing look of
geopolitics-explainer video content (glitch title, scanlines, matrix rain,
redacted headlines, a DEFCON-style risk gauge, a hotspot map, a live ticker,
and a scrolling system log) while staying genuinely useful: category filters,
a catalyst countdown watchlist, and expandable briefs for each headline.

**This is a front-end shell with sample data.** Wire it to a real feed in a
few minutes — see "Going live" below.

## Run it

No build step. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What's inside

```
index.html          Page structure
assets/style.css     Visual system (colors, glitch/scanline/matrix FX, layout)
assets/script.js      Behavior: boot sequence, ticker, threat gauge, feed
                       rendering, countdowns, map, terminal log
assets/data.js         Sample data + fetchIntelFeed() — the one function to
                       replace with a real API call
```

## Going live: plugging in a real news feed

Everything renders from the array returned by `fetchIntelFeed()` in
`assets/data.js`. Replace the sample implementation with a real call, as long
as you resolve to an array shaped like `SAMPLE_FEED`:

```js
async function fetchIntelFeed() {
  const res = await fetch("https://your-api-or-proxy/news");
  const raw = await res.json();
  return raw.map(item => ({
    id: item.id,
    category: item.category,       // e.g. "CENTRAL BANKS", "GEOPOLITICS", "ENERGY"
    impact: item.impact,           // "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    time: item.time,
    source: item.source,
    headline: item.headline,
    brief: item.summary,
    tags: item.tags,
  }));
}
```

Options for a real source:

- **NewsAPI.org** — broad headline coverage, free tier for dev.
- **Finnhub market news** — finance-specific, has a free tier.
- **GNews** — simple headline API.
- **Alpha Vantage News & Sentiment** — includes a sentiment score you could
  map to `impact`.
- Any RSS feed (Reuters, Bloomberg, central bank press releases) — proxy it
  through a small serverless function to avoid CORS issues and to keep your
  API key off the client.

Because most news APIs require a server-side key (CORS + secrecy), the
cleanest setup is a tiny proxy (Cloudflare Worker, Vercel/Netlify function,
or a one-route Express app) that `fetchIntelFeed()` calls — keeping this
static front end deployable as-is on GitHub Pages while the proxy does the
real fetching.

The **ticker** (`SAMPLE_TICKER`), **watchlist** (`WATCHLIST`), and **hotspot
map** (`HOTSPOTS`) in `assets/data.js` are separate arrays — wire each to a
market-data API (e.g. a quotes endpoint) or an economic calendar API
independently of the news feed.

## Deploying

Static site, so GitHub Pages works out of the box:

```bash
# from the repo root, on the branch you want published
git checkout -b gh-pages
git push origin gh-pages
```

Then enable Pages for that branch in the repo settings.

## Disclaimer

Sample data ships with the repo for demo purposes and is fictional. This is
a UI shell, not a licensed data product — treat any content as
situational-awareness inspiration, not investment advice, until you've wired
in real, licensed sources.
