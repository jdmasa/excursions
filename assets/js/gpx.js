// Lectura de GPX, càlcul d'estadístiques i perfil d'elevació en SVG.

export function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('El fitxer GPX no és vàlid.');
  let nodes = [...doc.getElementsByTagName('trkpt')];
  if (!nodes.length) nodes = [...doc.getElementsByTagName('rtept')];
  const points = nodes.map((n) => {
    const ele = n.getElementsByTagName('ele')[0];
    return {
      lat: parseFloat(n.getAttribute('lat')),
      lon: parseFloat(n.getAttribute('lon')),
      ele: ele ? parseFloat(ele.textContent) : null,
    };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!points.length) throw new Error('El fitxer GPX no conté cap punt.');
  return points;
}

function haversine(a, b) {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Afegeix `dist` (m acumulats) a cada punt i retorna distància, desnivell i altituds.
// El desnivell positiu fa servir un llindar per ignorar el soroll del GPS.
export function computeStats(points, threshold = 3) {
  let dist = 0;
  points.forEach((p, i) => {
    if (i) dist += haversine(points[i - 1], p);
    p.dist = dist;
  });

  const eles = points.map((p) => p.ele).filter(Number.isFinite);
  let gain = 0;
  let loss = 0;
  if (eles.length) {
    let ref = eles[0];
    for (const e of eles) {
      if (e - ref >= threshold) { gain += e - ref; ref = e; }
      else if (ref - e >= threshold) { loss += ref - e; ref = e; }
    }
  }
  return {
    distanciaKm: dist / 1000,
    desnivellM: eles.length ? gain : null,
    baixadaM: eles.length ? loss : null,
    minEle: eles.length ? Math.min(...eles) : null,
    maxEle: eles.length ? Math.max(...eles) : null,
  };
}

// Dibuixa el perfil dins `container`. `onHover(index|null)` es crida en moure el punter.
export function renderProfile(container, points, stats, onHover) {
  const withEle = points.filter((p) => Number.isFinite(p.ele));
  if (withEle.length < 2) {
    container.innerHTML = '<p class="muted">El GPX no té dades d\'altitud.</p>';
    return;
  }
  const W = 800, H = 200;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const total = points.at(-1).dist || 1;
  const span = Math.max(stats.maxEle - stats.minEle, 20);
  const yMin = Math.floor((stats.minEle - span * 0.1) / 10) * 10;
  const yMax = Math.ceil((stats.maxEle + span * 0.1) / 10) * 10;
  const x = (d) => pad.l + (d / total) * (W - pad.l - pad.r);
  const y = (e) => pad.t + (1 - (e - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  const line = withEle.map((p, i) => `${i ? 'L' : 'M'}${x(p.dist).toFixed(1)},${y(p.ele).toFixed(1)}`).join('');
  const area = `${line}L${x(withEle.at(-1).dist).toFixed(1)},${H - pad.b}L${x(withEle[0].dist).toFixed(1)},${H - pad.b}Z`;

  const ticks = [];
  const yStep = niceStep((yMax - yMin) / 4);
  for (let e = Math.ceil(yMin / yStep) * yStep; e <= yMax; e += yStep) {
    ticks.push(`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(e)}" y2="${y(e)}"/>` +
      `<text class="tick" x="${pad.l - 6}" y="${y(e) + 4}" text-anchor="end">${e}</text>`);
  }
  const kmStep = niceStep(total / 1000 / 6);
  for (let k = 0; k <= total / 1000 + 1e-9; k += kmStep) {
    ticks.push(`<text class="tick" x="${x(k * 1000)}" y="${H - 8}" text-anchor="middle">${+k.toFixed(1)}</text>`);
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Perfil d'elevació">
      ${ticks.join('')}
      <path class="area" d="${area}"/>
      <path class="line" d="${line}"/>
      <g class="cursor" visibility="hidden">
        <line y1="${pad.t}" y2="${H - pad.b}"/>
        <circle r="4"/>
      </g>
      <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}"/>
    </svg>
    <div class="profile-label" hidden></div>
    <div class="profile-axis"><span>m</span><span>km</span></div>`;

  const svg = container.querySelector('svg');
  const cursor = svg.querySelector('.cursor');
  const label = container.querySelector('.profile-label');

  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * W;
    const d = Math.min(Math.max((sx - pad.l) / (W - pad.l - pad.r), 0), 1) * total;
    const i = nearestIndex(withEle, d);
    const p = withEle[i];
    cursor.setAttribute('visibility', 'visible');
    cursor.setAttribute('transform', `translate(${x(p.dist)},0)`);
    cursor.querySelector('circle').setAttribute('cy', y(p.ele));
    label.hidden = false;
    label.textContent = `${(p.dist / 1000).toLocaleString('ca', { maximumFractionDigits: 2 })} km · ${Math.round(p.ele)} m`;
    const pct = (x(p.dist) / W) * 100;
    label.style.left = `${Math.min(Math.max(pct, 12), 88)}%`;
    onHover?.(points.indexOf(p));
  };
  const leave = () => {
    cursor.setAttribute('visibility', 'hidden');
    label.hidden = true;
    onHover?.(null);
  };
  const hit = svg.querySelector('.hit');
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);
}

function nearestIndex(pts, d) {
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].dist < d) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && d - pts[lo - 1].dist < pts[lo].dist - d) lo--;
  return lo;
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
