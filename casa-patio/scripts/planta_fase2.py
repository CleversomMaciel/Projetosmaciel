"""Casa Pátio — planta baixa cotada (Fase 2, estudo preliminar R03).

Gera PDF (A3, 1:100), SVG editável e PNG em ../plantas/.
Coordenadas em metros: x = largura (0 a 8), y = profundidade (0 = alinhamento da rua, 25 = fundos).
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plantas")

WALL = "#3a3a3a"
MURO = "#8a8a8a"
GLASS = "#2f8fd0"


def br(v, nd=2):
    return f"{v:.{nd}f}".replace(".", ",")


# Paredes da edificação (x0, y0, x1, y1)
WALLS = [
    (0, 5.50, 0.20, 25.00),          # divisa esquerda
    (7.80, 5.50, 8.00, 10.35),       # divisa direita (bloco social)
    (0, 24.80, 5.00, 25.00),         # fundos (suíte)
    (0, 5.50, 8.00, 5.70),           # frente da casa
    (0.20, 10.20, 3.55, 10.35),      # fundo do social / ala íntima
    (4.85, 10.20, 7.80, 10.35),      # fundo do social / pátio (vidro)
    (3.40, 10.35, 3.55, 21.80),      # ala íntima / corredor
    (4.85, 10.35, 5.00, 21.80),      # corredor / pátio (vidro)
    (4.85, 21.80, 5.00, 24.80),      # suíte / pátio e spa
    (0.20, 11.55, 3.40, 11.70),
    (0.20, 14.20, 3.40, 14.35),
    (0.20, 15.85, 3.40, 16.00),
    (0.20, 18.50, 3.40, 18.65),
    (0.20, 20.15, 3.40, 20.30),      # banho suíte / closet
    (0.20, 21.80, 4.85, 21.95),      # frente da suíte
    # lavanderia (dentro do bloco social, junto à cozinha)
    (5.20, 5.70, 5.35, 7.35),
    (5.35, 7.20, 7.80, 7.35),
]
MUROS = [
    (0, 0, 0.20, 5.50),
    (7.80, 0, 8.00, 5.50),
    (7.80, 10.35, 8.00, 25.00),
    (5.00, 24.80, 8.00, 25.00),
    (5.00, 22.25, 7.80, 22.40),      # pátio / spa
]
# Aberturas: (x0, y0, x1, y1, tipo, rótulo)
OPEN = [
    (4.15, 5.50, 5.05, 5.70, "door", "P1"),
    (1.60, 5.50, 3.40, 5.70, "win", "J1"),
    (5.90, 5.50, 7.30, 5.70, "win", "J2"),
    (5.00, 10.20, 7.80, 10.35, "glass", "V1"),
    (4.85, 10.35, 5.00, 21.80, "glass", "V2"),
    (3.40, 10.60, 3.55, 11.30, "door", "P3"),
    (3.40, 11.80, 3.55, 12.60, "door", "P2"),
    (3.40, 12.90, 3.55, 14.10, "win", "J3"),
    (2.40, 14.20, 3.10, 14.35, "door", "P3"),
    (2.40, 15.85, 3.10, 16.00, "door", "P3"),
    (3.40, 16.10, 3.55, 16.90, "door", "P2"),
    (3.40, 17.20, 3.55, 18.40, "win", "J3"),
    (1.40, 20.15, 2.10, 20.30, "door", "P3"),
    (1.40, 21.80, 2.10, 21.95, "door", "P3"),
    (3.75, 21.80, 4.65, 21.95, "door", "P1"),
    (4.85, 22.60, 5.00, 24.40, "glass", "V3"),
    (5.20, 22.25, 6.00, 22.40, "void", ""),
    (5.55, 7.20, 6.35, 7.35, "door", "P2"),
]
# Ambientes: (x centro, y centro, nome, largura, profundidade)
ROOMS = [
    (2.7, 8.3, "ESTAR / JANTAR", 5.00, 4.50),
    (6.5, 8.9, "COZINHA", 2.60, 2.85),
    (6.6, 6.45, "LAVANDERIA", 2.45, 1.50),
    (1.6, 10.95, "LAVABO", 3.20, 1.20),
    (1.8, 12.95, "DEMI-SUÍTE 02", 3.20, 2.50),
    (1.4, 15.1, "BANHO COMPARTILHADO", 3.20, 1.50),
    (1.8, 17.25, "DEMI-SUÍTE 01", 3.20, 2.50),
    (1.8, 19.4, "BANHO SUÍTE", 3.20, 1.50),
    (1.8, 21.05, "CLOSET", 3.20, 1.50),
    (2.5, 23.4, "SUÍTE MASTER", 4.65, 2.85),
]

# Móveis com medidas reais: (x0, y0, x1, y1, tipo, cor, altura em m)
FURN = [
    # suíte master: cama queen 1,60 × 2,00 com cabeceira na parede dos fundos
    (1.45, 22.80, 3.05, 24.80, "bed", "#f7f3ea", 0.55), (1.00, 24.40, 1.45, 24.80, "box", "#a9713f", 0.50),
    (3.05, 24.40, 3.50, 24.80, "box", "#a9713f", 0.50), (0.20, 22.90, 0.65, 23.90, "box", "#a9713f", 0.75),
    (2.30, 21.95, 3.60, 22.03, "box", "#2f3133", 1.60),
    # closet: dois armários de 1,50 m, 0,55 de profundidade
    (0.20, 20.30, 0.75, 21.80, "box", "#a9713f", 2.40), (2.85, 20.30, 3.40, 21.80, "box", "#a9713f", 2.40),
    # banho suíte: box 1,00 × 1,50, bancada 1,20 × 0,50, vaso
    (0.20, 18.65, 1.20, 20.15, "shower", "#b5d6e6", 1.90), (2.20, 18.65, 3.40, 19.15, "box", "#efefef", 0.85),
    (2.75, 19.45, 3.40, 19.85, "wc", "#ffffff", 0.42),
    # demi-suíte 01: cama de casal 1,38 × 1,88, guarda-roupa de correr 2,00 × 0,50, escrivaninha
    (0.20, 17.12, 2.08, 18.50, "bedL", "#f7f3ea", 0.55), (0.20, 16.00, 2.20, 16.50, "box", "#a9713f", 2.40),
    (2.90, 17.30, 3.40, 18.30, "box", "#a9713f", 0.75),
    # banho compartilhado: box 1,00 × 1,50, bancada 0,90 × 0,48, vaso
    (0.20, 14.35, 1.20, 15.85, "shower", "#b5d6e6", 1.90), (1.35, 14.35, 2.25, 14.83, "box", "#efefef", 0.85),
    (1.60, 15.20, 2.00, 15.85, "wc", "#ffffff", 0.42),
    # demi-suíte 02
    (0.20, 11.70, 2.08, 13.08, "bedL", "#f7f3ea", 0.55), (0.20, 13.70, 2.20, 14.20, "box", "#a9713f", 2.40),
    (2.90, 12.75, 3.40, 13.55, "box", "#a9713f", 0.75),
    # lavabo
    (0.20, 10.75, 0.85, 11.15, "wc", "#ffffff", 0.42), (1.30, 11.10, 2.20, 11.55, "box", "#efefef", 0.85),
    # estar: rack de TV na parede esquerda, sofá de 3 lugares 2,20 × 0,95, mesa de centro
    (0.20, 6.10, 0.65, 7.90, "box", "#a9713f", 0.50), (2.60, 5.95, 3.55, 8.15, "sofa", "#c9c0b0", 0.80),
    (1.40, 6.50, 2.00, 7.60, "box", "#7d5029", 0.38),
    # jantar: mesa 1,60 × 0,90 com 6 cadeiras
    (0.90, 8.75, 2.50, 9.65, "box", "#a9713f", 0.76),
    (0.98, 8.32, 1.40, 8.72, "chair", "#e4d7bf", 0.45), (1.49, 8.32, 1.91, 8.72, "chair", "#e4d7bf", 0.45),
    (2.00, 8.32, 2.42, 8.72, "chair", "#e4d7bf", 0.45), (0.98, 9.68, 1.40, 10.08, "chair", "#e4d7bf", 0.45),
    (1.49, 9.68, 1.91, 10.08, "chair", "#e4d7bf", 0.45), (2.00, 9.68, 2.42, 10.08, "chair", "#e4d7bf", 0.45),
    # cozinha: bancada em L com pia e cooktop, geladeira, balcão de refeições com 3 banquetas
    (7.20, 7.35, 7.80, 10.20, "box", "#4a4a4a", 0.90), (7.30, 8.20, 7.70, 8.80, "sink", "#c8c8c8", 0.91),
    (7.28, 9.20, 7.72, 9.90, "cook", "#1d1d1d", 0.91), (6.45, 7.35, 7.15, 8.10, "box", "#dcdcdc", 1.80),
    (5.20, 8.40, 5.65, 10.00, "box", "#6b6b6b", 1.05),
    (4.75, 8.50, 5.10, 8.85, "chair", "#e4d7bf", 0.65), (4.75, 9.02, 5.10, 9.37, "chair", "#e4d7bf", 0.65),
    (4.75, 9.54, 5.10, 9.89, "chair", "#e4d7bf", 0.65),
    # lavanderia: lavadora, tanque e bancada sob a janela
    (7.20, 5.75, 7.80, 6.35, "box", "#ffffff", 0.90), (7.20, 6.45, 7.80, 7.00, "sink", "#dfe7ea", 0.85),
    (5.90, 5.70, 7.10, 6.15, "box", "#a9713f", 0.90),
]


def rect(ax, r, **kw):
    ax.add_patch(Rectangle((r[0], r[1]), r[2] - r[0], r[3] - r[1], **kw))


def dim_chain(ax, pts, pos, vertical, min_label=0.45, fs=5):
    for a, b in zip(pts[:-1], pts[1:]):
        if vertical:
            ax.plot([pos, pos], [a, b], color="k", lw=0.4)
            for t in (a, b):
                ax.plot([pos - 0.08, pos + 0.08], [t - 0.08, t + 0.08], color="k", lw=0.5)
            if b - a >= min_label:
                ax.text(pos - 0.1, (a + b) / 2, br(b - a), rotation=90, ha="right", va="center", fontsize=fs)
        else:
            ax.plot([a, b], [pos, pos], color="k", lw=0.4)
            for t in (a, b):
                ax.plot([t - 0.08, t + 0.08], [pos - 0.08, pos + 0.08], color="k", lw=0.5)
            if b - a >= min_label:
                ax.text((a + b) / 2, pos - 0.1, br(b - a), ha="center", va="top", fontsize=fs)


def draw_plan(ax, etapa):
    # terreno
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.6, ls=(0, (6, 3)))
    # pisos
    rect(ax, (0.20, 0, 7.80, 5.50), fc="#eeeeee", ec="none")           # garagem
    rect(ax, (5.00, 10.35, 7.80, 22.25), fc="#dcebd2", ec="none")       # pátio
    rect(ax, (5.00, 22.40, 7.80, 24.80), fc="#e8dcc8", ec="none")       # spa
    for w in MUROS:
        rect(ax, w, fc=MURO, ec="none")
    for w in WALLS:
        rect(ax, w, fc=WALL, ec="none")
    for x0, y0, x1, y1, kind, tag in OPEN:
        rect(ax, (x0, y0, x1, y1), fc="white", ec="none")
        horiz = (x1 - x0) > (y1 - y0)
        if kind in ("win", "glass"):
            lw = 1.6 if kind == "glass" else 1.0
            if horiz:
                ax.plot([x0, x1], [(y0 + y1) / 2] * 2, color=GLASS, lw=lw)
            else:
                ax.plot([(x0 + x1) / 2] * 2, [y0, y1], color=GLASS, lw=lw)
        elif kind == "door":
            if horiz:
                ax.plot([x0, x0], [y1, y1 + (x1 - x0)], color="k", lw=0.5)
            else:
                ax.plot([x0, x0 - (y1 - y0)], [y0, y0], color="k", lw=0.5)
        if tag:
            if horiz:
                ax.text((x0 + x1) / 2, y0 - 0.12, tag, fontsize=4, ha="center", va="top", color="#b00000")
            else:
                ax.text(x1 + 0.08, (y0 + y1) / 2, tag, fontsize=4, ha="left", va="center", color="#b00000")

    for cx, cy, name, w, d in ROOMS:
        if name == "HALL":
            ax.text(cx + 0.1, cy, f"HALL\n{br(w * d)} m²", fontsize=4.2, ha="center", va="center")
            continue
        ax.text(cx, cy, f"{name}\n{br(w)} × {br(d)}\n{br(w * d)} m²", fontsize=4.6, ha="center", va="center",
                linespacing=1.25)
    ax.text(4.2, 15.8, "CORREDOR  1,30 × 11,45 = 14,89 m²", fontsize=4.6, rotation=90,
            ha="center", va="center")
    ax.text(6.4, 23.6, "SPA\n(descoberto)\n2,80 × 2,40\n6,72 m²", fontsize=4.6, ha="center", va="center")
    # zonas do social
    ax.plot([5.20, 5.20], [7.35, 10.20], color="#999999", lw=0.4, ls=":")
    ax.text(2.7, 6.5, "estar / TV", fontsize=4.4, ha="center", color="#555555")
    ax.text(2.7, 9.75, "jantar", fontsize=4.4, ha="center", color="#555555")

    # veículos (5,00 × 1,90)
    for x0 in (1.00, 5.50):
        rect(ax, (x0, 0.25, x0 + 1.90, 5.25), fill=False, ec="#777777", lw=0.5, ls="--")
    ax.text(4.2, 2.6, "passagem 2,60", fontsize=4, rotation=90, ha="center", va="center", color="#555555")

    if etapa == 1:
        ax.text(4.0, 1.0, "GARAGEM DESCOBERTA\n5,50 m de profundidade — piso drenante", fontsize=4.6,
                ha="center", va="center", bbox=dict(fc="#eeeeee", ec="none", pad=0.5))
        ax.text(6.4, 16.3, "PÁTIO CENTRAL\njardim\n2,80 × 11,90\n33,32 m²", fontsize=4.6, ha="center", va="center")
        rect(ax, (5.00, 14.00, 7.80, 19.00), fill=False, ec="#b00000", lw=0.5, ls=":")
        ax.text(6.4, 14.3, "área reservada — gourmet (Etapa 2)", fontsize=3.8, ha="center", color="#b00000")
        for (px, py, t) in ((7.6, 18.6, "AF+ESG"), (7.6, 17.4, "ELE")):
            ax.plot(px, py, marker="o", ms=2.5, color="#b00000")
            ax.text(px - 0.12, py, t, fontsize=3.6, ha="right", va="center", color="#b00000")
    else:
        rect(ax, (0.20, 0, 7.80, 5.50), fill=False, ec="#b00000", lw=0.8, ls="--")
        ax.text(4.0, 1.0, "COBERTURA FUTURA DA GARAGEM\n(sujeita à aprovação municipal)", fontsize=4.6,
                ha="center", va="center", color="#b00000", bbox=dict(fc="#eeeeee", ec="none", pad=0.5))
        rect(ax, (5.00, 14.00, 7.80, 19.00), fc="#f1e3c6", ec="#8a5a2b", lw=0.8, hatch="///")
        rect(ax, (7.00, 18.10, 7.80, 19.00), fc="#b0562f", ec="k", lw=0.4)      # churrasqueira
        rect(ax, (7.20, 15.60, 7.80, 18.10), fc="#cfcfcf", ec="k", lw=0.4)      # bancada com pia
        rect(ax, (5.45, 15.20, 6.35, 17.40), fc="#c79a63", ec="k", lw=0.4)      # mesa
        ax.text(6.0, 14.5, "ÁREA GOURMET\npergolado em madeira\n2,80 × 5,00 = 14,00 m²", fontsize=4.4,
                ha="center", va="center", bbox=dict(fc="white", ec="none", pad=0.4))
        ax.text(6.4, 12.2, "jardim\n2,80 × 3,65", fontsize=4.4, ha="center", va="center")
        ax.text(6.4, 20.6, "jardim\n2,80 × 3,25", fontsize=4.4, ha="center", va="center")

    # cotas
    ys = [0, 5.50, 5.70, 10.20, 10.35, 11.55, 11.70, 14.20, 14.35, 15.85, 16.00, 18.50, 18.65, 20.15, 20.30,
          21.80, 21.95, 24.80, 25.00]
    dim_chain(ax, ys, -0.45, True)
    dim_chain(ax, [0, 25.00], -1.25, True, fs=6)
    xs = [0, 0.20, 3.40, 3.55, 4.85, 5.00, 7.80, 8.00]
    dim_chain(ax, xs, -0.45, False)
    dim_chain(ax, [0, 8.00], -1.05, False, fs=6)
    ax.text(4.2, 4.9, "largura livre 7,60", fontsize=4, ha="center", color="#555555")
    ax.text(4.0, -1.75, "RUA  (testada 8,00 m)", fontsize=5.5, ha="center", va="center")
    ax.set_xlim(-1.9, 9.3)
    ax.set_ylim(-2.0, 26.0)
    ax.set_aspect("equal")
    ax.axis("off")


def main():
    W, H = 42.0, 29.7  # cm (A3 paisagem)
    fig = plt.figure(figsize=(W / 2.54, H / 2.54))
    aw, ah = 11.2, 28.0  # cm => escala 1:100
    for i, etapa in enumerate((1, 2)):
        ax = fig.add_axes([(1.0 + i * 11.6) / W, 0.3 / H, aw / W, ah / H])
        draw_plan(ax, etapa)
        ax.text(3.7, 25.75, f"PLANTA BAIXA — ETAPA {etapa}", fontsize=8, fontweight="bold", ha="center",
                va="bottom")

    tx = fig.add_axes([24.6 / W, 0.5 / H, 16.6 / W, 28.6 / H])
    tx.axis("off")
    tx.set_xlim(0, 1)
    tx.set_ylim(0, 1)
    y = 0.985
    tx.text(0, y, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    y -= 0.035
    tx.text(0, y, "Terreno 8,00 × 25,00 m = 200,00 m²   |   Planta baixa cotada — estudo preliminar", fontsize=7,
            va="top")
    y -= 0.04

    def table(title, rows, y):
        tx.text(0, y, title, fontsize=8, fontweight="bold", va="top")
        y -= 0.021
        for a, b, bold in rows:
            fw = "bold" if bold else "normal"
            tx.text(0.01, y, a, fontsize=6.3, va="top", fontweight=fw)
            tx.text(0.99, y, b, fontsize=6.3, va="top", ha="right", fontweight=fw)
            tx.plot([0, 1], [y - 0.0142, y - 0.0142], color="#bbbbbb", lw=0.3)
            y -= 0.0170
        return y - 0.009

    y = table("ÁREAS ÚTEIS (internas, sem paredes)", [
        ("Estar / jantar integrados — 5,00 × 4,50", "22,50 m²", False),
        ("Cozinha — 2,60 × 2,85", "7,41 m²", False),
        ("Lavanderia — 2,45 × 1,50", "3,68 m²", False),
        ("Suíte master — 4,65 × 2,85", "13,25 m²", False),
        ("Closet — 3,40 × 1,50", "5,10 m²", False),
        ("Banho suíte — 3,40 × 1,50", "5,10 m²", False),
        ("Demi-suíte 01 — 3,40 × 2,50", "8,50 m²", False),
        ("Demi-suíte 02 — 3,40 × 2,50", "8,50 m²", False),
        ("Banho compartilhado (acesso pelos dois quartos) — 3,40 × 1,50", "5,10 m²", False),
        ("Lavabo — 3,40 × 1,20", "4,08 m²", False),
        ("Corredor envidraçado — 1,10 × 11,45", "12,60 m²", False),
        ("TOTAL ÁREA ÚTIL", "95,81 m²", True),
    ], y)
    y = table("QUADRO DE ÁREAS — ETAPA 1", [
        ("Área do terreno", "200,00 m²", False),
        ("ÁREA CONSTRUÍDA TOTAL = PROJEÇÃO", "112,05 m²", True),
        ("Taxa de ocupação", "56,0 %", True),
        ("Garagem descoberta — 8,00 × 5,50", "44,00 m²", False),
        ("Pátio central descoberto", "33,32 m²", False),
        ("Spa descoberto", "6,72 m²", False),
        ("Muros e divisória do pátio", "3,91 m²", False),
    ], y)
    y = table("QUADRO DE ÁREAS — ETAPA 2 (acréscimos)", [
        ("Área gourmet com pergolado — 2,80 × 5,00", "14,00 m²", False),
        ("Projeção com gourmet coberto", "126,05 m²  (63,0 %)", True),
        ("Cobertura da garagem (se autorizada)", "44,00 m²", False),
        ("Projeção com gourmet e garagem cobertos", "170,05 m²  (85,0 %)", True),
        ("Jardim remanescente no pátio", "19,32 m²  (9,7 %)", False),
    ], y)
    y = table("ESQUADRIAS (pré-dimensionamento)", [
        ("P1  Porta de entrada / porta da suíte", "0,90 × 2,10", False),
        ("P2  Porta de quarto / lavanderia", "0,80 × 2,10", False),
        ("P3  Porta de banheiro, lavabo e closet", "0,70 × 2,10", False),
        ("J1  Janela do estar (frente)", "1,80 × 1,20", False),
        ("J2  Janela da lavanderia (frente)", "1,40 × 1,00", False),
        ("J3  Janela de quarto para o corredor", "1,20 × 1,20", False),
        ("V1  Vidro de correr social / pátio, piso ao teto", "2,80 m de vão", False),
        ("V2  Vidro de correr corredor / pátio, piso ao teto", "11,45 m de vão", False),
        ("V3  Porta de vidro suíte / spa", "1,80 × 2,10", False),
    ], y)
    notes = (
        "NOTAS\n"
        "1. Cotas em metros. Paredes externas e de divisa 0,20 m; internas 0,15 m (acabadas).\n"
        "2. Nenhuma abertura nas paredes de divisa. Banheiros, lavabo e closet: ventilação zenital\n"
        "    ou exaustão mecânica, a detalhar.\n"
        "3. Ventilação dos quartos pelo corredor envidraçado: depende de aceitação da Prefeitura.\n"
        "4. Índices urbanísticos (ocupação, permeabilidade, recuo) pendentes da Consulta Prévia.\n"
        "5. Pontos vermelhos na Etapa 1: esperas de água fria, esgoto e elétrica para a Etapa 2.\n"
        "6. Estudo preliminar. Não é projeto para aprovação nem para obra. Exige conferência e\n"
        "    assinatura de profissional habilitado (ART/RRT)."
    )
    tx.text(0, y, notes, fontsize=5.4, va="top", linespacing=1.3)
    tx.text(0, 0.0, "Doc. CP-ARQ-01   |   Revisão R03 — 15/11/2026   |   Escala 1:100 (folha A3)   |   Unidade: metro",
            fontsize=6.3, va="bottom", fontweight="bold")

    for ext in ("pdf", "svg"):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-01_planta-baixa_R03.{ext}"))
    fig.savefig(os.path.join(OUT, "CP-ARQ-01_planta-baixa_R03.png"), dpi=200)


if __name__ == "__main__":
    main()
