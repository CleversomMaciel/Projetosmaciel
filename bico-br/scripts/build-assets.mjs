// Copia a fonte (auto-hospedada, sem CDN de terceiros) para web/assets/fonts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'node_modules/@fontsource-variable/plus-jakarta-sans/files');
const to = path.join(root, 'web/assets/fonts');
fs.mkdirSync(to, { recursive: true });
for (const f of ['plus-jakarta-sans-latin-wght-normal.woff2', 'plus-jakarta-sans-latin-ext-wght-normal.woff2']) {
  fs.copyFileSync(path.join(from, f), path.join(to, f));
}
console.log('fontes copiadas');
