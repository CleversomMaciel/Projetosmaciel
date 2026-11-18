// Renderiza slides de um post (post.json) em JPEGs prontos para o Instagram.
// Uso: node render.js posts/<pasta-do-post>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = path.resolve(process.argv[2]);
const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
const HANDLE = '@renansantos.patrimonio';

const css = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:W px; height:H px; font-family:'Inter',sans-serif; background:#0d1b2a; color:#f5f1e8; }
  .s { width:100%; height:100%; padding:110px 96px; display:flex; flex-direction:column; position:relative;
       background: radial-gradient(circle at 85% 10%, #1d3557 0%, #0d1b2a 55%); }
  .tag { font-size:30px; font-weight:700; letter-spacing:4px; color:#d4a24c; text-transform:uppercase; margin-bottom:40px; }
  h1 { font-size:92px; line-height:1.05; font-weight:800; letter-spacing:-2px; }
  h2 { font-size:68px; line-height:1.1; font-weight:800; letter-spacing:-1px; margin-bottom:48px; }
  .sub { font-size:42px; line-height:1.35; color:#c9d3df; margin-top:44px; font-weight:500; }
  p { font-size:40px; line-height:1.45; color:#dfe6ee; margin-bottom:30px; }
  b, .hl { color:#d4a24c; font-weight:700; }
  ul { list-style:none; }
  li { font-size:40px; line-height:1.35; margin-bottom:34px; padding-left:64px; position:relative; color:#dfe6ee; }
  li::before { content:attr(data-n); position:absolute; left:0; top:2px; width:46px; height:46px; border-radius:50%;
       background:#d4a24c; color:#0d1b2a; font-size:26px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  .rows div { display:flex; justify-content:space-between; font-size:44px; padding:26px 0; border-bottom:2px solid #24384f; }
  .rows div span:last-child { font-weight:800; color:#d4a24c; }
  .note { font-size:28px; color:#8597ab; margin-top:28px; }
  .foot { position:absolute; left:96px; right:96px; bottom:64px; display:flex; justify-content:space-between;
       font-size:28px; color:#8597ab; font-weight:600; }
  .center { justify-content:center; }
  .big { font-size:150px; font-weight:800; color:#d4a24c; line-height:1; margin-bottom:20px; }
  .cta { margin-top:56px; display:inline-block; background:#d4a24c; color:#0d1b2a; font-size:46px; font-weight:800;
       padding:30px 46px; border-radius:18px; align-self:flex-start; }
`;

(async () => {
  const browser = await chromium.launch();
  const items = [...post.slides.map((s, i) => ({ html: s, name: `slide-${i + 1}.jpg`, w: 1080, h: 1350, n: i + 1 })),
                 ...(post.story ? [{ html: post.story, name: 'story.jpg', w: 1080, h: 1920 }] : [])];
  for (const it of items) {
    const page = await browser.newPage({ viewport: { width: it.w, height: it.h }, deviceScaleFactor: 1 });
    const foot = it.n ? `<div class="foot"><span>${HANDLE}</span><span>${it.n}/${post.slides.length}</span></div>`
                      : `<div class="foot"><span>${HANDLE}</span><span></span></div>`;
    await page.setContent(`<html><head><meta charset="utf-8"><style>${css.replace('W px', it.w + 'px').replace('H px', it.h + 'px')}</style></head>
      <body><div class="s ${it.cls || ''}">${it.html}${foot}</div></body></html>`);
    await page.screenshot({ path: path.join(dir, it.name), type: 'jpeg', quality: 92 });
    await page.close();
    console.log('ok', it.name);
  }
  await browser.close();
})();
