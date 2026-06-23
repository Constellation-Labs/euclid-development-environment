/* eslint-disable no-console */
/**
 * Live token-burn demonstration driver for the local Euclid cluster running the
 * burn-enabled tessellation (feat/l0-burn-transaction).
 *
 * Flow:
 *   1. Read metagraph ID + endpoints.
 *   2. Query BEFORE: metagraph-address balance + token total-supply.
 *   3. Fund the metagraph's own currency address with a normal currency transfer
 *      (from a genesis-funded wallet) — needed because the metagraph address is a
 *      hash of the genesis content and so cannot be pre-allocated in genesis.csv.
 *   4. Submit a signed BurnRequest data update to the metagraph data-L1. The data
 *      application combine emits a native no-ref self-burn BurnAction (source ==
 *      the metagraph currency address) into the snapshot's sharedArtifacts.
 *   5. Query AFTER: balance + total-supply, confirm both dropped by the burned amount.
 *
 * Env vars:
 *   METAGRAPH_ID         - the metagraph currency address (DAG...) (genesis.address)
 *   SOURCE_PRIVATE_KEY   - hex private key of a genesis-funded wallet (funds the metagraph)
 *   GLOBAL_L0_URL        - default http://localhost:9000
 *   META_L0_URL          - default http://localhost:9200
 *   CURRENCY_L1_URL      - default http://localhost:9300
 *   DATA_L1_URL          - default http://localhost:9400
 *   FUND_AMOUNT          - whole-token amount to send to metagraph addr (default 5000)
 *   BURN_AMOUNT          - datum (1e-8) amount to burn (default 100000000000 = 1000 tokens)
 */

const { dag4 } = require("@stardust-collective/dag4");
const jsSha256 = require("js-sha256");
const jsSha512 = require("js-sha512");
const EC = require("elliptic");
const axios = require("axios");

const curve = new EC.ec("secp256k1");

const METAGRAPH_ID = process.env.METAGRAPH_ID;
const SOURCE_PRIVATE_KEY = process.env.SOURCE_PRIVATE_KEY;
const GLOBAL_L0_URL = process.env.GLOBAL_L0_URL || "http://localhost:9000";
const META_L0_URL = process.env.META_L0_URL || "http://localhost:9200";
const CURRENCY_L1_URL = process.env.CURRENCY_L1_URL || "http://localhost:9300";
const DATA_L1_URL = process.env.DATA_L1_URL || "http://localhost:9400";
const FUND_AMOUNT = Number(process.env.FUND_AMOUNT || 5000); // whole tokens
const BURN_AMOUNT = Number(process.env.BURN_AMOUNT || 100000000000); // datum (1000 tokens)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fmt = (datum) =>
  datum == null ? "null" : `${datum} (= ${(datum / 1e8).toLocaleString()} tokens)`;

async function getBalance(address) {
  try {
    const r = await axios.get(`${META_L0_URL}/currency/${address}/balance`, {
      timeout: 10000,
    });
    return { balance: Number(r.data.balance), ordinal: Number(r.data.ordinal) };
  } catch (e) {
    if (e.response && e.response.status === 404) return { balance: 0, ordinal: null };
    throw e;
  }
}

async function getTotalSupply() {
  try {
    const r = await axios.get(`${META_L0_URL}/currency/total-supply`, { timeout: 10000 });
    return { total: Number(r.data.total), ordinal: Number(r.data.ordinal) };
  } catch (e) {
    if (e.response && e.response.status === 404) return { total: null, ordinal: null };
    throw e;
  }
}

async function getLatestSnapshotOrdinal() {
  try {
    const r = await axios.get(`${META_L0_URL}/snapshots/latest`, { timeout: 10000 });
    return Number(r.data?.value?.ordinal ?? r.data?.ordinal);
  } catch (e) {
    return null;
  }
}

/** Wait until the metagraph L0 snapshot ordinal advances past `fromOrdinal`. */
async function waitForSnapshotAdvance(fromOrdinal, label, maxWaitMs = 120000) {
  const start = Date.now();
  let last = fromOrdinal;
  while (Date.now() - start < maxWaitMs) {
    const cur = await getLatestSnapshotOrdinal();
    if (cur != null && cur > fromOrdinal) {
      console.log(`  [${label}] snapshot advanced ${fromOrdinal} -> ${cur}`);
      return cur;
    }
    if (cur !== last) {
      last = cur;
    }
    await sleep(3000);
  }
  console.log(`  [${label}] WARN: snapshot did not advance past ${fromOrdinal} within ${maxWaitMs}ms`);
  return await getLatestSnapshotOrdinal();
}

// ---- Signed data update (BurnRequest) per metagraph-examples recipe ----
const serializeHex = (obj) =>
  Buffer.from(JSON.stringify(obj), "utf8").toString("hex");

const signDataUpdate = (privateKeyHex, message) => {
  const serialized = serializeHex(message);
  const hash = jsSha256.sha256(Buffer.from(serialized, "hex"));
  const ecSig = curve.sign(jsSha512.sha512(hash), Buffer.from(privateKeyHex, "hex"));
  return Buffer.from(ecSig.toDER()).toString("hex");
};

async function submitBurnRequest(privateKeyHex, amountDatum) {
  const account = dag4.createAccount();
  account.loginPrivateKey(privateKeyHex);
  const publicKey = account.publicKey;
  const uncompressed = publicKey.length === 128 ? "04" + publicKey : publicKey;

  const message = { amount: amountDatum };
  const signature = signDataUpdate(privateKeyHex, message);

  const body = {
    value: { ...message },
    proofs: [{ id: uncompressed.substring(2), signature }],
  };

  console.log(`  POST ${DATA_L1_URL}/data  body=${JSON.stringify(body)}`);
  const r = await axios.post(`${DATA_L1_URL}/data`, body, { timeout: 15000 });
  console.log(`  -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

// ---- Funding: currency transfer to the metagraph's own address ----
async function fundMetagraphAddress(privateKeyHex, destination, wholeTokens) {
  const account = dag4.createAccount();
  account.loginPrivateKey(privateKeyHex);
  account.connect(
    { id: "main", networkVersion: "2.0", l0Url: GLOBAL_L0_URL, testnet: false },
    false
  );

  const metagraphClient = account.createMetagraphTokenClient({
    id: METAGRAPH_ID,
    l0Url: META_L0_URL,
    l1Url: CURRENCY_L1_URL,
    metagraphId: METAGRAPH_ID,
    beUrl: "",
    networkVersion: "2.0",
    testnet: false,
  });

  console.log(`  Funding ${destination} with ${wholeTokens} tokens from ${account.address}`);
  const pending = await metagraphClient.transfer(destination, wholeTokens, 0);
  console.log(`  -> transfer submitted: ${JSON.stringify(pending)}`);
  return pending;
}

async function main() {
  if (!METAGRAPH_ID) throw new Error("METAGRAPH_ID env var required");
  if (!SOURCE_PRIVATE_KEY) throw new Error("SOURCE_PRIVATE_KEY env var required");

  console.log("============================================================");
  console.log(" LIVE TOKEN BURN DEMO");
  console.log("============================================================");
  console.log(` Metagraph ID (currency address): ${METAGRAPH_ID}`);
  console.log(` Global L0:   ${GLOBAL_L0_URL}`);
  console.log(` Meta L0:     ${META_L0_URL}`);
  console.log(` Currency L1: ${CURRENCY_L1_URL}`);
  console.log(` Data L1:     ${DATA_L1_URL}`);
  console.log(` Fund amount: ${FUND_AMOUNT} tokens`);
  console.log(` Burn amount: ${fmt(BURN_AMOUNT)}`);
  console.log("");

  // --- Step 1: fund the metagraph address so it has something to burn ---
  console.log("STEP 1: Fund the metagraph's own currency address");
  let ord = await getLatestSnapshotOrdinal();
  await fundMetagraphAddress(SOURCE_PRIVATE_KEY, METAGRAPH_ID, FUND_AMOUNT);
  ord = await waitForSnapshotAdvance(ord, "post-fund");
  await waitForSnapshotAdvance(ord, "post-fund-settle"); // one more to settle balance

  // --- Step 2: capture BEFORE state ---
  console.log("\nSTEP 2: Capture BEFORE state");
  const balBefore = await getBalance(METAGRAPH_ID);
  const supBefore = await getTotalSupply();
  console.log(`  BEFORE metagraph-address balance: ${fmt(balBefore.balance)} (ordinal ${balBefore.ordinal})`);
  console.log(`  BEFORE total-supply:              ${fmt(supBefore.total)} (ordinal ${supBefore.ordinal})`);

  // --- Step 3: submit BurnRequest -> emits BurnAction self-burn ---
  console.log("\nSTEP 3: Submit BurnRequest data update (emits native BurnAction)");
  const ordBeforeBurn = await getLatestSnapshotOrdinal();
  await submitBurnRequest(SOURCE_PRIVATE_KEY, BURN_AMOUNT);
  let ordAfter = await waitForSnapshotAdvance(ordBeforeBurn, "post-burn");
  ordAfter = await waitForSnapshotAdvance(ordAfter, "post-burn-settle");

  // --- Step 4: capture AFTER state ---
  console.log("\nSTEP 4: Capture AFTER state");
  const balAfter = await getBalance(METAGRAPH_ID);
  const supAfter = await getTotalSupply();
  console.log(`  AFTER metagraph-address balance:  ${fmt(balAfter.balance)} (ordinal ${balAfter.ordinal})`);
  console.log(`  AFTER total-supply:               ${fmt(supAfter.total)} (ordinal ${supAfter.ordinal})`);

  // --- Step 5: verdict ---
  console.log("\n============================================================");
  console.log(" RESULT");
  console.log("============================================================");
  const balDelta = balBefore.balance - balAfter.balance;
  const supDelta = (supBefore.total ?? 0) - (supAfter.total ?? 0);
  console.log(` balance  delta: ${fmt(balDelta)}`);
  console.log(` supply   delta: ${fmt(supDelta)}`);
  console.log(` expected burn:  ${fmt(BURN_AMOUNT)}`);
  const ok = balDelta === BURN_AMOUNT && supDelta === BURN_AMOUNT;
  console.log(ok ? " ✅ BURN CONFIRMED: balance & total-supply each dropped by the burned amount." : " ⚠️  Deltas did not exactly match — inspect output above.");

  // machine-readable summary
  console.log("\nJSON_SUMMARY=" + JSON.stringify({
    metagraphId: METAGRAPH_ID,
    burnAmount: BURN_AMOUNT,
    balanceBefore: balBefore, balanceAfter: balAfter, balanceDelta: balDelta,
    supplyBefore: supBefore, supplyAfter: supAfter, supplyDelta: supDelta,
    confirmed: ok,
  }));
}

main().catch((e) => {
  console.error("DEMO ERROR:", e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message);
  process.exit(1);
});
