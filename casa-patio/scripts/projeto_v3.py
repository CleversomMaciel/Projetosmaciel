"""Casa Pátio — PACOTE DEFINITIVO sobre a planta V3 aprovada pelo proprietário.

Gera em ../projeto-definitivo/: pranchas ARQ-01, ARQ-02, LEG-01, EST-01, ELE-01, HID-01, IMP-01 (PDF e PNG)
e a planilha CP-PLANILHA (estimativa, resumo por etapa, cronograma físico-financeiro, quantitativos, cargas).
Coordenadas em metros: x = largura (0 a 8), y = profundidade (0 = rua, 25 = fundos).
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

import planta_v3 as P
from planta_fase2 import br, rect, dim_chain

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "projeto-definitivo")
REV, DATA = "R00", "16/11/2026"
PW, PH = 42.0, 29.7
RED, BLUE, BROWN, GREEN = "#b00000", "#1f6fb5", "#8a4b12", "#2a8a3a"
A_UTIL, A_CONST = P.A_UTIL, P.A_CONST
L_BALD = sum(max(w[2] - w[0], w[3] - w[1]) for w in P.WALLS)
L_MURO = 5.5 + 5.5 + 13.25 + 3.0


# ----------------------------------------------------------------------------- utilidades
def sheet():
    fig = plt.figure(figsize=(PW / 2.54, PH / 2.54))
    ax = fig.add_axes([0.8 / PW, 0.5 / PH, 11.2 / PW, 28.0 / PH])
    tx = fig.add_axes([12.8 / PW, 0.5 / PH, 28.6 / PW, 28.6 / PH]); tx.axis("off"); tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    return fig, ax, tx


def head(tx, code, title, sub):
    tx.text(0, 0.985, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    tx.text(0, 0.95, f"{code} — {title}", fontsize=10, fontweight="bold", va="top")
    tx.text(0, 0.925, sub, fontsize=7, va="top")
    tx.text(0, 0.0, f"Doc. CP-{code}   |   Revisão {REV} — {DATA}   |   Escala 1:100 (folha A3)   |   Unidade: metro   |   "
            "Anteprojeto — exige conferência e ART/RRT de profissional habilitado", fontsize=5.8, va="bottom", fontweight="bold")
    return 0.89


def table(tx, title, rows, y, x0=0.0, x1=1.0, fs=6.0):
    tx.text(x0, y, title, fontsize=8, fontweight="bold", va="top"); y -= 0.021
    for r in rows:
        fw = "bold" if len(r) > 2 and r[2] else "normal"
        tx.text(x0 + 0.004, y, r[0], fontsize=fs, va="top", fontweight=fw)
        tx.text(x1 - 0.004, y, r[1], fontsize=fs, va="top", ha="right", fontweight=fw)
        tx.plot([x0, x1], [y - 0.0135, y - 0.0135], color="#cccccc", lw=0.3); y -= 0.0160
    return y - 0.008


def notes(tx, y, title, lines, x0=0.0, fs=5.6):
    tx.text(x0, y, title + "\n" + "\n".join(lines), fontsize=fs, va="top", linespacing=1.32)


def save(fig, name):
    for ext, kw in (("pdf", {}), ("png", {"dpi": 170})):
        fig.savefig(os.path.join(OUT, f"CP-{name}_{REV}.{ext}"), **kw)
    plt.close(fig)


def base(ax, labels=True, title=""):
    """Planta de fundo em cinza para as pranchas complementares."""
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.5, ls=(0, (6, 3)))
    rect(ax, (4.80, 11.75, 7.80, 24.80), fc="#eef5ea", ec="none")
    rect(ax, (0.20, 16.55, 3.40, 18.05), fc="#eef5ea", ec="none"); rect(ax, (0.20, 11.75, 1.00, 13.25), fc="#fbf5dc", ec="none")
    for w in P.MUROS:
        rect(ax, w, fc="#cfcfcf", ec="none")
    for w in P.WALLS:
        rect(ax, w, fc="#9a9a9a", ec="none")
    for o in P.OPEN:
        rect(ax, o[:4], fc="white", ec="none")
    if labels:
        for cx, cy, name, w, d, a in P.ROOMS:
            ax.text(cx, cy + 0.15, name.replace(" (criança)", ""), fontsize=3.5, ha="center", va="center", color="#777777")
    ax.set_xlim(-1.9, 9.3); ax.set_ylim(-2.3, 25.7); ax.set_aspect("equal"); ax.axis("off")
    ax.text(4.0, -1.9, "RUA", fontsize=5.5, ha="center", va="center")
    ax.text(3.7, 25.3, title, fontsize=8, fontweight="bold", ha="center")


# ----------------------------------------------------------------------------- ARQ-01
def arq01():
    fig, ax, tx = sheet()
    P.planta(ax)
    for t in ax.texts:
        if t.get_text().startswith("PLANTA TÉRREA"):
            t.set_text("PLANTA BAIXA")
    y = head(tx, "ARQ-01", "Projeto arquitetônico: planta baixa", "Planta definitiva aprovada pelo proprietário. Números vermelhos: passagem livre em metros.")
    pd = {"ESTAR": "4,30", "SUÍTE": "2,80", "LAVAN": "2,80"}
    rows = [(f"{n.title()} — {br(w)} × {br(d)}   (pé-direito {pd.get(n[:5], '3,45')})", br(a) + " m²") for _, _, n, w, d, a in P.ROOMS]
    rows += [("Corredor interno — 1,10 × 9,60   (pé-direito 2,80)", br(P.A_CORR) + " m²"), ("TOTAL DE ÁREA ÚTIL", br(A_UTIL) + " m²", 1)]
    y1 = table(tx, "ÁREAS ÚTEIS", rows, y, x1=0.47)
    y1 = table(tx, "ÁREAS DESCOBERTAS", [
        ("Garagem, piso drenante — 7,60 × 5,50", "41,80 m²"), ("Pátio: área gourmet 3,00 × 4,00 e jardim 3,00 × 6,50", "31,50 m²"),
        ("Deck do spa com jacuzzi 2,00 × 1,80 e pergolado vazado", "7,20 m²"), ("Jardim de inverno do quarto 02 — 3,20 × 1,50", "4,80 m²"),
        ("Fosso de luz do banho social — 0,80 × 1,50", "1,20 m²")], y1, x1=0.47)
    table(tx, "QUADRO GERAL", [
        ("Terreno 8,00 × 25,00", "200,00 m²"), ("Área construída = projeção coberta", br(A_CONST) + " m²", 1),
        ("Taxa de ocupação (limite informado: 60 %)", br(A_CONST / 2, 1) + " %", 1), ("Saldo de projeção até 60 %", br(120 - A_CONST) + " m²")], y1, x1=0.47)
    y2 = table(tx, "QUADRO DE ESQUADRIAS", [
        ("P1  Porta de entrada, madeira, 1 un", "0,90 × 2,10"), ("P2  Portas internas de madeira, 5 un", "0,80 × 2,10"),
        ("P3  Porta do closet, 1 un", "0,70 × 2,10"), ("J1  Janela do estar, alumínio de correr, peitoril 0,70", "2,40 × 1,50"),
        ("J2  Janela da lavanderia, peitoril 1,10", "1,40 × 1,00"), ("J3  Janela da suíte para o pátio, peitoril 1,00", "0,60 × 1,20"),
        ("J5  Janela do banho social para o fosso, peitoril 1,10", "0,80 × 1,10"), ("J6  Janela alta do banho da suíte, peitoril 1,50", "0,80 × 0,70"),
        ("V1  Vidro de correr cozinha / gourmet, piso ao teto", "3,00 × 2,60"), ("V2  Vidro do corredor / pátio, com porta de correr", "9,60 × 2,60"),
        ("V3  Porta de vidro suíte / spa", "1,80 × 2,60"), ("V4  Porta de vidro quarto 02 / jardim de inverno", "2,40 × 2,60"),
        ("V5  Vidro fixo corredor / jardim de inverno", "1,30 × 2,60"), ("FA  Faixa alta da sala (frente e fundo), 6 painéis que abrem", "15,60 × 0,70"),
        ("FQ  Faixa alta de quarto, banhos e closet, que abre", "6,00 × 0,40")], y, x0=0.53)
    notes(tx, y2 - 0.005, "NOTAS", [
        "1. Paredes externas e de divisa 0,20 m; internas 0,15 m (acabadas). Piso interno 0,15 m acima da garagem.",
        "2. Nenhuma abertura nas paredes de divisa. A casa encosta na divisa esquerda; o pátio fica na direita.",
        "3. Vidros do piso ao teto em temperado ou laminado. No quarto da criança, trava alta na porta de vidro.",
        "4. Pergolados da área gourmet e do spa são vazados (ripados), para não contar como área coberta.",
        "5. Móveis indicados são sugestão de layout com medidas reais.",
        "6. Taxa de ocupação de 60 % informada pelo proprietário; recuo, permeabilidade e medidas mínimas de",
        "    pátio interno e fosso dependem da Consulta Prévia e do Código de Obras de Cascavel."], x0=0.53)
    save(fig, "ARQ-01_planta-baixa")


# ----------------------------------------------------------------------------- ARQ-02 cobertura, cortes, fachada
def arq02():
    fig = plt.figure(figsize=(PW / 2.54, PH / 2.54))
    ax = fig.add_axes([0.8 / PW, 0.5 / PH, 11.2 / PW, 28.0 / PH]); base(ax, labels=False, title="PLANTA DE COBERTURA")
    for r, h in (((0, 5.5, 8, 11.75), "||||"), ((1.0, 11.75, 3.55, 13.25), "----"), ((0, 13.25, 3.55, 16.55), "----"),
                 ((0, 18.05, 3.55, 21.5), "----"), ((3.55, 11.75, 4.8, 21.5), "////"), ((0, 21.5, 4.8, 25), "////")):
        rect(ax, r, fc="#d9d9d9", ec="k", lw=0.5, hatch=h, alpha=0.6)
    ax.annotate("", xy=(4.0, 6.0), xytext=(4.0, 11.2), arrowprops=dict(arrowstyle="->", lw=1))
    for yy in (14.8, 19.8):
        ax.annotate("", xy=(3.3, yy), xytext=(0.5, yy), arrowprops=dict(arrowstyle="->", lw=1))
    for yy in (13.0, 17.0, 20.5, 23.2):
        ax.annotate("", xy=(4.65, yy), xytext=(3.7 if yy < 21.5 else 0.6, yy), arrowprops=dict(arrowstyle="->", lw=1))
    for (tx_, ty_, t) in ((4.0, 8.5, "ÁGUA 1  sala\n+4,60, cai para a frente"), (1.8, 15.4, "ÁGUA 2  quartos\n+3,75"), (1.8, 20.4, "ÁGUA 2"),
                          (2.4, 23.9, "ÁGUA 4  suíte  +3,10"), (1.8, 17.3, "jardim de inverno\n(aberto)"), (0.6, 12.5, "fosso"),
                          (6.3, 17.0, "pátio\n(descoberto)"), (6.3, 23.6, "pergolado\nvazado"), (6.3, 13.7, "pergolado\nvazado"), (4.0, 2.7, "garagem (descoberta)")):
        ax.text(tx_, ty_, t, fontsize=4.4, ha="center", va="center", bbox=dict(fc="white", ec="none", pad=0.3, alpha=0.85))
    ax.text(4.17, 16.5, "ÁGUA 3  corredor  +3,10", fontsize=4.2, rotation=90, ha="center", va="center", bbox=dict(fc="white", ec="none", pad=0.3, alpha=0.85))
    ax.plot([0.2, 7.8], [5.62, 5.62], color=BLUE, lw=2.2); ax.plot([4.72, 4.72], [11.75, 24.8], color=BLUE, lw=2.2); ax.plot([3.47, 3.47], [11.75, 21.5], color=BLUE, lw=1.6)
    for (px, py) in ((0.5, 5.62), (7.5, 5.62), (4.72, 13.5), (4.72, 18.5), (4.72, 23.5), (3.47, 13.3), (3.47, 19.8)):
        ax.add_patch(Circle((px, py), 0.13, fc="white", ec=BLUE, lw=1))
    rect(ax, (5.4, 5.75, 7.75, 7.3), fill=False, ec=RED, lw=0.8); ax.text(6.6, 6.5, "reservatório\n1.000 L", fontsize=4.2, ha="center", va="center", color=RED)
    ax.plot([1.8, 1.8], [-0.3, 25.2], color=RED, lw=0.5, ls="-."); ax.plot([-0.5, 8.5], [15.0, 15.0], color=RED, lw=0.5, ls="-.")
    for a, b, t in ((1.8, -0.6, "A"), (1.8, 25.5, "A"), (-0.8, 15.0, "B"), (8.8, 15.0, "B")):
        ax.text(a, b, t, fontsize=8, fontweight="bold", ha="center", va="center", color=RED)

    cx = fig.add_axes([13.2 / PW, 11.3 / PH, 28.0 / PW, 14.8 / PH]); cx.set_xlim(-1.2, 26.8); cx.set_ylim(-1.5, 13.3); cx.set_aspect("equal"); cx.axis("off")
    y0 = 7.4                                                                 # ---- corte longitudinal A-A
    cx.plot([-1, 26], [y0, y0], color="k", lw=0.8); rect(cx, (5.5, y0, 25.0, y0 + 0.15), fc="#bbbbbb", ec="none")
    for yy, w, h in [(5.5, 0.2, 5.05), (11.6, 0.15, 5.05), (13.25, 0.15, 3.9), (16.4, 0.15, 3.9), (18.05, 0.15, 3.9), (19.7, 0.15, 3.9), (21.35, 0.15, 3.9), (24.8, 0.2, 3.45)]:
        rect(cx, (yy, y0 + 0.15, yy + w, y0 + h), fc="#3a3a3a", ec="none")
    for yy, w in ((5.5, 0.2), (11.6, 0.15)):
        rect(cx, (yy, y0 + 3.6, yy + w, y0 + 4.3), fc="white", ec="none"); cx.plot([yy + w / 2] * 2, [y0 + 3.6, y0 + 4.3], color="#2f8fd0", lw=2)
    rect(cx, (5.5, y0 + 4.45, 11.75, y0 + 4.57), fc="#777777", ec="none"); cx.plot([5.5, 11.75], [y0 + 4.72, y0 + 4.95], color="k", lw=1.3)
    for a, b in ((11.75, 16.55), (18.05, 21.5)):
        rect(cx, (a, y0 + 3.6, b, y0 + 3.72), fc="#777777", ec="none"); cx.plot([a, b], [y0 + 3.9, y0 + 3.9], color="k", lw=1.3)
    rect(cx, (21.5, y0 + 2.95, 25.0, y0 + 3.07), fc="#777777", ec="none"); cx.plot([21.5, 25.0], [y0 + 3.25, y0 + 3.25], color="k", lw=1.3)
    for x, t, rot in [(8.6, "ESTAR / JANTAR / COZINHA\npé-direito 4,30", 0), (12.5, "banho\nsocial", 90), (14.9, "quarto 02\n3,45", 0), (17.3, "jardim de\ninverno\n(aberto)", 0),
                      (18.95, "banho\nsuíte", 90), (20.6, "closet", 90), (23.2, "suíte master\n2,80", 0), (2.75, "garagem\ndescoberta", 0)]:
        cx.text(x, y0 + 1.5, t, fontsize=5, ha="center", va="center", rotation=rot)
    for lvl, t in [(0, "0,00"), (0.15, "+0,15"), (2.95, "+2,95"), (3.6, "+3,60"), (4.45, "+4,45"), (5.05, "+5,05 topo")]:
        cx.plot([25.3, 25.7], [y0 + lvl] * 2, color="k", lw=0.4); cx.text(25.8, y0 + lvl + (0.08 if lvl == 0.15 else 0), t, fontsize=4.5, va="center")
    dim_chain(cx, [0, 5.5, 11.75, 16.55, 18.05, 21.5, 25.0], y0 - 0.45, False, fs=4.6)
    cx.text(12.5, y0 + 5.35, "CORTE LONGITUDINAL A-A", fontsize=7.5, fontweight="bold", ha="center")
    x0, y0 = 0.5, -0.4                                                        # ---- corte transversal B-B
    cx.plot([x0 - 0.6, x0 + 8.6], [y0, y0], color="k", lw=0.8); rect(cx, (x0, y0, x0 + 4.8, y0 + 0.15), fc="#bbbbbb", ec="none")
    rect(cx, (x0, y0 + 0.15, x0 + 0.2, y0 + 3.9), fc="#3a3a3a", ec="none"); rect(cx, (x0 + 3.4, y0 + 0.15, x0 + 3.55, y0 + 3.9), fc="#3a3a3a", ec="none")
    rect(cx, (x0 + 3.4, y0 + 3.1, x0 + 3.55, y0 + 3.5), fc="white", ec="none"); cx.plot([x0 + 3.475] * 2, [y0 + 3.1, y0 + 3.5], color="#2f8fd0", lw=2)
    cx.plot([x0 + 4.725] * 2, [y0 + 0.15, y0 + 2.75], color="#2f8fd0", lw=1.6); rect(cx, (x0 + 4.65, y0 + 2.75, x0 + 4.8, y0 + 3.05), fc="#3a3a3a", ec="none")
    rect(cx, (x0 + 0.2, y0 + 3.6, x0 + 3.4, y0 + 3.72), fc="#777777", ec="none"); rect(cx, (x0 + 3.55, y0 + 2.95, x0 + 4.65, y0 + 3.05), fc="#777777", ec="none")
    cx.plot([x0 + 0.2, x0 + 3.5], [y0 + 4.0, y0 + 3.82], color="k", lw=1.3); cx.plot([x0 + 3.55, x0 + 4.85], [y0 + 3.25, y0 + 3.15], color="k", lw=1.3)
    rect(cx, (x0 + 7.8, y0, x0 + 8.0, y0 + 2.2), fc="#8a8a8a", ec="none")
    for x, t, rot in ((x0 + 1.8, "quarto 02\npé-direito 3,45", 0), (x0 + 4.1, "corredor 2,80", 90), (x0 + 6.3, "pátio", 0)):
        cx.text(x, y0 + 1.4, t, fontsize=5, ha="center", va="center", rotation=rot)
    cx.annotate("faixa alta que abre", xy=(x0 + 3.5, y0 + 3.3), xytext=(x0 + 6.3, y0 + 3.7), fontsize=4.6, ha="center", arrowprops=dict(arrowstyle="->", lw=0.5))
    dim_chain(cx, [x0, x0 + 0.2, x0 + 3.4, x0 + 3.55, x0 + 4.65, x0 + 4.8, x0 + 7.8, x0 + 8.0], y0 - 0.45, False, fs=4.4)
    cx.text(x0 + 4, y0 + 4.5, "CORTE TRANSVERSAL B-B", fontsize=7.5, fontweight="bold", ha="center")
    x0 = 13.5                                                                 # ---- fachada frontal
    cx.plot([x0 - 0.6, x0 + 8.6], [y0, y0], color="k", lw=0.8)
    rect(cx, (x0 + 5.3, y0 + 5.05, x0 + 8.0, y0 + 5.75), fc="#e6e6e6", ec="k", lw=0.5)
    rect(cx, (x0, y0, x0 + 8.0, y0 + 5.05), fc="#f2f2f2", ec="k", lw=0.8); rect(cx, (x0, y0 + 4.55, x0 + 8.0, y0 + 5.05), fc="#dddddd", ec="k", lw=0.4)
    rect(cx, (x0 + 0.2, y0 + 3.6, x0 + 7.8, y0 + 4.3), fc="#cfe6f7", ec="k", lw=0.5)
    for k in range(1, 6):
        cx.plot([x0 + 0.2 + 7.6 * k / 6] * 2, [y0 + 3.6, y0 + 4.3], color="k", lw=0.4)
    xx = x0 + 3.95
    while xx < x0 + 5.37:
        side = xx < x0 + 4.15 or xx > x0 + 5.13
        rect(cx, (xx, y0 + (0.15 if side else 2.3), xx + 0.05, y0 + 4.5), fc="#a9713f", ec="none"); xx += 0.085
    rect(cx, (x0 + 4.2, y0 + 0.15, x0 + 5.1, y0 + 2.25), fc="#7d5029", ec="k", lw=0.6)
    rect(cx, (x0 + 1.0, y0 + 0.85, x0 + 3.4, y0 + 2.35), fc="#cfe6f7", ec="k", lw=0.6); rect(cx, (x0 + 6.0, y0 + 1.25, x0 + 7.4, y0 + 2.25), fc="#cfe6f7", ec="k", lw=0.6)
    rect(cx, (x0, y0 + 2.6, x0 + 8.0, y0 + 2.7), fc="#2f3133", ec="none")
    for t, xx_, yy_ in (("J1", 2.2, 2.45), ("P1", 4.65, 2.4), ("J2", 6.7, 2.4), ("faixa de vidro alta FA", 2.0, 4.38), ("volume do reservatório", 6.65, 5.4)):
        cx.text(x0 + xx_, y0 + yy_, t, fontsize=4.2, ha="center")
    dim_chain(cx, [x0, x0 + 8.0], y0 - 0.45, False, fs=4.6)
    cx.text(x0 + 4, y0 + 6.05, "FACHADA FRONTAL DA CASA (vista da garagem)", fontsize=7.5, fontweight="bold", ha="center")

    tx = fig.add_axes([13.2 / PW, 0.5 / PH, 28.2 / PW, 28.6 / PH]); tx.axis("off"); tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    head(tx, "ARQ-02", "Projeto arquitetônico: cobertura, cortes e fachada", "")
    y = table(tx, "COBERTURA", [
        ("Telha termoacústica trapezoidal 30 mm, inclinação de 5 a 10 %, sobre estrutura metálica leve; platibanda nas divisas e na frente", ""),
        ("Água 1 — sala e cozinha (cai para a frente, calha C1)", "50,00 m²"), ("Água 2 — quarto, banhos e closet (cai para o corredor, calha C3)", "28,61 m²"),
        ("Água 3 — corredor (cai para o pátio, calha C2)", "12,19 m²"), ("Água 4 — suíte (cai para o pátio, calha C2)", "16,80 m²"),
        ("Área de telha com 5 % de perdas", "113,0 m²"), ("Calhas C1 (7,60) + C2 (13,05) + C3 (9,75)", "30,40 m"),
        ("Condutores verticais Ø100", "7 un"), ("Rufos e contra-rufos (divisas, platibandas, volumes altos)", "62,0 m"),
        ("Laje pré-moldada sobre a lavanderia para o reservatório, em volume elevado (topo +5,75)", "6,37 m²")], 0.375, x1=0.6)
    notes(tx, y - 0.004, "NOTAS", [
        "1. Níveis referidos ao piso da garagem (0,00), que fica no nível da rua. Piso interno +0,15.",
        "2. Jardim de inverno e fosso são abertos para o céu: paredes internas deles são fachadas, com rufo no topo.",
        "3. A faixa alta dos quartos fica acima do telhado do corredor e abre para o pátio.",
        "4. Nenhuma água de chuva cai no vizinho: divisas sobem como platibanda, com rufo e pingadeira."], fs=5.6)
    save(fig, "ARQ-02_cobertura-cortes-fachada")


# ----------------------------------------------------------------------------- LEG-01
def leg01():
    fig, ax, tx = sheet()
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=1.0)
    for r in ((0, 5.5, 8, 11.75), (1.0, 11.75, 4.8, 13.25), (0, 11.75, 0.2, 13.25), (0, 13.25, 4.8, 16.55), (0, 16.55, 0.2, 18.05), (3.4, 16.55, 4.8, 18.05), (0, 18.05, 4.8, 25)):
        rect(ax, r, fc="#d0d0d0", ec="none", hatch="////")
    rect(ax, (0.2, 0, 7.8, 5.5), fc="#f4f4f4", ec="#999999", lw=0.4); rect(ax, (4.8, 11.75, 7.8, 24.8), fc="#e3f0da", ec="#999999", lw=0.4)
    rect(ax, (4.8, 11.75, 7.8, 15.75), fc="#f1e6cd", ec="#999999", lw=0.4, ls="--"); rect(ax, (4.8, 22.4, 7.8, 24.8), fc="#f1e6cd", ec="#999999", lw=0.4, ls="--")
    rect(ax, (0.2, 16.55, 3.4, 18.05), fc="#e3f0da", ec="#999999", lw=0.4); rect(ax, (0.2, 11.75, 1.0, 13.25), fc="#fbf5dc", ec="#999999", lw=0.4)
    for x, y_, t in ((4.0, 8.6, "CASA TÉRREA\nbloco social\nh = 5,05"), (2.4, 15.0, "ala íntima\nh = 3,90"), (2.4, 23.2, "suíte\nh = 3,45"), (4.0, 2.8, "GARAGEM DESCOBERTA\npiso drenante 41,80 m²"),
                     (6.3, 19.0, "JARDIM\npermeável\n19,50 m²"), (6.3, 13.7, "gourmet\npergolado vazado"), (6.3, 23.6, "spa\npergolado vazado"), (1.8, 17.3, "jardim de inverno 4,80 m²")):
        ax.text(x, y_, t, fontsize=4.6, ha="center", va="center", bbox=dict(fc="white", ec="none", pad=0.4, alpha=0.9))
    dim_chain(ax, [0, 5.5, 25.0], -0.5, True, fs=5.5); dim_chain(ax, [0, 8.0], -0.7, False, fs=6); dim_chain(ax, [5.5, 11.75, 25.0], 8.6, True, fs=5)
    dim_chain(ax, [0, 4.8, 8.0], 25.5, False, fs=5)
    ax.text(4.0, -1.6, "RUA (testada 8,00 m) — nome e largura da via a informar", fontsize=5, ha="center")
    ax.text(-1.4, 24.5, "N ?", fontsize=8, fontweight="bold", color=RED); ax.text(-1.75, 23.9, "norte a\ninformar", fontsize=4, color=RED)
    ax.set_xlim(-1.9, 9.3); ax.set_ylim(-2.3, 26.2); ax.set_aspect("equal"); ax.axis("off")
    ax.text(3.7, 26.0, "IMPLANTAÇÃO E PROJEÇÃO DA EDIFICAÇÃO", fontsize=8, fontweight="bold", ha="center")
    y = head(tx, "LEG-01", "Projeto legal: implantação e quadro estatístico (minuta)", "Minuta para o arquiteto ou engenheiro montar o processo de aprovação na Prefeitura de Cascavel. Não é o projeto legal assinado.")
    y1 = table(tx, "QUADRO ESTATÍSTICO", [
        ("Área do terreno", "200,00 m²"), ("Uso", "residencial unifamiliar, 1 pavimento"), ("Área construída total (computável)", br(A_CONST) + " m²", 1),
        ("Projeção da edificação", br(A_CONST) + " m²"), ("Taxa de ocupação", br(A_CONST / 2, 1) + " %", 1), ("Coeficiente de aproveitamento", br(A_CONST / 200, 2)),
        ("Área permeável: jardim do pátio 19,50 + jardim de inverno 4,80", "24,30 m²  (12,2 %)"),
        ("Área permeável contando a garagem com piso drenante", "66,10 m²  (33,1 %)"), ("Recuo frontal (casa)", "5,50 m"),
        ("Afastamentos laterais e de fundos", "0,00 (paredes cegas nas divisas)"), ("Altura máxima da edificação", "5,05 m (volume do reservatório 5,75 m)"),
        ("Número de vagas", "2, descobertas"), ("Dormitórios", "2 (1 suíte)")], y, x1=0.49)
    y1 = table(tx, "ÁREAS POR TIPO", [
        ("Área útil interna", br(A_UTIL) + " m²"), ("Paredes e estrutura", br(A_CONST - A_UTIL) + " m²"), ("Garagem descoberta", "41,80 m²"),
        ("Pátio (gourmet + jardim)", "31,50 m²"), ("Deck do spa", "7,20 m²"), ("Jardim de inverno + fosso", "6,00 m²"), ("Muros", "5,90 m²")], y1, x1=0.49)
    y2 = table(tx, "ÍNDICES A CONFIRMAR NA CONSULTA PRÉVIA", [
        ("Zona do lote", "não informada"), ("Taxa de ocupação máxima", "60 % (informado pelo proprietário)"), ("Coeficiente de aproveitamento máximo", "a confirmar"),
        ("Taxa de permeabilidade mínima", "a confirmar"), ("Recuo frontal mínimo", "a confirmar"), ("Altura máxima na divisa", "a confirmar"),
        ("Pátio interno mínimo para dormitório", "a confirmar (projeto: 3,20 × 1,50)"), ("Fosso mínimo para banheiro", "a confirmar (projeto: 0,80 × 1,50)"),
        ("Pergolado vazado conta como área coberta?", "a confirmar")], y, x0=0.53)
    y2 = table(tx, "DOCUMENTOS NORMALMENTE EXIGIDOS PARA O ALVARÁ", [
        ("Matrícula atualizada do imóvel", "proprietário"), ("Consulta Prévia / guia de viabilidade do lote", "Prefeitura (IPC)"),
        ("Projeto arquitetônico legal assinado", "arquiteto ou engenheiro"), ("RRT ou ART de projeto e de execução", "profissional"),
        ("Memorial descritivo", "profissional"), ("Projetos complementares, quando exigidos", "engenheiros"),
        ("Comprovante de quitação de tributos do imóvel", "proprietário")], y2, x0=0.53)
    notes(tx, min(y1, y2) - 0.006, "O QUE FALTA PARA VIRAR PROJETO LEGAL", [
        "1. Endereço, inscrição imobiliária e matrícula do lote, com as medidas e confrontações oficiais.",
        "2. Consulta Prévia do Instituto de Planejamento de Cascavel com os índices da zona. Sem ela não dá para afirmar que o projeto atende.",
        "3. Orientação do norte, nome e largura da rua e do passeio, e cota do meio-fio.",
        "4. Conferência, pelo profissional, de três pontos do Código de Obras: pátio interno do quarto 02, fosso do banho social e a",
        "    ventilação por faixa alta dos banheiros e do closet.",
        "5. Carimbo padrão da Prefeitura, assinaturas e RRT/ART. A lista de documentos acima é a usual; a Prefeitura pode pedir outros.",
        "6. Se a obra for financiada, o banco pede este projeto aprovado, o alvará, o orçamento e o cronograma no modelo dele."])
    save(fig, "LEG-01_implantacao-quadro-estatistico")


# ----------------------------------------------------------------------------- EST-01
YW = [11.675, 13.325, 16.475, 18.125, 19.775, 21.425]
PIL = ([(0.10, y) for y in (5.60, 8.60, 24.90)] + [(0.10, y) for y in YW] + [(3.475, y) for y in YW] + [(4.725, y) for y in (11.675, 14.90, 18.10, 21.425, 24.90)]
       + [(7.90, y) for y in (5.60, 7.275, 9.50, 11.675)] + [(3.80, 5.60), (5.275, 5.60), (5.275, 7.275)])
N_PIL = len(PIL)
EST = dict(est=N_PIL * 3.1416 * 0.125 ** 2 * 4.0, bal=L_BALD * 0.15 * 0.30, pil=(N_PIL - 10) * 0.15 * 0.30 * 3.6 + 10 * 0.15 * 0.30 * 5.0,
           cin=L_BALD * 0.15 * 0.25 + 27.7 * 0.15 * 0.25)


def est01():
    fig, ax, tx = sheet(); base(ax, title="LOCAÇÃO DE PILARES, BALDRAMES E ESTACAS")
    for x0, y0, x1, y1 in P.WALLS:
        if (x1 - x0) > (y1 - y0):
            ax.plot([x0, x1], [(y0 + y1) / 2] * 2, color=GREEN, lw=1.0)
        else:
            ax.plot([(x0 + x1) / 2] * 2, [y0, y1], color=GREEN, lw=1.0)
    for i, (px, py) in enumerate(sorted(PIL, key=lambda p: (p[1], p[0])), 1):
        ax.add_patch(Circle((px, py), 0.22, fill=False, ec=BROWN, lw=0.6, ls="--")); rect(ax, (px - 0.09, py - 0.15, px + 0.09, py + 0.15), fc=RED, ec="k", lw=0.3)
        ax.text(px + 0.26, py + 0.2, f"P{i}", fontsize=3.8, color=RED)
    for (px, py) in ((4.95, 11.9), (7.7, 11.9), (4.95, 15.65), (7.7, 15.65), (4.95, 22.55), (7.7, 22.55), (4.95, 24.68), (7.7, 24.68)):
        rect(ax, (px - 0.15, py - 0.15, px + 0.15, py + 0.15), fill=False, ec=RED, lw=0.7)
    rect(ax, (5.5, 22.7, 7.7, 24.7), fill=False, ec=RED, lw=0.8, hatch="xx"); ax.text(6.6, 23.7, "radier\njacuzzi", fontsize=4, ha="center", va="center", color=RED, bbox=dict(fc="white", ec="none", pad=0.3))
    y = head(tx, "EST-01", "Projeto estrutural: concepção e fundações (pré-dimensionamento)", "Casa térrea com bloco social de pé-direito alto. Dimensões e armaduras definitivas dependem de sondagem e de cálculo.")
    y = table(tx, "SISTEMA ADOTADO PARA ORÇAMENTO", [
        ("Fundação: estaca escavada Ø25 cm, uma por pilar, profundidade adotada 4,0 m", f"{N_PIL} un"),
        ("Viga baldrame 15 × 30 cm sob todas as paredes e sob as esquadrias de vidro", f"{br(L_BALD, 1)} m"),
        ("Pilares 15 × 30 cm: 10 no bloco social com 5,0 m de altura, os demais com 3,6 m", f"{N_PIL} un"),
        ("Cinta de respaldo 15 × 25 cm em todas as paredes, mais cinta intermediária no bloco social (nível +2,95)", f"{br(L_BALD + 27.7, 1)} m"),
        ("Vigas sobre os vãos de vidro (V1, V2, V4): 15 × 35 cm, vãos de até 3,25 m", "16,3 m"),
        ("Cobertura do bloco social: vigas ou treliças metálicas vencendo 7,60 m, a cada 1,50 m", "5 un"),
        ("Laje pré-moldada treliçada h = 12 cm sobre a lavanderia (reservatório)", "6,37 m²"),
        ("Radier armado da jacuzzi 2,40 × 2,20 × 0,15 m (carga de cerca de 2 t)", "0,79 m³"),
        ("Blocos 40 × 40 × 40 cm para os pilares dos dois pergolados", "8 un"),
        ("Muros de divisa: brocas Ø20 × 2,0 m a cada 2,5 m, baldrame 15 × 25 e pilaretes", f"{br(L_MURO, 2)} m"),
        ("Contrapiso armado com tela sobre lastro de brita e lona", f"{br(A_UTIL, 1)} m²")], y, x1=0.72)
    aco = (EST["bal"] + EST["pil"] + EST["cin"]) * 90 + EST["est"] * 40
    y = table(tx, "VOLUMES E CONSUMOS ESTIMADOS", [
        ("Concreto das estacas (fck 20 MPa)", f"{br(EST['est'], 1)} m³"), ("Concreto dos baldrames (fck 25 MPa)", f"{br(EST['bal'], 1)} m³"),
        ("Concreto dos pilares (fck 25 MPa)", f"{br(EST['pil'], 1)} m³"), ("Concreto das cintas e vigas (fck 25 MPa)", f"{br(EST['cin'] + 0.86, 1)} m³"),
        ("Aço CA-50 / CA-60, taxa adotada de 90 kg por m³", f"{br(aco, 0)} kg"),
        ("Formas de madeira", f"{br(L_BALD * 0.6 + N_PIL * 0.9 * 4.0 + (L_BALD + 27.7) * 0.5, 0)} m²")], y, x1=0.72)
    notes(tx, y - 0.004, "NOTAS", [
        "1. NÃO É PROJETO ESTRUTURAL. Seções, armaduras e profundidade das estacas são premissas para orçamento. O projeto",
        "    definitivo exige cálculo pelas NBR 6118, 6120 e 6122, com ART.",
        "2. Sondagem SPT obrigatória antes do projeto de fundações (NBR 8036), mínimo de 2 furos. O solo argiloso poroso de",
        "    Cascavel pode ser colapsível; a profundidade real das estacas pode mudar bastante o custo.",
        "3. Bloco social: paredes de 5,05 m com rasgo contínuo de vidro no alto. Precisam de pilares mais altos, cinta",
        "    intermediária e verificação ao vento. É o ponto estrutural mais delicado da casa.",
        "4. Paredes do jardim de inverno e do fosso são externas: baldrame impermeabilizado e pingadeira no topo.",
        "5. A casa encosta na divisa esquerda: verificar fundações e construções do vizinho antes de escavar.",
        "6. Círculos tracejados: estacas. Retângulos vermelhos: pilares. Quadrados vazados: blocos dos pergolados."])
    save(fig, "EST-01_estrutura-fundacoes")


# ----------------------------------------------------------------------------- ELE-01
CIRC = [
    (1, "Iluminação — sala, cozinha, lavanderia, garagem", 127, 1300, 1.5, 10, "não"), (2, "Iluminação — ala íntima, corredor, pátio e spa", 127, 1100, 1.5, 10, "não"),
    (3, "Tomadas — estar e jantar", 127, 1300, 2.5, 20, "sim"), (4, "Tomadas — cozinha, bancada e ilha", 127, 2400, 2.5, 20, "sim"),
    (5, "Tomadas — geladeira, coifa e micro-ondas", 127, 1900, 2.5, 20, "sim"), (6, "Tomadas — lavanderia (lavadora)", 127, 1500, 2.5, 20, "sim"),
    (7, "Tomadas — quarto 02, suíte, closet e corredor", 127, 1900, 2.5, 20, "sim"), (8, "Tomadas — banheiros", 127, 1200, 2.5, 20, "sim"),
    (9, "Chuveiro — banho da suíte", 220, 7500, 6.0, 40, "sim"), (10, "Chuveiro — banho social", 220, 7500, 6.0, 40, "sim"),
    (11, "Forno elétrico", 220, 2500, 2.5, 20, "sim"), (12, "Ar-condicionado — suíte master (12.000 BTU)", 220, 1300, 2.5, 16, "não"),
    (13, "Ar-condicionado — quarto 02 (9.000 BTU)", 220, 1000, 2.5, 16, "não"), (14, "Ar-condicionado — sala, pé-direito alto (30.000 BTU)", 220, 3200, 4.0, 25, "não"),
    (15, "Jacuzzi — aquecedor e motobomba", 220, 5000, 6.0, 32, "sim"), (16, "Área gourmet — tomadas e iluminação", 127, 2000, 2.5, 20, "sim"),
    (17, "Portão basculante, interfone e iluminação frontal", 127, 700, 2.5, 16, "sim"), (18, "Pressurizador de água e automação das faixas altas", 127, 600, 2.5, 16, "sim"),
]
LUZ = [(1.9, 7.5), (2.05, 10.3), (6.4, 9.2), (5.85, 8.9), (6.5, 6.5), (2.5, 12.6), (1.8, 15.0), (0.4, 17.9), (2.0, 19.0), (1.8, 20.6), (2.4, 23.1),
       (4.1, 13.5), (4.1, 17.0), (4.1, 20.2), (4.0, 2.8), (0.7, 5.3), (7.3, 5.3), (6.0, 13.75), (6.3, 18.5), (6.3, 21.0), (6.6, 23.7), (0.6, 12.5)]
TUG = [(0.35, 6.8), (0.35, 8.3), (3.3, 5.85), (4.9, 5.85), (0.35, 10.3), (3.3, 11.45), (7.65, 8.0), (7.65, 9.1), (7.65, 10.3), (5.85, 8.5), (7.65, 10.95),
       (7.65, 6.0), (7.65, 6.7), (6.2, 5.85), (3.25, 11.9), (1.3, 16.25), (3.25, 15.2), (3.25, 14.55), (0.35, 14.2), (3.25, 18.35), (1.8, 21.2),
       (1.4, 24.65), (3.5, 24.65), (2.9, 21.65), (0.35, 22.5), (4.5, 23.0), (3.7, 15.5), (3.7, 19.0), (0.35, 1.0), (7.65, 1.0), (7.65, 13.0), (7.65, 14.2)]
TUE = [(1.6, 11.9), (0.6, 18.4), (7.65, 7.6), (7.65, 24.6), (7.65, 9.75)]
ACS = [(0.3, 23.5), (0.3, 13.75), (0.3, 9.2)]


def ele01():
    fig, ax, tx = sheet(); base(ax, title="PLANTA DE PONTOS ELÉTRICOS")
    for x, y in LUZ:
        ax.add_patch(Circle((x, y), 0.14, fc="#ffe066", ec="k", lw=0.4))
    for x, y in TUG:
        ax.add_patch(Polygon([(x - 0.1, y - 0.08), (x + 0.1, y - 0.08), (x, y + 0.12)], fc="white", ec="k", lw=0.5))
    for x, y in TUE:
        ax.add_patch(Polygon([(x - 0.12, y - 0.1), (x + 0.12, y - 0.1), (x, y + 0.14)], fc="k", ec="k", lw=0.5))
    for x, y in ACS:
        rect(ax, (x - 0.07, y - 0.3, x + 0.1, y + 0.3), fc="#9ad0f5", ec="k", lw=0.4)
    rect(ax, (5.36, 5.95, 5.48, 6.55), fc=RED, ec="k", lw=0.4); ax.text(5.6, 6.25, "QD", fontsize=4.5, color=RED, va="center", fontweight="bold")
    rect(ax, (7.45, 0.1, 7.75, 0.5), fc="k", ec="k"); ax.text(7.35, 0.3, "padrão de entrada", fontsize=4, va="center", ha="right")
    ax.plot([7.6, 7.6, 5.42, 5.42], [0.5, 5.35, 5.35, 5.95], color=RED, lw=0.7, ls="--")
    y = head(tx, "ELE-01", "Projeto elétrico: pontos e quadro de cargas (pré-dimensionamento)", "Fornecimento Copel 127/220 V. Referência: ABNT NBR 5410. Condutores de cobre 750 V em eletroduto corrugado.")
    tx.text(0, y, "QUADRO DE CARGAS", fontsize=8, fontweight="bold", va="top"); y -= 0.022
    cols = [0.0, 0.035, 0.50, 0.58, 0.67, 0.75, 0.84, 0.92]
    for c, h in zip(cols, ["Nº", "Circuito", "Tensão", "Potência", "Corrente", "Cabo", "Disjuntor", "DR 30 mA"]):
        tx.text(c, y, h, fontsize=6, fontweight="bold", va="top")
    y -= 0.017; tot = 0
    for n, d, v, p, cab, dj, dr in CIRC:
        for c, val in zip(cols, [str(n), d, f"{v} V", f"{p} VA", f"{br(p / v, 1)} A", f"{br(cab, 1)} mm²", f"{dj} A", dr]):
            tx.text(c, y, val, fontsize=5.8, va="top")
        tx.plot([0, 1], [y - 0.0135, y - 0.0135], color="#cccccc", lw=0.3); y -= 0.0162; tot += p
    tx.text(0.035, y, "POTÊNCIA INSTALADA TOTAL", fontsize=6.2, fontweight="bold", va="top"); tx.text(0.58, y, f"{tot} VA", fontsize=6.2, fontweight="bold", va="top"); y -= 0.03
    y = table(tx, "CONTAGEM DE PONTOS", [
        ("Pontos de luz (círculo amarelo), incluindo pátio, jardim de inverno, fosso e spa", f"{len(LUZ)} un"),
        ("Tomadas de uso geral 2P+T 10 A (triângulo vazado)", f"{len(TUG)} un"),
        ("Tomadas de uso específico 20 A: chuveiros, forno, coifa e jacuzzi (triângulo cheio)", f"{len(TUE)} un"),
        ("Pontos de ar-condicionado com dreno e tubulação embutidos (retângulo azul)", f"{len(ACS)} un"), ("Interruptores", "16 un"),
        ("Quadro de distribuição de embutir, 28 a 32 módulos, na lavanderia", "1 un"), ("DPS classe II 275 V 20 kA", "4 un"),
        ("Hastes de aterramento 2,40 m com caixa de inspeção, esquema TN-S", "3 un")], y, x1=0.8)
    notes(tx, y - 0.004, "NOTAS", [
        "1. Entrada prevista trifásica. Categoria e disjuntor geral a confirmar com a Copel pela demanda calculada (ordem de",
        "    grandeza: disjuntor geral de 63 A, ramal 16 mm²).",
        "2. Jacuzzi: circuito exclusivo com DR de 30 mA, equipotencialização das partes metálicas e comando fora do alcance de",
        "    quem está na água, conforme as regras da NBR 5410 para locais com banheira.",
        "3. DR de 30 mA em todas as áreas molhadas, tomadas e áreas externas.",
        "4. A sala de pé-direito alto pede ar-condicionado maior e ponto elétrico para abrir os painéis da faixa alta.",
        "5. Queda de tensão a verificar no projeto definitivo (percurso mais longo: quadro até a jacuzzi, cerca de 26 m).",
        "6. Posições de pontos são indicativas e devem ser ajustadas ao layout de móveis antes da execução."])
    save(fig, "ELE-01_eletrica")
    return tot


# ----------------------------------------------------------------------------- HID-01
def hid01():
    fig, ax, tx = sheet(); base(ax, title="PLANTA HIDROSSANITÁRIA E PLUVIAL")
    af = [[(7.6, 0.3), (7.6, 5.3), (6.6, 5.3), (6.6, 6.4)], [(6.6, 6.4), (4.1, 6.4), (4.1, 21.0)], [(4.1, 12.5), (1.6, 12.5)], [(4.1, 19.0), (0.6, 19.0)],
          [(4.1, 17.3), (3.2, 17.3)], [(6.6, 6.4), (7.5, 6.4), (7.5, 13.3)], [(7.5, 13.3), (7.5, 24.2)]]
    for seg in af:
        ax.plot([p[0] for p in seg], [p[1] for p in seg], color=BLUE, lw=0.9)
    rect(ax, (5.5, 5.8, 7.7, 7.15), fill=False, ec=BLUE, lw=0.9, ls="--"); ax.text(6.6, 6.75, "reservatório 1.000 L", fontsize=4, ha="center", color=BLUE)
    rect(ax, (7.45, 0.1, 7.75, 0.5), fc=BLUE, ec="k", lw=0.3); ax.text(7.35, 0.3, "hidrômetro", fontsize=4, ha="right", va="center", color=BLUE)
    eg = [[(1.6, 12.9), (5.1, 12.9)], [(1.5, 19.3), (5.1, 19.3)], [(6.6, 22.6), (5.1, 22.6)], [(5.1, 22.6), (5.1, 0.6), (5.1, -0.2)],
          [(7.4, 8.6), (6.6, 8.6), (6.6, 4.9)], [(7.4, 6.7), (6.6, 6.7)], [(6.6, 4.6), (5.1, 4.6)], [(7.4, 13.0), (6.4, 13.0), (6.4, 12.3), (5.1, 12.3)]]
    for seg in eg:
        ax.plot([p[0] for p in seg], [p[1] for p in seg], color=BROWN, lw=1.1)
    for k, (x, y) in {"CI1": (5.1, 22.6), "CI2": (5.1, 19.3), "CI3": (5.1, 12.9), "CI4": (5.1, 4.6), "CI5": (5.1, 0.6)}.items():
        rect(ax, (x - 0.2, y - 0.2, x + 0.2, y + 0.2), fc="white", ec=BROWN, lw=0.9); ax.text(x - 0.28, y + 0.26, k, fontsize=3.8, color=BROWN, ha="right")
    for (x, y, t) in ((6.6, 4.75, "CG1"), (6.4, 12.65, "CG2")):
        ax.add_patch(Circle((x, y), 0.18, fc="white", ec=BROWN, lw=0.9)); ax.text(x + 0.25, y + 0.2, t, fontsize=3.8, color=BROWN)
    pv = [[(4.95, 13.5), (5.7, 13.5)], [(4.95, 18.5), (5.7, 18.5)], [(4.95, 23.5), (5.7, 23.5)], [(5.7, 24.0), (5.7, 0.9), (5.7, -0.2)], [(1.8, 17.3), (5.7, 17.3)],
          [(0.6, 12.2), (0.6, 11.9), (5.7, 11.9)], [(0.5, 5.4), (0.5, 0.9), (5.7, 0.9)], [(7.5, 5.4), (7.2, 5.4), (7.2, 3.5), (5.7, 3.5)], [(6.6, 17.8), (5.7, 17.8)], [(6.6, 20.8), (5.7, 20.8)]]
    for seg in pv:
        ax.plot([p[0] for p in seg], [p[1] for p in seg], color=GREEN, lw=0.9, ls="--")
    for (x, y) in ((5.7, 13.5), (5.7, 18.5), (5.7, 23.5), (5.7, 0.9), (1.8, 17.3), (0.6, 12.2), (6.6, 17.8), (6.6, 20.8), (5.7, 3.5)):
        rect(ax, (x - 0.14, y - 0.14, x + 0.14, y + 0.14), fc="#cfeecf", ec=GREEN, lw=0.8)
    y = head(tx, "HID-01", "Projeto hidrossanitário: água, esgoto e águas pluviais (pré-dimensionamento)", "Referências: ABNT NBR 5626, NBR 8160 e NBR 10844. Traçados esquemáticos, a detalhar com isométricos no executivo.")
    y = table(tx, "ÁGUA FRIA (linhas azuis)", [
        ("Alimentação do hidrômetro ao reservatório, PVC soldável Ø25", "12 m"), ("Reservatório de polietileno 1.000 L em volume elevado sobre a lavanderia", "1 un"),
        ("Barrilete Ø32 e distribuição Ø25 pelo forro: cozinha, lavanderia, 2 banheiros, gourmet, jacuzzi, torneiras de jardim", "68 m"),
        ("Pressurizador (o reservatório fica a cerca de 2,3 m acima dos chuveiros)", "1 un"), ("Registros de gaveta, um por ambiente molhado, e de pressão nos chuveiros", "10 un"),
        ("Pontos de consumo: 2 vasos, 2 lavatórios, 2 chuveiros, pia, tanque, lavadora, pia do gourmet, jacuzzi, 3 torneiras de jardim", "14 pontos")], y, x1=0.82)
    y = table(tx, "ESGOTO SANITÁRIO (linhas marrons)", [
        ("Ramais Ø40 / Ø50 / Ø75 dentro dos banheiros, cozinha e lavanderia", "26 m"), ("Ramais Ø100 dos banheiros sob o corredor até as caixas no pátio", "8 m"),
        ("Coletor predial Ø100, i = 1 %, do pátio até a rua, passando sob a cozinha sem caixas", "24 m"), ("Caixas de inspeção 60 × 60 (CI1 a CI5)", "5 un"),
        ("Caixas de gordura: CG1 cozinha e lavanderia, CG2 pia do gourmet", "2 un"), ("Dreno da jacuzzi ligado à CI1 (confirmar com a Sanepar se é esgoto ou pluvial)", "1 un"),
        ("Caixas sifonadas e colunas de ventilação Ø50", "3 + 2 un")], y, x1=0.82)
    y = table(tx, "ÁGUAS PLUVIAIS (linhas verdes tracejadas)", [
        ("Calhas C1, C2 e C3 em chapa galvanizada", "30,40 m"), ("Condutores verticais Ø100", "7 un"),
        ("Ralos: jardim de inverno, fosso de luz, pátio (2) e deck do spa", "5 un"), ("Caixas de areia com grelha", "4 un"),
        ("Coletor pluvial Ø100 / Ø150 ao longo do pátio, sob a cozinha e a garagem, até a sarjeta", "34 m")], y, x1=0.82)
    notes(tx, y - 0.004, "NOTAS", [
        "1. Considerada rede pública de esgoto (Sanepar) na rua. Sem rede, é preciso fossa, filtro e sumidouro na garagem.",
        "2. O pátio, o jardim de inverno e o fosso são fechados: toda a água de chuva deles sai por tubo enterrado. O ralo do jardim de",
        "    inverno e o do fosso passam sob o corredor. Esses tubos são assentados ANTES dos baldrames e do contrapiso, com teste.",
        "3. Um ralo entupido no jardim de inverno alaga o quarto 02: prever ralo de 100 mm com grelha removível e extravasor.",
        "4. Esgoto e pluvial são redes separadas. Nenhuma caixa de inspeção ou de gordura dentro da casa.",
        "5. Água quente: chuveiros elétricos. Aquecimento solar ou a gás é alternativa a comparar, principalmente para a jacuzzi."])
    save(fig, "HID-01_hidrossanitario")


# ----------------------------------------------------------------------------- IMP-01
def imp01():
    fig, ax, tx = sheet(); base(ax, title="PLANTA DE IMPERMEABILIZAÇÃO")
    for w in P.WALLS:
        rect(ax, w, fc="#c0392b", ec="none", alpha=0.75)
    for r in ((1.15, 11.75, 3.4, 13.25), (0.2, 18.2, 3.4, 19.7), (5.35, 5.7, 7.8, 7.2)):
        rect(ax, r, fc="#2e86c1", ec="none", alpha=0.45)
    for r in ((1.15, 11.75, 2.05, 13.25), (0.2, 18.2, 1.2, 19.7)):
        rect(ax, r, fc="#1b4f72", ec="none", alpha=0.6)
    for r in ((0.2, 16.55, 3.4, 18.05), (0.2, 11.75, 1.0, 13.25)):
        rect(ax, r, fc="#8e44ad", ec="none", alpha=0.5)
    rect(ax, (5.5, 22.7, 7.7, 24.7), fc="#d35400", ec="none", alpha=0.55); rect(ax, (5.4, 5.75, 7.75, 7.3), fill=False, ec="#d35400", lw=1.2, hatch="xx")
    ax.plot([4.85, 4.85], [11.75, 24.8], color="#16a085", lw=2.5); ax.plot([0.2, 7.8], [5.45, 5.45], color="#16a085", lw=2.5); ax.plot([7.75, 7.75], [11.75, 24.8], color="#16a085", lw=2.5)
    for x, y_, t in ((2.4, 12.5, "B"), (1.9, 19.0, "B"), (6.6, 6.5, "B + E"), (1.6, 12.2, "C"), (0.7, 18.9, "C"), (1.8, 17.3, "D"), (0.6, 12.5, "D"), (6.6, 23.7, "E"), (5.25, 16.0, "F"), (4.0, 5.2, "F")):
        ax.text(x, y_, t, fontsize=6, fontweight="bold", ha="center", va="center", bbox=dict(fc="white", ec="none", pad=0.4, alpha=0.9))
    ax.text(1.8, 8.5, "A em todos os baldrames\n(paredes em vermelho)", fontsize=4.6, ha="center", color="#c0392b")
    y = head(tx, "IMP-01", "Projeto de impermeabilização", "Referências: ABNT NBR 9575 (projeto) e NBR 9574 (execução). As letras na planta indicam o sistema de cada área.")
    y = table(tx, "SISTEMAS POR ÁREA", [
        ("A  Baldrames, 3 faces: argamassa polimérica em 3 demãos + emulsão asfáltica; 2 primeiras fiadas com argamassa aditivada", f"{br(L_BALD * 0.75, 0)} m²"),
        ("B  Pisos de banheiros e lavanderia, com rodapé de 30 cm: argamassa polimérica com tela nos cantos e ralos", "17,4 m²"),
        ("C  Paredes dos dois boxes até 1,80 m: membrana acrílica", "12,2 m²"),
        ("D  Jardim de inverno e fosso de luz: manta asfáltica 4 mm no piso, subindo 30 cm, com proteção mecânica e dreno", "12,5 m²"),
        ("E  Laje do reservatório e radier da jacuzzi: manta asfáltica 4 mm com proteção mecânica", "11,7 m²"),
        ("F  Pé de parede externa junto ao pátio e à garagem, faixa de 60 cm: argamassa polimérica", "13,0 m²"),
        ("G  Calhas, rufos e encontros de telhado com parede alta: fita ou manta aluminizada sobre os rufos", "62,0 m"),
        ("H  Peitoris e soleiras das esquadrias de vidro: pingadeira, caimento para fora e selante de poliuretano", "38,0 m"),
        ("I  Muros de divisa e paredes na divisa, face interna em contato com o solo: emulsão asfáltica", "27,0 m²")], y, x1=0.86)
    y = table(tx, "PONTOS CRÍTICOS DESTA CASA", [
        ("Jardim de inverno e fosso", "são áreas abertas dentro da casa: piso estanque, ralo e soleira elevada nas portas"),
        ("Porta de vidro do quarto 02", "soleira 3 cm acima do piso do jardim, com trilho drenado"),
        ("Vidro do corredor (9,60 m)", "trilho inferior com dreno e caimento do piso externo para o pátio"),
        ("Faixas de vidro altas", "rufo por cima e pingadeira por baixo em todo o comprimento"),
        ("Encontro do telhado do corredor com a parede dos quartos", "rufo embutido na parede, 20 cm acima da telha"),
        ("Parede sobre a divisa esquerda", "sem acesso por fora depois que o vizinho construir: executar bem agora"),
        ("Jacuzzi", "base estanque com caimento para o ralo do deck; tubulações com acesso para manutenção")], y, x1=0.86)
    notes(tx, y - 0.004, "COMPARAÇÃO PARA OS PISOS MOLHADOS", [
        "• Argamassa polimérica (adotada): custo menor, aplicação simples, boa durabilidade em áreas internas. Exige base firme.",
        "• Manta asfáltica: custo maior e mão de obra especializada, mas é a mais segura onde há água parada ou a céu aberto. Por isso",
        "   foi adotada no jardim de inverno, no fosso, na laje do reservatório e sob a jacuzzi.",
        "• Membrana acrílica: boa para paredes de box; não serve para piso com água parada.",
        "",
        "REGRAS DE EXECUÇÃO",
        "1. Teste de estanqueidade com lâmina de água por 72 horas em todos os pisos impermeabilizados, antes do revestimento.",
        "2. Não economizar aqui: refazer impermeabilização depois do piso pronto custa várias vezes mais."])
    save(fig, "IMP-01_impermeabilizacao")


# ----------------------------------------------------------------------------- planilha
ETAPAS = [("01 Serviços preliminares, projetos e taxas", 3.0), ("02 Limpeza e preparação do terreno", 0.5), ("03 Terraplenagem", 1.0), ("04 Fundação", 6.5),
          ("05 Estrutura", 9.5), ("06 Alvenaria", 8.0), ("07 Vergas e contravergas", 0.5), ("08 Cobertura", 8.5), ("09 Impermeabilização", 2.5),
          ("10 Instalação hidráulica", 3.5), ("11 Instalação sanitária e pluvial", 4.0), ("12 Instalação elétrica", 7.0), ("13 Esquadrias de madeira e alumínio", 4.0),
          ("14 Revestimentos", 8.0), ("15 Contrapiso", 3.0), ("16 Pisos", 7.5), ("17 Forros", 3.0), ("18 Pintura", 5.5), ("19 Louças e metais", 2.5),
          ("20 Bancadas", 1.5), ("21 Vidros", 6.0), ("22 Iluminação", 1.5), ("23 Acabamentos, muros e portões", 2.5), ("24 Limpeza final", 0.5)]
# distribuição de cada etapa pelos 8 meses de obra (em % da etapa)
DIST = {1: [70, 10, 0, 0, 0, 0, 10, 10], 2: [100], 3: [100], 4: [60, 40], 5: [0, 40, 40, 20], 6: [0, 20, 50, 30], 7: [0, 0, 60, 40], 8: [0, 0, 0, 60, 40],
        9: [0, 25, 0, 25, 30, 20], 10: [10, 0, 0, 40, 30, 0, 20], 11: [40, 0, 0, 30, 30], 12: [0, 0, 10, 30, 30, 0, 20, 10], 13: [0, 0, 0, 0, 30, 40, 30],
        14: [0, 0, 0, 0, 40, 40, 20], 15: [0, 0, 0, 50, 50], 16: [0, 0, 0, 0, 0, 50, 50], 17: [0, 0, 0, 0, 0, 60, 40], 18: [0, 0, 0, 0, 0, 20, 40, 40],
        19: [0, 0, 0, 0, 0, 0, 40, 60], 20: [0, 0, 0, 0, 0, 0, 60, 40], 21: [0, 0, 0, 0, 20, 40, 40], 22: [0, 0, 0, 0, 0, 0, 40, 60], 23: [0, 10, 10, 0, 0, 0, 30, 50], 24: [0, 0, 0, 0, 0, 0, 0, 100]}


def quantitativos(tot_va):
    Q = []
    add = lambda e, d, u, q, o="": Q.append((e, d, u, round(q, 2), o))
    aco = (EST["bal"] + EST["pil"] + EST["cin"]) * 90 + EST["est"] * 40
    add("01", "Sondagem SPT (2 furos)", "furo", 2, "NBR 8036"); add("01", "Projetos legais e executivos com ART/RRT, taxas e alvará", "vb", 1)
    add("01", "Ligações provisórias, barracão e tapume na testada", "vb", 1); add("01", "Locação da obra com gabarito", "m²", A_CONST)
    add("02", "Limpeza e raspagem mecanizada do terreno", "m²", 200); add("03", "Aterro compactado para elevar o piso interno 15 cm", "m³", A_CONST * 0.15 * 1.25)
    add("03", "Escavação de valas para baldrames e redes enterradas", "m³", L_BALD * 0.25 * 0.35 + 58 * 0.4 * 0.6)
    add("04", "Estaca escavada Ø25 cm, profundidade adotada 4,0 m", "m", N_PIL * 4.0, "confirmar por sondagem"); add("04", "Concreto fck 20 MPa para estacas", "m³", EST["est"])
    add("04", "Viga baldrame 15 × 30, concreto fck 25 MPa", "m³", EST["bal"], f"{br(L_BALD, 1)} m lineares"); add("04", "Forma de madeira para baldrame", "m²", L_BALD * 0.6)
    add("04", "Radier da jacuzzi e 8 blocos dos pergolados", "m³", 0.79 + 8 * 0.064)
    add("05", "Pilares 15 × 30, concreto fck 25 MPa", "m³", EST["pil"], f"{N_PIL} pilares, 10 com 5,0 m"); add("05", "Cintas e vigas, concreto fck 25 MPa", "m³", EST["cin"] + 0.86)
    add("05", "Aço CA-50 / CA-60 cortado e dobrado", "kg", aco, "taxa adotada 90 kg/m³"); add("05", "Formas para pilares, cintas e vigas", "m²", N_PIL * 0.9 * 4.0 + (L_BALD + 27.7) * 0.5)
    add("05", "Laje pré-moldada treliçada h = 12 (reservatório)", "m²", 6.37); add("05", "Estrutura metálica da cobertura do bloco social (vão de 7,60 m)", "m²", 50.0)
    add("06", "Alvenaria do bloco social, bloco cerâmico 14 cm, h = 4,75", "m²", 103.1, "descontados vãos e faixa de vidro"); add("06", "Alvenaria de divisa e externa da ala íntima, bloco 14 cm", "m²", 65.4)
    add("06", "Alvenaria interna, bloco 11,5 cm", "m²", 98.5, "inclui paredes do jardim de inverno e do fosso"); add("06", "Muros de divisa novos h = 2,20, bloco 14 cm", "m²", L_MURO * 2.2, f"{br(L_MURO, 2)} m")
    add("06", "Muros: brocas, baldrame e pilaretes (concreto)", "m³", L_MURO * 0.15 * 0.25 + 11 * 0.05 + 11 * 0.063); add("06", "Pórtico frontal: 3 pilares 30 × 30 e viga 20 × 30", "m³", 1.6)
    add("07", "Vergas pré-moldadas sobre portas e janelas", "m", 24.0); add("07", "Contravergas sob janelas", "m", 11.0)
    add("08", "Estrutura metálica leve da cobertura da ala íntima", "m²", 57.6); add("08", "Telha termoacústica 30 mm", "m²", 113.0, "inclui 5 % de perdas")
    add("08", "Calhas em chapa galvanizada", "m", 30.4); add("08", "Rufos e contra-rufos", "m", 62.0); add("08", "Condutores verticais Ø100", "m", 26.0, "7 descidas")
    add("09", "Baldrames: argamassa polimérica + emulsão asfáltica", "m²", L_BALD * 0.75); add("09", "Pisos molhados com rodapé: argamassa polimérica", "m²", 17.4)
    add("09", "Paredes de box: membrana acrílica", "m²", 12.2); add("09", "Manta asfáltica 4 mm: jardim de inverno, fosso, laje do reservatório, radier da jacuzzi", "m²", 24.2)
    add("09", "Pé de parede externa e faces em contato com o solo", "m²", 40.0)
    add("10", "Tubo PVC soldável Ø25 / Ø32 / Ø20", "m", 96.0); add("10", "Registros de gaveta e de pressão", "un", 10); add("10", "Reservatório 1.000 L com boia", "un", 1)
    add("10", "Pressurizador", "un", 1); add("10", "Pontos de água fria", "pt", 14)
    add("11", "Tubo PVC esgoto Ø100", "m", 32.0); add("11", "Tubo PVC esgoto Ø40 / Ø50 / Ø75", "m", 26.0); add("11", "Tubo PVC pluvial enterrado Ø100 / Ø150", "m", 34.0)
    add("11", "Caixas de inspeção 60 × 60", "un", 5); add("11", "Caixas de gordura", "un", 2); add("11", "Caixas sifonadas, ralos e caixas de areia", "un", 12)
    add("12", "Padrão de entrada trifásico Copel", "un", 1); add("12", "Quadro de distribuição 28–32 módulos, disjuntores, 4 DR e 4 DPS", "cj", 1, f"potência instalada {tot_va} VA")
    add("12", "Cabo flexível 1,5 mm²", "m", 350); add("12", "Cabo flexível 2,5 mm²", "m", 950); add("12", "Cabo flexível 4,0 e 6,0 mm²", "m", 280); add("12", "Cabo 16 mm² (ramal)", "m", 40)
    add("12", "Eletroduto corrugado e caixas", "m", 460); add("12", "Tomadas, interruptores e pontos de força", "un", len(TUG) + len(TUE) + 16)
    add("12", "Aterramento e equipotencialização (inclui jacuzzi)", "cj", 1); add("12", "Infraestrutura de ar-condicionado", "pt", len(ACS))
    add("13", "Porta de entrada 0,90 × 2,10", "un", 1); add("13", "Portas internas de madeira com batente e ferragens", "un", 6); add("13", "Janelas de alumínio J1, J2, J3, J5, J6", "m²", 7.16)
    add("14", "Chapisco + reboco interno", "m²", 359.0); add("14", "Chapisco + reboco externo (fachada, pátio, jardim de inverno, fosso, platibandas)", "m²", 115.0)
    add("14", "Reboco das faces internas dos muros", "m²", L_MURO * 2.2); add("14", "Revestimento cerâmico de parede (banheiros, lavanderia, faixa da pia)", "m²", 79.0, "inclui 10 % de perdas")
    add("15", "Lastro de brita + lona + contrapiso armado 7 cm", "m²", A_UTIL + 6.0); add("16", "Porcelanato — áreas secas", "m²", (A_UTIL - 11.85) * 1.10, "inclui 10 % de perdas")
    add("16", "Porcelanato antiderrapante — áreas molhadas", "m²", 11.85 * 1.10); add("16", "Rodapés, soleiras e peitoris", "m", 118.0); add("16", "Piso drenante da garagem", "m²", 41.8)
    add("16", "Piso da área gourmet e deck do spa", "m²", 19.2); add("16", "Jardim do pátio e jardim de inverno (terra, grama, pisantes)", "m²", 24.3)
    add("17", "Forro de gesso acartonado", "m²", A_UTIL, "sala a 4,30 m exige andaime"); add("18", "Massa corrida + tinta acrílica interna", "m²", 359.0 - 72.0)
    add("18", "Tinta acrílica em forro", "m²", A_UTIL); add("18", "Textura / tinta externa e muros", "m²", 115.0 + L_MURO * 2.2)
    add("19", "Vasos sanitários com caixa acoplada", "un", 2); add("19", "Cubas com torneira", "un", 4, "2 banheiros, cozinha, gourmet"); add("19", "Chuveiros elétricos", "un", 2)
    add("19", "Tanque com torneira", "un", 1); add("20", "Bancadas de granito: cozinha, ilha, banheiros e gourmet", "m²", 9.6)
    add("21", "Vidro temperado 8 mm de correr, piso ao teto (V1, V2, V3, V4, V5)", "m²", 47.1); add("21", "Faixas de vidro altas FA e FQ, com 6 + 4 painéis que abrem", "m²", 13.3)
    add("21", "Box de vidro temperado e espelhos", "m²", 8.2); add("22", "Luminárias e arandelas", "un", len(LUZ))
    add("23", "Portão basculante 6,40 × 2,40 com motor e portão social", "cj", 1); add("23", "Pergolados de madeira vazados: gourmet 12 m² e spa 7,2 m²", "m²", 19.2)
    add("23", "Churrasqueira pré-moldada com chaminé", "un", 1); add("23", "Jacuzzi 2,00 × 1,80 com instalação", "un", 1, "equipamento a escolher")
    add("23", "Calçada / passeio público", "m²", 16.0); add("24", "Limpeza final e remoção de entulho", "m²", A_CONST)
    return Q


def planilha(tot_va):
    wb = Workbook(); bold = Font(bold=True); hf = PatternFill("solid", fgColor="1F3864"); sf = PatternFill("solid", fgColor="D9E1F2")

    def hd(ws, cols, widths, row=1):
        for i, (c, w) in enumerate(zip(cols, widths), 1):
            cell = ws.cell(row=row, column=i, value=c); cell.font = Font(bold=True, color="FFFFFF"); cell.fill = hf
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True); ws.column_dimensions[get_column_letter(i)].width = w

    # ---- estimativa
    we = wb.active; we.title = "Estimativa de custo"
    we["A1"] = "CASA PÁTIO — Estimativa paramétrica do custo da obra (planta definitiva V3)"; we["A1"].font = Font(bold=True, size=13)
    we["A2"] = ("ESTIMATIVA, NÃO É COTAÇÃO NEM ORÇAMENTO. Base: custo por m² (índice SINAPI-PR informado pelo proprietário, sem conferência do mês; "
                "CUB-PR R-1 normal de setembro/2026, fonte secundária). Itens fora dos índices são faixas de ordem de grandeza, a substituir por SINAPI item a item e cotações.")
    we["A2"].alignment = Alignment(wrap_text=True); we.merge_cells("A2:E2"); we.row_dimensions[2].height = 48
    hd(we, ["Item", "Econômico (R$)", "Provável (R$)", "Alto (R$)", "Base / observação"], [66, 18, 18, 18, 72], row=4)
    rows = [("Área construída da casa (m²)", A_CONST, A_CONST, A_CONST, "Planta V3"),
            ("Custo por m² adotado (R$/m²)", 2232.31, "=(B6+D6)/2", 3365.21, "Econômico: SINAPI-PR. Alto: CUB-PR R-1 normal. Provável: média"),
            ("A. Casa — material e mão de obra", "=B5*B6", "=C5*C6", "=D5*D6", "Área × custo por m²"),
            ("Projetos, ART/RRT, aprovação, taxas e sondagem", 12000, 17000, 22000, ""),
            ("Muros de divisa novos (60 m²) com fundação e reboco", 17000, 21000, 26000, ""),
            ("Pórtico, portão basculante motorizado, portão social e interfone", 18000, 24000, 30000, ""),
            ("Vidros piso ao teto (47 m²): acréscimo sobre esquadria comum", 26000, 35000, 45000, ""),
            ("Pé-direito alto da sala: paredes, estrutura e faixas de vidro altas (13 m²)", 18000, 26000, 35000, ""),
            ("Jacuzzi 2,00 × 1,80 instalada, radier, deck e pergolado do spa", 25000, 35000, 48000, "depende muito do equipamento"),
            ("Área gourmet: pergolado, churrasqueira, bancada e piso", 12000, 18000, 25000, "pode ficar para a segunda etapa"),
            ("Garagem drenante, jardins, jardim de inverno e calçada", 9000, 13000, 17000, ""),
            ("Ligações definitivas de água, esgoto e energia", 3000, 4500, 6000, ""),
            ("B. Itens fora dos índices", "=SUM(B8:B16)", "=SUM(C8:C16)", "=SUM(D8:D16)", ""),
            ("C. Custo direto (A + B)", "=B7+B17", "=C7+C17", "=D7+D17", ""),
            ("Administração / BDI da construtora (%)", 0.08, 0.15, 0.22, "Econômico: obra por administração. Demais: construtora"),
            ("Reserva para imprevistos (%)", 0.05, 0.07, 0.10, "A fundação depende da sondagem"),
            ("D. Administração / BDI (R$)", "=B18*B19", "=C18*C19", "=D18*D19", ""), ("E. Reserva (R$)", "=B18*B20", "=C18*C20", "=D18*D20", ""),
            ("TOTAL ESTIMADO DA OBRA (C + D + E)", "=B18+B21+B22", "=C18+C21+C22", "=D18+D21+D22", "Sem terreno, móveis, eletrodomésticos e ar-condicionado"),
            ("Total por m² construído (R$/m²)", "=B23/B5", "=C23/C5", "=D23/D5", "")]
    for i, row in enumerate(rows, 5):
        for c, v in enumerate(row, 1):
            cell = we.cell(row=i, column=c, value=v)
            if c in (2, 3, 4):
                cell.number_format = "0.0%" if i in (19, 20) else ("#,##0.00" if i in (5, 6) else "#,##0")
        if row[0][:2] in ("A.", "B.", "C.", "TO"):
            for c in range(1, 6):
                we.cell(row=i, column=c).font = bold; we.cell(row=i, column=c).fill = sf

    # ---- resumo por etapa e cronograma físico-financeiro
    wr = wb.create_sheet("Resumo e cronograma")
    wr["A1"] = "CASA PÁTIO — Orçamento resumido por etapa e cronograma físico-financeiro (cenário provável)"; wr["A1"].font = Font(bold=True, size=13)
    wr["A2"] = ("Base: custo direto provável da aba 'Estimativa de custo'. Pesos por etapa e distribuição mensal são referências típicas para casa térrea, "
                "ajustadas a esta planta. Servem para preencher o modelo do banco e planejar desembolso; o engenheiro responsável deve conferir e assinar.")
    wr["A2"].alignment = Alignment(wrap_text=True); wr.merge_cells("A2:L2"); wr.row_dimensions[2].height = 34
    hd(wr, ["Etapa", "Peso (%)", "Valor (R$)"] + [f"Mês {m}" for m in range(1, 9)] + ["Confere"], [46, 10, 15] + [12] * 8 + [10], row=4)
    r0 = 5
    for i, (n, pz) in enumerate(ETAPAS):
        r = r0 + i; wr.cell(row=r, column=1, value=n); wr.cell(row=r, column=2, value=pz / 100).number_format = "0.0%"
        wr.cell(row=r, column=3, value=f"='Estimativa de custo'!$C$18*B{r}").number_format = "#,##0"
        d = DIST[i + 1] + [0] * (8 - len(DIST[i + 1])); assert sum(d) == 100, n
        for m in range(8):
            if d[m]:
                wr.cell(row=r, column=4 + m, value=f"=$C{r}*{d[m] / 100}").number_format = "#,##0"
        wr.cell(row=r, column=12, value=f"=SUM(D{r}:K{r})-C{r}").number_format = "#,##0"
    assert abs(sum(p for _, p in ETAPAS) - 100) < 1e-9
    r = r0 + len(ETAPAS)
    for lab, fml in (("TOTAL DO MÊS (custo direto)", "=SUM({c}%d:{c}%d)" % (r0, r - 1)), ("% do mês", None), ("% acumulado", None)):
        wr.cell(row=r, column=1, value=lab).font = bold
        if fml:
            wr.cell(row=r, column=2, value=f"=SUM(B{r0}:B{r - 1})").number_format = "0.0%"
            for c in range(3, 12):
                L = get_column_letter(c); wr.cell(row=r, column=c, value=fml.format(c=L)).number_format = "#,##0"; wr.cell(row=r, column=c).font = bold
        elif lab == "% do mês":
            for c in range(4, 12):
                L = get_column_letter(c); wr.cell(row=r, column=c, value=f"={L}{r - 1}/$C${r - 1}").number_format = "0.0%"
        else:
            for c in range(4, 12):
                L = get_column_letter(c); wr.cell(row=r, column=c, value=f"=SUM($D{r - 1}:{L}{r - 1})").number_format = "0.0%"
        r += 1
    wr.cell(row=r + 1, column=1, value="Administração / BDI e reserva (aba Estimativa) entram sobre cada medição, na mesma proporção.")
    wr.cell(row=r + 2, column=1, value="Marcos de medição sugeridos: fundação concluída; alvenaria e estrutura; cobertura; instalações e reboco; revestimentos e vidros; entrega.")
    wr.freeze_panes = "D5"

    # ---- quantitativos
    wq = wb.create_sheet("Quantitativos e orçamento")
    wq["A1"] = "CASA PÁTIO — Quantitativos e orçamento detalhado (preencher preços com SINAPI-PR do mês ou cotação local)"; wq["A1"].font = Font(bold=True, size=13)
    hd(wq, ["Item", "Descrição", "Un.", "Quantidade", "Código SINAPI", "Material (R$/un)", "Mão de obra (R$/un)", "Equip./terceiros (R$/un)", "Total (R$)", "Fonte do preço (mês/ano)", "Observações"],
       [8, 78, 7, 12, 14, 14, 14, 14, 16, 22, 40], row=3)
    names = {e[:2]: e[3:] for e, _ in ETAPAS}; r = 4; cur = None; secs = []
    for e, d, u, q, o in quantitativos(tot_va):
        if e != cur:
            if cur:
                secs.append((sr, first, r - 1))
            cur = e; sr = r
            for c in range(1, 12):
                wq.cell(row=r, column=c).fill = sf
            wq.cell(row=r, column=1, value=e).font = bold; wq.cell(row=r, column=2, value=names[e].upper()).font = bold; r += 1; first = r; k = 0
        k += 1; wq.cell(row=r, column=1, value=f"{e}.{k:02d}"); wq.cell(row=r, column=2, value=d); wq.cell(row=r, column=3, value=u)
        wq.cell(row=r, column=4, value=q).number_format = "#,##0.00"; wq.cell(row=r, column=9, value=f"=D{r}*(F{r}+G{r}+H{r})").number_format = "#,##0.00"
        wq.cell(row=r, column=11, value=o); r += 1
    secs.append((sr, first, r - 1))
    for sr, a, b in secs:
        wq.cell(row=sr, column=9, value=f"=SUM(I{a}:I{b})").number_format = "#,##0.00"; wq.cell(row=sr, column=9).font = bold
    wq.cell(row=r + 1, column=2, value="CUSTO DIRETO").font = bold
    wq.cell(row=r + 1, column=9, value="=" + "+".join(f"I{sr}" for sr, _, _ in secs)).number_format = "#,##0.00"
    wq.cell(row=r + 3, column=2, value="Quantidades de anteprojeto, com precisão estimada de ±10 a 15 %. A fundação depende da sondagem.")
    wq.freeze_panes = "C4"

    # ---- áreas e cargas
    wa = wb.create_sheet("Áreas"); hd(wa, ["Ambiente / grandeza", "Medidas", "Área (m²)", "Pé-direito"], [44, 18, 12, 12])
    pd = {"ESTAR": 4.30, "SUÍTE": 2.80, "LAVAN": 2.80}
    r = 2
    for _, _, n, w, d, a in P.ROOMS:
        for c, v in enumerate([n.title(), f"{br(w)} × {br(d)}", round(a, 2), pd.get(n[:5], 3.45)], 1):
            wa.cell(row=r, column=c, value=v)
        r += 1
    for c, v in enumerate(["Corredor Interno", "1,10 × 9,60", round(P.A_CORR, 2), 2.80], 1):
        wa.cell(row=r, column=c, value=v)
    r += 1; wa.cell(row=r, column=1, value="TOTAL ÁREA ÚTIL").font = bold; wa.cell(row=r, column=3, value=f"=SUM(C2:C{r - 1})"); r += 2
    for n, m, a in [("Terreno", "8,00 × 25,00", 200.0), ("Área construída / projeção", "", round(A_CONST, 2)), ("Taxa de ocupação (%)", "limite 60", round(A_CONST / 2, 1)),
                    ("Garagem descoberta", "7,60 × 5,50", 41.8), ("Pátio (gourmet + jardim)", "3,00 × 10,50", 31.5), ("Deck do spa", "3,00 × 2,40", 7.2),
                    ("Jardim de inverno", "3,20 × 1,50", 4.8), ("Fosso de luz", "0,80 × 1,50", 1.2)]:
        for c, v in enumerate([n, m, a], 1):
            wa.cell(row=r, column=c, value=v)
        r += 1
    wc = wb.create_sheet("Quadro de cargas")
    hd(wc, ["Nº", "Circuito", "Tensão (V)", "Potência (VA)", "Corrente (A)", "Cabo (mm²)", "Disjuntor (A)", "DR 30 mA"], [6, 56, 11, 13, 12, 11, 13, 10])
    for i, (n, d, v, p, cab, dj, dr) in enumerate(CIRC, 2):
        for c, val in enumerate([n, d, v, p, f"=D{i}/C{i}", cab, dj, dr], 1):
            wc.cell(row=i, column=c, value=val)
        wc.cell(row=i, column=5).number_format = "0.0"
    i = len(CIRC) + 2; wc.cell(row=i, column=2, value="POTÊNCIA INSTALADA TOTAL").font = bold; wc.cell(row=i, column=4, value=f"=SUM(D2:D{i - 1})").font = bold
    wb.save(os.path.join(OUT, f"CP-PLANILHA_custos-cronograma-quantitativos_{REV}.xlsx"))


def main():
    os.makedirs(OUT, exist_ok=True)
    arq01(); arq02(); leg01(); est01(); tot = ele01(); hid01(); imp01(); planilha(tot)
    A = A_CONST
    for n, m2, ex, b, r in (("eco", 2232.31, 140000, .08, .05), ("prov", (2232.31 + 3365.21) / 2, 193500, .15, .07), ("alto", 3365.21, 254000, .22, .10)):
        c = A * m2 + ex; print(n, round(A * m2), ex, round(c), round(c * (1 + b + r)), round(c * (1 + b + r) / A))
    print("pilares", N_PIL, "baldrame", round(L_BALD, 1), {k: round(v, 1) for k, v in EST.items()}, "VA", tot)


if __name__ == "__main__":
    main()
