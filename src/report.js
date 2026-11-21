import { STATUS, formatBytes } from './scoring.js';

function mdEscape(s) {
  return String(s).replace(/([\\`*_{}\[\]<>|#])/g, '\\$1');
}

/** Build a Markdown migration report from assessInventory() output. Pure function. */
export function buildMarkdownReport({ results, counts }, { crqcYear, currentYear }, generatedAt = new Date()) {
  const z = crqcYear - currentYear;
  const lines = [];
  lines.push('# Mosca Clock report: post-quantum exposure of AI workloads');
  lines.push('');
  lines.push(`Generated ${generatedAt.toISOString().slice(0, 10)}. CRQC planning year: **${crqcYear}** (z = ${z} years from ${currentYear}).`);
  lines.push('');
  lines.push('| Status | Workloads |');
  lines.push('|---|---|');
  for (const key of Object.keys(STATUS).sort((a, b) => STATUS[b].rank - STATUS[a].rank)) {
    lines.push(`| ${STATUS[key].label} | ${counts[key]} |`);
  }
  lines.push('');
  lines.push('## Ranked workloads');
  lines.push('');
  lines.push('| # | Workload | Status | Priority | x | y | x + y vs z | Key exchange | Signature |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  results.forEach((r, i) => {
    const mosca = r.kexVulnerable ? `${r.x + r.y} vs ${r.z}` : 'n/a (quantum-safe)';
    lines.push(`| ${i + 1} | ${mdEscape(r.name)} | ${STATUS[r.status].label} | ${r.priority} | ${r.x} | ${r.y} | ${mosca} | ${r.kex.label} | ${r.sig.label} |`);
  });
  lines.push('');
  lines.push('## Actions');
  results.forEach((r, i) => {
    lines.push('');
    lines.push(`### ${i + 1}. ${mdEscape(r.name)} (${STATUS[r.status].label})`);
    lines.push('');
    r.actions.forEach((a) => lines.push(`- ${a}`));
    if (r.overhead && r.overhead.perHandshakeBytes !== 0) {
      lines.push(`- Size cost of the recommended algorithms: ${formatBytes(r.overhead.perHandshakeBytes)} per handshake` +
        (r.overhead.handshakesPerDay ? `, about ${formatBytes(r.overhead.perDayBytes)} per day at ${r.overhead.handshakesPerDay.toLocaleString('en-US')} handshakes.` : '.'));
    }
  });
  lines.push('');
  lines.push('---');
  lines.push('Method: Mosca inequality (x + y > z). Key exchange is scored for harvest-now-decrypt-later; signatures are scored on whether migration finishes before the CRQC year. Sizes from FIPS 203/204/205. The CRQC year is an assumption, not a prediction.');
  return lines.join('\n') + '\n';
}
