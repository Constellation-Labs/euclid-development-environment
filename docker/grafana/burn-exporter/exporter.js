'use strict';
// Prometheus exporter for the burn demo. The metagraph nodes do NOT emit supply/burn
// metrics, so this sidecar polls the metagraph L0 HTTP API and exposes them in
// Prometheus text format for Grafana. Pure Node (global fetch, node:20) — no deps.
const http = require('http');

const META = process.env.META_L0_URL || 'http://172.60.0.10:8200';
const METAGRAPH_ID = process.env.METAGRAPH_ID || '';
const PORT = Number(process.env.PORT || 9464);

let totalSupply = 0;
let supplyOrdinal = 0;
let metaBalance = 0;
let burnedTotal = 0;
let burnEvents = 0;
let latestOrdinal = 0;
let lastScanned = -1;

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function poll() {
  try {
    const s = await getJson(`${META}/currency/total-supply`);
    totalSupply = Number(s.total) || 0;
    supplyOrdinal = Number(s.ordinal) || 0;
  } catch (_) {}

  if (METAGRAPH_ID) {
    try {
      const b = await getJson(`${META}/currency/${METAGRAPH_ID}/balance`);
      metaBalance = Number(b.balance) || 0;
    } catch (_) {}
  }

  // Scan new snapshots for BurnActions (artifacts live at value.artifacts as
  // { "BurnAction": { "burnTransactions": [{ amount, source, currencyId }] } }).
  try {
    const latest = await getJson(`${META}/snapshots/latest`);
    // /snapshots/latest returns { value: { ordinal, ... }, proofs }; /snapshots/{n} is the same shape.
    latestOrdinal = Number((latest.value && latest.value.ordinal) ?? latest.ordinal) || 0;
    // Start at ordinal 1: the genesis snapshot (ordinal 0) isn't served and would break the scan.
    for (let o = Math.max(1, lastScanned + 1); o <= latestOrdinal; o++) {
      let snap;
      try {
        snap = await getJson(`${META}/snapshots/${o}`);
      } catch (_) {
        break; // transient — retry this ordinal on the next poll, don't miss a burn
      }
      const arts = (snap.value && snap.value.artifacts) || snap.artifacts || [];
      for (const a of arts) {
        const ba = a && a.BurnAction;
        if (ba && Array.isArray(ba.burnTransactions)) {
          for (const tx of ba.burnTransactions) {
            burnedTotal += Number(tx.amount) || 0;
            burnEvents += 1;
          }
        }
      }
      lastScanned = o;
    }
  } catch (_) {}
}

setInterval(poll, 8000);
poll();

http
  .createServer((req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(
        [
          '# HELP burn_demo_total_supply_datum Token total supply in datum (1e8 = 1 token)',
          '# TYPE burn_demo_total_supply_datum gauge',
          `burn_demo_total_supply_datum ${totalSupply}`,
          '# HELP burn_demo_metagraph_balance_datum Metagraph (currencyId) address balance in datum',
          '# TYPE burn_demo_metagraph_balance_datum gauge',
          `burn_demo_metagraph_balance_datum ${metaBalance}`,
          '# HELP burn_demo_burned_datum_total Cumulative datum burned across all observed BurnActions',
          '# TYPE burn_demo_burned_datum_total counter',
          `burn_demo_burned_datum_total ${burnedTotal}`,
          '# HELP burn_demo_burn_events_total Number of burn transactions observed',
          '# TYPE burn_demo_burn_events_total counter',
          `burn_demo_burn_events_total ${burnEvents}`,
          '# HELP burn_demo_supply_ordinal Currency snapshot ordinal of the latest supply reading',
          '# TYPE burn_demo_supply_ordinal gauge',
          `burn_demo_supply_ordinal ${supplyOrdinal}`,
          '# HELP burn_demo_latest_ordinal Latest metagraph snapshot ordinal scanned',
          '# TYPE burn_demo_latest_ordinal gauge',
          `burn_demo_latest_ordinal ${latestOrdinal}`,
          '',
        ].join('\n'),
      );
    } else if (req.url === '/healthz') {
      res.writeHead(200);
      res.end('ok');
    } else {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(PORT, () => console.log(`burn-exporter on :${PORT}, polling ${META}`));
