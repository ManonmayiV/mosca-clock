import {
  KEY_EXCHANGE, SIGNATURE, SYMMETRIC, STATUS,
  assessInventory, normaliseWorkload, formatBytes,
} from './scoring.js';
import { TEMPLATES, SAMPLE_INVENTORY } from './templates.js';
import { buildMarkdownReport } from './report.js';

const STORAGE_KEY = 'mosca-clock.v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const currentYear = new Date().getFullYear();

const $ = (id) => document.getElementById(id);

const state = load() ?? { crqcYear: 2035, workloads: [] };

// ---------- persistence ----------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      crqcYear: clampYear(parsed.crqcYear),
      workloads: Array.isArray(parsed.workloads) ? parsed.workloads.map(normaliseWorkload) : [],
    };
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the app still works for this session
  }
}

function clampYear(y) {
  const n = Number(y);
  return Number.isFinite(n) ? Math.min(2050, Math.max(2027, Math.round(n))) : 2035;
}

// ---------- DOM helpers (textContent only; user input never goes through innerHTML) ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function fillSelect(select, table) {
  select.replaceChildren(...Object.entries(table).map(([value, v]) => el('option', { value }, v.label)));
}

// ---------- form ----------
function initForm() {
  fillSelect($('f-template'), TEMPLATES);
  fillSelect($('f-kex'), KEY_EXCHANGE);
  fillSelect($('f-sig'), SIGNATURE);
  fillSelect($('f-sym'), SYMMETRIC);
  $('f-template').addEventListener('change', () => applyTemplate($('f-template').value));
  $('workload-form').addEventListener('submit', onSubmit);
  $('f-cancel').addEventListener('click', resetForm);
  applyTemplate('training-upload');
}

function applyTemplate(key) {
  const t = TEMPLATES[key] ?? TEMPLATES.custom;
  $('f-template').value = key;
  $('f-hint').textContent = t.hint;
  $('f-kex').value = t.keyExchange;
  $('f-sig').value = t.signature;
  $('f-sym').value = t.symmetric;
  $('f-y').value = t.shelfLifeYears;
  $('f-x').value = t.migrationYears;
  $('f-sens').value = String(t.sensitivity);
  $('f-hs').value = t.handshakesPerDay ?? 0;
  $('f-internet').checked = Boolean(t.internetFacing);
  $('f-root').checked = Boolean(t.longLivedRoot);
}

function readForm() {
  return {
    id: $('f-id').value || `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    template: $('f-template').value,
    name: $('f-name').value,
    keyExchange: $('f-kex').value,
    signature: $('f-sig').value,
    symmetric: $('f-sym').value,
    shelfLifeYears: $('f-y').value,
    migrationYears: $('f-x').value,
    sensitivity: $('f-sens').value,
    handshakesPerDay: $('f-hs').value,
    internetFacing: $('f-internet').checked,
    longLivedRoot: $('f-root').checked,
    notes: $('f-notes').value,
  };
}

function onSubmit(event) {
  event.preventDefault();
  $('form-error').textContent = '';
  const raw = readForm();
  for (const [field, max] of [['shelfLifeYears', 100], ['migrationYears', 50]]) {
    const n = Number(raw[field]);
    if (raw[field] === '' || !Number.isFinite(n) || n < 0 || n > max) {
      $('form-error').textContent = `${field === 'shelfLifeYears' ? 'Shelf life' : 'Migration time'} must be between 0 and ${max}.`;
      return;
    }
  }
  let w;
  try {
    w = normaliseWorkload(raw);
  } catch (err) {
    $('form-error').textContent = err.message.replace('Workload 1', 'This workload');
    $('f-name').focus();
    return;
  }
  const i = state.workloads.findIndex((x) => x.id === w.id);
  if (i >= 0) state.workloads[i] = w; else state.workloads.push(w);
  save();
  resetForm();
  render();
}

function resetForm() {
  $('f-id').value = '';
  $('f-name').value = '';
  $('f-notes').value = '';
  $('f-submit').textContent = 'Add workload';
  $('f-cancel').hidden = true;
  $('form-error').textContent = '';
  applyTemplate($('f-template').value);
}

function editWorkload(id) {
  const w = state.workloads.find((x) => x.id === id);
  if (!w) return;
  $('f-id').value = w.id;
  $('f-template').value = TEMPLATES[w.template] ? w.template : 'custom';
  $('f-hint').textContent = (TEMPLATES[w.template] ?? TEMPLATES.custom).hint;
  $('f-name').value = w.name;
  $('f-kex').value = w.keyExchange;
  $('f-sig').value = w.signature;
  $('f-sym').value = w.symmetric;
  $('f-y').value = w.shelfLifeYears;
  $('f-x').value = w.migrationYears;
  $('f-sens').value = String(w.sensitivity);
  $('f-hs').value = w.handshakesPerDay;
  $('f-internet').checked = w.internetFacing;
  $('f-root').checked = w.longLivedRoot;
  $('f-notes').value = w.notes;
  $('f-submit').textContent = 'Save changes';
  $('f-cancel').hidden = false;
  $('workload-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('f-name').focus({ preventScroll: true });
}

function deleteWorkload(id) {
  const w = state.workloads.find((x) => x.id === id);
  if (!w || !confirm(`Remove "${w.name}"?`)) return;
  state.workloads = state.workloads.filter((x) => x.id !== id);
  save();
  render();
}

// ---------- assumptions ----------
function initAssumptions() {
  const slider = $('crqc-year');
  slider.value = state.crqcYear;
  $('current-year').textContent = currentYear;
  slider.addEventListener('input', () => setCrqcYear(slider.value));
  document.querySelectorAll('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => setCrqcYear(b.dataset.preset)));
}

function setCrqcYear(y) {
  state.crqcYear = clampYear(y);
  $('crqc-year').value = state.crqcYear;
  save();
  render();
}

// ---------- import / export ----------
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initToolbar() {
  $('load-sample').addEventListener('click', () => {
    if (state.workloads.length && !confirm('Replace the current inventory with the sample?')) return;
    state.workloads = SAMPLE_INVENTORY.map(normaliseWorkload);
    save();
    render();
    $('io-status').textContent = `Loaded ${state.workloads.length} sample workloads. The organisation is fictional.`;
  });
  $('export-json').addEventListener('click', () => {
    download('mosca-clock-inventory.json', JSON.stringify(state, null, 2), 'application/json');
  });
  $('import-json').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) { $('io-status').textContent = 'File is larger than 1 MB; not imported.'; return; }
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed.workloads;
      if (!Array.isArray(list)) throw new Error('Expected a "workloads" array.');
      if (list.length > 500) throw new Error('More than 500 workloads.');
      state.workloads = list.map(normaliseWorkload);
      if (!Array.isArray(parsed) && parsed.crqcYear) state.crqcYear = clampYear(parsed.crqcYear);
      $('crqc-year').value = state.crqcYear;
      save();
      render();
      $('io-status').textContent = `Imported ${state.workloads.length} workloads.`;
    } catch (err) {
      $('io-status').textContent = `Import failed: ${err.message}`;
    }
  });
  $('clear-all').addEventListener('click', () => {
    if (!state.workloads.length || !confirm('Delete every workload?')) return;
    state.workloads = [];
    save();
    render();
  });
  $('export-md').addEventListener('click', () => {
    const assessed = assessInventory(state.workloads, assumptions());
    download(`mosca-clock-report-${state.crqcYear}.md`, buildMarkdownReport(assessed, assumptions()), 'text/markdown');
  });
}

// ---------- rendering ----------
function assumptions() {
  return { crqcYear: state.crqcYear, currentYear };
}

function render() {
  $('crqc-year-out').textContent = state.crqcYear;
  $('z-out').textContent = state.crqcYear - currentYear;
  const assessed = assessInventory(state.workloads, assumptions());
  renderSummary(assessed.counts);
  renderChart(assessed.results);
  renderPlan(assessed.results);
}

function renderSummary(counts) {
  const order = ['critical', 'high', 'medium', 'low', 'ready'];
  $('summary').replaceChildren(...order.map((k) =>
    el('div', { class: `card s-${k}`, title: STATUS[k].summary },
      el('div', { class: 'n' }, counts[k]),
      el('div', { class: 'l' }, STATUS[k].label))));
}

function renderChart(results) {
  const box = $('chart');
  if (!results.length) {
    box.replaceChildren(el('p', { class: 'empty' }, 'Add a workload or load the sample to see the chart.'));
    return;
  }
  const z = state.crqcYear - currentYear;
  const maxYears = Math.max(z + 2, ...results.map((r) => r.x + (r.kexVulnerable ? r.y : 0)), 10);
  const labelW = 260, rowH = 30, top = 24, right = 80, width = 1000;
  const plotW = width - labelW - right;
  const height = top + results.length * rowH + 30;
  const sx = (years) => labelW + (years / maxYears) * plotW;

  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });

  const grid = svg('g', { class: 'grid axis' });
  const step = maxYears > 30 ? 5 : 2;
  for (let t = 0; t <= maxYears; t += step) {
    grid.append(svg('line', { x1: sx(t), x2: sx(t), y1: top - 6, y2: height - 24 }));
    grid.append(svg('text', { x: sx(t), y: height - 8, 'text-anchor': 'middle' }, String(currentYear + t)));
  }
  root.append(grid);

  results.forEach((r, i) => {
    const y = top + i * rowH;
    const label = r.name.length > 36 ? `${r.name.slice(0, 35)}…` : r.name;
    root.append(svg('text', { x: labelW - 10, y: y + 15, 'text-anchor': 'end' }, label));
    root.append(svg('rect', { x: sx(0), y: y + 4, width: Math.max(1, sx(r.x) - sx(0)), height: 16, rx: 3, fill: 'var(--x)' }));
    if (r.kexVulnerable && r.y > 0) {
      root.append(svg('rect', { x: sx(r.x), y: y + 4, width: sx(r.x + r.y) - sx(r.x), height: 16, rx: 3, fill: 'var(--y)' }));
    }
    const endX = sx(r.x + (r.kexVulnerable ? r.y : 0));
    root.append(svg('text', { x: endX + 6, y: y + 16, fill: `var(--${r.status})` }, STATUS[r.status].label));
  });

  root.append(svg('line', { x1: sx(z), x2: sx(z), y1: top - 10, y2: height - 24, stroke: 'var(--critical)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
  root.append(svg('text', { x: sx(z), y: top - 12, 'text-anchor': 'middle', fill: 'var(--critical)' }, `CRQC ${state.crqcYear}`));

  box.setAttribute('aria-label', `Mosca chart. ${results.map((r) => `${r.name}: ${STATUS[r.status].label}`).join('; ')}.`);
  box.replaceChildren(root);
}

function renderPlan(results) {
  const box = $('plan');
  if (!results.length) {
    box.replaceChildren(el('p', { class: 'empty' }, 'No workloads yet.'));
    return;
  }
  box.replaceChildren(...results.map((r, i) => {
    const meta = r.kexVulnerable
      ? `x ${r.x} + y ${r.y} = ${r.x + r.y} vs z ${r.z} · priority ${r.priority}`
      : `${r.kex.notApplicable ? 'no data in transit' : 'key exchange quantum-safe'} · priority ${r.priority}`;
    const items = r.actions.map((a) => el('li', {}, a));
    if (r.overhead && r.overhead.perHandshakeBytes !== 0) {
      const perDay = r.overhead.handshakesPerDay
        ? `, about ${formatBytes(r.overhead.perDayBytes)}/day at ${r.overhead.handshakesPerDay.toLocaleString()} handshakes`
        : '';
      items.push(el('li', {}, `Size cost of the recommended algorithms: +${formatBytes(r.overhead.perHandshakeBytes)} per handshake${perDay}.`));
    }
    const w = state.workloads.find((x) => x.id === r.id);
    return el('article', { class: `plan-item s-${r.status}` },
      el('header', {},
        el('h4', {}, `${i + 1}. ${r.name}`),
        el('span', { class: `badge b-${r.status}` }, STATUS[r.status].label),
        el('span', { class: 'meta' }, meta),
        el('span', { class: 'row-actions' },
          el('button', { type: 'button', onclick: () => editWorkload(r.id), 'aria-label': `Edit ${r.name}` }, 'Edit'),
          el('button', { type: 'button', onclick: () => deleteWorkload(r.id), 'aria-label': `Delete ${r.name}` }, 'Delete'))),
      el('p', { class: 'meta' }, `${r.kex.label} · ${r.sig.label} · ${r.sym.label}${w?.notes ? ` · ${w.notes}` : ''}`),
      el('ol', {}, ...items));
  }));
}

// Demo link: index.html#sample loads the fictional inventory when nothing is saved yet.
// index.html#sample&crqc=2030 also sets the planning year.
const hashParams = new URLSearchParams(location.hash.slice(1));
if (hashParams.has('sample') && state.workloads.length === 0) {
  state.workloads = SAMPLE_INVENTORY.map(normaliseWorkload);
}
if (hashParams.has('crqc')) state.crqcYear = clampYear(hashParams.get('crqc'));

initAssumptions();
initForm();
initToolbar();
render();
