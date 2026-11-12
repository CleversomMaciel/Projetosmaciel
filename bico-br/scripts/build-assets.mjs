// Copia as fontes (auto-hospedadas, sem CDN de terceiros) para web/assets/fonts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const to = path.join(root, 'web/assets/fonts');
fs.mkdirSync(to, { recursive: true });
const files = {
  montserrat: ['montserrat-latin-wght-normal.woff2', 'montserrat-latin-wght-italic.woff2', 'montserrat-latin-ext-wght-normal.woff2'],
  inter: ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2'],
};
for (const [pkg, list] of Object.entries(files)) {
  for (const f of list) fs.copyFileSync(path.join(root, `node_modules/@fontsource-variable/${pkg}/files`, f), path.join(to, f));
}
console.log('fontes copiadas');
