"""Casa Pátio — imagens de apresentação (ilustrações geradas por código, não renders fotográficos).

Gera em ../imagens/: fachada moderna (portão fechado e vista da casa), plantas humanizadas das duas
etapas, perspectivas isométricas em corte das duas etapas e uma prancha-resumo com tudo.
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon, Circle, Ellipse, FancyBboxPatch
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

from planta_fase2 import WALLS, MUROS, OPEN, FURN

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "imagens")
REV = "R01"

WOOD = "#a9713f"
WOOD_D = "#7d5029"
DARK = "#2f3133"
CONC = "#8f8d88"
WHITE = "#f3efe6"
GLASS = "#9fd0e8"
GREEN = "#5d9b4a"
GREEN_D = "#356b2c"
FLOOR = "#e9dcc6"
WET = "#cfd8dc"

GLASS_WALLS = {5, 7}


# ============================================================================ fachada
def sky(ax, x0, x1, y0, y1):
    grad = np.linspace(0, 1, 200).reshape(-1, 1)
    ax.imshow(grad, extent=(x0, x1, y0, y1), origin="lower", aspect="auto", zorder=0,
              cmap=matplotlib.colors.LinearSegmentedColormap.from_list("s", ["#f6c9a0", "#b9c7dc", "#5e7fae"]))


def ripado(ax, x0, y0, x1, y1, step=0.09, z=5, top=None):
    """Painel ripado vertical. top=(yl, yr) permite topo inclinado."""
    x = x0
    while x < x1 - 1e-6:
        xa, xb = x, min(x + step * 0.62, x1)
        if top:
            ya = top[0] + (top[1] - top[0]) * (xa - x0) / (x1 - x0)
            yb = top[0] + (top[1] - top[0]) * (xb - x0) / (x1 - x0)
        else:
            ya = yb = y1
        ax.add_patch(Polygon([(xa, y0), (xb, y0), (xb, yb), (xa, ya)], fc=WOOD, ec=WOOD_D, lw=0.2, zorder=z))
        x += step


def plant(ax, x, y, s=1.0, z=9):
    rng = np.random.default_rng(abs(int(x * 100 + y * 10)) + 1)
    for a in np.linspace(-1.1, 1.1, 9):
        L = s * (0.55 + 0.25 * rng.random())
        ax.add_patch(Polygon([(x - 0.03 * s, y), (x + 0.03 * s, y), (x + np.sin(a) * L, y + np.cos(a) * L)],
                             fc=GREEN if rng.random() > 0.4 else GREEN_D, ec="none", zorder=z))


def glow(ax, x, y, w=0.9, h=1.6, z=8):
    for k, a in enumerate((0.10, 0.10, 0.12)):
        ax.add_patch(Ellipse((x, y), w * (1 - 0.25 * k), h * (1 - 0.25 * k), fc="#ffd27a", ec="none", alpha=a, zorder=z))


def top_line(x):
    """Linha de topo inclinada da fachada da casa: 4,70 m à esquerda, 3,50 m à direita."""
    return 4.70 + (3.50 - 4.70) * x / 8.0


def casa_frontal(ax, z=2, detail=True):
    """Fachada da casa (a 5,50 m do alinhamento)."""
    ax.add_patch(Polygon([(0, 0), (8, 0), (8, top_line(8)), (0, top_line(0))], fc=WHITE, ec="#55524c", lw=0.8, zorder=z))
    # faixa escura de coroamento acompanhando a inclinação
    ax.add_patch(Polygon([(0, top_line(0) - 0.22), (8, top_line(8) - 0.22), (8, top_line(8)), (0, top_line(0))],
                         fc=DARK, ec="none", zorder=z + 1))
    # painel ripado alto envolvendo a entrada (x 3,75–5,45)
    ripado(ax, 3.75, 0.15, 5.45, 0, z=z + 2, top=(top_line(3.75) - 0.22, top_line(5.45) - 0.22))
    if detail:
        ax.add_patch(Rectangle((4.15, 0.15), 0.90, 2.25, fc=WOOD_D, ec="#3d2714", lw=0.8, zorder=z + 3))   # porta
        ax.add_patch(Rectangle((4.93, 1.0), 0.04, 0.5, fc="#d9d9d9", ec="none", zorder=z + 4))             # puxador
        # marquise fina
        ax.add_patch(Rectangle((3.55, 2.48), 2.1, 0.10, fc=DARK, ec="none", zorder=z + 4))
        # moldura escura saliente com vidro do estar (J1 1,80 × 1,20, peitoril 1,05)
        ax.add_patch(Rectangle((1.42, 0.87), 2.16, 1.56, fc=DARK, ec="none", zorder=z + 2))
        ax.add_patch(Rectangle((1.60, 1.05), 1.80, 1.20, fc=GLASS, ec="#1d1d1d", lw=0.8, zorder=z + 3))
        ax.plot([2.5, 2.5], [1.05, 2.25], color="#1d1d1d", lw=0.8, zorder=z + 4)
        ax.add_patch(Polygon([(1.6, 1.05), (2.1, 1.05), (1.6, 1.9)], fc="white", ec="none", alpha=0.25, zorder=z + 4))
        # lavanderia: janela J2 escondida por painel de brises horizontais
        ax.add_patch(Rectangle((5.90, 1.25), 1.40, 1.00, fc=GLASS, ec="#1d1d1d", lw=0.6, zorder=z + 2))
        for yy in np.arange(0.95, 2.50, 0.11):
            ax.add_patch(Rectangle((5.75, yy), 1.70, 0.05, fc=DARK, ec="none", zorder=z + 3))
        # base em pedra/porcelanato escuro à esquerda
        ax.add_patch(Rectangle((0.2, 0.15), 1.05, top_line(0.7) - 0.42, fc="#b9b2a3", ec="none", zorder=z + 1))
        for yy in np.arange(0.55, 4.2, 0.4):
            ax.plot([0.2, 1.25], [yy, yy], color="#a49d8e", lw=0.4, zorder=z + 2)
        glow(ax, 0.72, 1.3, 0.8, 2.2, z=z + 3)
        glow(ax, 4.6, 2.3, 1.6, 0.8, z=z + 5)
        ax.add_patch(Rectangle((0, 0), 8, 0.15, fc="#b5b0a6", ec="none", zorder=z + 1))                   # soleira
        plant(ax, 1.0, 0.15, 0.9, z=z + 6)
        plant(ax, 3.55, 0.15, 0.7, z=z + 6)
        plant(ax, 7.6, 0.15, 0.8, z=z + 6)


def fachada_rua(ax):
    ax.set_xlim(-1.2, 9.2)
    ax.set_ylim(-0.7, 6.0)
    ax.set_aspect("equal")
    ax.axis("off")
    sky(ax, -1.2, 9.2, 0, 6.0)
    ax.add_patch(Rectangle((-1.2, -0.7), 10.4, 0.7, fc="#77736c", ec="none", zorder=1))                    # rua
    ax.add_patch(Rectangle((-1.2, -0.22), 10.4, 0.22, fc="#c9c4ba", ec="none", zorder=1))                  # passeio
    # vizinhos esmaecidos
    ax.add_patch(Rectangle((-1.2, 0), 1.2, 2.2, fc="#b9b5ad", ec="none", zorder=1))
    ax.add_patch(Rectangle((8, 0), 1.2, 2.2, fc="#b9b5ad", ec="none", zorder=1))
    # casa ao fundo (só a parte acima do portão aparece)
    casa_frontal(ax, z=2, detail=False)
    # ---- fechamento frontal
    # lâmina vertical (totem) à esquerda com número
    ax.add_patch(Polygon([(0, 0), (0.30, 0), (0.30, 4.05), (0, 4.25)], fc=DARK, ec="none", zorder=12))
    ax.text(0.15, 3.3, "128", fontsize=9, color="#f2d9a0", rotation=90, ha="center", va="center", zorder=13,
            fontweight="bold")
    # portão social em ripado, com bandeira ripada até a testeira
    ripado(ax, 0.30, 0.03, 1.30, 2.40, z=11)
    ax.add_patch(Rectangle((1.18, 1.0), 0.04, 0.45, fc="#e3e3e3", ec="none", zorder=12))
    # pilares
    for x0, x1 in ((1.30, 1.60), (7.70, 8.00)):
        ax.add_patch(Rectangle((x0, 0), x1 - x0, 2.40, fc=CONC, ec="none", zorder=11))
    # testeira em cunha (inclinada): 3,20 m à esquerda, 2,62 m à direita
    ax.add_patch(Polygon([(0.30, 2.40), (8.0, 2.40), (8.0, 2.62), (0.30, 3.20)], fc=DARK, ec="none", zorder=12))
    ax.plot([0.30, 8.0], [3.20, 2.62], color="#f2d9a0", lw=1.2, zorder=13)                                 # fita de LED
    # portão basculante com lambril horizontal
    ax.add_patch(Rectangle((1.60, 0.03), 6.10, 2.37, fc="#3a3d40", ec="#1b1b1b", lw=1.0, zorder=10))
    for yy in np.arange(0.15, 2.40, 0.125):
        ax.plot([1.63, 7.67], [yy, yy], color="#5a5e62", lw=0.6, zorder=11)
    ax.plot([4.65, 4.65], [0.03, 2.40], color="#24272a", lw=1.0, zorder=11)
    # luzes de piso e plantas
    for gx in (1.45, 7.85):
        glow(ax, gx, 1.0, 0.5, 2.0, z=13)
    plant(ax, -0.35, -0.02, 0.8, z=14)
    plant(ax, 8.45, -0.02, 0.7, z=14)
    ax.text(4.0, 5.72, "FACHADA DA RUA — portão basculante fechado", fontsize=10, fontweight="bold", ha="center",
            zorder=20)


def fachada_casa(ax):
    ax.set_xlim(-1.2, 9.2)
    ax.set_ylim(-0.7, 6.0)
    ax.set_aspect("equal")
    ax.axis("off")
    sky(ax, -1.2, 9.2, 0, 6.0)
    ax.add_patch(Rectangle((-1.2, -0.7), 10.4, 0.7, fc="#bdb7aa", ec="none", zorder=1))                    # piso garagem
    for xx in np.arange(-1.2, 9.2, 0.4):
        ax.plot([xx, xx], [-0.7, 0], color="#a9a396", lw=0.3, zorder=1)
    for x0 in (-0.2, 8.0):
        ax.add_patch(Rectangle((x0, 0), 0.2, 2.2, fc="#a7a39b", ec="none", zorder=3))                      # muros laterais
    casa_frontal(ax, z=2, detail=True)
    ax.text(4.0, 5.72, "FACHADA DA CASA — vista de dentro da garagem (portão aberto)", fontsize=10,
            fontweight="bold", ha="center", zorder=20)
    for x, t in ((0.0, "4,70"), (8.0, "3,50")):
        ax.text(x + (0.12 if x else -0.12), top_line(x) + 0.12, t + " m", fontsize=6, ha="left" if x else "right",
                zorder=20)


# ============================================================================ planta humanizada
def humanizada(ax, etapa, title=True):
    ax.set_xlim(-0.4, 8.4)
    ax.set_ylim(-0.9, 25.9)
    ax.set_aspect("equal")
    ax.axis("off")
    R = lambda r, **k: ax.add_patch(Rectangle((r[0], r[1]), r[2] - r[0], r[3] - r[1], **k))
    R((-0.4, -0.9, 8.4, 0), fc="#c9c4ba", ec="none")
    R((0, 0, 8, 25), fc="#d8d2c4", ec="none")
    R((0.2, 0, 7.8, 5.5), fc="#bdb7aa", ec="none")                                    # garagem drenante
    for xx in np.arange(0.2, 7.8, 0.4):
        ax.plot([xx, xx], [0, 5.5], color="#a9a396", lw=0.25)
    R((0.2, 5.7, 7.8, 10.2), fc=FLOOR, ec="none")
    R((0.2, 10.35, 4.85, 24.8), fc=FLOOR, ec="none")
    for r in ((0.2, 10.35, 3.4, 11.55), (0.2, 14.35, 3.4, 15.85), (0.2, 18.65, 3.4, 20.15), (5.35, 5.7, 7.8, 7.2)):
        R(r, fc=WET, ec="none")
    R((0.2, 20.3, 3.4, 21.8), fc="#d9c3a0", ec="none")                                # closet
    R((5.0, 10.35, 7.8, 22.25), fc="#86b56a", ec="none")                              # pátio
    R((5.0, 22.4, 7.8, 24.8), fc="#c9a26f", ec="none")                                # deck do spa
    R((5.45, 22.75, 7.35, 24.45), fill=False, ec="#7d5029", lw=0.8, ls="--")
    ax.text(6.4, 23.6, "base do spa", fontsize=4.5, ha="center", va="center", color="#5b3a1c")
    rng = np.random.default_rng(7)
    garden = [(5.0, 10.35, 7.8, 22.25)] if etapa == 1 else [(5.0, 10.35, 7.8, 14.0), (5.0, 19.0, 7.8, 22.25)]
    for g in garden:
        n = int((g[3] - g[1]) * 2.2)
        for _ in range(n):
            ax.add_patch(Circle((rng.uniform(g[0] + 0.3, g[2] - 0.3), rng.uniform(g[1] + 0.3, g[3] - 0.3)),
                                rng.uniform(0.15, 0.33), fc=GREEN_D if rng.random() > 0.5 else "#4f8f3d", ec="none",
                                alpha=0.9))
        for yy in np.arange(g[1] + 0.5, g[3] - 0.4, 0.75):
            R((5.9, yy, 6.9, yy + 0.5), fc="#e6e0d2", ec="none")
    if etapa == 2:
        R((5.0, 14.0, 7.8, 19.0), fc="#d9c7a6", ec="none")
        R((7.0, 18.1, 7.8, 19.0), fc="#a0522d", ec="k", lw=0.4)
        R((7.2, 15.6, 7.8, 18.1), fc="#4a4a4a", ec="k", lw=0.4)
        R((7.3, 16.5, 7.7, 17.1), fc="#c8c8c8", ec="k", lw=0.3)
        R((5.5, 15.2, 6.4, 17.4), fc=WOOD, ec=WOOD_D, lw=0.5)
        for yy in (15.45, 16.1, 16.75):
            for xx in (5.2, 6.5):
                R((xx, yy, xx + 0.25, yy + 0.4), fc="#e4d7bf", ec=WOOD_D, lw=0.3)
        for yy in np.arange(14.0, 19.01, 0.5):
            ax.plot([5.0, 7.8], [yy, yy], color=WOOD_D, lw=1.6, alpha=0.75)
        for p in ((5.15, 14.15), (7.65, 14.15), (5.15, 18.85), (7.65, 18.85)):
            R((p[0] - 0.1, p[1] - 0.1, p[0] + 0.1, p[1] + 0.1), fc=WOOD_D, ec="k", lw=0.3)
    # móveis (medidas reais, lista FURN)
    for x0, y0, x1, y1, kind, col, h in FURN:
        if kind in ("bed", "bedL"):
            R((x0, y0, x1, y1), fc=col, ec="#8a8172", lw=0.5)
            if kind == "bed":      # cabeceira nos fundos
                R((x0, y1 - 0.12, x1, y1), fc=WOOD, ec="none")
                R((x0 + 0.1, y1 - 0.62, (x0 + x1) / 2 - 0.05, y1 - 0.2), fc="white", ec="#b9b2a3", lw=0.3)
                R(((x0 + x1) / 2 + 0.05, y1 - 0.62, x1 - 0.1, y1 - 0.2), fc="white", ec="#b9b2a3", lw=0.3)
                R((x0, y0, x1, y0 + 0.7), fc="#b7a98f", ec="none")
            else:                  # cabeceira na parede esquerda
                R((x0, y0, x0 + 0.12, y1), fc=WOOD, ec="none")
                R((x0 + 0.2, y0 + 0.1, x0 + 0.62, (y0 + y1) / 2 - 0.05), fc="white", ec="#b9b2a3", lw=0.3)
                R((x0 + 0.2, (y0 + y1) / 2 + 0.05, x0 + 0.62, y1 - 0.1), fc="white", ec="#b9b2a3", lw=0.3)
                R((x1 - 0.7, y0, x1, y1), fc="#b7a98f", ec="none")
        elif kind == "shower":
            R((x0, y0, x1, y1), fc=col, ec="#5f8ea3", lw=0.5)
            ax.add_patch(Circle((x0 + 0.3, (y0 + y1) / 2), 0.1, fc="#8fb6c9", ec="#5f8ea3", lw=0.3))
        elif kind == "wc":
            horiz = (x1 - x0) > (y1 - y0)
            ax.add_patch(Ellipse(((x0 + x1) / 2, (y0 + y1) / 2), x1 - x0, y1 - y0, fc="white", ec="#777", lw=0.5))
        elif kind == "sofa":
            R((x0, y0, x1, y1), fc=col, ec="#8a8172", lw=0.5)
            R((x1 - 0.22, y0, x1, y1), fc="#b0a691", ec="none")
            for yy in (y0, y1 - 0.18):
                R((x0, yy, x1, yy + 0.18), fc="#b0a691", ec="none")
        elif kind == "sink":
            R((x0, y0, x1, y1), fc=col, ec="#555", lw=0.4)
            ax.add_patch(Circle(((x0 + x1) / 2, (y0 + y1) / 2), 0.05, fc="#555", ec="none"))
        elif kind == "cook":
            R((x0, y0, x1, y1), fc=col, ec="k", lw=0.3)
            for cx_ in (x0 + 0.12, x1 - 0.12):
                for cy_ in (y0 + 0.18, y1 - 0.18):
                    ax.add_patch(Circle((cx_, cy_), 0.08, fill=False, ec="#bbbbbb", lw=0.4))
        else:
            R((x0, y0, x1, y1), fc=col, ec="#5a5348", lw=0.4)
    for x0, c in ((1.0, "#e9e9e9"), (5.5, "#3d3d3d")):                                # carros 1,85 × 4,90
        ax.add_patch(FancyBboxPatch((x0, 0.3), 1.85, 4.9, boxstyle="round,pad=0,rounding_size=0.45", fc=c, ec="#222",
                                    lw=0.5))
        ax.add_patch(FancyBboxPatch((x0 + 0.2, 1.3), 1.45, 2.5, boxstyle="round,pad=0,rounding_size=0.3", fc="#8fb6c9",
                                    ec="#222", lw=0.3))
    # paredes
    for w in MUROS:
        R(w, fc="#8a8a8a", ec="none")
    for i, w in enumerate(WALLS):
        R(w, fc="#2b2b2b", ec="none")
    for x0, y0, x1, y1, kind, tag in OPEN:
        R((x0, y0, x1, y1), fc=FLOOR if kind in ("door", "void") else "white", ec="none")
        if kind in ("win", "glass"):
            if (x1 - x0) > (y1 - y0):
                ax.plot([x0, x1], [(y0 + y1) / 2] * 2, color="#2f8fd0", lw=1.6)
            else:
                ax.plot([(x0 + x1) / 2] * 2, [y0, y1], color="#2f8fd0", lw=1.6)
    # pórtico e portões
    for x0, x1 in ((0, 0.30), (1.30, 1.60), (7.70, 8.0)):
        R((x0, 0, x1, 0.30), fc=DARK, ec="none")
    ax.plot([1.6, 7.7], [0.15, 0.15], color=DARK, lw=2.2)
    ax.plot([0.3, 1.3], [0.15, 0.15], color=WOOD_D, lw=2.2)
    labels = [(4.1, 23.2, "SUÍTE\nMASTER"), (1.8, 21.05, "CLOSET"), (1.75, 19.7, "BANHO SUÍTE"), (2.75, 16.75, "DEMI-\nSUÍTE 01"),
              (2.75, 15.3, "BANHO"), (2.75, 13.75, "DEMI-\nSUÍTE 02"), (2.75, 10.75, "LAVABO"), (1.2, 8.03, "ESTAR / JANTAR"),
              (6.2, 9.3, "COZINHA"), (6.3, 6.7, "LAVAND."), (4.2, 2.8, "GARAGEM"), (4.2, 17.0, "CORREDOR 1,30")]
    for x, y, t in labels:
        ax.text(x, y, t, fontsize=4.4, ha="center", va="center", fontweight="bold", color="#3a342a",
                rotation=90 if t.startswith("CORREDOR") else 0)
    ax.text(6.4, 16.9 if etapa == 2 else 16.3, "ÁREA GOURMET" if etapa == 2 else "PÁTIO CENTRAL", fontsize=4.8,
            ha="center", va="center", fontweight="bold", color="#3a2a12" if etapa == 2 else "white",
            bbox=dict(fc="#f1e3c6" if etapa == 2 else "none", ec="none", pad=0.5))
    if title:
        ax.text(4.0, 25.35, f"PLANTA — ETAPA {etapa}", fontsize=10, fontweight="bold", ha="center")
    ax.text(4.0, -0.5, "RUA", fontsize=6, ha="center", va="center")


# ============================================================================ isométrica em corte
def shade(color, f):
    c = np.array(matplotlib.colors.to_rgb(color))
    return tuple(np.clip(c * f, 0, 1))


def box(polys, x0, y0, z0, x1, y1, z1, color, alpha=1.0, top=None):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [((4, 5, 6, 7), 1.0), ((0, 1, 5, 4), 0.80), ((1, 2, 6, 5), 0.66), ((2, 3, 7, 6), 0.72), ((3, 0, 4, 7), 0.88)]
    for idx, f in faces:
        c = shade(top if (top and f == 1.0) else color, f)
        polys.append(([v[i] for i in idx], c, alpha))


def tiles(polys, x0, y0, x1, y1, z, color, step=1.0):
    xs = np.append(np.arange(x0, x1 - 1e-6, step), x1)
    ys = np.append(np.arange(y0, y1 - 1e-6, step), y1)
    for a, b in zip(xs[:-1], xs[1:]):
        for c, d in zip(ys[:-1], ys[1:]):
            polys.append(([(a, c, z), (b, c, z), (b, d, z), (a, d, z)], matplotlib.colors.to_rgb(color), 1.0))


def wall_segments(w, openings):
    """Divide a parede em trechos cheios e vãos ao longo do eixo maior."""
    x0, y0, x1, y1 = w
    horiz = (x1 - x0) > (y1 - y0)
    a0, a1 = (x0, x1) if horiz else (y0, y1)
    cuts = []
    for ox0, oy0, ox1, oy1, kind, tag in openings:
        inside = (oy0 >= y0 - 1e-6 and oy1 <= y1 + 1e-6 and ox0 >= x0 - 1e-6 and ox1 <= x1 + 1e-6)
        if inside:
            cuts.append(((ox0, ox1) if horiz else (oy0, oy1), kind))
    cuts.sort()
    segs, pos = [], a0
    for (c0, c1), kind in cuts:
        if c0 > pos:
            segs.append((pos, c0, "wall"))
        segs.append((c0, c1, kind))
        pos = c1
    if pos < a1:
        segs.append((pos, a1, "wall"))
    return horiz, segs


def isometrica(ax, etapa):
    P = []
    H = 2.8
    tiles(P, -0.6, -1.2, 8.6, 0, 0.0, "#c9c4ba")                       # passeio
    tiles(P, 0, 0, 8, 5.5, 0.0, "#bdb7aa")                             # garagem
    tiles(P, 0.2, 5.7, 7.8, 10.2, 0.15, FLOOR)
    tiles(P, 0.2, 10.2, 4.85, 24.8, 0.15, FLOOR)
    for r in ((0.2, 10.35, 3.4, 11.55), (0.2, 14.35, 3.4, 15.85), (0.2, 18.65, 3.4, 20.15), (5.35, 5.7, 7.8, 7.2)):
        tiles(P, r[0], r[1], r[2], r[3], 0.16, WET)
    if etapa == 1:
        tiles(P, 5.0, 10.35, 7.8, 22.25, 0.05, "#7fb062")
    else:
        tiles(P, 5.0, 10.35, 7.8, 14.0, 0.05, "#7fb062")
        tiles(P, 5.0, 14.0, 7.8, 19.0, 0.08, "#d9c7a6")
        tiles(P, 5.0, 19.0, 7.8, 22.25, 0.05, "#7fb062")
    tiles(P, 5.0, 22.4, 7.8, 24.8, 0.10, "#c9a26f")
    for yy in np.arange(10.9, 22.0, 0.8):
        if etapa == 2 and 13.6 < yy < 19.0:
            continue
        box(P, 5.9, yy, 0.05, 6.9, yy + 0.5, 0.09, "#e6e0d2")
    # muros
    for (x0, y0, x1, y1) in MUROS:
        L = max(x1 - x0, y1 - y0)
        n = max(1, int(np.ceil(L / 1.5)))
        for k in range(n):
            if (x1 - x0) > (y1 - y0):
                box(P, x0 + (x1 - x0) * k / n, y0, 0, x0 + (x1 - x0) * (k + 1) / n, y1, 2.2, "#a7a39b")
            else:
                box(P, x0, y0 + (y1 - y0) * k / n, 0, x1, y0 + (y1 - y0) * (k + 1) / n, 2.2, "#a7a39b")
    # paredes com vãos
    for i, w in enumerate(WALLS):
        horiz, segs = wall_segments(w, OPEN)
        for a, b, kind in segs:
            n = max(1, int(np.ceil((b - a) / 1.2)))
            for k in range(n):
                s0, s1 = a + (b - a) * k / n, a + (b - a) * (k + 1) / n
                r = (s0, w[1], s1, w[3]) if horiz else (w[0], s0, w[2], s1)
                if kind == "wall":
                    box(P, r[0], r[1], 0.15, r[2], r[3], 0.15 + H, WHITE, top="#55524c")
                elif kind == "win":
                    box(P, r[0], r[1], 0.15, r[2], r[3], 1.15, WHITE, top="#55524c")
                    box(P, r[0], r[1], 1.15, r[2], r[3], 2.35, GLASS, alpha=0.45)
                elif kind == "glass":
                    box(P, r[0], r[1], 0.15, r[2], r[3], 2.75, GLASS, alpha=0.35)
    # móveis (lista FURN)
    for x0, y0, x1, y1, kind, col, h in FURN:
        if kind == "shower":
            box(P, x0, y0, 0.15, x1, y1, 0.15 + h, col, alpha=0.35)
        elif kind in ("bed", "bedL"):
            box(P, x0, y0, 0.15, x1, y1, 0.15 + h, col)
            if kind == "bed":
                box(P, x0, y1 - 0.08, 0.15, x1, y1, 1.25, WOOD)
            else:
                box(P, x0, y0, 0.15, x0 + 0.08, y1, 1.25, WOOD)
        else:
            box(P, x0, y0, 0.15, x1, y1, 0.15 + h, col)
    for x0, c in ((1.0, "#e9e9e9"), (5.5, "#3d3d3d")):
        box(P, x0, 0.35, 0.15, x0 + 1.85, 5.2, 0.85, c)
        box(P, x0 + 0.15, 1.5, 0.85, x0 + 1.7, 3.9, 1.45, "#8fb6c9")
    # pórtico frontal com testeira inclinada
    box(P, 0, 0, 0, 0.3, 0.3, 4.1, DARK)
    for x0 in (1.30, 7.70):
        box(P, x0, 0, 0, x0 + 0.3, 0.3, 2.4, CONC)
    for k in range(8):
        xa, xb = 0.3 + 7.7 * k / 8, 0.3 + 7.7 * (k + 1) / 8
        zt = 3.20 + (2.62 - 3.20) * ((xa + xb) / 2 - 0.3) / 7.7
        box(P, xa, 0.05, 2.4, xb, 0.25, zt, DARK)
    box(P, 0.3, 0.12, 0.03, 1.3, 0.18, 2.4, WOOD, alpha=0.9)
    if etapa == 2:
        for p in ((5.15, 14.15), (7.65, 14.15), (5.15, 18.85), (7.65, 18.85)):
            box(P, p[0] - 0.08, p[1] - 0.08, 0.08, p[0] + 0.08, p[1] + 0.08, 2.6, WOOD_D)
        for xx in (5.15, 7.65):
            box(P, xx - 0.06, 14.0, 2.6, xx + 0.06, 19.0, 2.78, WOOD_D)
        for yy in np.arange(14.1, 19.0, 0.45):
            box(P, 5.0, yy, 2.78, 7.8, yy + 0.09, 2.9, WOOD)
        box(P, 7.0, 18.1, 0.08, 7.8, 19.0, 2.0, "#a0522d")
        box(P, 7.25, 18.35, 2.0, 7.55, 18.75, 3.6, "#8a4525")
        box(P, 7.2, 15.6, 0.08, 7.8, 18.1, 0.98, "#4a4a4a")
        box(P, 5.5, 15.2, 0.75, 6.4, 17.4, 0.83, WOOD)
    pc = Poly3DCollection([p[0] for p in P], facecolors=[(*p[1], p[2]) for p in P], edgecolors=(0, 0, 0, 0.18),
                          linewidths=0.15)
    ax.add_collection3d(pc)
    ax.set_xlim(-0.6, 8.6)
    ax.set_ylim(-1.2, 25.0)
    ax.set_zlim(0, 4.2)
    ax.set_box_aspect((9.2, 26.2, 4.2))
    ax.view_init(elev=38, azim=-128)
    ax.set_axis_off()


# ============================================================================ saída
def save(fig, name, dpi=220):
    fig.savefig(os.path.join(OUT, f"{name}_{REV}.png"), dpi=dpi, facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    os.makedirs(OUT, exist_ok=True)
    fig, ax = plt.subplots(figsize=(11, 7.1))
    fig.subplots_adjust(0, 0, 1, 1)
    fachada_rua(ax)
    save(fig, "CP-IMG-01_fachada-rua")
    fig, ax = plt.subplots(figsize=(11, 7.1))
    fig.subplots_adjust(0, 0, 1, 1)
    fachada_casa(ax)
    save(fig, "CP-IMG-02_fachada-casa")
    for e in (1, 2):
        fig, ax = plt.subplots(figsize=(4.6, 13.2))
        fig.subplots_adjust(0, 0, 1, 1)
        humanizada(ax, e)
        save(fig, f"CP-IMG-0{2 + e}_planta-humanizada-etapa{e}")
    for e in (1, 2):
        fig = plt.figure(figsize=(11, 9))
        ax = fig.add_axes([-0.12, -0.18, 1.24, 1.3], projection="3d")
        isometrica(ax, e)
        fig.text(0.5, 0.96, f"PERSPECTIVA EM CORTE — ETAPA {e}", fontsize=13, fontweight="bold", ha="center")
        save(fig, f"CP-IMG-0{4 + e}_perspectiva-etapa{e}", dpi=200)

    # prancha-resumo
    fig = plt.figure(figsize=(24, 15), facecolor="#2b2d2f")
    fig.text(0.015, 0.955, "CASA PÁTIO", fontsize=30, fontweight="bold", color="white")
    fig.text(0.015, 0.928, "Cascavel/PR  ·  terreno 8,00 × 25,00 m  ·  112,05 m² construídos  ·  fachada com testeira e coroamento inclinados",
             fontsize=12, color="#d8d2c4")
    a1 = fig.add_axes([0.01, 0.02, 0.14, 0.88]); a1.set_facecolor("#2b2d2f"); humanizada(a1, 1)
    a2 = fig.add_axes([0.155, 0.02, 0.14, 0.88]); humanizada(a2, 2)
    for a in (a1, a2):
        for t in a.texts:
            if t.get_text().startswith("PLANTA") or t.get_text() == "RUA":
                t.set_color("white")
    f1 = fig.add_axes([0.305, 0.47, 0.36, 0.44]); fachada_rua(f1)
    f2 = fig.add_axes([0.305, 0.02, 0.36, 0.44]); fachada_casa(f2)
    for e, y in ((1, 0.45), (2, 0.02)):
        ax = fig.add_axes([0.645, y - 0.03, 0.37, 0.56], projection="3d")
        ax.patch.set_alpha(0)
        isometrica(ax, e)
        fig.text(0.985, y + 0.43, f"ETAPA {e} — perspectiva em corte", fontsize=16, fontweight="bold", color="white", ha="right")
    fig.text(0.985, 0.012, "Ilustrações geradas a partir da planta aprovada. Estudo de linguagem; cores e materiais a definir. "
             "Exige projeto assinado por profissional habilitado.", fontsize=8, color="#bdb7aa", ha="right")
    save(fig, "CP-IMG-00_prancha-resumo", dpi=150)


if __name__ == "__main__":
    main()
