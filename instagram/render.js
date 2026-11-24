// Renderiza slides de um post (post.json) em JPEGs no padrão visual da marca Renan Santos Patrimônio.
// Uso: node render.js posts/<pasta-do-post>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = path.resolve(process.argv[2]);
const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
const mark = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'brand/mark.png')).toString('base64');

// Paleta da marca
const C = {
  bg: '#0a0a0a',
  bg2: '#16130f',
  gold: 'linear-gradient(180deg,#f3e3c3 0%,#d9bb86 45%,#a8834f 100%)',
  goldSolid: '#cfae78',
  text: '#f2eee7',
  muted: '#a49d92',
  line: 'rgba(207,174,120,.35)',
};

const css = (w, h) => `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${w}px; height:${h}px; font-family:'Montserrat',sans-serif; background:${C.bg}; color:${C.text}; }
  .s { width:100%; height:100%; padding:${h > 1400 ? 250 : 200}px 90px 170px; display:flex; flex-direction:column; position:relative; overflow:hidden;
       background: radial-gradient(ellipse at 100% 0%, #3a2e1d 0%, transparent 55%),
                   radial-gradient(ellipse at 0% 100%, #1f1912 0%, transparent 50%), ${C.bg}; }
  .s::after { content:''; position:absolute; inset:28px; border:1px solid ${C.line}; pointer-events:none; }
  .brand { position:absolute; top:70px; left:90px; display:flex; align-items:center; gap:22px; }
  .brand img { height:70px; }
  .brand .n { font-size:25px; letter-spacing:7px; font-weight:500; color:${C.text}; line-height:1.15; }
  .brand .n small { display:block; font-size:15px; letter-spacing:6px; color:${C.goldSolid}; }
  .motto { position:absolute; top:74px; right:90px; font-size:15px; letter-spacing:5px; color:${C.muted}; text-align:left; line-height:1.6; }
  .motto::after { content:''; display:block; width:40px; height:2px; background:${C.goldSolid}; margin-top:10px; }
  .gold { background:${C.gold}; -webkit-background-clip:text; background-clip:text; color:transparent; }
  .tag { font-size:24px; font-weight:600; letter-spacing:6px; color:${C.goldSolid}; text-transform:uppercase; margin-bottom:34px; }
  h1 { font-size:74px; line-height:1.08; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
  h1 .big { display:block; font-size:118px; font-weight:800; letter-spacing:-1px; line-height:1; margin:10px 0; }
  h2 { font-size:58px; line-height:1.12; font-weight:700; text-transform:uppercase; margin-bottom:44px; }
  .sub { font-size:36px; line-height:1.45; color:${C.text}; margin-top:40px; font-weight:400; max-width:820px; }
  p { font-size:35px; line-height:1.5; color:#d9d3c9; margin-bottom:28px; }
  b, .hl { color:${C.goldSolid}; font-weight:700; }
  ul { list-style:none; }
  li { font-size:34px; line-height:1.4; margin-bottom:30px; padding-left:96px; position:relative; color:#e3ddd3; min-height:70px; }
  li::before { content:attr(data-n); position:absolute; left:0; top:-4px; width:66px; height:66px; border:2px solid ${C.goldSolid}; border-radius:12px;
       color:${C.goldSolid}; font-size:28px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .rows div { display:flex; justify-content:space-between; align-items:center; font-size:38px; padding:26px 30px; margin-bottom:16px;
       border:1px solid ${C.line}; border-radius:14px; background:rgba(255,255,255,.03); }
  .rows div span:last-child { font-weight:700; color:${C.goldSolid}; }
  .note { font-size:24px; color:${C.muted}; margin-top:22px; }
  .cta { margin-top:52px; display:inline-block; border:2px solid ${C.goldSolid}; color:${C.goldSolid}; font-size:30px; font-weight:600; letter-spacing:4px;
       text-transform:uppercase; padding:26px 40px; border-radius:6px; align-self:flex-start; }
  .foot { position:absolute; left:90px; right:90px; bottom:72px; display:flex; justify-content:space-between; align-items:center;
       font-size:17px; letter-spacing:4px; color:${C.muted}; font-weight:500; white-space:nowrap; }
  .foot .l::before { content:''; display:inline-block; width:70px; height:2px; background:${C.goldSolid}; vertical-align:middle; margin-right:22px; }
  .mid { margin-top:auto; margin-bottom:auto; }
`;

const chrome = (n, total) => `
  <div class="brand"><img src="${mark}"><div class="n">RENAN SANTOS<small>PATRIMÔNIO</small></div></div>
  <div class="motto">CADA<br>AQUISIÇÃO<br>DEVE<br>CONSTRUIR<br>A PRÓXIMA.</div>
  <div class="foot"><span class="l">IMÓVEIS | CONSULTORIA | PATRIMÔNIO</span>
  <span>${n ? n + '/' + total + ' &nbsp; ' : ''}CASCAVEL | PR</span></div>`;

(async () => {
  const browser = await chromium.launch();
  const items = [...post.slides.map((s, i) => ({ html: s, name: `slide-${i + 1}.jpg`, w: 1080, h: 1350, n: i + 1 })),
                 ...(post.story ? [{ html: post.story, name: 'story.jpg', w: 1080, h: 1920 }] : [])];
  // Foto de fundo opcional: post.json "bg": "foto.jpg" (capa e story) e "bg_all": true (todos os slides, mais escuro)
  const bgData = post.bg ? 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, post.bg)).toString('base64') : null;
  const bgStyle = (it) => {
    if (!bgData) return '';
    const isCover = it.n === 1 || !it.n;
    if (!isCover && !post.bg_all) return '';
    const shade = isCover
      ? 'linear-gradient(90deg, rgba(10,10,10,.96) 0%, rgba(10,10,10,.85) 38%, rgba(10,10,10,.25) 75%, rgba(10,10,10,.1) 100%), linear-gradient(0deg, rgba(10,10,10,.9) 0%, rgba(10,10,10,0) 30%)'
      : 'linear-gradient(rgba(10,10,10,.88), rgba(10,10,10,.88))';
    return ` style="background:${shade}, url('${bgData}') center/cover no-repeat"`;
  };
  for (const it of items) {
    const page = await browser.newPage({ viewport: { width: it.w, height: it.h }, deviceScaleFactor: 1 });
    await page.setContent(`<html><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=block" rel="stylesheet">
      <style>${css(it.w, it.h)}</style></head>
      <body><div class="s"${bgStyle(it)}>${chrome(it.n, post.slides.length)}${it.html}</div></body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(dir, it.name), type: 'jpeg', quality: 92 });
    await page.close();
    console.log('ok', it.name);
  }
  await browser.close();
})();
