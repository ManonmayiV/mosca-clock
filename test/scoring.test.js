import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessWorkload, assessInventory, estimateOverhead, normaliseWorkload, latestSafeCrqcYear, formatBytes,
} from '../src/scoring.js';
import { SAMPLE_INVENTORY, TEMPLATES } from '../src/templates.js';
import { buildMarkdownReport } from '../src/report.js';

const A = { crqcYear: 2035, currentYear: 2026 }; // z = 9

const base = {
  id: 't', name: 'test', keyExchange: 'X25519', signature: 'ECDSA-P256', symmetric: 'AES-256-GCM',
  shelfLifeYears: 1, migrationYears: 1, sensitivity: 2, internetFacing: false,
};

test('critical when shelf life alone exceeds the quantum timeline (harvest now, decrypt later)', () => {
  const r = assessWorkload({ ...base, shelfLifeYears: 10, migrationYears: 0 }, A);
  assert.equal(r.z, 9);
  assert.equal(r.harvestNowGap, 1);
  assert.equal(r.status, 'critical');
});

test('high when x + y > z but y <= z', () => {
  const r = assessWorkload({ ...base, shelfLifeYears: 7, migrationYears: 3 }, A);
  assert.equal(r.moscaGap, 1);
  assert.equal(r.status, 'high');
});

test('x + y == z is not a failure; it lands in the medium margin', () => {
  const r = assessWorkload({ ...base, shelfLifeYears: 6, migrationYears: 3 }, A);
  assert.equal(r.moscaGap, 0);
  assert.equal(r.status, 'medium');
});

test('low when there is room beyond the margin', () => {
  const r = assessWorkload({ ...base, shelfLifeYears: 2, migrationYears: 1 }, A);
  assert.equal(r.status, 'low');
});

test('ready when key exchange and signature are quantum-safe', () => {
  const r = assessWorkload({ ...base, keyExchange: 'X25519MLKEM768', signature: 'ML-DSA-65', shelfLifeYears: 50 }, A);
  assert.equal(r.status, 'ready');
  assert.equal(r.moscaGap, null);
});

test('signatures are not harvestable: long shelf life does not matter, only x vs z', () => {
  const sigOnly = { ...base, keyExchange: 'none', symmetric: 'none', signature: 'RSA-3072', shelfLifeYears: 30 };
  assert.equal(assessWorkload({ ...sigOnly, migrationYears: 2 }, A).status, 'low');
  const late = assessWorkload({ ...sigOnly, migrationYears: 10 }, A);
  assert.equal(late.signatureGap, 1);
  assert.equal(late.status, 'medium');
});

test('unknown crypto is treated as vulnerable and asks the user to find out', () => {
  const r = assessWorkload({ ...base, keyExchange: 'made-up', signature: 'unknown' }, A);
  assert.equal(r.kexVulnerable, true);
  assert.ok(r.actions.some((a) => a.startsWith('Find out which key exchange')));
  assert.equal(r.overhead, null);
});

test('moving the CRQC year later can only improve or keep a status', () => {
  const rank = { ready: 0, low: 1, medium: 2, high: 3, critical: 4 };
  for (const w of SAMPLE_INVENTORY) {
    let prev = Infinity;
    for (let year = 2027; year <= 2050; year++) {
      const s = rank[assessWorkload(w, { crqcYear: year, currentYear: 2026 }).status];
      assert.ok(s <= prev, `${w.name} got worse at ${year}`);
      prev = s;
    }
  }
});

test('internet-facing and sensitivity raise priority', () => {
  const lo = assessWorkload({ ...base, shelfLifeYears: 7, migrationYears: 3, sensitivity: 1 }, A).priority;
  const hi = assessWorkload({ ...base, shelfLifeYears: 7, migrationYears: 3, sensitivity: 3, internetFacing: true }, A).priority;
  assert.ok(hi > lo);
});

test('overhead uses FIPS 203 / 204 sizes', () => {
  const o = estimateOverhead({ ...base, handshakesPerDay: 1000 });
  // before: X25519 32+32, ECDSA-P256 64+64 = 192
  // after: X25519MLKEM768 1216+1120, ML-DSA-65 1952+3309 = 7597
  assert.equal(o.beforeBytes, 192);
  assert.equal(o.afterBytes, 7597);
  assert.equal(o.perHandshakeBytes, 7405);
  assert.equal(o.perDayBytes, 7405000);
});

test('long-lived roots are pointed at SLH-DSA', () => {
  const r = assessWorkload({ ...base, keyExchange: 'none', signature: 'RSA-3072', longLivedRoot: true }, A);
  assert.ok(r.actions.some((a) => a.includes('SLH-DSA-SHA2-128s')));
});

test('latestSafeCrqcYear', () => {
  assert.equal(latestSafeCrqcYear({ ...base, shelfLifeYears: 5, migrationYears: 2 }, 2026), 2033);
  assert.equal(latestSafeCrqcYear({ ...base, keyExchange: 'ML-KEM-768' }, 2026), null);
});

test('normaliseWorkload rejects missing names and clamps bad numbers', () => {
  assert.throws(() => normaliseWorkload({ name: '  ' }), /no name/);
  const w = normaliseWorkload({ name: 'x', shelfLifeYears: -5, migrationYears: 'abc', sensitivity: 9, keyExchange: '<script>' });
  assert.equal(w.shelfLifeYears, 0);
  assert.equal(w.migrationYears, 0);
  assert.equal(w.sensitivity, 3);
  assert.equal(w.keyExchange, 'unknown');
});

test('every template uses known algorithm keys', () => {
  for (const [key, t] of Object.entries(TEMPLATES)) {
    const w = normaliseWorkload({ name: key, ...t });
    assert.equal(w.keyExchange, t.keyExchange, key);
    assert.equal(w.signature, t.signature, key);
    assert.equal(w.symmetric, t.symmetric, key);
  }
});

test('sample inventory produces a mix of statuses at 2035', () => {
  const { counts, results } = assessInventory(SAMPLE_INVENTORY, A);
  assert.equal(results.length, 6);
  assert.ok(counts.critical >= 1);
  assert.equal(counts.ready, 1);
  for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].priority >= results[i].priority);
});

test('markdown report escapes names and lists every workload', () => {
  const assessed = assessInventory([{ ...base, name: 'a | b <img>' }], A);
  const md = buildMarkdownReport(assessed, A, new Date('2026-11-19T00:00:00Z'));
  assert.ok(md.includes('a \\| b \\<img\\>'));
  assert.ok(md.includes('Generated 2026-11-19'));
});

test('formatBytes', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(7405), '7.4 KB');
  assert.equal(formatBytes(7405000), '7.41 MB');
  assert.equal(formatBytes(null), 'unknown');
});
