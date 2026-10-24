// Genera excursions/index.json amb la llista de carpetes d'excursions.
// Una carpeta compta si conté excursio.yaml i el nom no comença per "_" o ".".
// Ús: node scripts/build-index.mjs
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'excursions');

const ids = readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !/^[_.]/.test(e.name))
  .filter((e) => existsSync(join(dir, e.name, 'excursio.yaml')))
  .map((e) => e.name)
  .sort()
  .reverse();

writeFileSync(join(dir, 'index.json'), JSON.stringify({ excursions: ids }, null, 2) + '\n');
console.log(`index.json: ${ids.length} excursions`);
