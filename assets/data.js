/* ==========================================================================
   DATA LAYER — SAMPLE / DEMO FEED
   --------------------------------------------------------------------------
   This file is intentionally isolated from rendering logic (script.js).
   Replace `fetchIntelFeed()` with a real call to a news/market API and the
   rest of the terminal keeps working unchanged, as long as you resolve to
   an array of objects shaped like the SAMPLE_FEED entries below.

   Suggested real sources (need your own API key, see README):
     - NewsAPI.org            https://newsapi.org
     - Finnhub (market news)  https://finnhub.io/docs/api/market-news
     - GNews                  https://gnews.io
     - Alpha Vantage News     https://www.alphavantage.co/documentation/#news-sentiment
     - Any RSS feed, proxied through a CORS-friendly endpoint you control
   ========================================================================== */

const THREAT_LEVELS = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"];

const STATE = {
  threatLevel: 3, // index into THREAT_LEVELS -> "HIGH"
};

const SAMPLE_TICKER = [
  { label: "S&P 500", value: "6,481.20", delta: "+0.34%", up: true },
  { label: "NASDAQ", value: "21,904.55", delta: "+0.61%", up: true },
  { label: "DOW", value: "44,918.02", delta: "-0.12%", up: false },
  { label: "US10Y", value: "4.18%", delta: "+3bp", up: true },
  { label: "DXY", value: "103.42", delta: "-0.22%", up: false },
  { label: "WTI CRUDE", value: "$71.85", delta: "+1.94%", up: true },
  { label: "GOLD", value: "$3,412.10", delta: "+0.87%", up: true },
  { label: "BTC/USD", value: "$71,240", delta: "-2.15%", up: false },
  { label: "VIX", value: "18.62", delta: "+6.3%", up: true },
  { label: "EUR/USD", value: "1.0871", delta: "+0.09%", up: true },
  { label: "NIKKEI 225", value: "39,884", delta: "+0.44%", up: true },
  { label: "NATGAS", value: "$2.91", delta: "-1.05%", up: false },
];

const SAMPLE_FEED = [
  {
    id: "f-001",
    category: "CENTRAL BANKS",
    impact: "CRITICAL",
    time: "T-00:04:12",
    source: "WIRE // FOMC",
    headline: "Fed signals split on pace of cuts as core inflation prints hot for third month",
    brief:
      "Minutes reveal a divided committee. Futures now price a 58% chance of a hold in the next meeting, down from 74% a week ago. Rate-sensitive sectors (housing, small caps) are the fastest movers.",
    tags: ["RATES", "USD", "EQUITIES"],
  },
  {
    id: "f-002",
    category: "GEOPOLITICS",
    impact: "HIGH",
    time: "T-00:11:47",
    source: "SIGINT // REGIONAL DESK",
    headline: "Tanker traffic through the Strait of Hormuz reroutes amid naval buildup",
    brief:
      "Insurance premiums on Gulf shipping routes jump. Brent-WTI spread widens. Watch energy majors and airline fuel hedges for second-order moves.",
    tags: ["OIL", "SHIPPING", "ENERGY"],
  },
  {
    id: "f-003",
    category: "TRADE",
    impact: "MEDIUM",
    time: "T-00:22:03",
    source: "WIRE // TRADE DESK",
    headline: "New semiconductor export controls floated, targeting advanced-node equipment",
    brief:
      "Draft language still under interagency review. Chip equipment makers and foundries most exposed; downstream device makers see muted reaction so far.",
    tags: ["SEMIS", "SUPPLY-CHAIN", "CHINA"],
  },
  {
    id: "f-004",
    category: "CRYPTO",
    impact: "MEDIUM",
    time: "T-00:31:55",
    source: "ON-CHAIN // MONITOR",
    headline: "Large exchange wallet moves $[REDACTED] in BTC to cold storage",
    brief:
      "On-chain analytics flag the transfer as consistent with routine custody rotation, not a sell signal — but derivatives desks are already repricing short-dated vol.",
    tags: ["BTC", "DERIVATIVES", "VOLATILITY"],
  },
  {
    id: "f-005",
    category: "ENERGY",
    impact: "HIGH",
    time: "T-00:38:29",
    source: "WIRE // OPEC WATCH",
    headline: "OPEC+ delegates float larger-than-expected output increase for next quarter",
    brief:
      "If confirmed, this reverses months of restraint. Crude futures curve flattening; refiners and energy-heavy currencies (CAD, NOK, RUB proxies) in focus.",
    tags: ["OPEC", "CRUDE", "FX"],
  },
  {
    id: "f-006",
    category: "EQUITIES",
    impact: "MEDIUM",
    time: "T-00:47:14",
    source: "WIRE // EARNINGS DESK",
    headline: "Mega-cap cloud provider beats on revenue, guides capex sharply higher for AI buildout",
    brief:
      "Street reaction split between margin-compression worries and top-line acceleration. Power/utility names tied to data-center demand rally in sympathy.",
    tags: ["AI", "CAPEX", "MEGACAP"],
  },
  {
    id: "f-007",
    category: "GEOPOLITICS",
    impact: "CRITICAL",
    time: "T-00:55:02",
    source: "SIGINT // ELECTIONS DESK",
    headline: "Snap election called in key eurozone member state, coalition math uncertain",
    brief:
      "Sovereign CDS spreads widen intraday. Domestic banks and utilities most rate-sensitive to fiscal policy uncertainty. EUR crosses whip on headline algo triggers.",
    tags: ["EUR", "SOVEREIGN-RISK", "POLITICS"],
  },
  {
    id: "f-008",
    category: "COMMODITIES",
    impact: "LOW",
    time: "T-01:08:41",
    source: "WIRE // AG DESK",
    headline: "Weather models shift favorable for key grain belt, yield estimates revised up",
    brief:
      "Front-month grain futures ease. Limited cross-asset spillover expected barring confirmation from next USDA report.",
    tags: ["AGRICULTURE", "WEATHER"],
  },
  {
    id: "f-009",
    category: "CENTRAL BANKS",
    impact: "MEDIUM",
    time: "T-01:19:56",
    source: "WIRE // ECB WATCH",
    headline: "ECB officials push back on market pricing for near-term easing",
    brief:
      "Hawkish repricing across the front end of the EUR curve. Peripheral spreads (BTP-Bund) tick wider on reduced cut expectations.",
    tags: ["ECB", "EUR", "RATES"],
  },
  {
    id: "f-010",
    category: "CYBER",
    impact: "HIGH",
    time: "T-01:34:10",
    source: "SIGINT // CYBER DESK",
    headline: "Financial-sector clearing utility discloses attempted intrusion, no funds affected",
    brief:
      "Disclosure timed with market close to limit reaction. Cybersecurity names see relative-strength bid; affected utility's counterparties reviewing exposure.",
    tags: ["CYBERSECURITY", "INFRASTRUCTURE"],
  },
];

const WATCHLIST = [
  { label: "FOMC RATE DECISION", target: "2026-09-17T18:00:00Z", tag: "RATES" },
  { label: "US CPI (AUG)", target: "2026-09-16T12:30:00Z", tag: "INFLATION" },
  { label: "OPEC+ MEETING", target: "2026-09-20T09:00:00Z", tag: "ENERGY" },
  { label: "ECB PRESS CONFERENCE", target: "2026-09-24T12:45:00Z", tag: "RATES" },
  { label: "US NONFARM PAYROLLS", target: "2026-10-02T12:30:00Z", tag: "LABOR" },
];

const HOTSPOTS = [
  { name: "STRAIT OF HORMUZ", x: 63.5, y: 44, note: "Oil shipping chokepoint — naval activity elevated", level: "HIGH" },
  { name: "TAIWAN STRAIT", x: 79.5, y: 46, note: "Semiconductor supply-chain risk corridor", level: "MEDIUM" },
  { name: "WASHINGTON D.C.", x: 27, y: 34, note: "Fed / fiscal policy nexus", level: "CRITICAL" },
  { name: "BRUSSELS", x: 47.5, y: 27, note: "ECB policy + EU fiscal coordination", level: "MEDIUM" },
  { name: "SUEZ CANAL", x: 54, y: 42, note: "Global trade chokepoint", level: "MEDIUM" },
  { name: "SOUTH CHINA SEA", x: 77, y: 51, note: "Maritime trade route tension", level: "MEDIUM" },
  { name: "MOSCOW", x: 56, y: 24, note: "Energy export policy risk", level: "HIGH" },
];

const TERMINAL_LOG_LINES = [
  "connecting to wire services... OK",
  "authenticating market data handshake... OK",
  "streaming central bank comms channel...",
  "cross-referencing headline vs. futures tape...",
  "scanning options flow for anomalous skew...",
  "correlating sovereign CDS with FX crosses...",
  "flagging keyword cluster: [rates, inflation, hawkish]...",
  "flagging keyword cluster: [oil, strait, shipping]...",
  "updating global risk index...",
  "no anomalies detected in clearing infrastructure...",
  "resyncing threat level gauge...",
  "archive checkpoint written...",
];

/**
 * Swap this for a real fetch() to a live news/market API.
 * Must resolve to an array shaped like SAMPLE_FEED.
 */
async function fetchIntelFeed() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(SAMPLE_FEED), 400);
  });
}
