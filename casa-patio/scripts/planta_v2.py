"""Casa Pátio — PROPOSTA V2 para aprovação: corredor lateral externo e nova entrada da garagem.

Baseada na nova imagem de referência do proprietário. Gera uma prancha única em ../plantas/.
Coordenadas em metros: x = largura (0 a 8), y = profundidade (0 = rua, 25 = fundos).
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, Ellipse, FancyBboxPatch

from planta_fase2 import br, rect, dim_chain

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plantas")
REV = "P1"
DATA = "16/11/2026"

# faixas em x
XC0, XC1 = 0.20, 1.70      # corredor lateral externo (1,50)
XR0, XR1 = 1.90, 4.60      # quartos (2,70)
XI0, XI1 = 4.75, 5.65      # corredor interno (0,90)
XP0, XP1 = 5.80, 7.80      # pátio (2,00)

WALLS = [
    (1.70, 5.50, 1.90, 25.00),       # parede lateral da casa (com janelas para o corredor)
    (1.70, 5.50, 8.00, 5.70),        # frente
    (7.80, 5.50, 8.00, 12.00),       # divisa direita (social + lavanderia)
    (1.70, 24.80, 5.80, 25.00),      # fundos
    (1.90, 10.20, 4.75, 10.35),      # social / banho social
    (5.65, 10.20, 7.80, 10.35),      # social / lavanderia
    (4.60, 10.35, 4.75, 21.45),      # quartos / corredor interno
    (5.65, 10.35, 5.80, 12.00),      # corredor interno / lavanderia
    (5.80, 11.85, 7.80, 12.00),      # lavanderia / pátio
    (5.65, 12.00, 5.80, 21.45),      # corredor interno / pátio (vidro)
    (5.65, 21.45, 5.80, 24.80),      # suíte / spa
    (1.90, 11.85, 4.60, 12.00),
    (1.90, 15.00, 4.60, 15.15),
    (1.90, 18.15, 4.60, 18.30),
    (1.90, 19.80, 4.60, 19.95),
    (1.90, 21.45, 5.65, 21.60),      # frente da suíte
]
MUROS = [
    (0, 0, 0.20, 25.00), (7.80, 0, 8.00, 5.50), (7.80, 12.00, 8.00, 25.00),
    (0.20, 24.80, 1.70, 25.00), (5.80, 24.80, 7.80, 25.00), (5.80, 22.25, 7.80, 22.40),
]
OPEN = [
    (4.55, 5.50, 5.45, 5.70, "door", "P1"), (2.30, 5.50, 3.90, 5.70, "win", "J1"), (6.00, 5.50, 7.40, 5.70, "win", "J2"),
    (1.70, 22.40, 1.90, 24.00, "win", "J3"), (1.70, 18.75, 1.90, 19.35, "win", "J5"),
    (1.70, 15.90, 1.90, 17.10, "win", "J4"), (1.70, 12.75, 1.90, 13.95, "win", "J4"),
    (1.70, 10.80, 1.90, 11.40, "win", "J5"),
    (4.60, 10.70, 4.75, 11.40, "door", "P3"), (4.60, 14.10, 4.75, 14.90, "door", "P2"),
    (4.60, 17.25, 4.75, 18.05, "door", "P2"),
    (2.90, 19.80, 3.60, 19.95, "door", "P3"), (2.90, 21.45, 3.60, 21.60, "door", "P3"),
    (4.80, 21.45, 5.60, 21.60, "door", "P2"),
    (5.65, 10.65, 5.80, 11.45, "door", "P2"), (6.30, 11.85, 7.30, 12.00, "win", "J6"),
    (5.65, 12.00, 5.80, 21.45, "glass", "V2"), (5.65, 22.60, 5.80, 24.40, "glass", "V3"),
    (6.00, 22.25, 6.80, 22.40, "void", ""),
]
# (x centro, y centro, nome, largura, profundidade)
ROOMS = [
    (4.85, 7.95, "ESTAR / JANTAR / COZINHA", 5.90, 4.50),
    (6.8, 11.1, "LAVANDERIA", 2.00, 1.50),
    (3.25, 11.1, "BANHO SOCIAL", 2.70, 1.50),
    (3.25, 13.5, "QUARTO 03", 2.70, 3.00),
    (3.25, 16.65, "QUARTO 02", 2.70, 3.00),
    (3.25, 19.05, "BANHO SUÍTE", 2.70, 1.50),
    (3.25, 20.7, "CLOSET", 2.70, 1.50),
    (3.75, 23.2, "SUÍTE MASTER", 3.75, 3.20),
]
A_CORR = 0.90 * 11.25 + 1e-6
A_UTIL = sum(w * d for *_, w, d in ROOMS) + A_CORR
A_CONST = 6.30 * 4.85 + 2.35 * 1.65 + 4.10 * 14.65

# móveis: (x0, y0, x1, y1, tipo, cor)
W = "#a9713f"
FURN = [
    (3.00, 22.80, 4.60, 24.80, "bed", "#f7f3ea"), (2.55, 24.40, 3.00, 24.80, "box", W), (4.60, 24.40, 5.05, 24.80, "box", W),
    (1.90, 19.95, 2.45, 21.45, "box", W), (4.05, 19.95, 4.60, 21.45, "box", W),
    (1.90, 18.30, 2.80, 19.80, "shower", "#b5d6e6"), (3.50, 18.30, 4.60, 18.78, "box", "#efefef"), (2.95, 18.30, 3.35, 18.95, "wc", "#fff"),
    (1.90, 16.40, 3.78, 17.78, "bedL", "#f7f3ea"), (1.90, 15.15, 3.90, 15.65, "box", W),
    (1.90, 13.25, 3.78, 14.63, "bedL", "#f7f3ea"), (1.90, 12.00, 3.90, 12.50, "box", W),
    (1.90, 10.35, 2.80, 11.85, "shower", "#b5d6e6"), (3.50, 10.35, 4.50, 10.83, "box", "#efefef"), (2.95, 10.35, 3.35, 11.00, "wc", "#fff"),
    (1.90, 6.60, 2.35, 8.60, "box", W), (3.75, 6.50, 4.70, 8.70, "sofa", "#c9c0b0"), (2.75, 7.05, 3.30, 8.15, "box", "#7d5029"),
    (5.60, 5.70, 7.80, 6.30, "box", "#4a4a4a"), (6.40, 5.78, 7.00, 6.22, "sink", "#c8c8c8"), (7.20, 6.30, 7.80, 7.50, "box", "#4a4a4a"),
    (7.26, 6.55, 7.74, 7.25, "cook", "#1d1d1d"), (7.12, 7.50, 7.80, 8.18, "box", "#dcdcdc"),
    (6.10, 8.20, 7.00, 9.80, "box", W),
    (5.68, 8.28, 6.06, 8.68, "chair", "#e4d7bf"), (5.68, 8.80, 6.06, 9.20, "chair", "#e4d7bf"), (5.68, 9.32, 6.06, 9.72, "chair", "#e4d7bf"),
    (7.04, 8.28, 7.42, 8.68, "chair", "#e4d7bf"), (7.04, 8.80, 7.42, 9.20, "chair", "#e4d7bf"), (7.04, 9.32, 7.42, 9.72, "chair", "#e4d7bf"),
    (7.20, 10.40, 7.80, 11.00, "box", "#ffffff"), (7.20, 11.10, 7.80, 11.65, "sink", "#dfe7ea"),
]


def walls_and_openings(ax, wall_c="#3a3a3a", muro_c="#8a8a8a", floor="white", tags=True):
    for w in MUROS:
        rect(ax, w, fc=muro_c, ec="none")
    for w in WALLS:
        rect(ax, w, fc=wall_c, ec="none")
    for x0, y0, x1, y1, kind, tag in OPEN:
        rect(ax, (x0, y0, x1, y1), fc=floor if kind in ("door", "void") else "white", ec="none")
        horiz = (x1 - x0) > (y1 - y0)
        if kind in ("win", "glass"):
            lw = 1.7 if kind == "glass" else 1.1
            if horiz:
                ax.plot([x0, x1], [(y0 + y1) / 2] * 2, color="#2f8fd0", lw=lw)
            else:
                ax.plot([(x0 + x1) / 2] * 2, [y0, y1], color="#2f8fd0", lw=lw)
        elif kind == "door" and tags:
            if horiz:
                ax.plot([x0, x0], [y1, y1 + (x1 - x0)], color="k", lw=0.5)
            else:
                ax.plot([x0, x0 - (y1 - y0)], [y0, y0], color="k", lw=0.5)
        if tag and tags:
            if horiz:
                ax.text((x0 + x1) / 2, y0 - 0.12, tag, fontsize=4, ha="center", va="top", color="#b00000")
            else:
                ax.text(x0 - 0.08, (y0 + y1) / 2, tag, fontsize=4, ha="right", va="center", color="#b00000")
    # portões e pilares da frente
    for x0, x1 in ((0, 0.20), (1.70, 1.90), (7.80, 8.00)):
        rect(ax, (x0, 0, x1, 0.30), fc="#2f3133", ec="none")
    ax.plot([1.90, 7.80], [0.15, 0.15], color="#2f3133", lw=2.2)
    ax.plot([0.45, 1.45], [0.15, 0.15], color="#7d5029", lw=2.2)
    ax.plot([0.20, 0.45], [0.15, 0.15], color="#2f3133", lw=1.2)
    ax.plot([1.45, 1.70], [0.15, 0.15], color="#2f3133", lw=1.2)
    ax.plot([0.20, 1.70], [5.60, 5.60], color="#7d5029", lw=1.8, ls=(0, (3, 1.5)))        # portão de serviço


def tecnica(ax):
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.6, ls=(0, (6, 3)))
    rect(ax, (0.20, 0, 7.80, 5.50), fc="#eeeeee", ec="none")
    rect(ax, (XC0, 5.50, XC1, 24.80), fc="#f3ead7", ec="none")
    rect(ax, (XP0, 12.00, XP1, 22.25), fc="#dcebd2", ec="none")
    rect(ax, (XP0, 22.40, XP1, 24.80), fc="#e8dcc8", ec="none")
    walls_and_openings(ax)
    for cx, cy, name, w, d in ROOMS:
        ax.text(cx, cy, f"{name}\n{br(w)} × {br(d)}\n{br(w * d)} m²", fontsize=4.5, ha="center", va="center", linespacing=1.25)
    ax.text(5.2, 16.5, f"CORREDOR INTERNO  0,90 × 11,25 = {br(A_CORR)} m²", fontsize=4.3, rotation=90, ha="center", va="center")
    ax.text(0.95, 15.0, "CORREDOR LATERAL DESCOBERTO  1,50 × 19,30", fontsize=4.5, rotation=90, ha="center", va="center")
    ax.text(6.8, 17.0, "PÁTIO /\nGOURMET\n2,00 × 10,25\n20,50 m²", fontsize=4.5, ha="center", va="center")
    ax.text(6.8, 23.6, "SPA\n2,00 × 2,40", fontsize=4.5, ha="center", va="center")
    ax.text(4.85, 1.2, "GARAGEM DESCOBERTA  7,60 × 5,50\n(sem parede entre a garagem e a faixa de pedestres)", fontsize=4.5, ha="center", va="center")
    for x0 in (2.25, 5.60):
        rect(ax, (x0, 0.45, x0 + 1.85, 5.35), fill=False, ec="#777777", lw=0.5, ls="--")
    rect(ax, (0.20, 0.30, 1.70, 5.50), fill=False, ec="#b00000", lw=0.5, ls=":")
    ax.text(0.95, 2.9, "faixa de pedestres", fontsize=4, rotation=90, ha="center", va="center", color="#b00000")
    ax.text(0.95, 5.85, "portão de serviço", fontsize=3.6, ha="center", color="#7d5029")
    ax.text(0.95, -0.25, "social 1,00", fontsize=3.8, ha="center", va="top", color="#7d5029")
    ax.text(4.85, -0.25, "portão basculante 5,90", fontsize=3.8, ha="center", va="top")
    ys = [0, 5.50, 5.70, 10.20, 10.35, 11.85, 12.00, 15.00, 15.15, 18.15, 18.30, 19.80, 19.95, 21.45, 21.60, 24.80, 25.00]
    dim_chain(ax, ys, -0.45, True)
    dim_chain(ax, [0, 25.00], -1.25, True, fs=6)
    dim_chain(ax, [0, 0.20, 1.70, 1.90, 4.60, 4.75, 5.65, 5.80, 7.80, 8.00], -0.75, False, min_label=0.8)
    dim_chain(ax, [0, 8.00], -1.35, False, fs=6)
    ax.text(4.0, -1.95, "RUA  (testada 8,00 m)", fontsize=5.5, ha="center", va="center")
    ax.set_xlim(-1.9, 9.3); ax.set_ylim(-2.2, 25.8); ax.set_aspect("equal"); ax.axis("off")
    ax.text(3.7, 25.35, "PLANTA COTADA", fontsize=8, fontweight="bold", ha="center")


def humanizada(ax):
    R = lambda r, **k: ax.add_patch(Rectangle((r[0], r[1]), r[2] - r[0], r[3] - r[1], **k))
    FL = "#e9dcc6"
    R((-0.4, -0.9, 8.4, 0), fc="#c9c4ba", ec="none")
    R((0, 0, 8, 25), fc="#d8d2c4", ec="none")
    R((0.2, 0, 7.8, 5.5), fc="#bdb7aa", ec="none")
    R((XC0, 0, XC1, 24.8), fc="#d6c7a8", ec="none")
    for yy in np.arange(0.4, 24.8, 0.6):
        ax.plot([XC0, XC1], [yy, yy], color="#c2b391", lw=0.3)
    R((1.9, 5.7, 7.8, 10.2), fc=FL, ec="none")
    R((1.9, 10.2, 5.65, 24.8), fc=FL, ec="none")
    for r in ((1.9, 10.35, 4.6, 11.85), (1.9, 18.3, 4.6, 19.8), (5.8, 10.35, 7.8, 11.85)):
        R(r, fc="#cfd8dc", ec="none")
    R((1.9, 19.95, 4.6, 21.45), fc="#d9c3a0", ec="none")
    R((XP0, 12.0, XP1, 22.25), fc="#86b56a", ec="none")
    R((XP0, 22.4, XP1, 24.8), fc="#c9a26f", ec="none")
    R((6.0, 22.75, 7.6, 24.45), fill=False, ec="#7d5029", lw=0.8, ls="--")
    ax.text(6.8, 23.6, "base\ndo spa", fontsize=4.2, ha="center", va="center", color="#5b3a1c")
    # gourmet (Etapa 2) no meio do pátio
    R((XP0, 14.5, XP1, 19.0), fc="#d9c7a6", ec="none")
    R((7.25, 15.0, 7.8, 18.5), fc="#4a4a4a", ec="k", lw=0.4)
    R((7.3, 17.7, 7.75, 18.4), fc="#a0522d", ec="k", lw=0.3)
    R((7.32, 15.6, 7.72, 16.2), fc="#c8c8c8", ec="k", lw=0.3)
    R((6.2, 15.6, 6.9, 17.8), fc=W, ec="#7d5029", lw=0.5)
    for yy in np.arange(14.5, 19.01, 0.5):
        ax.plot([XP0, XP1], [yy, yy], color="#7d5029", lw=1.4, alpha=0.6)
    rng = np.random.default_rng(3)
    for g in ((XP0, 12.0, XP1, 14.5), (XP0, 19.0, XP1, 22.25)):
        for _ in range(9):
            ax.add_patch(Circle((rng.uniform(g[0] + 0.25, g[2] - 0.25), rng.uniform(g[1] + 0.25, g[3] - 0.25)),
                                rng.uniform(0.14, 0.28), fc="#356b2c" if rng.random() > 0.5 else "#4f8f3d", ec="none"))
    for yy in np.arange(6.4, 24.0, 1.6):                                   # vasos no corredor lateral
        ax.add_patch(Circle((0.42, yy), 0.16, fc="#4f8f3d", ec="none"))
    for x0, y0, x1, y1, kind, col in FURN:
        if kind in ("bed", "bedL"):
            R((x0, y0, x1, y1), fc=col, ec="#8a8172", lw=0.5)
            if kind == "bed":
                R((x0, y1 - 0.12, x1, y1), fc=W, ec="none")
                R((x0 + 0.1, y1 - 0.62, (x0 + x1) / 2 - 0.05, y1 - 0.2), fc="white", ec="#b9b2a3", lw=0.3)
                R(((x0 + x1) / 2 + 0.05, y1 - 0.62, x1 - 0.1, y1 - 0.2), fc="white", ec="#b9b2a3", lw=0.3)
                R((x0, y0, x1, y0 + 0.7), fc="#b7a98f", ec="none")
            else:
                R((x0, y0, x0 + 0.12, y1), fc=W, ec="none")
                R((x0 + 0.2, y0 + 0.1, x0 + 0.62, (y0 + y1) / 2 - 0.05), fc="white", ec="#b9b2a3", lw=0.3)
                R((x0 + 0.2, (y0 + y1) / 2 + 0.05, x0 + 0.62, y1 - 0.1), fc="white", ec="#b9b2a3", lw=0.3)
                R((x1 - 0.7, y0, x1, y1), fc="#b7a98f", ec="none")
        elif kind == "shower":
            R((x0, y0, x1, y1), fc=col, ec="#5f8ea3", lw=0.5)
        elif kind == "wc":
            ax.add_patch(Ellipse(((x0 + x1) / 2, (y0 + y1) / 2), x1 - x0, y1 - y0, fc="white", ec="#777", lw=0.5))
        elif kind == "sofa":
            R((x0, y0, x1, y1), fc=col, ec="#8a8172", lw=0.5)
            R((x1 - 0.22, y0, x1, y1), fc="#b0a691", ec="none")
        elif kind == "cook":
            R((x0, y0, x1, y1), fc=col, ec="k", lw=0.3)
            for a in (x0 + 0.13, x1 - 0.13):
                for b in (y0 + 0.18, y1 - 0.18):
                    ax.add_patch(Circle((a, b), 0.08, fill=False, ec="#bbb", lw=0.4))
        else:
            R((x0, y0, x1, y1), fc=col, ec="#5a5348", lw=0.4)
    for x0, c in ((2.25, "#e9e9e9"), (5.60, "#3d3d3d")):
        ax.add_patch(FancyBboxPatch((x0, 0.45), 1.85, 4.9, boxstyle="round,pad=0,rounding_size=0.45", fc=c, ec="#222", lw=0.5))
        ax.add_patch(FancyBboxPatch((x0 + 0.2, 1.45), 1.45, 2.5, boxstyle="round,pad=0,rounding_size=0.3", fc="#8fb6c9", ec="#222", lw=0.3))
    walls_and_openings(ax, wall_c="#2b2b2b", floor=FL, tags=False)
    for x, y, t, rot in [(4.9, 23.6, "SUÍTE\nMASTER", 0), (3.25, 20.7, "CLOSET", 0), (3.85, 19.3, "BANHO SUÍTE", 0),
                         (4.15, 16.0, "QUARTO\n02", 0), (4.15, 12.85, "QUARTO\n03", 0), (3.9, 11.4, "BANHO SOCIAL", 0),
                         (3.0, 9.4, "SALA DE ESTAR", 0), (6.55, 7.6, "COZINHA E JANTAR", 0), (6.4, 11.1, "LAVAND.", 0),
                         (4.85, 2.9, "GARAGEM", 0), (0.95, 14.0, "CORREDOR LATERAL 1,50", 90), (5.2, 16.5, "CORREDOR INTERNO 0,90", 90),
                         (6.5, 14.8, "GOURMET", 0)]:
        ax.text(x, y, t, fontsize=4.3, ha="center", va="center", fontweight="bold", color="#3a342a", rotation=rot)
    ax.text(4.0, -0.5, "RUA", fontsize=6, ha="center", va="center")
    ax.set_xlim(-0.4, 8.4); ax.set_ylim(-0.9, 25.8); ax.set_aspect("equal"); ax.axis("off")
    ax.text(4.0, 25.35, "PLANTA COM MÓVEIS (Etapa 2 com gourmet)", fontsize=8, fontweight="bold", ha="center")


# ----------------------------------------------------------------------------- prancha de medidas e análise
CLEAR = [  # (x0, y0, x1, y1, rótulo): passagens livres medidas entre móveis e paredes
    (4.75, 13.0, 5.65, 13.0, "0,90"), (0.20, 9.0, 1.70, 9.0, "1,50"),
    (3.78, 14.0, 4.60, 14.0, "0,82"), (3.0, 12.50, 3.0, 13.25, "0,75"), (3.0, 14.63, 3.0, 15.00, "0,37"),
    (3.78, 17.0, 4.60, 17.0, "0,82"), (3.0, 15.65, 3.0, 16.40, "0,75"), (3.0, 17.78, 3.0, 18.15, "0,37"),
    (3.8, 21.60, 3.8, 22.80, "1,20"), (1.90, 23.5, 3.00, 23.5, "1,10"), (4.60, 23.5, 5.65, 23.5, "1,05"),
    (2.45, 20.2, 4.05, 20.2, "1,60"), (2.35, 7.6, 3.75, 7.6, "1,40"), (4.70, 8.6, 5.68, 8.6, "0,98"),
    (7.42, 9.25, 7.80, 9.25, "0,38"), (6.6, 6.30, 6.6, 8.20, "1,90"), (5.80, 13.2, 7.80, 13.2, "2,00"),
    (2.80, 11.65, 4.60, 11.65, "1,80"), (2.80, 19.6, 4.60, 19.6, "1,80"), (4.10, 3.0, 5.60, 3.0, "1,50"),
]


def medidas():
    PW, PH = 42.0, 29.7
    fig = plt.figure(figsize=(PW / 2.54, PH / 2.54))
    ax = fig.add_axes([0.8 / PW, 0.5 / PH, 11.2 / PW, 28.0 / PH])
    tecnica(ax)
    for t in list(ax.texts):
        if t.get_text() == "PLANTA COTADA":
            t.set_text("PLANTA TÉRREA COTADA")
    for x0, y0, x1, y1, kind, col in FURN:                                   # móveis em contorno
        rect(ax, (x0, y0, x1, y1), fill=False, ec="#9a9a9a", lw=0.35)
    for x0, y0, x1, y1, lab in CLEAR:                                        # passagens livres
        ax.annotate("", xy=(x1, y1), xytext=(x0, y0), arrowprops=dict(arrowstyle="<->", color="#b00000", lw=0.6,
                                                                     shrinkA=0, shrinkB=0, mutation_scale=4))
        horiz = abs(x1 - x0) > abs(y1 - y0)
        ax.text((x0 + x1) / 2 + (0 if horiz else 0.07), (y0 + y1) / 2 + (0.07 if horiz else 0), lab, fontsize=3.8,
                color="#b00000", ha="center" if horiz else "left", va="bottom" if horiz else "center", fontweight="bold")
    dim_chain(ax, [5.50, 5.70, 10.20, 10.35, 11.85, 12.00, 22.25, 22.40, 24.80, 25.00], 8.75, True, fs=4.4)
    ax.set_xlim(-1.9, 9.3)

    tx = fig.add_axes([12.8 / PW, 0.5 / PH, 28.6 / PW, 28.6 / PH]); tx.axis("off"); tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    tx.text(0, 0.985, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    tx.text(0, 0.95, "Planta térrea com todas as medidas e análise de circulação, ventilação e conforto", fontsize=10,
            fontweight="bold", va="top")
    tx.text(0, 0.925, "Planta V2 aprovada, com pé-direito alto na sala e cozinha. Números vermelhos na planta: passagem livre entre móveis e paredes, em metros.",
            fontsize=7, va="top")

    def grid(title, cols, xs, rows, y, x0=0.0, fs=5.9):
        tx.text(x0, y, title, fontsize=8, fontweight="bold", va="top"); y -= 0.022
        for c, x in zip(cols, xs):
            tx.text(x0 + x, y, c, fontsize=fs, fontweight="bold", va="top")
        y -= 0.016
        for r in rows:
            color = {"ok": "#1d6b2f", "at": "#a05a00", "no": "#b00000"}.get(r[-1], "k")
            for i, (c, x) in enumerate(zip(r[:-1], xs)):
                tx.text(x0 + x, y, c, fontsize=fs, va="top", color=color if i == len(r) - 2 else "k",
                        fontweight="bold" if i == len(r) - 2 else "normal")
            tx.plot([x0, x0 + xs[-1] + 0.21], [y - 0.0128, y - 0.0128], color="#cccccc", lw=0.3); y -= 0.0150
        return y - 0.007

    amb = [(n.title(), f"{br(w)} × {br(d)}", br(w * d) + " m²", "4,30" if n.startswith("ESTAR") else "2,80", "") for _, _, n, w, d in ROOMS]
    amb += [("Corredor Interno", "0,90 × 11,25", "10,13 m²", "2,80", ""), ("TOTAL ÁREA ÚTIL", "", br(A_UTIL) + " m²", "", ""),
            ("Corredor lateral (descoberto)", "1,50 × 19,30", "28,95 m²", "—", ""), ("Garagem (descoberta)", "7,60 × 5,50", "41,80 m²", "—", ""),
            ("Pátio / gourmet (descoberto)", "2,00 × 10,25", "20,50 m²", "—", ""), ("Deck do spa (descoberto)", "2,00 × 2,40", "4,80 m²", "—", "")]
    y1 = grid("MEDIDAS DOS AMBIENTES", ["Ambiente", "Largura × profund.", "Área", "Pé-direito"], [0, 0.17, 0.29, 0.37], amb, 0.89)
    esq = [("P1", "Porta de entrada", "0,90 × 2,10", "—", ""), ("P2", "Quartos, suíte, lavanderia", "0,80 × 2,10", "—", ""),
           ("P3", "Banheiros e closet", "0,70 × 2,10", "—", ""), ("J1", "Janela do estar (frente)", "1,60 × 1,20", "1,00", ""),
           ("J2", "Janela da cozinha (frente)", "1,40 × 1,00", "1,05", ""), ("J3", "Janela da suíte (lateral)", "1,60 × 1,20", "1,00", ""),
           ("J4", "Janela dos quartos 02 e 03", "1,20 × 1,20", "1,00", ""), ("J5", "Janela alta dos banheiros", "0,60 × 0,60", "1,55", ""),
           ("J6", "Janela da lavanderia", "1,00 × 1,00", "1,00", ""), ("V2", "Vidro corredor / pátio", "9,45 × 2,60", "piso", ""),
           ("V3", "Porta de vidro suíte / spa", "1,80 × 2,10", "piso", "")]
    grid("PORTAS E JANELAS", ["Cód.", "Local", "Largura × altura", "Peitoril"], [0, 0.04, 0.21, 0.32], esq, 0.89, x0=0.53)
    il = [("Estar / jantar / cozinha, só janelas baixas", "26,55", "3,32 (12,5 %)", "1,66 (6,3 %)", "INSUFICIENTE", "no"),
          ("Estar / jantar / cozinha, com faixa alta", "26,55", "14,73 (55,5 %)", "3,76 (14,2 %)", "BOA", "ok"),
          ("Suíte master", "12,00", "5,70 (47,5 %)", "2,85 (23,8 %)", "BOA", "ok"),
          ("Quarto 02", "8,10", "1,44 (17,8 %)", "0,72 (8,9 %)", "ATENDE", "ok"),
          ("Quarto 03", "8,10", "1,44 (17,8 %)", "0,72 (8,9 %)", "ATENDE", "ok"),
          ("Banho social", "4,05", "0,36 (8,9 %)", "0,36 (8,9 %)", "JANELA PEQUENA", "at"),
          ("Banho da suíte", "4,05", "0,36 (8,9 %)", "0,36 (8,9 %)", "JANELA PEQUENA", "at"),
          ("Lavanderia", "3,00", "1,00 (33,3 %)", "0,50 (16,7 %)", "BOA", "ok"),
          ("Closet", "4,05", "sem janela", "pelas portas", "ACEITÁVEL", "ok")]
    y2 = grid("ILUMINAÇÃO E VENTILAÇÃO NATURAL", ["Ambiente", "Piso (m²)", "Vidro (m² e % do piso)", "Abertura p/ ar (m² e %)", "Situação"],
              [0, 0.17, 0.25, 0.42, 0.59], il, y1 - 0.004)
    tx.text(0, y2 + 0.002, "Referências: iluminação de 1/6 do piso (16,7 %) em sala e quartos e 1/8 (12,5 %) em banheiros, usual nos códigos de obras; ventilação\n"
            "de 7 % do piso (NBR 15575-4). Janela de correr abre metade do vão. Os valores exatos de Cascavel precisam ser conferidos no Código de Obras.",
            fontsize=5.3, va="top", color="#444444", linespacing=1.3)
    y3 = y2 - 0.036
    ci = [("Corredor lateral", "1,50 m", "Confortável. Duas pessoas se cruzam; cadeira de rodas gira.", "AMPLO", "ok"),
          ("Corredor interno", "0,90 m × 11,25 m", "Passa uma pessoa por vez. Para duas se cruzarem seria 1,20 m.", "JUSTO", "at"),
          ("Portas dos quartos", "0,80 m", "Boas para uso comum. Cadeira de rodas pede folha de 0,90 m.", "ATENDE", "ok"),
          ("Portas dos banheiros", "0,70 m", "Estreitas para cadeira de rodas ou andador.", "ESTREITAS", "at"),
          ("Suíte master", "1,05 a 1,20 m livres", "Sobra espaço dos dois lados e no pé da cama queen.", "AMPLA", "ok"),
          ("Quartos 02 e 03", "0,82 / 0,75 / 0,37 m", "Cama de casal encostada: acesso por um lado só. Com solteiro fica folgado.", "JUSTO", "at"),
          ("Closet", "1,60 m entre armários", "Passagem larga entre quarto e banho.", "AMPLO", "ok"),
          ("Banheiros", "1,80 × 1,50 m fora do box", "Bom para uso comum. Não é acessível sem adaptação.", "ATENDE", "ok"),
          ("Sala de estar", "1,40 m sofá–rack", "Caminho da porta ao corredor com 0,98 m livres.", "BOA", "ok"),
          ("Mesa de jantar", "0,38 m atrás das cadeiras", "Não dá para passar atrás de quem está sentado do lado da parede.", "APERTADA", "no"),
          ("Cozinha", "1,90 m de corredor", "Espaço de sobra entre a bancada e a mesa.", "AMPLA", "ok"),
          ("Pátio / gourmet", "2,00 m de largura", "Com bancada e mesa, só cabe gente sentada de um lado.", "APERTADO", "no"),
          ("Garagem", "7,60 × 5,50 m", "Dois carros com 1,50 m de passagem no meio.", "AMPLA", "ok")]
    y4 = grid("CIRCULAÇÃO E ESPAÇO PARA ANDAR", ["Local", "Medida livre", "Avaliação", "Situação"], [0, 0.13, 0.28, 0.69], ci, y3)
    notes = (
        "COMO O AR CIRCULA\n"
        "• Quartos: o ar entra pela janela do corredor lateral e sai pela porta, pelo corredor interno e pelo vidro do pátio. É ventilação cruzada, a melhor que\n"
        "   existe, mas só funciona com a porta do quarto aberta. Uma bandeira ventilada sobre a porta resolve com a porta fechada.\n"
        "• Sala e cozinha: são o ponto fraco. Só têm as duas janelas da frente, e a lavanderia ficou entre a cozinha e o pátio.\n"
        "• Corredor lateral: com 1,50 m e aberto em cima, funciona como poço de luz e ar para a ala dos quartos.\n"
        "\n"
        "AJUSTES QUE RECOMENDO (não mexem na planta, só em janelas, portas e móveis)\n"
        "1. Bloco social com pé-direito de 4,30 m e faixa de vidro alta de 0,70 m (do nível 3,45 ao 4,15) em três lados: frente, corredor lateral e\n"
        "    fundo, acima do telhado dos quartos. São 16,30 m de faixa, 11,41 m² de vidro. A parede da divisa direita fica cega.\n"
        "2. Seis painéis da faixa alta que abrem (maxim-ar com comando): o ar quente sobe e sai por cima, e a sala ganha ventilação cruzada.\n"
        "3. Janelas dos banheiros de 0,60 × 0,60 para 1,00 × 0,60 (basculante).\n"
        "4. Portas dos banheiros de 0,70 para 0,80 m. Custo quase igual e a casa fica adaptável no futuro.\n"
        "5. Mesa de jantar redonda de 1,10 m (4 a 5 lugares) ou banco fixo no lado da parede, no lugar da mesa de 6 com cadeiras dos dois lados.\n"
        "6. Coifa na cozinha, porque o cooktop fica longe de janela.\n"
        "7. Na área gourmet, mesa estreita de 0,65 m com banco do lado do vidro, e abrir as folhas do corredor para ganhar largura nos dias de uso."
    )
    tx.text(0, y4 - 0.002, notes, fontsize=5.6, va="top", linespacing=1.32)
    tx.text(0, 0.0, f"Doc. CP-ARQ-V2-MED   |   Revisão R01 — {DATA}   |   Escala 1:100 (folha A3)   |   Unidade: metro   |   "
            "Estudo — exige conferência e ART/RRT de profissional habilitado", fontsize=6, va="bottom", fontweight="bold")
    for ext, kw in (("pdf", {}), ("png", {"dpi": 200})):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-V2_planta-terrea-medidas_R01.{ext}"), **kw)


def corte_social():
    """Corte longitudinal esquemático mostrando o pé-direito alto do bloco social."""
    fig, ax = plt.subplots(figsize=(29.7 / 2.54, 12.0 / 2.54))
    fig.subplots_adjust(0.02, 0.04, 0.98, 0.9)
    ax.plot([-1, 26], [0, 0], color="k", lw=0.9)
    rect(ax, (5.50, 0, 25.0, 0.15), fc="#bbbbbb", ec="none")
    for y0, w, h in [(5.50, 0.20, 4.90), (10.20, 0.15, 4.90), (11.85, 0.15, 3.07), (15.00, 0.15, 3.07), (18.15, 0.15, 3.07),
                     (19.80, 0.15, 3.07), (21.45, 0.15, 3.07), (24.80, 0.20, 3.45)]:
        rect(ax, (y0, 0.15, y0 + w, h), fc="#3a3a3a", ec="none")
    for y0 in (5.50, 10.20):                                               # faixas de vidro altas
        w = 0.20 if y0 < 6 else 0.15
        rect(ax, (y0, 3.60, y0 + w, 4.30), fc="white", ec="none")
        ax.plot([y0 + w / 2] * 2, [3.60, 4.30], color="#2f8fd0", lw=2.2)
    rect(ax, (5.50, 4.45, 10.35, 4.57), fc="#777777", ec="none")            # laje/forro alto
    rect(ax, (10.35, 2.95, 25.0, 3.07), fc="#777777", ec="none")            # forro dos quartos
    ax.plot([5.50, 10.35], [4.75, 4.62], color="k", lw=1.4); ax.plot([10.35, 25.0], [3.30, 3.18], color="k", lw=1.4)
    for x, t in [(7.9, "ESTAR / JANTAR / COZINHA\npé-direito 4,30"), (11.1, "banho\nsocial"), (13.5, "quarto 03"), (16.65, "quarto 02"),
                 (19.05, "banho\nsuíte"), (20.7, "closet"), (23.2, "suíte master"), (2.75, "garagem\ndescoberta")]:
        ax.text(x, 1.5, t, fontsize=6, ha="center", va="center")
    ax.text(17.5, 2.45, "pé-direito 2,80 nos demais ambientes", fontsize=6, ha="center")
    ax.annotate("faixa de vidro alta\n0,70 m, do 3,45 ao 4,15", xy=(5.6, 3.95), xytext=(1.3, 4.6), fontsize=6, ha="center",
                arrowprops=dict(arrowstyle="->", lw=0.6))
    ax.annotate("vidro alto no fundo,\nacima do telhado dos quartos", xy=(10.28, 3.95), xytext=(14.5, 4.55), fontsize=6, ha="center",
                arrowprops=dict(arrowstyle="->", lw=0.6))
    ax.annotate("", xy=(9.6, 4.25), xytext=(8.4, 2.9), arrowprops=dict(arrowstyle="->", color="#b00000", lw=1))
    ax.text(8.2, 3.3, "ar quente\nsobe e sai", fontsize=5.5, color="#b00000", ha="right")
    for lvl, t in [(0, "0,00"), (0.15, "+0,15 piso"), (2.95, "+2,95 forro dos quartos"), (4.45, "+4,45 forro da sala"), (4.90, "+4,90 topo")]:
        ax.plot([25.3, 25.7], [lvl, lvl], color="k", lw=0.4); ax.text(25.8, lvl, t, fontsize=5.5, va="center")
    dim_chain(ax, [0, 5.50, 10.35, 25.0], -0.5, False, fs=6)
    ax.set_xlim(-1.5, 29.5); ax.set_ylim(-1.3, 5.6); ax.set_aspect("equal"); ax.axis("off")
    ax.set_title("CASA PÁTIO — Corte longitudinal esquemático: pé-direito alto na sala e cozinha (escala 1:100)", fontsize=9,
                 fontweight="bold", loc="left")
    for ext, kw in (("pdf", {}), ("png", {"dpi": 200})):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-V2_corte-pe-direito-alto_R00.{ext}"), **kw)
    plt.close(fig)


def main():
    PW, PH = 42.0, 29.7
    fig = plt.figure(figsize=(PW / 2.54, PH / 2.54))
    ax = fig.add_axes([0.8 / PW, 0.5 / PH, 11.2 / PW, 28.0 / PH]); tecnica(ax)
    ax2 = fig.add_axes([12.2 / PW, 1.0 / PH, 8.8 / PW, 26.7 / PH]); humanizada(ax2)
    tx = fig.add_axes([21.8 / PW, 0.5 / PH, 19.6 / PW, 28.6 / PH]); tx.axis("off"); tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    tx.text(0, 0.985, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    tx.text(0, 0.95, "PROPOSTA V2 PARA APROVAÇÃO", fontsize=10, fontweight="bold", va="top", color="#b00000")
    tx.text(0, 0.925, "Corredor lateral descoberto com janelas dos quartos + nova entrada da garagem", fontsize=7, va="top")

    def table(title, rows, y):
        tx.text(0, y, title, fontsize=8, fontweight="bold", va="top"); y -= 0.021
        for r in rows:
            fw = "bold" if len(r) > 2 else "normal"
            tx.text(0.005, y, r[0], fontsize=6.2, va="top", fontweight=fw)
            tx.text(0.995, y, r[1], fontsize=6.2, va="top", ha="right", fontweight=fw)
            tx.plot([0, 1], [y - 0.0142, y - 0.0142], color="#bbbbbb", lw=0.3); y -= 0.0170
        return y - 0.009

    y = table("ÁREAS ÚTEIS", [(f"{n.title()} — {br(w)} × {br(d)}", br(w * d) + " m²") for _, _, n, w, d in ROOMS]
              + [("Corredor interno — 0,90 × 11,25", br(A_CORR) + " m²"), ("TOTAL ÁREA ÚTIL", br(A_UTIL) + " m²", 1)], 0.885)
    y = table("QUADRO GERAL", [
        ("Área construída = projeção coberta", br(A_CONST) + " m²", 1),
        ("Taxa de ocupação (limite informado: 60 %)", br(A_CONST / 2, 1) + " %", 1),
        ("Saldo de projeção até 60 % (gourmet e outras coberturas)", br(120 - A_CONST) + " m²"),
        ("Corredor lateral descoberto — 1,50 × 19,30 (+ faixa na garagem)", "28,95 m²"),
        ("Garagem descoberta — 7,60 × 5,50", "41,80 m²"),
        ("Pátio — 2,00 × 10,25", "20,50 m²"),
        ("Muros de divisa novos", "49,4 m"),
        ("Comparação: planta anterior (R03)", "95,96 m² úteis / 112,05 m² construídos"),
    ], y)
    y = table("ESQUADRIAS", [
        ("P1 porta de entrada 0,90 × 2,10  |  P2 portas 0,80 × 2,10  |  P3 portas 0,70 × 2,10", ""),
        ("J1 estar 1,60 × 1,20  |  J2 cozinha 1,40 × 1,00  |  J3 suíte 1,60 × 1,20", ""),
        ("J4 quartos 1,20 × 1,20  |  J5 banheiros 0,60 × 0,60 alta  |  J6 lavanderia 1,00 × 1,00", ""),
        ("V2 vidro de abrir piso ao teto corredor/pátio 9,45 m  |  V3 porta de vidro suíte/spa 1,80", ""),
    ], y)
    notes = (
        "O QUE MUDOU EM RELAÇÃO À IMAGEM DE REFERÊNCIA\n"
        "1. Corredor lateral com 1,50 m, não 1,30 m. O Código Civil (art. 1.301) proíbe janela a menos de 1,50 m\n"
        "    da divisa. Com 1,30 m as janelas dos quartos não podem ser aprovadas.\n"
        "2. Corredor interno com 0,90 m. Na imagem ele aparece com cerca de 0,65 m, que não permite passagem.\n"
        "3. Entrada: portão social de 1,00 m à esquerda, alinhado com o corredor lateral; portão basculante de\n"
        "    5,90 m para os dois carros. Retirada a parede entre a garagem e o corredor: a faixa de pedestres é\n"
        "    só marcada no piso, a garagem fica com 7,60 m livres e a obra fica mais barata.\n"
        "4. Portão de serviço fechando o corredor lateral no alinhamento da frente da casa.\n"
        "5. Porta de entrada no centro da fachada, alinhada com a passagem entre os carros e com o corredor interno.\n"
        "6. Cozinha em L sob a janela da frente; mesa de jantar de 6 lugares atrás; lavanderia atrás da cozinha.\n"
        "\n"
        "CONSEQUÊNCIAS QUE VOCÊ PRECISA ACEITAR\n"
        "A. A casa encolhe: de 95,96 para 80,03 m² úteis. O corredor lateral tira 1,70 m da largura.\n"
        "B. Quartos 02 e 03 com 2,70 m de largura (8,10 m²). Suíte com 12,00 m².\n"
        "C. Pátio com 2,00 m de largura. A área gourmet fica estreita: bancada de um lado e mesa de 0,70 m.\n"
        "D. Sem lavabo: as visitas usam o banho social, ao lado da sala.\n"
        "E. Mais muro (49,4 m contra 31,45 m), mas menos área construída e menos vidro.\n"
        "F. A ocupação cai para 47 %, sobrando 25 m² de cobertura para a área gourmet.\n"
        "\n"
        "OPÇÃO PARA A SUÍTE: fechar o fundo do corredor lateral e levar a suíte até a divisa (5,45 × 3,20 =\n"
        "17,4 m²), com luz e ventilação pela porta de vidro do spa. Custa cerca de 5 m² a mais de construção."
    )
    tx.text(0, y, notes, fontsize=5.7, va="top", linespacing=1.32)
    tx.text(0, 0.0, f"Doc. CP-ARQ-V2   |   Revisão {REV} — {DATA}   |   Escala 1:100 (planta cotada, folha A3)   |   "
            "Estudo para aprovação do proprietário", fontsize=6, va="bottom", fontweight="bold")
    for ext, kw in (("pdf", {}), ("png", {"dpi": 190})):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-V2_proposta-corredor-lateral_{REV}.{ext}"), **kw)
    medidas()
    corte_social()
    print("util", round(A_UTIL, 2), "const", round(A_CONST, 2), "TO", round(A_CONST / 2, 1))


if __name__ == "__main__":
    main()
