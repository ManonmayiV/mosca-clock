// Mosca Clock scoring model.
//
// Mosca's inequality: if x + y > z, data protected today is at risk.
//   x = years needed to migrate a system to quantum-safe cryptography
//   y = years the data must stay confidential (its "shelf life")
//   z = years until a cryptographically relevant quantum computer (CRQC) exists
//
// Key establishment (RSA, ECDH, X25519) is exposed to "harvest now, decrypt later":
// traffic recorded today can be decrypted once a CRQC exists.
// Signatures (RSA, ECDSA, Ed25519) are not harvestable. They only fail once a CRQC
// exists, so the question for them is whether migration finishes before z (x > z).
//
// This file has no DOM access so the same code runs in the browser and in Node tests.

// Sizes in bytes. Sources: FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA),
// RFC 7748 (X25519), SEC 1 (P-256 uncompressed point), draft-ietf-tls-ecdhe-mlkem
// (X25519MLKEM768 hybrid key shares).
export const KEY_EXCHANGE = {
  'RSA-2048':        { label: 'RSA-2048 key transport', quantumSafe: false, clientBytes: 256,  serverBytes: 256 },
  'ECDHE-P256':      { label: 'ECDHE P-256',            quantumSafe: false, clientBytes: 65,   serverBytes: 65 },
  'X25519':          { label: 'X25519',                 quantumSafe: false, clientBytes: 32,   serverBytes: 32 },
  'X25519MLKEM768':  { label: 'X25519MLKEM768 (hybrid)', quantumSafe: true, clientBytes: 1216, serverBytes: 1120 },
  'ML-KEM-768':      { label: 'ML-KEM-768',             quantumSafe: true,  clientBytes: 1184, serverBytes: 1088 },
  'ML-KEM-1024':     { label: 'ML-KEM-1024',            quantumSafe: true,  clientBytes: 1568, serverBytes: 1568 },
  'none':            { label: 'None (no data in transit)', quantumSafe: true, clientBytes: 0,  serverBytes: 0, notApplicable: true },
  'unknown':         { label: 'Unknown',                quantumSafe: false, clientBytes: null, serverBytes: null, unknown: true },
};

export const SIGNATURE = {
  'RSA-2048':          { label: 'RSA-2048',            quantumSafe: false, publicKeyBytes: 256,  signatureBytes: 256 },
  'RSA-3072':          { label: 'RSA-3072',            quantumSafe: false, publicKeyBytes: 384,  signatureBytes: 384 },
  'ECDSA-P256':        { label: 'ECDSA P-256',         quantumSafe: false, publicKeyBytes: 64,   signatureBytes: 64 },
  'Ed25519':           { label: 'Ed25519',             quantumSafe: false, publicKeyBytes: 32,   signatureBytes: 64 },
  'ML-DSA-44':         { label: 'ML-DSA-44',           quantumSafe: true,  publicKeyBytes: 1312, signatureBytes: 2420 },
  'ML-DSA-65':         { label: 'ML-DSA-65',           quantumSafe: true,  publicKeyBytes: 1952, signatureBytes: 3309 },
  'ML-DSA-87':         { label: 'ML-DSA-87',           quantumSafe: true,  publicKeyBytes: 2592, signatureBytes: 4627 },
  'SLH-DSA-SHA2-128s': { label: 'SLH-DSA-SHA2-128s',   quantumSafe: true,  publicKeyBytes: 32,   signatureBytes: 7856 },
  'none':              { label: 'None',                quantumSafe: true,  publicKeyBytes: 0,    signatureBytes: 0, notApplicable: true },
  'unknown':           { label: 'Unknown',             quantumSafe: false, publicKeyBytes: null, signatureBytes: null, unknown: true },
};

export const SYMMETRIC = {
  'AES-256-GCM':       { label: 'AES-256-GCM',        level: 'ok' },
  'ChaCha20-Poly1305': { label: 'ChaCha20-Poly1305',  level: 'ok' },
  'AES-128-GCM':       { label: 'AES-128-GCM',        level: 'advisory' },
  '3DES':              { label: '3DES',               level: 'weak' },
  'none':              { label: 'None',               level: 'ok', notApplicable: true },
  'unknown':           { label: 'Unknown',            level: 'advisory', unknown: true },
};

// Recommended replacements, used for the migration plan and the size comparison.
export const RECOMMENDED = {
  keyExchange: 'X25519MLKEM768',
  keyExchangeHighAssurance: 'ML-KEM-1024',
  signature: 'ML-DSA-65',
  signatureLongLivedRoot: 'SLH-DSA-SHA2-128s',
  symmetric: 'AES-256-GCM',
};

export const STATUS = {
  critical: { rank: 4, weight: 4, label: 'Critical', summary: 'Traffic sent today is already harvestable: it must stay secret longer than the quantum timeline.' },
  high:     { rank: 3, weight: 3, label: 'High',     summary: 'Mosca inequality fails: migration time plus shelf life is longer than the quantum timeline.' },
  medium:   { rank: 2, weight: 2, label: 'Medium',   summary: 'Inside the safety margin, or signatures will still be classical when a CRQC arrives.' },
  low:      { rank: 1, weight: 1, label: 'Low',      summary: 'Quantum-vulnerable, but the timeline currently leaves room to migrate.' },
  ready:    { rank: 0, weight: 0, label: 'Ready',    summary: 'All recorded cryptography is quantum-safe.' },
};

export const SAFETY_MARGIN_YEARS = 2;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Assess one workload against a CRQC year.
 * @param {object} w workload
 * @param {{crqcYear:number,currentYear:number}} assumptions
 */
export function assessWorkload(w, { crqcYear, currentYear }) {
  const kex = KEY_EXCHANGE[w.keyExchange] ?? KEY_EXCHANGE.unknown;
  const sig = SIGNATURE[w.signature] ?? SIGNATURE.unknown;
  const sym = SYMMETRIC[w.symmetric] ?? SYMMETRIC.unknown;

  const x = clamp(num(w.migrationYears), 0, 50);
  const y = clamp(num(w.shelfLifeYears), 0, 100);
  const z = num(crqcYear) - num(currentYear);
  const sensitivity = clamp(Math.round(num(w.sensitivity, 2)), 1, 3);

  const kexVulnerable = !kex.quantumSafe;
  const sigVulnerable = !sig.quantumSafe;

  // Positive gap = years of exposure.
  const harvestNowGap = kexVulnerable ? y - z : null;     // data sent today
  const moscaGap = kexVulnerable ? x + y - z : null;      // data sent until migration completes
  const signatureGap = sigVulnerable ? x - z : null;      // forgeable signatures still in use

  let status;
  if (!kexVulnerable && !sigVulnerable) status = 'ready';
  else if (kexVulnerable && harvestNowGap > 0) status = 'critical';
  else if (kexVulnerable && moscaGap > 0) status = 'high';
  else if ((kexVulnerable && moscaGap > -SAFETY_MARGIN_YEARS) || (sigVulnerable && signatureGap > -SAFETY_MARGIN_YEARS)) status = 'medium';
  else status = 'low';

  const exposureYears = Math.max(0, moscaGap ?? -Infinity, signatureGap ?? -Infinity);
  const internetFactor = w.internetFacing ? 1.5 : 1;
  const priority = Math.round((STATUS[status].weight * sensitivity * internetFactor + exposureYears) * 10) / 10;

  return {
    id: w.id,
    name: w.name,
    x, y, z, sensitivity,
    kex, sig, sym,
    kexVulnerable, sigVulnerable,
    harvestNowGap, moscaGap, signatureGap,
    exposureYears,
    status,
    priority,
    actions: buildActions(w, { kex, sig, sym, kexVulnerable, sigVulnerable, harvestNowGap, moscaGap, signatureGap, x, y, z }),
    overhead: estimateOverhead(w),
  };
}

function buildActions(w, a) {
  const actions = [];
  if (a.kex.unknown) {
    actions.push('Find out which key exchange this flow uses. Unknown crypto is treated as quantum-vulnerable.');
  }
  if (a.kexVulnerable) {
    if (a.harvestNowGap > 0) {
      actions.push(`Treat as already exposed: data must stay secret ${a.y} years but the assumed quantum timeline is ${a.z} years. Reduce what crosses this link, or add a quantum-safe layer now.`);
    }
    actions.push(`Move key exchange from ${a.kex.label} to ${KEY_EXCHANGE[RECOMMENDED.keyExchange].label} in TLS 1.3. Use ${KEY_EXCHANGE[RECOMMENDED.keyExchangeHighAssurance].label} where policy requires CNSA 2.0.`);
    if (a.x > 0 && a.moscaGap > 0) {
      actions.push(`Cut migration time. Every year shaved off the ${a.x}-year plan removes a year of harvestable traffic.`);
    }
  }
  if (a.sig.unknown) {
    actions.push('Find out which signature algorithm protects this flow or artifact.');
  }
  if (a.sigVulnerable) {
    const target = w.longLivedRoot ? RECOMMENDED.signatureLongLivedRoot : RECOMMENDED.signature;
    actions.push(`Replace ${a.sig.label} signatures with ${SIGNATURE[target].label}${a.signatureGap > 0 ? ' before the CRQC year: at the current plan, signatures would be forgeable for ' + a.signatureGap + ' year(s)' : ''}.`);
  }
  if (a.sym.level === 'weak') {
    actions.push(`${a.sym.label} is weak even without a quantum computer. Replace it with ${RECOMMENDED.symmetric} now.`);
  } else if (a.sym.level === 'advisory' && !a.sym.notApplicable) {
    actions.push(`${a.sym.label}: Grover's algorithm halves effective key strength. Plan a move to ${RECOMMENDED.symmetric} (required by CNSA 2.0).`);
  }
  if (actions.length === 0) {
    actions.push('No action needed. Re-check when the inventory or assumptions change.');
  }
  return actions;
}

/**
 * Bytes added per TLS handshake (key shares + one certificate public key and signature)
 * if the workload moves to the recommended algorithms. Returns null when unknown.
 */
export function estimateOverhead(w) {
  const kex = KEY_EXCHANGE[w.keyExchange] ?? KEY_EXCHANGE.unknown;
  const sig = SIGNATURE[w.signature] ?? SIGNATURE.unknown;
  const targetKex = kex.quantumSafe ? kex : KEY_EXCHANGE[RECOMMENDED.keyExchange];
  const targetSig = sig.quantumSafe ? sig : SIGNATURE[w.longLivedRoot ? RECOMMENDED.signatureLongLivedRoot : RECOMMENDED.signature];

  if (kex.clientBytes == null || sig.signatureBytes == null) return null;

  const before = kex.clientBytes + kex.serverBytes + sig.publicKeyBytes + sig.signatureBytes;
  const after = targetKex.clientBytes + targetKex.serverBytes + targetSig.publicKeyBytes + targetSig.signatureBytes;
  const perHandshake = after - before;
  const handshakesPerDay = Math.max(0, num(w.handshakesPerDay));
  return {
    beforeBytes: before,
    afterBytes: after,
    perHandshakeBytes: perHandshake,
    perDayBytes: perHandshake * handshakesPerDay,
    handshakesPerDay,
  };
}

/** Assess every workload and return them sorted by priority (highest first). */
export function assessInventory(workloads, assumptions) {
  const results = workloads.map((w) => assessWorkload(w, assumptions));
  results.sort((a, b) => b.priority - a.priority || STATUS[b.status].rank - STATUS[a.status].rank || a.name.localeCompare(b.name));
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0]));
  for (const r of results) counts[r.status] += 1;
  return { results, counts };
}

/** The earliest CRQC year at which a workload's Mosca inequality still holds (x + y <= z). */
export function latestSafeCrqcYear(w, currentYear) {
  const kex = KEY_EXCHANGE[w.keyExchange] ?? KEY_EXCHANGE.unknown;
  if (kex.quantumSafe) return null;
  return currentYear + clamp(num(w.migrationYears), 0, 50) + clamp(num(w.shelfLifeYears), 0, 100);
}

export function formatBytes(n) {
  if (n == null) return 'unknown';
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1e9) return `${sign}${(v / 1e9).toFixed(2)} GB`;
  if (v >= 1e6) return `${sign}${(v / 1e6).toFixed(2)} MB`;
  if (v >= 1e3) return `${sign}${(v / 1e3).toFixed(1)} KB`;
  return `${sign}${v} B`;
}

/** Validate and normalise imported data. Throws on anything malformed. */
export function normaliseWorkload(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new Error(`Workload ${index + 1} is not an object.`);
  const name = String(raw.name ?? '').trim().slice(0, 120);
  if (!name) throw new Error(`Workload ${index + 1} has no name.`);
  const pick = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? key : 'unknown');
  return {
    id: String(raw.id ?? `w${Date.now().toString(36)}${index}`).slice(0, 40),
    name,
    template: String(raw.template ?? 'custom').slice(0, 40),
    keyExchange: pick(KEY_EXCHANGE, raw.keyExchange),
    signature: pick(SIGNATURE, raw.signature),
    symmetric: pick(SYMMETRIC, raw.symmetric),
    shelfLifeYears: clamp(num(raw.shelfLifeYears), 0, 100),
    migrationYears: clamp(num(raw.migrationYears), 0, 50),
    sensitivity: clamp(Math.round(num(raw.sensitivity, 2)), 1, 3),
    internetFacing: Boolean(raw.internetFacing),
    longLivedRoot: Boolean(raw.longLivedRoot),
    handshakesPerDay: clamp(num(raw.handshakesPerDay), 0, 1e12),
    notes: String(raw.notes ?? '').slice(0, 500),
  };
}
