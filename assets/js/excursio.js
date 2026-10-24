import { loadExcursio, resolveStats, formatData, formatEdats, fmtKm, fmtM, esc, safeUrl, showError, BASE } from './common.js';
import { renderProfile } from './gpx.js';

const main = document.getElementById('excursio');
const id = new URLSearchParams(location.search).get('id');

function paragraphs(text) {
  return String(text).trim().split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
}

function stat(label, value, note) {
  return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span>` +
    (note ? `<span class="stat-note">${note}</span>` : '') + '</div>';
}

function infoRow(label, value) {
  return value ? `<dt>${label}</dt><dd>${value}</dd>` : '';
}

function renderPage(exc, stats) {
  document.title = `${exc.titol ?? id} · Excursions amb nens`;
  const edats = formatEdats(exc.edats);
  const calc = '<abbr title="Calculat a partir del fitxer GPX">calculat del GPX</abbr>';

  const statsHtml = [
    edats && stat('Edats dels nens', esc(edats)),
    Number.isFinite(stats.distanciaKm) && stat('Distància', fmtKm(stats.distanciaKm), stats.calculat.distancia && calc),
    Number.isFinite(stats.desnivellM) && stat('Desnivell positiu', fmtM(stats.desnivellM), stats.calculat.desnivell && calc),
    exc.durada && stat('Durada', esc(exc.durada)),
    (exc.tipus || exc.circular != null) && stat('Tipus', esc([exc.tipus, exc.circular === true ? 'Circular' : exc.circular === false ? 'Lineal' : null].filter(Boolean).join(' · '))),
  ].filter(Boolean).join('');

  const ruta = Array.isArray(exc.ruta) && exc.ruta.length
    ? `<section><h2>Ruta</h2><ol class="ruta">${exc.ruta.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></section>` : '';

  const portar = Array.isArray(exc.que_cal_portar) ? esc(exc.que_cal_portar.join(', ')) : esc(exc.que_cal_portar ?? '');
  const org = exc.organitzador
    ? (typeof exc.organitzador === 'string' ? esc(exc.organitzador)
      : safeUrl(exc.organitzador.url)
        ? `<a href="${esc(safeUrl(exc.organitzador.url))}" target="_blank" rel="noopener">${esc(exc.organitzador.nom ?? exc.organitzador.url)}</a>`
        : esc(exc.organitzador.nom ?? ''))
    : '';
  const info = [
    infoRow('Transport', esc(exc.transport ?? '')),
    infoRow('Punt de trobada', esc(exc.punt_de_trobada ?? '')),
    infoRow('Què cal portar', portar),
    infoRow('Organitzador', org),
  ].join('');

  const links = (Array.isArray(exc.enllacos) ? exc.enllacos : [])
    .map((l) => ({ titol: l.titol ?? l.url, url: safeUrl(l.url) }))
    .filter((l) => l.url);
  if (exc.gpx) links.push({ titol: `Descarrega el track (${exc.gpx})`, url: `${BASE}/${encodeURIComponent(exc.id)}/${encodeURIComponent(exc.gpx)}`, download: true });
  const linksHtml = links.length
    ? `<section><h2>Enllaços</h2><ul class="links">${links.map((l) =>
      `<li><a href="${esc(l.url)}"${l.download ? ' download' : ' target="_blank" rel="noopener"'}>${esc(l.titol)}</a></li>`).join('')}</ul></section>` : '';

  main.innerHTML = `
    <header class="exc-header">
      <p class="card-date">${esc(formatData(exc))}</p>
      <h1>${esc(exc.titol ?? id)}</h1>
      <p class="exc-place">${esc([exc.lloc, exc.comarca].filter(Boolean).join(' · '))}</p>
    </header>
    ${statsHtml ? `<div class="stats">${statsHtml}</div>` : ''}
    ${exc.gpx ? `<section class="map-section">
      <div id="mapa" class="map" role="region" aria-label="Mapa del recorregut"></div>
      <div id="perfil" class="profile"></div>
    </section>` : ''}
    <div class="exc-body">
      <div class="exc-main">
        ${exc.descripcio ? `<section><h2>Descripció</h2>${paragraphs(exc.descripcio)}</section>` : ''}
        ${ruta}
        ${exc.notes ? `<section class="notes"><h2>Notes</h2>${paragraphs(exc.notes)}</section>` : ''}
      </div>
      <aside class="exc-side">
        ${info ? `<section><h2>Informació pràctica</h2><dl class="info">${info}</dl></section>` : ''}
        ${linksHtml}
      </aside>
    </div>`;
}

function renderMap(points, stats) {
  const latlngs = points.map((p) => [p.lat, p.lon]);
  const map = L.map('mapa', { scrollWheelZoom: false });

  const layers = {
    'Topogràfic (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }),
    'ICGC Topogràfic': L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/topografic/MON3857NW/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.icgc.cat">Institut Cartogràfic i Geològic de Catalunya</a>',
    }),
    'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
  };
  layers['Topogràfic (OpenTopoMap)'].addTo(map);
  L.control.layers(layers).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);

  const track = L.polyline(latlngs, { color: getComputedStyle(document.documentElement).getPropertyValue('--track').trim() || '#d9480f', weight: 4, opacity: 0.9 }).addTo(map);
  L.circleMarker(latlngs[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#2b8a3e', fillOpacity: 1 })
    .bindTooltip('Sortida').addTo(map);
  L.circleMarker(latlngs.at(-1), { radius: 7, color: '#fff', weight: 2, fillColor: '#c92a2a', fillOpacity: 1 })
    .bindTooltip('Arribada').addTo(map);
  map.fitBounds(track.getBounds(), { padding: [20, 20] });

  const cursor = L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#1c7ed6', fillOpacity: 1 });
  renderProfile(document.getElementById('perfil'), points, stats.gpxStats, (i) => {
    if (i === null) { cursor.remove(); return; }
    cursor.setLatLng(latlngs[i]).addTo(map);
  });
}

if (!id) {
  showError(main, 'No s\'ha indicat cap excursió. Torna al llistat i tria\'n una.');
} else {
  try {
    const exc = await loadExcursio(id);
    let stats;
    let gpxError = null;
    try {
      stats = await resolveStats(exc, { needPoints: true });
    } catch (e) {
      gpxError = e;
      stats = await resolveStats({ ...exc, gpx: null });
    }
    renderPage(exc, stats);
    if (gpxError) {
      showError(document.querySelector('.map-section'), `No s'ha pogut mostrar el track: ${gpxError.message}`);
    } else if (stats.points) {
      renderMap(stats.points, stats);
    }
  } catch (e) {
    showError(main, e.message.includes('404')
      ? `No hem trobat l'excursió «${id}».`
      : e.message);
  }
}
