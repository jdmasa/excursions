import { loadIndex, loadExcursio, resolveStats, formatData, formatEdats, fmtKm, fmtM, esc, showError } from './common.js';

const list = document.getElementById('llistat');
const count = document.getElementById('comptador');
const form = document.getElementById('filtres');
const resetBtn = form.querySelector('.f-reset');
const FIELDS = ['q', 'any', 'comarca', 'dist', 'edat', 'ordre'];

// Minúscules i sense accents, per cercar "popa" o "moianes" indistintament.
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

async function card(id) {
  const exc = await loadExcursio(id);
  let stats = { distanciaKm: exc.distancia_km, desnivellM: exc.desnivell_m };
  try { stats = await resolveStats(exc); } catch { /* el GPX és opcional al llistat */ }

  const edats = formatEdats(exc.edats);
  const chips = [
    Number.isFinite(stats.distanciaKm) && `<span class="chip">${fmtKm(stats.distanciaKm)}</span>`,
    Number.isFinite(stats.desnivellM) && `<span class="chip">↗ ${fmtM(stats.desnivellM)}</span>`,
    edats && `<span class="chip chip-kids">Edats: ${esc(edats)}</span>`,
  ].filter(Boolean).join('');

  return {
    date: exc.dataObj?.getTime() ?? 0,
    year: exc.dataObj ? String(exc.dataObj.getUTCFullYear()) : '',
    comarca: exc.comarca ?? '',
    dist: Number.isFinite(stats.distanciaKm) ? stats.distanciaKm : null,
    edats: (Array.isArray(exc.edats) ? exc.edats : []).filter(Number.isFinite),
    text: norm([exc.titol, exc.lloc, exc.comarca, exc.resum, exc.descripcio, ...(exc.ruta ?? [])].join(' ')),
    html: `
      <a class="card" href="excursio.html?id=${encodeURIComponent(id)}">
        <p class="card-date">${esc(formatData(exc))}</p>
        <h2>${esc(exc.titol ?? id)}</h2>
        <p class="card-place">${esc([exc.lloc, exc.comarca].filter(Boolean).join(' · '))}</p>
        ${exc.resum ? `<p class="card-summary">${esc(exc.resum)}</p>` : ''}
        ${chips ? `<div class="chips">${chips}</div>` : ''}
      </a>`,
  };
}

function fillSelect(name, values, label = (v) => v) {
  const select = form.elements[name];
  select.insertAdjacentHTML('beforeend',
    values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join(''));
}

function readFilters() {
  return Object.fromEntries(FIELDS.map((f) => [f, form.elements[f].value.trim()]));
}

function matches(c, f) {
  if (f.q && !norm(f.q).split(/\s+/).every((w) => c.text.includes(w))) return false;
  if (f.any && c.year !== f.any) return false;
  if (f.comarca && c.comarca !== f.comarca) return false;
  if (f.dist) {
    if (c.dist === null) return false;
    const [min, max] = f.dist.split('-').map((v) => (v === '' ? null : Number(v)));
    if (min !== null && c.dist < min) return false;
    if (max !== null && c.dist >= max) return false;
  }
  // Una excursió és apta si el nen més petit que la va fer no superava l'edat triada.
  if (f.edat && !(c.edats.length && Math.min(...c.edats) <= Number(f.edat))) return false;
  return true;
}

const sorters = {
  '': (a, b) => b.date - a.date,
  antigues: (a, b) => a.date - b.date,
  curtes: (a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity),
  llargues: (a, b) => (b.dist ?? -Infinity) - (a.dist ?? -Infinity),
};

function render(cards) {
  const f = readFilters();
  const shown = cards.filter((c) => matches(c, f)).sort(sorters[f.ordre] ?? sorters['']);
  const active = FIELDS.some((k) => k !== 'ordre' && f[k]);

  list.innerHTML = shown.length
    ? shown.map((c) => c.html).join('')
    : '<p class="muted">Cap excursió no coincideix amb els filtres.</p>';
  const word = (n) => `${n} ${n === 1 ? 'excursió' : 'excursions'}`;
  count.textContent = active ? `${word(shown.length)} de ${cards.length}` : word(cards.length);
  resetBtn.hidden = !active && !f.ordre;

  // Desa els filtres a l'URL perquè la vista es pugui compartir o desar.
  const params = new URLSearchParams();
  FIELDS.forEach((k) => f[k] && params.set(k, f[k]));
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
}

try {
  const ids = await loadIndex();
  const results = await Promise.allSettled(ids.map(card));
  const cards = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.warn(r.reason));

  if (!cards.length) {
    list.innerHTML = '<p class="muted">Encara no hi ha cap excursió.</p>';
  } else {
    const uniq = (arr) => [...new Set(arr.filter((v) => v !== '' && v != null))];
    fillSelect('any', uniq(cards.map((c) => c.year)).sort().reverse());
    fillSelect('comarca', uniq(cards.map((c) => c.comarca)).sort((a, b) => a.localeCompare(b, 'ca')));
    // Edats des del nen més petit fins al més gran registrats, sense forats.
    const allAges = cards.flatMap((c) => c.edats);
    const ages = allAges.length
      ? Array.from({ length: Math.max(...allAges) - Math.min(...allAges) + 1 }, (_, i) => Math.min(...allAges) + i)
      : [];
    fillSelect('edat', ages, (e) => `${e} ${e === 1 ? 'any' : 'anys'}`);
    if (form.elements.edat.options.length === 1) form.elements.edat.closest('label').hidden = true;

    const params = new URLSearchParams(location.search);
    FIELDS.forEach((k) => { if (params.has(k)) form.elements[k].value = params.get(k); });

    form.hidden = false;
    form.addEventListener('input', () => render(cards));
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('reset', () => setTimeout(() => render(cards)));
    render(cards);
  }
} catch (e) {
  showError(list, `${e.message}. Si estàs treballant en local, executa primer «node scripts/build-index.mjs».`);
}
