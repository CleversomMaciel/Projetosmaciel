// Gera quadros de Reels no estilo "série" (selo + manchete condensada + caixa destacada + foto).
// Uso: node reelcard.js posts/<pasta>   (lê reel.json: { "serie": "...", "cenas": [ {foto, linhas:[...], destaque, texto} ] })
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = path.resolve(process.argv[2]);
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'reel.json'), 'utf8'));
const b64 = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64');
const mark = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'brand/mark.png')).toString('base64');

const css = `
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1080px; height:1920px; background:#0a0a0a; font-family:'Oswald',sans-serif; color:#f2eee7; }
.s { width:100%; height:100%; position:relative; overflow:hidden; }
.photo { position:absolute; left:0; right:0; bottom:0; height:62%; background-size:cover; background-position:center; }
.photo::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg,#0a0a0a 0%,rgba(10,10,10,.0) 22%,rgba(10,10,10,0) 80%,rgba(10,10,10,.7) 100%); }
.top { position:absolute; top:0; left:0; right:0; height:44%; padding:150px 70px 0; text-align:center; }
.handle { position:absolute; top:70px; right:70px; font-family:'Montserrat',sans-serif; font-size:24px; letter-spacing:1px; color:#a49d92; }
.brand { position:absolute; top:58px; left:70px; height:58px; }
.serie { display:inline-block; background:#cfae78; color:#0a0a0a; font-weight:700; font-size:34px; letter-spacing:2px; padding:6px 18px; margin-bottom:34px; }
.l { font-weight:700; text-transform:uppercase; line-height:1.02; color:#f2eee7; }
.box { display:inline-block; background:linear-gradient(180deg,#f3e3c3,#cfae78 55%,#a8834f); color:#0a0a0a; font-weight:700; text-transform:uppercase; line-height:1.05; padding:4px 22px 8px; margin-top:10px; }
.txt { font-family:'Montserrat',sans-serif; font-size:40px; line-height:1.4; color:#d9d3c9; margin-top:34px; padding:0 20px; }
.txt b { color:#cfae78; }
`;

(async () => {
  const browser = await chromium.launch();
  for (const [i, c] of cfg.cenas.entries()) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const size = c.tamanho || 104;
    const linhas = (c.linhas || []).map(t => `<div class="l" style="font-size:${size}px">${t}</div>`).join('');
    const box = c.destaque ? `<div class="box" style="font-size:${c.tamanho_destaque || size}px">${c.destaque}</div>` : '';
    const txt = c.texto ? `<div class="txt">${c.texto}</div>` : '';
    await page.setContent(`<html><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Montserrat:wght@400;600&display=block" rel="stylesheet">
      <style>${css}</style></head><body><div class="s">
      <div class="photo" style="background-image:url('${b64(path.join(__dirname, 'brand/fotos', c.foto))}')"></div>
      <img class="brand" src="${mark}"><div class="handle">@renansantos.patrimonio</div>
      <div class="top"><div class="serie">${cfg.serie}</div>${linhas}${box}${txt}</div>
      </div></body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(dir, `cena-${i + 1}.jpg`), type: 'jpeg', quality: 92 });
    await page.close();
  }
  await browser.close();
  console.log('ok', cfg.cenas.length, 'cenas');
})();
