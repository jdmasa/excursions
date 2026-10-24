// Utilitats compartides: càrrega de dades i formatació en català.
// Depèn de js-yaml (global `jsyaml`), carregat abans des de cdnjs.

export const BASE = 'excursions';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function safeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const u = new URL(url, location.href);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

async function fetchText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No s'ha pogut carregar ${path} (${res.status})`);
  return res.text();
}

export async function loadIndex() {
  const { excursions } = JSON.parse(await fetchText(`${BASE}/index.json`));
  return excursions;
}

export async function loadExcursio(id) {
  let data;
  try {
    data = jsyaml.load(await fetchText(`${BASE}/${id}/excursio.yaml`));
  } catch (e) {
    if (e.name === 'YAMLException') throw new Error(`El fitxer excursio.yaml de «${id}» té errors de format: ${e.reason}`);
    throw e;
  }
  if (!data || typeof data !== 'object') throw new Error(`El fitxer excursio.yaml de «${id}» és buit.`);
  data.id = id;
  data.dataObj = parseDate(data.data);
  return data;
}

export async function loadGpxText(exc) {
  return fetchText(`${BASE}/${exc.id}/${exc.gpx}`);
}

// js-yaml converteix AAAA-MM-DD en un Date UTC; també acceptem text.
function parseDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d.slice(0, 10) + 'T00:00:00Z');
  return null;
}

const dateFmt = new Intl.DateTimeFormat('ca', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

export function formatData(exc) {
  if (!exc.dataObj) return String(exc.data ?? '');
  const s = dateFmt.format(exc.dataObj);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function joinCa(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' i ' + items.at(-1);
}

// [4, 7] → "4 i 7 anys"; [1] → "1 any"; admet textos com "18 mesos".
export function formatEdats(edats) {
  if (!Array.isArray(edats) || !edats.length) return '';
  const allNums = edats.every((e) => typeof e === 'number');
  if (!allNums) return joinCa(edats.map((e) => (typeof e === 'number' ? `${e} ${e === 1 ? 'any' : 'anys'}` : e)));
  const last = edats.at(-1);
  return `${joinCa(edats.map(String))} ${edats.length === 1 && last === 1 ? 'any' : 'anys'}`;
}

const num1 = new Intl.NumberFormat('ca', { maximumFractionDigits: 1 });
const num0 = new Intl.NumberFormat('ca', { maximumFractionDigits: 0 });
export const fmtKm = (km) => `${num1.format(km)} km`;
export const fmtM = (m) => `${num0.format(m)} m`;

export function showError(container, message) {
  container.innerHTML = `<div class="error"><strong>Vaja!</strong> ${esc(message)}</div>`;
}

// Distància i desnivell: prioritat al YAML; si hi falten, es calculen del GPX.
// Retorna { distanciaKm, desnivellM, calculat: {distancia, desnivell}, points, gpxStats }.
export async function resolveStats(exc, { needPoints = false } = {}) {
  const out = {
    distanciaKm: Number.isFinite(exc.distancia_km) ? exc.distancia_km : null,
    desnivellM: Number.isFinite(exc.desnivell_m) ? exc.desnivell_m : null,
    calculat: { distancia: false, desnivell: false },
    points: null,
    gpxStats: null,
  };
  const missing = out.distanciaKm === null || out.desnivellM === null;
  if (!exc.gpx || (!missing && !needPoints)) return out;

  const { parseGpx, computeStats } = await import('./gpx.js');
  out.points = parseGpx(await loadGpxText(exc));
  out.gpxStats = computeStats(out.points);
  if (out.distanciaKm === null) {
    out.distanciaKm = out.gpxStats.distanciaKm;
    out.calculat.distancia = true;
  }
  if (out.desnivellM === null && out.gpxStats.desnivellM !== null) {
    out.desnivellM = out.gpxStats.desnivellM;
    out.calculat.desnivell = true;
  }
  return out;
}
