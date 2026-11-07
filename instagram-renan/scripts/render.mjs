// Gera a arte do post: node scripts/render.mjs posts/AAAA-MM-DD-slug.json
// Saída: o mesmo caminho com .jpg (1080x1350, JPEG para o Instagram).
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = await import("playwright")); }

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arq = resolve(process.argv[2] || "");
if (!arq.endsWith(".json")) { console.error("uso: node scripts/render.mjs posts/arquivo.json"); process.exit(1); }
const post = JSON.parse(readFileSync(arq, "utf8"));
const cfg = JSON.parse(readFileSync(resolve(raiz, "config.json"), "utf8"));
post.handle ??= cfg.handle;
if (post.foto && !/^(https?:|data:|file:)/.test(post.foto)) post.foto = pathToFileURL(resolve(raiz, post.foto)).href;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await p.addInitScript(d => { window.POST = d; }, post);
await p.goto(pathToFileURL(resolve(raiz, "template.html")).href);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
// avisa se algum texto vazou da arte
const vazou = await p.evaluate(() => {
  const a = document.getElementById("arte"), r = document.querySelector(".rodape").getBoundingClientRect();
  const blocos = [...a.querySelectorAll("h1,.sub,.chips,.lista,.muda,.fecho")];
  return blocos.filter(e => e.getBoundingClientRect().bottom > r.top + 1).map(e => e.className || e.tagName);
});
const saida = arq.replace(/\.json$/, ".jpg");
await p.screenshot({ path: saida, type: "jpeg", quality: 90 });
await b.close();
if (vazou.length) { console.error("ATENÇÃO: texto encostando no rodapé:", vazou.join(", "), "→ reduza o texto ou use \"tam\" menor"); process.exitCode = 2; }
console.log(saida);
