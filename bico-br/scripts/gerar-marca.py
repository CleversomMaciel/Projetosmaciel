#!/usr/bin/env python3
"""Gera as versões da marca Bico BR em SVG (web/assets/marca/).
O texto "BicoBR" já está convertido em curvas (Montserrat ExtraBold Itálico, licença SIL OFL) em
scripts/marca-wordmark.json, então os arquivos não dependem de fonte instalada.
Uso: python3 scripts/gerar-marca.py"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'assets', 'marca')
W = json.load(open(os.path.join(ROOT, 'scripts', 'marca-wordmark.json')))

VERDE_PROFUNDO = '#071B12'; MUSGO = '#1B5E20'; DOURADO = '#D4AF37'; AMARELO = '#FFCA05'; BRANCO = '#FFFFFF'

def defs(uid):
    return (f'<defs><linearGradient id="ouro{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{AMARELO}"/><stop offset="1" stop-color="{DOURADO}"/></linearGradient>'
            f'<linearGradient id="arco{uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{DOURADO}"/><stop offset=".55" stop-color="{AMARELO}"/><stop offset="1" stop-color="{DOURADO}"/></linearGradient></defs>')

B_PATH = ('M17 6h19c8.6 0 13.8 4.2 13.8 10.9 0 4.2-2.2 7.4-6 8.9 5.3 1.4 8.6 5.4 8.6 10.6C52.4 44.2 46 49 36.4 49H17z'
          'M26.5 13.8v8.4h8.2c3 0 5-1.6 5-4.2s-2-4.2-5-4.2zM26.5 29.3v12h9c3.5 0 5.8-2.2 5.8-6s-2.3-6-5.8-6z')

def symbol(uid, mode='cor', b=None):
    """Símbolo em caixa 64x64. mode: cor | mono (uma cor só)."""
    if mode == 'mono':
        c = b
        return (f'<path d="M4 46c5 11 27 16 48 6 4-2 7-5 9-8-13 9-36 11-49 2-3-2-6-2-8 0z" fill="{c}"/>'
                f'<g transform="skewX(-9) translate(7 0)"><path fill="{c}" fill-rule="evenodd" d="{B_PATH}"/></g>'
                f'<circle cx="20.5" cy="31" r="4.6" fill="{c}"/><path d="M10.5 47.5c0-6.2 4.4-10 10-10s10 3.8 10 10z" fill="{c}"/>'
                f'<path d="M22.5 37.5h15.2c.9 0 1.5.7 1.3 1.6l-1.7 7.4h-16.4z" fill="none" stroke="{c}" stroke-width="2" stroke-linejoin="round"/>')
    bfill = b or VERDE_PROFUNDO
    return (f'<path d="M4 46c5 11 27 16 48 6 4-2 7-5 9-8-13 9-36 11-49 2-3-2-6-2-8 0z" fill="url(#arco{uid})"/>'
            f'<path d="M7 47.2c8.5 7.6 27.5 9.6 43.5 1.4-15 5.4-32 5-43.5-1.4z" fill="{MUSGO}"/>'
            f'<g transform="skewX(-9) translate(7 0)"><path fill="{bfill}" fill-rule="evenodd" d="{B_PATH}"/></g>'
            f'<circle cx="20.5" cy="31" r="4.6" fill="url(#ouro{uid})" stroke="{VERDE_PROFUNDO}" stroke-width="1.6"/>'
            f'<path d="M10.5 47.5c0-6.2 4.4-10 10-10s10 3.8 10 10z" fill="url(#ouro{uid})" stroke="{VERDE_PROFUNDO}" stroke-width="1.6"/>'
            f'<path d="M22.5 37.5h15.2c.9 0 1.5.7 1.3 1.6l-1.7 7.4h-16.4z" fill="{BRANCO}" stroke="{VERDE_PROFUNDO}" stroke-width="1.6" stroke-linejoin="round"/>'
            f'<path d="M18.5 47.5h21" stroke="{VERDE_PROFUNDO}" stroke-width="1.8" stroke-linecap="round"/>')

def wordmark(bico_fill, br_fill, x, base, scale):
    t = f'translate({x} {base}) scale({scale})'
    return (f'<g transform="{t}"><path fill="{bico_fill}" d="{W["bico"]}"/><path fill="{br_fill}" d="{W["br"]}"/></g>')

def underline(x1, x2, y, fill):
    return f'<path d="M{x1} {y+3}C{x1+60} {y-2} {x2-40} {y-6} {x2} {y-5}c-70 6-140 9-{x2-x1} 8z" fill="{fill}"/>'

def svg(vb, body, label='Bico BR'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{label}">{body}</svg>\n'

def write(name, content):
    with open(os.path.join(OUT, name), 'w') as fh: fh.write(content)

os.makedirs(OUT, exist_ok=True)
S = 66 / W['ascent']                       # altura das maiúsculas = 66
WW = W['width'] * S
# horizontal: símbolo (128) + texto
def horizontal(uid, bico, br, under, sym_mode='cor', b=None):
    return svg(f'0 0 {round(150 + WW + 12)} 132', defs(uid) + f'<g transform="scale(2)">{symbol(uid, sym_mode, b)}</g>'
               + wordmark(bico, br, 148, 96, S) + underline(205, round(148 + WW), 116, under))
write('logo-horizontal.svg', horizontal('h', VERDE_PROFUNDO, DOURADO, MUSGO))
write('logo-horizontal-negativa.svg', horizontal('n', BRANCO, AMARELO, AMARELO, b=BRANCO))
write('logo-mono-verde.svg', horizontal('m', VERDE_PROFUNDO, VERDE_PROFUNDO, VERDE_PROFUNDO, 'mono', VERDE_PROFUNDO))
write('logo-mono-branca.svg', horizontal('w', BRANCO, BRANCO, BRANCO, 'mono', BRANCO))
# vertical: símbolo em cima, texto embaixo
SV = 58 / W['ascent']; WV = W['width'] * SV; VB_W = max(WV + 20, 180)
write('logo-vertical.svg', svg(f'0 0 {round(VB_W)} 238', defs('v') + f'<g transform="translate({(VB_W - 160) / 2} 0) scale(2.5)">{symbol("v")}</g>'
                               + wordmark(VERDE_PROFUNDO, DOURADO, (VB_W - WV) / 2, 222, SV)))
# símbolo isolado, favicon e ícone de aplicativo
write('simbolo.svg', svg('0 0 64 64', defs('s') + symbol('s')))
write('simbolo-negativo.svg', svg('0 0 64 64', defs('k') + symbol('k', b=BRANCO)))
icon = lambda uid, pad: svg('0 0 64 64', defs(uid) + f'<rect width="64" height="64" rx="14" fill="{VERDE_PROFUNDO}"/>'
                            f'<g transform="translate({pad} {pad - .8}) scale({(64 - 2 * pad) / 64})">{symbol(uid, b=BRANCO)}</g>')
write('favicon.svg', icon('f', 3))
write('icone-app.svg', icon('a', 7))
print('ok:', sorted(os.listdir(OUT)))
