"""Casa Pátio — gera o pacote de anteprojeto (pranchas PDF/SVG/PNG e planilha de quantitativos).

Uso: python3 gerar_projeto.py
Reaproveita a geometria aprovada (planta R03) de planta_fase2.py.
Coordenadas em metros: x = largura (0 a 8), y = profundidade (0 = rua, 25 = fundos).
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, Polygon
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

import planta_fase2 as base
from planta_fase2 import br, rect, dim_chain, WALLS, MUROS, OPEN, ROOMS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "plantas")
DOCS = os.path.join(HERE, "..", "planilhas")
REV = "R01"
DATA = "15/11/2026"
W, H = 42.0, 29.7  # A3 paisagem, cm

PD = 2.80          # pé-direito
H_INT = 3.00       # altura de alvenaria interna (piso ao respaldo)
H_EXT = 3.60       # altura de alvenaria externa/divisa (inclui platibanda)
H_MURO = 2.20
RED = "#b00000"
BLUE = "#1f6fb5"
BROWN = "#8a4b12"
GREEN = "#2a8a3a"


# ----------------------------------------------------------------------------- utilidades de prancha
def new_sheet():
    return plt.figure(figsize=(W / 2.54, H / 2.54))


def plan_axes(fig, left_cm=1.0):
    ax = fig.add_axes([left_cm / W, 0.3 / H, 11.2 / W, 28.0 / H])
    return ax


def side_axes(fig, left_cm=13.0, width_cm=28.2):
    tx = fig.add_axes([left_cm / W, 0.5 / H, width_cm / W, 28.6 / H])
    tx.axis("off")
    tx.set_xlim(0, 1)
    tx.set_ylim(0, 1)
    return tx


def header(tx, title, sub):
    tx.text(0, 0.985, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    tx.text(0, 0.95, title, fontsize=10, fontweight="bold", va="top")
    tx.text(0, 0.925, sub, fontsize=7, va="top")
    return 0.89


def footer(tx, code, extra="Escala 1:100 (folha A3)"):
    tx.text(0, 0.0, f"Doc. {code}   |   Revisão {REV} — {DATA}   |   {extra}   |   Unidade: metro   |   "
            "Anteprojeto — exige conferência e ART/RRT de profissional habilitado",
            fontsize=5.8, va="bottom", fontweight="bold")


def table(tx, title, rows, y, x0=0.0, x1=1.0, fs=6.3):
    tx.text(x0, y, title, fontsize=8, fontweight="bold", va="top")
    y -= 0.021
    for row in rows:
        a, b = row[0], row[1]
        fw = "bold" if len(row) > 2 and row[2] else "normal"
        tx.text(x0 + 0.005, y, a, fontsize=fs, va="top", fontweight=fw)
        tx.text(x1 - 0.005, y, b, fontsize=fs, va="top", ha="right", fontweight=fw)
        tx.plot([x0, x1], [y - 0.0142, y - 0.0142], color="#bbbbbb", lw=0.3)
        y -= 0.0170
    return y - 0.009


def notes(tx, y, lines, x0=0.0, fs=5.6):
    tx.text(x0, y, "NOTAS\n" + "\n".join(lines), fontsize=fs, va="top", linespacing=1.3)


def save(fig, name):
    for ext in ("pdf", "svg"):
        fig.savefig(os.path.join(OUT, f"{name}_{REV}.{ext}"))
    fig.savefig(os.path.join(OUT, f"{name}_{REV}.png"), dpi=170)
    plt.close(fig)


def light_plan(ax, etapa=1, labels=True):
    """Planta de fundo (paredes em cinza claro) para pranchas complementares."""
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.5, ls=(0, (6, 3)))
    rect(ax, (5.00, 10.35, 7.80, 22.25), fc="#eef5ea", ec="none")
    for w in MUROS:
        rect(ax, w, fc="#cfcfcf", ec="none")
    for w in WALLS:
        rect(ax, w, fc="#9a9a9a", ec="none")
    for x0, y0, x1, y1, kind, tag in OPEN:
        rect(ax, (x0, y0, x1, y1), fc="white", ec="none")
    if labels:
        for cx, cy, name, w, d in ROOMS:
            ax.text(cx, cy + d / 2 - 0.22, name.replace("\n", " "), fontsize=3.6, ha="center", va="top",
                    color="#666666")
    ax.set_xlim(-1.9, 9.3)
    ax.set_ylim(-2.0, 26.0)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.text(4.0, -1.75, "RUA", fontsize=5.5, ha="center", va="center")


# ----------------------------------------------------------------------------- ARQ-01 / ARQ-02
AREAS_UTEIS = [
    ("Estar / jantar integrados — 5,00 × 4,50", 22.50),
    ("Cozinha — 2,60 × 2,85", 7.41),
    ("Lavanderia — 2,45 × 1,50", 3.6751),
    ("Suíte master — 4,65 × 2,85", 13.2525),
    ("Closet — 3,40 × 1,50", 5.10),
    ("Banho suíte — 3,40 × 1,50", 5.10),
    ("Demi-suíte 01 — 3,40 × 2,50", 8.50),
    ("Demi-suíte 02 — 3,40 × 2,50", 8.50),
    ("Banho compartilhado — 3,40 × 1,50", 5.10),
    ("Lavabo — 3,40 × 1,20", 4.08),
    ("Corredor envidraçado — 1,10 × 11,45", 12.595),
]
A_UTIL = sum(a for _, a in AREAS_UTEIS)
A_CONST = 8.00 * 4.85 + 5.00 * 14.65          # 112,05
ESQ = [
    ("P1  Porta de entrada / porta da suíte (2 un)", "0,90 × 2,10"),
    ("P2  Porta de quarto / lavanderia (3 un)", "0,80 × 2,10"),
    ("P3  Porta de banheiro, lavabo e closet (5 un)", "0,70 × 2,10"),
    ("J1  Janela do estar, frente (1 un)", "1,80 × 1,20"),
    ("J2  Janela da lavanderia, frente (1 un)", "1,40 × 1,00"),
    ("J3  Janela de quarto para o corredor (2 un)", "1,20 × 1,20"),
    ("V1  Vidro de correr social / pátio, piso ao teto", "2,80 × 2,60"),
    ("V2  Vidro de correr corredor / pátio, piso ao teto", "11,45 × 2,60"),
    ("V3  Porta de vidro suíte / spa", "1,80 × 2,10"),
]


def arq(etapa):
    fig = new_sheet()
    ax = plan_axes(fig)
    base.draw_plan(ax, etapa)
    if etapa == 2:
        # com TO de 60 % a cobertura da garagem não cabe: remove a indicação herdada
        rect(ax, (0.20, 0, 7.80, 5.50), fc="#eeeeee", ec="none", zorder=3)
        for x0 in (1.00, 5.50):
            rect(ax, (x0, 0.25, x0 + 1.90, 5.25), fill=False, ec="#777777", lw=0.5, ls="--", zorder=4)
        ax.text(4.0, 1.0, "GARAGEM DESCOBERTA\n(cobertura não cabe na taxa de ocupação de 60 %)", fontsize=4.6,
                ha="center", va="center", zorder=5)
    ax.text(3.7, 25.75, f"PLANTA BAIXA — ETAPA {etapa}", fontsize=8, fontweight="bold", ha="center", va="bottom")
    tx = side_axes(fig)
    if etapa == 1:
        y = header(tx, "ARQ-01 — Planta baixa da Etapa 1 (construção inicial)",
                   "Terreno 8,00 × 25,00 m = 200,00 m²   |   Planta aprovada pelo proprietário (R03 do estudo)")
        y = table(tx, "ÁREAS ÚTEIS (internas, sem paredes)",
                  [(n, br(a) + " m²") for n, a in AREAS_UTEIS] + [("TOTAL ÁREA ÚTIL", br(A_UTIL) + " m²", True)],
                  y, x1=0.48)
        y2 = table(tx, "QUADRO DE ÁREAS — ETAPA 1", [
            ("Área do terreno", "200,00 m²"),
            ("ÁREA CONSTRUÍDA = PROJEÇÃO COBERTA", br(A_CONST) + " m²", True),
            ("Taxa de ocupação (limite informado: 60 %)", "56,0 %", True),
            ("Saldo de projeção até 60 % (120,00 m²)", "7,95 m²"),
            ("Garagem descoberta, piso drenante — 8,00 × 5,50", "44,00 m²"),
            ("Pátio central descoberto (jardim)", "33,32 m²"),
            ("Pátio do spa descoberto (só infraestrutura)", "6,72 m²"),
            ("Muros e divisória do pátio", "3,91 m²"),
            ("Área permeável: jardim do pátio", "33,32 m²  (16,7 %)"),
            ("Área permeável com garagem drenante (se aceita)", "77,32 m²  (38,7 %)"),
        ], 0.89, x0=0.52)
        table(tx, "ESQUADRIAS", ESQ, y2, x0=0.52)
        notes(tx, y - 0.01, [
            "1. Cotas em metros. Paredes externas e de divisa 0,20 m; internas 0,15 m (acabadas).",
            "2. Pé-direito 2,80 m. Piso interno 0,15 m acima do piso da garagem.",
            "3. Nenhuma abertura nas paredes de divisa. Banheiros, lavabo e closet: exaustão mecânica",
            "    com duto até a cobertura.",
            "4. Banho compartilhado com uma porta para cada demi-suíte (tranca dos dois lados).",
            "5. Spa: executar só base estrutural, ponto de água, dreno e eletroduto (sem equipamento).",
            "6. Pontos vermelhos: esperas de água fria, esgoto e elétrica para a área gourmet (Etapa 2).",
            "7. Taxa de ocupação de 60 % informada pelo proprietário; confirmar na Consulta Prévia,",
            "    junto com recuo frontal e permeabilidade mínima.",
            "8. Ventilação dos quartos através do corredor envidraçado: confirmar aceitação no",
            "    Código de Obras antes do projeto legal.",
        ], x0=0.0)
        footer(tx, "CP-ARQ-01")
        save(fig, "CP-ARQ-01_planta-etapa1")
    else:
        y = header(tx, "ARQ-02 — Planta baixa da Etapa 2 (ampliação futura)",
                   "Acrescenta a área gourmet no meio do pátio central. A casa da Etapa 1 não é alterada.")
        y = table(tx, "QUADRO DE ÁREAS — ETAPA 2", [
            ("Área construída da Etapa 1", br(A_CONST) + " m²"),
            ("Área gourmet — 2,80 × 5,00", "14,00 m²"),
            ("Limite de projeção com taxa de ocupação de 60 %", "120,00 m²", True),
            ("Opção A — pergolado vazado (não conta como projeção)", "112,05 m²  (56,0 %)", True),
            ("Opção B — cobertura fechada de até 7,95 m² + restante vazado", "120,00 m²  (60,0 %)", True),
            ("Opção C — gourmet 14 m² todo coberto (NÃO ATENDE)", "126,05 m²  (63,0 %)"),
            ("Cobertura da garagem, 44 m² (NÃO ATENDE)", "156,05 m²  (78,0 %)"),
            ("Jardim remanescente no pátio", "19,32 m²  (9,7 %)"),
            ("Área permeável com garagem drenante (se aceita)", "63,32 m²  (31,7 %)"),
        ], y, x1=0.62)
        y = table(tx, "ITENS DA ETAPA 2", [
            ("Pergolado em madeira tratada, 2,80 × 5,00, pilares 15 × 15", "14,00 m²"),
            ("Churrasqueira pré-moldada com coifa e chaminé acima da platibanda", "1 un"),
            ("Bancada em granito com cuba, 2,50 × 0,60", "1 un"),
            ("Piso antiderrapante sobre contrapiso (base já prevista)", "14,00 m²"),
            ("Iluminação e tomadas (circuito reservado no quadro)", "1 cj"),
        ], y, x1=0.62)
        notes(tx, y - 0.01, [
            "1. Com taxa de ocupação de 60 %, a casa da Etapa 1 já usa 56 %. Sobram 7,95 m² de projeção.",
            "2. A área gourmet como desenhada só atende ao limite se o pergolado for vazado (ripado sem",
            "    telha ou vidro) ou se a parte coberta ficar em até 7,95 m² (por exemplo 2,80 × 2,80 sobre",
            "    churrasqueira e bancada). Confirmar com a Prefeitura como o pergolado é computado.",
            "3. A cobertura da garagem não cabe na taxa de ocupação de 60 % e ficaria no recuo frontal.",
            "    Alternativa a consultar: pergolado vazado ou toldo retrátil.",
            "4. Deixados prontos na Etapa 1: 4 blocos de fundação com arranque para os pilares do",
            "    pergolado, ponto de água fria, ponto de esgoto com caixa de gordura, 2 eletrodutos secos",
            "    e disjuntor reservado no quadro.",
            "5. Chaminé da churrasqueira deve subir acima da platibanda e ficar afastada das janelas.",
        ])
        footer(tx, "CP-ARQ-02")
        save(fig, "CP-ARQ-02_planta-etapa2")


# ----------------------------------------------------------------------------- ARQ-03 cobertura, cortes, fachada
def arq03():
    fig = new_sheet()
    ax = plan_axes(fig)
    light_plan(ax, labels=False)
    # águas
    rect(ax, (0.20, 5.50, 7.80, 10.35), fc="#d9d9d9", ec="k", lw=0.5, hatch="||||", alpha=0.6)
    rect(ax, (0.20, 10.35, 5.00, 24.80), fc="#d9d9d9", ec="k", lw=0.5, hatch="----", alpha=0.6)
    ax.annotate("", xy=(4.0, 6.0), xytext=(4.0, 9.8), arrowprops=dict(arrowstyle="->", lw=1))
    ax.text(4.25, 8.0, "i = 10 %", fontsize=5.5, rotation=90, va="center")
    for yy in (13.0, 18.0, 23.0):
        ax.annotate("", xy=(4.6, yy), xytext=(0.6, yy), arrowprops=dict(arrowstyle="->", lw=1))
    ax.text(2.5, 18.25, "i = 10 %", fontsize=5.5, ha="center")
    ax.text(4.0, 9.3, "ÁGUA 1 — 8,00 × 4,85", fontsize=5, ha="center", bbox=dict(fc="white", ec="none", pad=0.4))
    ax.text(2.5, 20.6, "ÁGUA 2 — 5,00 × 14,65", fontsize=5, ha="center", bbox=dict(fc="white", ec="none", pad=0.4))
    # calhas e condutores
    ax.plot([0.20, 7.80], [5.62, 5.62], color=BLUE, lw=2.2)
    ax.plot([4.92, 4.92], [10.35, 24.80], color=BLUE, lw=2.2)
    ax.text(4.0, 5.2, "calha C1 (7,60 m)", fontsize=4.6, ha="center", color=BLUE)
    ax.text(5.15, 17.0, "calha C2 (14,45 m)", fontsize=4.6, rotation=90, va="center", color=BLUE)
    for (px, py) in ((0.5, 5.62), (7.5, 5.62), (4.92, 11.0), (4.92, 16.5), (4.92, 21.5), (4.92, 24.5)):
        ax.add_patch(Circle((px, py), 0.13, fc="white", ec=BLUE, lw=1))
    ax.text(6.4, 14.0, "pátio\n(descoberto)", fontsize=5, ha="center", color="#555555")
    ax.text(6.4, 23.6, "spa\n(descoberto)", fontsize=5, ha="center", color="#555555")
    ax.text(4.0, 2.7, "garagem (descoberta)", fontsize=5, ha="center", color="#555555")
    rect(ax, (0.3, 14.5, 3.5, 15.7), fill=False, ec=RED, lw=0.8)
    ax.text(1.9, 15.1, "volume elevado: laje +\nreservatório 1.000 L", fontsize=4.4, ha="center", va="center", color=RED)
    for a, b, t in ((2.0, -0.6, "A"), (2.0, 25.6, "A")):
        ax.text(a, b, t, fontsize=8, fontweight="bold", ha="center", va="center", color=RED)
    ax.plot([2.0, 2.0], [-0.3, 25.3], color=RED, lw=0.5, ls="-.")
    ax.plot([-0.5, 8.5], [17.25, 17.25], color=RED, lw=0.5, ls="-.")
    for a in (-0.8, 8.8):
        ax.text(a, 17.25, "B", fontsize=8, fontweight="bold", ha="center", va="center", color=RED)
    ax.text(3.7, 25.95, "PLANTA DE COBERTURA", fontsize=8, fontweight="bold", ha="center", va="bottom")

    # ---- cortes e fachada (escala 1:100): eixo com 27 m × 16 m
    cx = fig.add_axes([13.2 / W, 12.2 / H, 27.6 / W, 13.0 / H])
    cx.set_xlim(-1.3, 26.3)
    cx.set_ylim(-1.5, 11.5)
    cx.set_aspect("equal")
    cx.axis("off")

    def corte_long(y0):
        cx.plot([-1, 26], [y0, y0], color="k", lw=0.8)                                  # terreno
        rect(cx, (5.50, y0, 25.0, y0 + 0.15), fc="#bbbbbb", ec="none")                  # piso elevado
        ys = [5.50, 10.20, 11.55, 14.20, 15.85, 18.50, 20.15, 21.80, 24.80]
        ws = [0.20, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.20]
        for yy, w in zip(ys, ws):
            rect(cx, (yy, y0 + 0.15, yy + w, y0 + 0.15 + H_INT), fc="#3a3a3a", ec="none")
        # forro
        cx.plot([5.70, 24.80], [y0 + 0.15 + PD] * 2, color="#777777", lw=0.6, ls="--")
        # cobertura água 1 (cai para a frente) e água 2 (vista em corte, plana na direção do corte)
        cx.plot([5.50, 10.35], [y0 + 3.25, y0 + 3.75], color="k", lw=1.4)
        cx.plot([10.35, 25.0], [y0 + 3.50, y0 + 3.50], color="k", lw=1.4)
        # platibanda/oitão na divisa (ao fundo)
        rect(cx, (5.50, y0 + 3.15, 25.0, y0 + 3.90), fill=False, ec="#999999", lw=0.5, ls=":")
        rect(cx, (14.20, y0 + 3.55, 16.00, y0 + 3.67), fc="#777777", ec="none")          # laje elevada
        rect(cx, (14.6, y0 + 3.70, 15.6, y0 + 4.50), fill=False, ec=RED, lw=0.7)         # reservatório
        rect(cx, (14.20, y0 + 3.67, 16.00, y0 + 4.70), fill=False, ec="k", lw=0.6)        # volume em alvenaria
        cx.text(16.1, y0 + 4.45, "volume do reservatório, topo +4,70", fontsize=4.2, va="center")
        names = ["estar/jantar", "lavabo", "demi 02", "banho", "demi 01", "b. suíte", "closet", "suíte"]
        mids = [7.95, 10.95, 12.95, 15.10, 17.25, 19.40, 21.05, 23.38]
        for n, m in zip(names, mids):
            cx.text(m, y0 + 1.4, n, fontsize=4.4, ha="center", rotation=90 if n in ("lavabo", "banho", "b. suíte", "closet") else 0)
        cx.text(2.75, y0 + 0.6, "garagem descoberta", fontsize=4.6, ha="center")
        for lvl, t in ((-0.12, "0,00 garagem"), (0.2, "+0,15 piso"), (0.15 + PD, "+2,95 forro"), (3.90, "+3,90 platibanda")):
            cx.plot([25.1, 25.5], [y0 + lvl] * 2, color="k", lw=0.4)
            cx.text(25.55, y0 + lvl, t, fontsize=4.2, va="center")
        dim_chain(cx, [0, 5.50, 10.35, 25.0], y0 - 0.45, False, fs=4.6)
        cx.text(12.5, y0 + 5.05, "CORTE LONGITUDINAL A-A (pela ala dos quartos)", fontsize=7, fontweight="bold",
                ha="center")

    corte_long(5.8)

    def corte_trans(x0, y0):
        cx.plot([x0 - 0.6, x0 + 8.6], [y0, y0], color="k", lw=0.8)
        rect(cx, (x0, y0, x0 + 5.0, y0 + 0.15), fc="#bbbbbb", ec="none")
        rect(cx, (x0, y0 + 0.15, x0 + 0.20, y0 + 3.90), fc="#3a3a3a", ec="none")          # divisa esq
        rect(cx, (x0 + 3.60, y0 + 0.15, x0 + 3.75, y0 + 3.15), fc="#3a3a3a", ec="none")   # parede corredor
        cx.plot([x0 + 4.92, x0 + 4.92], [y0 + 0.15, y0 + 2.75], color=BLUE, lw=1.6)        # vidro
        rect(cx, (x0 + 4.85, y0 + 2.75, x0 + 5.0, y0 + 3.05), fc="#3a3a3a", ec="none")     # viga sobre vidro
        rect(cx, (x0 + 7.80, y0, x0 + 8.0, y0 + H_MURO), fc="#8a8a8a", ec="none")          # muro
        cx.plot([x0 + 0.20, x0 + 5.05], [y0 + 3.60, y0 + 3.12], color="k", lw=1.4)         # telha
        cx.plot([x0 + 0.20, x0 + 4.85], [y0 + 0.15 + PD] * 2, color="#777777", lw=0.6, ls="--")
        cx.add_patch(Rectangle((x0 + 4.95, y0 + 2.95), 0.22, 0.16, fc="white", ec=BLUE, lw=1))  # calha
        cx.text(x0 + 1.9, y0 + 1.4, "demi-suíte 01", fontsize=4.4, ha="center")
        cx.text(x0 + 4.3, y0 + 1.4, "corredor", fontsize=4.4, ha="center", rotation=90)
        cx.text(x0 + 6.4, y0 + 1.0, "pátio", fontsize=4.4, ha="center")
        dim_chain(cx, [x0, x0 + 0.20, x0 + 3.60, x0 + 3.75, x0 + 4.85, x0 + 5.0, x0 + 7.8, x0 + 8.0], y0 - 0.45, False,
                  fs=4.2)
        cx.text(x0 + 4, y0 + 4.3, "CORTE TRANSVERSAL B-B", fontsize=7, fontweight="bold", ha="center")

    corte_trans(0.5, -0.4)

    def fachada(x0, y0):
        cx.plot([x0 - 0.6, x0 + 8.6], [y0, y0], color="k", lw=0.8)
        rect(cx, (x0, y0, x0 + 8.0, y0 + 3.90), fc="#f2f2f2", ec="k", lw=0.8)
        rect(cx, (x0, y0 + 3.40, x0 + 8.0, y0 + 3.90), fc="#dddddd", ec="k", lw=0.5)       # platibanda
        rect(cx, (x0 + 4.15, y0 + 0.15, x0 + 5.05, y0 + 2.25), fc="#b9895a", ec="k", lw=0.6)  # porta
        rect(cx, (x0 + 1.60, y0 + 1.05, x0 + 3.40, y0 + 2.25), fc="#cfe6f7", ec="k", lw=0.6)  # J1
        rect(cx, (x0 + 5.90, y0 + 1.25, x0 + 7.30, y0 + 2.25), fc="#cfe6f7", ec="k", lw=0.6)  # J2
        rect(cx, (x0, y0, x0 + 0.20, y0 + H_MURO), fc="#8a8a8a", ec="none")
        rect(cx, (x0 + 7.80, y0, x0 + 8.0, y0 + H_MURO), fc="#8a8a8a", ec="none")
        cx.text(x0 + 4, y0 + 4.3, "FACHADA FRONTAL — ETAPA 1 (vista da garagem)", fontsize=7, fontweight="bold",
                ha="center")
        cx.text(x0 + 4.6, y0 + 2.5, "P1", fontsize=4.2, ha="center")
        cx.text(x0 + 2.5, y0 + 2.5, "J1", fontsize=4.2, ha="center")
        cx.text(x0 + 6.6, y0 + 2.5, "J2", fontsize=4.2, ha="center")
        dim_chain(cx, [x0, x0 + 8.0], y0 - 0.45, False, fs=4.6)

    fachada(13.5, -0.4)

    tx = side_axes(fig, left_cm=13.2, width_cm=27.8)
    tx.text(0, 0.985, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    tx.text(0, 0.95, "ARQ-03 — Cobertura, cortes e fachada (Etapa 1)", fontsize=10, fontweight="bold", va="top")
    y = table(tx, "COBERTURA", [
        ("Telha termoacústica (sanduíche) trapezoidal, i = 10 %, sobre estrutura metálica leve", ""),
        ("Água 1 — bloco social, cai para a garagem", "38,80 m² em planta"),
        ("Água 2 — ala íntima e corredor, cai para o pátio", "73,25 m² em planta"),
        ("Área de telha (com inclinação e perdas de 5 %)", "118,2 m²"),
        ("Calhas em chapa galvanizada, C1 + C2", "22,05 m"),
        ("Condutores verticais Ø100 (6 un × 3,2 m)", "19,2 m"),
        ("Rufos e contra-rufos nas divisas e platibandas", "49,0 m"),
        ("Laje pré-moldada elevada (+3,55) para reservatório, em volume de alvenaria sobre o banho compartilhado", "5,10 m²"),
    ], 0.385, x1=0.62)
    notes(tx, y - 0.005, [
        "1. Nenhuma água de chuva pode cair no terreno vizinho: paredes de divisa sobem como platibanda",
        "    0,50 m acima da telha, com rufo e pingadeira.",
        "2. Platibanda só na fachada frontal e nas divisas; lado do pátio com beiral curto e calha aparente.",
        "3. Forro de gesso acartonado em toda a casa; manta de subcobertura dispensada pela telha sanduíche.",
        "4. Níveis referidos ao piso da garagem (0,00), que fica no nível da rua. Piso interno +0,15.",
        "5. Fachada da Etapa 1 sem cobertura de garagem. Portão e muro frontal a definir com o proprietário.",
        "6. Reservatório com fundo a +3,70: pressão baixa nos chuveiros (cerca de 1,4 m de coluna). Avaliar pressurizador",
        "    ou elevar o volume no projeto executivo.",
    ], fs=5.6)
    footer(tx, "CP-ARQ-03")
    save(fig, "CP-ARQ-03_cobertura-cortes-fachada")



# ----------------------------------------------------------------------------- ARQ-04 fachada com portão basculante
def arq04():
    fig = new_sheet()
    ax = fig.add_axes([1.0 / W, 1.0 / H, 40.0 / W, 27.0 / H])   # 1:50 -> 20 m x 13,5 m
    ax.set_xlim(-1.0, 19.0)
    ax.set_ylim(-8.2, 5.3)
    ax.set_aspect("equal")
    ax.axis("off")
    # ---- elevação
    ax.plot([-0.6, 8.6], [0, 0], color="k", lw=1.0)
    rect(ax, (0.2, 3.90, 3.6, 4.70), fc="#e9e9e9", ec="#888888", lw=0.5)               # volume do reservatório (fundo)
    rect(ax, (0, 2.70, 8.0, 3.90), fc="#f1efe9", ec="#888888", lw=0.5)                 # casa ao fundo
    rect(ax, (0, 3.40, 8.0, 3.90), fc="#e0ddd5", ec="#888888", lw=0.4)
    for x0, x1 in ((0, 0.30), (1.30, 1.60), (7.70, 8.0)):
        rect(ax, (x0, 0, x1, 2.70), fc="#6b6b6b", ec="k", lw=0.6)
    rect(ax, (0, 2.40, 8.0, 2.70), fc="#6b6b6b", ec="k", lw=0.6)                       # viga do pórtico
    rect(ax, (0.30, 0.03, 1.30, 2.40), fc="#b9895a", ec="k", lw=0.7)                   # portão social
    rect(ax, (1.60, 0.03, 7.70, 2.40), fc="#3b3b3b", ec="k", lw=0.8)                   # basculante
    yy = 0.15
    while yy < 2.40:
        ax.plot([1.62, 7.68], [yy, yy], color="#8a8a8a", lw=0.35)
        yy += 0.12
    ax.plot([4.65, 4.65], [0.03, 2.40], color="#8a8a8a", lw=0.5)
    ax.annotate("", xy=(4.65, 2.15), xytext=(4.65, 0.5), arrowprops=dict(arrowstyle="->", color="white", lw=1.2))
    ax.text(4.9, 1.3, "abre para cima", fontsize=6, color="white", va="center")
    ax.text(0.8, 1.2, "portão\nsocial", fontsize=5.5, ha="center", va="center")
    ax.text(4.0, 3.12, "casa ao fundo (a 5,50 m do alinhamento)", fontsize=5.5, ha="center", color="#555555")
    ax.text(1.9, 4.3, "volume do reservatório", fontsize=5.5, ha="center", color="#555555")
    dim_chain(ax, [0, 0.30, 1.30, 1.60, 7.70, 8.0], -0.35, False, min_label=0.25, fs=5.5)
    dim_chain(ax, [0, 8.0], -0.85, False, fs=6.5)
    dim_chain(ax, [0, 2.40, 2.70, 3.90, 4.70], 8.5, True, min_label=0.25, fs=5.5)
    ax.text(4.0, 4.95, "FACHADA FRONTAL NO ALINHAMENTO DA RUA — escala 1:50", fontsize=9, fontweight="bold", ha="center")
    # ---- corte lateral do portão
    ox = 11.5
    ax.plot([ox - 1.6, ox + 6.6], [0, 0], color="k", lw=1.0)
    rect(ax, (ox, 0, ox + 0.30, 2.70), fc="#6b6b6b", ec="k", lw=0.6)
    rect(ax, (ox + 5.50, 0.15, ox + 5.70, 3.90), fc="#3a3a3a", ec="none")              # parede frontal da casa
    rect(ax, (ox + 5.50, 0, ox + 6.5, 0.15), fc="#bbbbbb", ec="none")
    ax.plot([ox + 0.15, ox + 0.15], [0.03, 2.40], color="k", lw=2.2)                   # fechado
    ax.plot([ox - 0.75, ox + 1.65], [2.28, 2.28], color=RED, lw=2.0, ls="--")           # aberto
    ax.annotate("", xy=(ox - 0.5, 2.2), xytext=(ox + 0.1, 0.6),
                arrowprops=dict(arrowstyle="->", color=RED, lw=0.8, connectionstyle="arc3,rad=-0.35"))
    ax.text(ox + 0.45, 1.2, "fechado", fontsize=5.5, va="center")
    ax.text(ox + 1.75, 2.28, "aberto", fontsize=5.5, va="center", color=RED)
    ax.text(ox - 0.8, 0.25, "passeio", fontsize=5.5, ha="center")
    ax.text(ox + 2.9, 0.25, "garagem descoberta", fontsize=5.5, ha="center")
    rect(ax, (ox + 0.35, 0.02, ox + 5.35, 0.06), fc="none", ec="none")
    ax.add_patch(Rectangle((ox + 0.45, 0.25), 4.9, 1.45, fill=False, ec="#999999", lw=0.5, ls="--"))
    ax.text(ox + 2.9, 1.0, "veículo de até 5,35 m", fontsize=5, ha="center", color="#777777")
    dim_chain(ax, [ox - 0.75, ox, ox + 0.30, ox + 5.50], -0.35, False, min_label=0.25, fs=5.5)
    dim_chain(ax, [0, 2.28, 2.70], ox + 6.9, True, min_label=0.25, fs=5.5)
    ax.text(ox + 2.5, 4.95, "CORTE C-C — PORTÃO BASCULANTE", fontsize=9, fontweight="bold", ha="center")
    # ---- planta da frente
    oy = -7.3
    rect(ax, (0, oy, 8.0, oy + 5.7), fc="#eeeeee", ec="none")
    rect(ax, (0, oy, 0.20, oy + 5.5), fc="#8a8a8a", ec="none")
    rect(ax, (7.80, oy, 8.0, oy + 5.5), fc="#8a8a8a", ec="none")
    rect(ax, (0, oy + 5.5, 8.0, oy + 5.7), fc="#3a3a3a", ec="none")
    for x0, x1 in ((0, 0.30), (1.30, 1.60), (7.70, 8.0)):
        rect(ax, (x0, oy, x1, oy + 0.30), fc="#6b6b6b", ec="k", lw=0.5)
    ax.plot([1.60, 7.70], [oy + 0.15, oy + 0.15], color="k", lw=2.0)
    ax.plot([0.30, 0.30], [oy + 0.15, oy + 1.15], color="k", lw=0.8)
    ax.add_patch(matplotlib.patches.Arc((0.30, oy + 0.15), 2.0, 2.0, theta1=0, theta2=90, lw=0.5))
    rect(ax, (1.60, oy - 0.80, 7.70, oy + 0.15), fill=False, ec=RED, lw=0.6, ls="--")
    ax.text(4.65, oy - 0.45, "projeção do portão aberto sobre o passeio: 0,80 m", fontsize=5, ha="center", color=RED)
    for x0 in (1.00, 5.50):
        rect(ax, (x0, oy + 0.4, x0 + 1.90, oy + 5.4), fill=False, ec="#777777", lw=0.5, ls="--")
    rect(ax, (4.15, oy + 5.5, 5.05, oy + 5.7), fc="#b9895a", ec="k", lw=0.4)
    ax.text(4.6, oy + 5.2, "entrada", fontsize=5, ha="center")
    ax.text(4.0, oy + 2.9, "GARAGEM DESCOBERTA\n8,00 × 5,50 — piso drenante", fontsize=6, ha="center", va="center")
    ax.text(4.0, oy + 5.85, "PLANTA DA FRENTE", fontsize=9, fontweight="bold", ha="center")
    # ---- quadro
    tx = fig.add_axes([20.5 / W, 0.5 / H, 20.5 / W, 28.6 / H])
    tx.axis("off"); tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    y = table(tx, "FECHAMENTO FRONTAL E MUROS", [
        ("Portão basculante de alumínio/aço, lambril horizontal, com motor e contrapeso", "6,10 × 2,40 m"),
        ("Portão social de abrir, mesma linguagem, fechadura elétrica", "1,00 × 2,40 m"),
        ("Pórtico: 3 pilares 30 × 30 cm e viga 20 × 30 cm de concreto armado", "h = 2,70 m"),
        ("Muros de divisa novos em bloco cerâmico, h = 2,20 m, com pilaretes a cada 2,50 m", "31,45 m"),
        ("  laterais da garagem 2 × 5,50 | lateral do pátio 14,65 | fundos 3,00 | pátio/spa 2,80", ""),
        ("Fundação dos muros: brocas Ø20 × 2,0 m e baldrame 15 × 25 cm", "13 brocas"),
        ("Interfone/vídeo-porteiro e ponto de iluminação nos pilares", "1 cj"),
    ], 0.50, fs=6.0)
    notes(tx, y - 0.01, [
        "1. O portão basculante abre para cima e, aberto, avança cerca de 0,80 m sobre o passeio a 2,28 m de altura.",
        "    Confirmar na Prefeitura se a projeção sobre o passeio é permitida; se não for, usar basculante",
        "    articulado (dobra em duas folhas e recolhe para dentro) no mesmo vão.",
        "2. Vão livre de 6,10 m para dois carros. Motor dimensionado para o peso da folha, com destrave manual,",
        "    sensor de barreira e sinalizador.",
        "3. As paredes da casa sobre as divisas fazem o papel de muro nesses trechos.",
        "4. Altura dos muros e do fechamento frontal a confirmar na legislação municipal.",
        "5. Cores e materiais de acabamento a definir com o proprietário.",
    ], fs=5.6)
    fig.text(1.0 / W, 0.4 / H, f"Doc. CP-ARQ-04   |   Revisão {REV} — {DATA}   |   Escala 1:50 (folha A3)   |   Unidade: metro   |   "
             "Anteprojeto — exige conferência e ART/RRT de profissional habilitado", fontsize=5.8, fontweight="bold")
    fig.text(1.0 / W, 28.8 / H, "CASA PÁTIO — Cascavel/PR      ARQ-04 — Fachada frontal, portão basculante e muros",
             fontsize=12, fontweight="bold")
    save(fig, "CP-ARQ-04_fachada-portao-muros")

# ----------------------------------------------------------------------------- EST-01
YL = [5.60, 10.275, 11.625, 14.275, 15.925, 18.575, 20.225, 21.875, 24.90]
PILARES = ([(0.10, y) for y in YL] + [(3.675, y) for y in YL]
           + [(4.925, y) for y in (10.275, 13.20, 16.50, 19.60, 21.875, 24.90)]
           + [(7.90, 5.60), (7.90, 10.275), (5.275, 5.60), (5.275, 7.275), (7.90, 7.275)])
PERG = [(5.15, 14.15), (7.65, 14.15), (5.15, 18.85), (7.65, 18.85)]


def baldrame_len():
    return sum(max(x1 - x0, y1 - y0) for x0, y0, x1, y1 in WALLS)


def est01():
    fig = new_sheet()
    ax = plan_axes(fig)
    light_plan(ax)
    for x0, y0, x1, y1 in WALLS:
        if (x1 - x0) > (y1 - y0):
            ax.plot([x0, x1], [(y0 + y1) / 2] * 2, color=GREEN, lw=1.0)
        else:
            ax.plot([(x0 + x1) / 2] * 2, [y0, y1], color=GREEN, lw=1.0)
    for i, (px, py) in enumerate(sorted(PILARES, key=lambda p: (p[1], p[0])), 1):
        ax.add_patch(Circle((px, py), 0.22, fill=False, ec=BROWN, lw=0.6, ls="--"))
        rect(ax, (px - 0.09, py - 0.15, px + 0.09, py + 0.15), fc=RED, ec="k", lw=0.3)
        ax.text(px + 0.26, py + 0.2, f"P{i}", fontsize=3.8, color=RED)
    for i, (px, py) in enumerate(PERG, 1):
        rect(ax, (px - 0.15, py - 0.15, px + 0.15, py + 0.15), fill=False, ec=RED, lw=0.7)
        ax.text(px, py + 0.25, f"BE{i}", fontsize=3.6, ha="center", color=RED)
    rect(ax, (5.3, 22.7, 7.5, 24.5), fill=False, ec=RED, lw=0.8, hatch="xx")
    ax.text(6.4, 23.6, "base spa", fontsize=4.2, ha="center", va="center", color=RED,
            bbox=dict(fc="white", ec="none", pad=0.3))
    ax.text(3.7, 25.75, "LOCAÇÃO DE PILARES, BALDRAMES E ESTACAS", fontsize=8, fontweight="bold", ha="center",
            va="bottom")
    tx = side_axes(fig)
    y = header(tx, "EST-01 — Concepção estrutural e fundações (pré-dimensionamento)",
               "Edificação térrea, cobertura leve. Dimensões e armaduras definitivas dependem de sondagem e cálculo.")
    lb = baldrame_len()
    n = len(PILARES)
    y = table(tx, "SISTEMA ADOTADO PARA ORÇAMENTO", [
        ("Fundação: estaca escavada (broca) Ø25 cm, uma por pilar — profundidade adotada 4,0 m", f"{n} un"),
        ("Viga baldrame 15 × 30 cm sob todas as paredes e sob as esquadrias de vidro", f"{br(lb, 1)} m"),
        ("Pilares 15 × 30 cm, altura 3,00 m (3,60 m nas divisas)", f"{n} un"),
        ("Cinta de respaldo / viga superior 15 × 25 cm", f"{br(lb, 1)} m"),
        ("Viga V2 sobre o vidro do corredor 15 × 30, vãos de até 3,30 m", "14,45 m"),
        ("Vergas e contravergas pré-moldadas 10 × 10 em todos os vãos", "ver planilha"),
        ("Laje pré-moldada (treliçada h = 12) sob o reservatório", "5,10 m²"),
        ("Base do spa: radier armado 2,20 × 1,80 × 0,15 (carga de cerca de 2 t)", "0,59 m³"),
        ("Blocos de espera do pergolado (Etapa 2) 40 × 40 × 40 com arranque", "4 un"),
        ("Contrapiso armado sobre lastro de brita com lona", f"{br(A_UTIL, 1)} m²"),
    ], y, x1=0.7)
    conc_est = n * 3.1416 * 0.125 ** 2 * 4.0
    conc_bal = lb * 0.15 * 0.30
    conc_pil = n * 0.15 * 0.30 * 3.2
    conc_cin = lb * 0.15 * 0.25
    y = table(tx, "VOLUMES E CONSUMOS ESTIMADOS", [
        ("Concreto das estacas (fck 20 MPa)", f"{br(conc_est, 1)} m³"),
        ("Concreto dos baldrames (fck 25 MPa)", f"{br(conc_bal, 1)} m³"),
        ("Concreto dos pilares (fck 25 MPa)", f"{br(conc_pil, 1)} m³"),
        ("Concreto das cintas e vigas (fck 25 MPa)", f"{br(conc_cin + 14.45 * 0.15 * 0.05, 1)} m³"),
        ("Aço CA-50/CA-60 — taxa adotada 90 kg por m³ de concreto estrutural", f"{br((conc_bal + conc_pil + conc_cin) * 90 + conc_est * 40, 0)} kg"),
        ("Formas de madeira (baldrames, pilares e cintas)", f"{br(lb * 0.6 + n * 0.9 * 3.2 + lb * 0.5, 0)} m²"),
    ], y, x1=0.7)
    notes(tx, y - 0.005, [
        "1. NÃO É PROJETO ESTRUTURAL. Seções, armaduras e profundidade das estacas são premissas para",
        "    orçamento. O projeto definitivo exige cálculo conforme NBR 6118, NBR 6120 e NBR 6122, com ART.",
        "2. Sondagem SPT obrigatória antes do projeto de fundações (NBR 8036): mínimo de 2 furos.",
        "    O solo argiloso poroso típico de Cascavel pode ser colapsível; a profundidade real das",
        "    estacas pode mudar bastante o custo.",
        "3. Paredes de vedação em bloco cerâmico. Pilares embutidos nos encontros de parede.",
        "4. Bloco social: vão de 7,60 m dividido pela parede da lavanderia (pilares em x = 5,275).",
        "5. Baldrames impermeabilizados nas três faces antes da alvenaria.",
        "6. Juntas de dilatação e ligação com muros vizinhos existentes a verificar no local.",
        "7. Círculos tracejados: estacas. Retângulos vermelhos: pilares. Linhas verdes: eixos dos baldrames.",
    ])
    footer(tx, "CP-EST-01")
    save(fig, "CP-EST-01_estrutura-fundacoes")
    return dict(n=n, lb=lb, conc_est=conc_est, conc_bal=conc_bal, conc_pil=conc_pil, conc_cin=conc_cin)


# ----------------------------------------------------------------------------- ELE-01
# (nº, descrição, tensão V, potência VA, cabo mm², disjuntor A, DR)
CIRC = [
    (1, "Iluminação — social, garagem e pátio", 127, 1100, 1.5, 10, "não"),
    (2, "Iluminação — ala íntima e corredor", 127, 900, 1.5, 10, "não"),
    (3, "Tomadas — estar e jantar", 127, 1200, 2.5, 20, "sim"),
    (4, "Tomadas — cozinha, bancada", 127, 1900, 2.5, 20, "sim"),
    (5, "Tomadas — cozinha, geladeira e micro-ondas", 127, 1800, 2.5, 20, "sim"),
    (6, "Tomadas — lavanderia (lavadora)", 127, 1500, 2.5, 20, "sim"),
    (7, "Tomadas — quartos e corredor", 127, 1700, 2.5, 20, "sim"),
    (8, "Tomadas — banheiros e lavabo", 127, 1800, 2.5, 20, "sim"),
    (9, "Chuveiro — banho suíte", 220, 7500, 6.0, 40, "sim"),
    (10, "Chuveiro — banho compartilhado", 220, 7500, 6.0, 40, "sim"),
    (11, "Forno elétrico", 220, 2500, 2.5, 20, "sim"),
    (12, "Ar-condicionado — suíte master (12.000 BTU)", 220, 1300, 2.5, 16, "não"),
    (13, "Ar-condicionado — demi-suíte 01 (9.000 BTU)", 220, 1000, 2.5, 16, "não"),
    (14, "Ar-condicionado — demi-suíte 02 (9.000 BTU)", 220, 1000, 2.5, 16, "não"),
    (15, "Ar-condicionado — estar/jantar (24.000 BTU)", 220, 2600, 4.0, 25, "não"),
    (16, "Portão eletrônico e iluminação frontal", 127, 600, 2.5, 16, "sim"),
    (17, "RESERVA — spa (só eletroduto e espaço no quadro)", 220, 6000, 6.0, 32, "sim"),
    (18, "RESERVA — área gourmet, Etapa 2", 127, 2000, 2.5, 20, "sim"),
]
# pontos: (x, y, tipo)  L = luz, T = tomada, E = tomada de uso específico, I = interruptor, A = ar-condicionado
PTS = []


def _room_pts():
    P = PTS
    lights = [(2.7, 6.9), (2.7, 9.2), (6.5, 8.8), (6.6, 6.45), (1.9, 10.95), (1.9, 12.95), (1.9, 15.1),
              (1.9, 17.25), (1.9, 19.4), (1.9, 21.05), (2.5, 23.4), (4.3, 12.0), (4.3, 15.5), (4.3, 19.0),
              (4.0, 2.75), (1.2, 5.3), (6.9, 5.3), (6.4, 12.5), (6.4, 16.5), (6.4, 20.5), (6.4, 23.6)]
    P += [(x, y, "L") for x, y in lights]
    tug = [(0.35, 6.2), (0.35, 8.0), (0.35, 9.6), (2.5, 5.85), (4.9, 9.9), (3.4, 10.05),          # estar/jantar
           (7.65, 7.8), (7.65, 8.6), (7.65, 9.4), (5.5, 7.5), (6.9, 7.5),                            # cozinha
           (7.65, 6.0), (7.65, 6.8), (5.5, 6.0),                                                     # lavanderia
           (0.35, 10.9),                                                                             # lavabo
           (0.35, 12.2), (0.35, 13.7), (3.45, 12.75), (1.5, 11.85),                                  # demi 02
           (0.35, 15.1),                                                                             # banho comp
           (0.35, 16.5), (0.35, 18.0), (3.45, 17.05), (1.5, 18.35),                                  # demi 01
           (0.35, 19.4), (0.35, 21.05),                                                              # banho suíte, closet
           (0.35, 22.5), (0.35, 24.2), (2.5, 24.65), (4.7, 23.0), (3.0, 22.1),                       # suíte
           (3.9, 13.5), (3.9, 18.0),                                                                 # corredor
           (0.35, 1.0), (7.65, 1.0)]                                                                 # garagem
    P += [(x, y, "T") for x, y in tug]
    P += [(3.2, 19.9, "E"), (3.2, 15.6, "E"), (7.65, 9.9, "E"), (7.65, 23.6, "E"), (7.65, 17.4, "E")]
    P += [(0.4, 23.4, "A"), (0.4, 17.25, "A"), (0.4, 12.95, "A"), (0.4, 7.0, "A")]
    sw = [(5.15, 5.9), (3.9, 10.5), (3.45, 11.1), (3.45, 12.0), (3.45, 16.3), (2.4, 14.5), (2.4, 15.75),
          (1.2, 20.0), (1.2, 21.65), (3.7, 22.1), (5.45, 7.5), (4.7, 21.6)]
    P += [(x, y, "I") for x, y in sw]


_room_pts()


def ele01():
    fig = new_sheet()
    ax = plan_axes(fig)
    light_plan(ax)
    for x, y, t in PTS:
        if t == "L":
            ax.add_patch(Circle((x, y), 0.14, fc="#ffe066", ec="k", lw=0.4))
        elif t == "T":
            ax.add_patch(Polygon([(x - 0.1, y - 0.08), (x + 0.1, y - 0.08), (x, y + 0.12)], fc="white", ec="k", lw=0.5))
        elif t == "E":
            ax.add_patch(Polygon([(x - 0.12, y - 0.1), (x + 0.12, y - 0.1), (x, y + 0.14)], fc="k", ec="k", lw=0.5))
        elif t == "A":
            rect(ax, (x - 0.12, y - 0.3, x + 0.06, y + 0.3), fc="#9ad0f5", ec="k", lw=0.4)
        else:
            ax.text(x, y, "S", fontsize=4.2, ha="center", va="center", color=RED, fontweight="bold")
    rect(ax, (5.36, 9.0, 5.48, 9.6), fc=RED, ec="k", lw=0.4)
    ax.text(5.6, 9.3, "QD", fontsize=4.5, color=RED, va="center", fontweight="bold")
    rect(ax, (0.25, 0.1, 0.55, 0.5), fc="k", ec="k")
    ax.text(0.7, 0.3, "padrão de entrada", fontsize=4, va="center")
    ax.plot([0.4, 0.4, 5.42, 5.42], [0.5, 5.35, 5.35, 9.0], color=RED, lw=0.7, ls="--")
    ax.text(3.7, 25.75, "PLANTA DE PONTOS ELÉTRICOS", fontsize=8, fontweight="bold", ha="center", va="bottom")
    # legenda
    lg = [("L", "ponto de luz no teto"), ("T", "tomada de uso geral 2P+T 10 A"), ("E", "tomada de uso específico 20 A"),
          ("A", "ar-condicionado split (evaporadora)"), ("I", "interruptor")]
    for i, (t, d) in enumerate(lg):
        yy = -0.75 - 0.0 * i
    tx = side_axes(fig)
    y = header(tx, "ELE-01 — Instalações elétricas: pontos e quadro de cargas (pré-dimensionamento)",
               "Fornecimento Copel 127/220 V. Referência: ABNT NBR 5410. Condutores de cobre, isolação 750 V, eletroduto corrugado.")
    tx.text(0, y, "QUADRO DE CARGAS", fontsize=8, fontweight="bold", va="top")
    y -= 0.022
    cols = [0.0, 0.035, 0.50, 0.58, 0.67, 0.75, 0.84, 0.92]
    hd = ["Nº", "Circuito", "Tensão", "Potência", "Corrente", "Cabo", "Disjuntor", "DR 30 mA"]
    for c, h in zip(cols, hd):
        tx.text(c, y, h, fontsize=6, fontweight="bold", va="top")
    y -= 0.017
    tot = 0
    for n, d, v, p, cab, dj, dr in CIRC:
        cur = p / v
        vals = [str(n), d, f"{v} V", f"{p} VA", f"{br(cur, 1)} A", f"{br(cab, 1)} mm²", f"{dj} A", dr]
        for c, val in zip(cols, vals):
            tx.text(c, y, val, fontsize=5.8, va="top")
        tx.plot([0, 1], [y - 0.0135, y - 0.0135], color="#bbbbbb", lw=0.3)
        y -= 0.0162
        tot += p
    tx.text(0.035, y, "POTÊNCIA INSTALADA TOTAL (com reservas)", fontsize=6.2, fontweight="bold", va="top")
    tx.text(0.58, y, f"{tot} VA", fontsize=6.2, fontweight="bold", va="top")
    y -= 0.03
    nL = sum(1 for p in PTS if p[2] == "L")
    nT = sum(1 for p in PTS if p[2] == "T")
    nE = sum(1 for p in PTS if p[2] == "E")
    nI = sum(1 for p in PTS if p[2] == "I")
    y = table(tx, "CONTAGEM DE PONTOS", [
        ("Pontos de luz (símbolo: círculo amarelo)", f"{nL} un"),
        ("Tomadas de uso geral 2P+T 10 A (triângulo vazado)", f"{nT} un"),
        ("Tomadas de uso específico 20 A — chuveiros, forno, esperas do spa e do gourmet (triângulo cheio)", f"{nE} un"),
        ("Pontos de ar-condicionado com dreno e tubulação frigorígena embutidos (retângulo azul)", "4 un"),
        ("Interruptores (letra S)", f"{nI} un"),
        ("Quadro de distribuição de embutir, 24 a 28 módulos, com barramentos de neutro e terra", "1 un"),
        ("DPS classe II 275 V 20 kA (3 fases + neutro)", "4 un"),
        ("Haste de aterramento cobreada 2,40 m com caixa de inspeção, esquema TN-S", "3 un"),
    ], y, x1=0.8)
    notes(tx, y - 0.005, [
        "1. Entrada prevista: trifásica. Categoria e disjuntor geral a confirmar com a Copel pela demanda calculada",
        "    pelo projetista (ordem de grandeza: disjuntor geral de 63 A, ramal 16 mm²).",
        "2. DR de 30 mA em todos os circuitos de áreas molhadas, tomadas e áreas externas. Um DR por grupo de circuitos.",
        "3. Bitola mínima: 1,5 mm² para iluminação e 2,5 mm² para tomadas. Queda de tensão a verificar no projeto",
        "    definitivo (percurso mais longo: quadro até a suíte, cerca de 22 m).",
        "4. Chuveiros em 220 V com cabo 6 mm² e disjuntor 40 A. Se o aquecimento for a gás ou solar, os circuitos 9 e 10",
        "    caem para apoio e a entrada pode ser reduzida.",
        "5. Spa e área gourmet: apenas eletroduto seco Ø32 mm com guia e espaço reservado no quadro.",
        "6. Condensadoras de ar-condicionado sobre a cobertura ou na parede do pátio, a definir no executivo.",
        "7. Posições de pontos são indicativas e devem ser ajustadas ao layout de móveis antes da execução.",
    ])
    footer(tx, "CP-ELE-01")
    save(fig, "CP-ELE-01_eletrica")
    return dict(nL=nL, nT=nT, nE=nE, nI=nI, tot=tot)


# ----------------------------------------------------------------------------- HID-01
def hid01():
    fig = new_sheet()
    ax = plan_axes(fig)
    light_plan(ax)
    # água fria
    af = [[(7.6, 0.3), (7.6, 5.3), (7.6, 5.9)], [(7.6, 5.3), (4.4, 5.3), (4.4, 22.0), (7.5, 22.0), (7.5, 23.2)], [(4.4, 15.1), (3.3, 15.1)],
          [(3.5, 15.1), (3.5, 10.9), (2.6, 10.9)], [(3.5, 15.1), (3.5, 19.4), (2.6, 19.4)],
          [(7.6, 5.9), (7.6, 8.8)], [(7.5, 18.6), (7.5, 22.0)]]
    for seg in af:
        ax.plot([p[0] for p in seg], [p[1] for p in seg], color=BLUE, lw=0.9)
    rect(ax, (0.6, 14.55, 3.2, 15.65), fill=False, ec=BLUE, lw=0.9, ls="--")
    ax.text(1.9, 15.1, "reservatório 1.000 L\n(sobre laje)", fontsize=4, ha="center", va="center", color=BLUE)
    rect(ax, (7.45, 0.1, 7.75, 0.5), fc=BLUE, ec="k", lw=0.3)
    ax.text(7.35, 0.3, "hidrômetro", fontsize=4, ha="right", va="center", color=BLUE)
    # esgoto
    ci = {"CI1": (5.35, 19.4), "CI2": (5.35, 15.1), "CI3": (5.35, 10.9), "CI4": (5.35, 4.6), "CI5": (5.35, 0.6)}
    eg = [[(1.0, 19.4), (5.35, 19.4)], [(1.0, 15.1), (5.35, 15.1)], [(1.0, 10.9), (5.35, 10.9)],
          [(5.35, 19.4), (5.35, 0.6), (5.35, -0.2)], [(7.2, 8.8), (6.6, 8.8), (6.6, 4.9)], [(6.6, 6.4), (7.2, 6.4)],
          [(6.6, 4.6), (5.35, 4.6)], [(7.4, 18.3), (5.35, 18.3)]]
    for seg in eg:
        ax.plot([p[0] for p in seg], [p[1] for p in seg], color=BROWN, lw=1.1)
    for k, (x, y) in ci.items():
        rect(ax, (x - 0.22, y - 0.22, x + 0.22, y + 0.22), fc="white", ec=BROWN, lw=0.9)
        ax.text(x + 0.3, y + 0.28, k, fontsize=3.8, color=BROWN)
    for (x, y, t) in ((6.6, 4.75, "CG1"), (6.3, 18.3, "CG2")):
        ax.add_patch(Circle((x, y), 0.2, fc="white", ec=BROWN, lw=0.9))
        ax.text(x + 0.25, y + 0.25, t, fontsize=3.8, color=BROWN)
    # pluvial
    pv = [[(4.92 + 0.25, 11.0), (5.9, 11.0)], [(5.17, 16.5), (5.9, 16.5)], [(5.17, 21.5), (5.9, 21.5)],
          [(5.17, 24.5), (5.9, 24.5), (5.9, 0.9), (5.9, -0.2)], [(0.5, 5.4), (0.5, 0.9), (5.9, 0.9)],
          [(7.5, 5.4), (7.5, 4.0), (5.9, 4.0)]]
    for seg in pv:
        ax.plot([p[0] for p in seg], [p[1] for p in seg], color=GREEN, lw=0.9, ls="--")
    for (x, y) in ((5.9, 11.0), (5.9, 16.5), (5.9, 21.5), (5.9, 24.5), (5.9, 0.9), (6.9, 13.0), (6.9, 20.0), (6.4, 23.6)):
        rect(ax, (x - 0.15, y - 0.15, x + 0.15, y + 0.15), fc="#cfeecf", ec=GREEN, lw=0.8)
    for (x, y) in ((6.9, 13.0), (6.9, 20.0), (6.4, 23.6)):
        ax.plot([x, 5.9], [y, y], color=GREEN, lw=0.7, ls="--")
    ax.text(3.7, 25.75, "PLANTA HIDROSSANITÁRIA E PLUVIAL", fontsize=8, fontweight="bold", ha="center", va="bottom")
    tx = side_axes(fig)
    y = header(tx, "HID-01 — Água fria, esgoto sanitário e águas pluviais (pré-dimensionamento)",
               "Referências: ABNT NBR 5626, NBR 8160 e NBR 10844. Traçados esquemáticos, a detalhar com isométricos no executivo.")
    y = table(tx, "ÁGUA FRIA (linhas azuis)", [
        ("Alimentação do hidrômetro ao reservatório, PVC soldável Ø25", "28 m"),
        ("Reservatório de polietileno 1.000 L sobre laje, com boia, extravasor e limpeza", "1 un"),
        ("Barrilete e descidas PVC Ø32 / Ø25, um registro de gaveta por ambiente", "9 registros"),
        ("Distribuição PVC Ø25 e ramais Ø20", "62 m"),
        ("Pontos de consumo: 3 vasos, 3 lavatórios, 2 chuveiros, pia, tanque, lavadora, 2 torneiras de jardim", "13 pontos"),
        ("Esperas com cap: spa (1) e bancada gourmet (1)", "2 pontos"),
        ("Água quente: chuveiros elétricos (sem rede de água quente). Alternativa solar a comparar", "—"),
    ], y, x1=0.78)
    y = table(tx, "ESGOTO SANITÁRIO (linhas marrons)", [
        ("Ramais de descarga e de esgoto PVC Ø40 / Ø50 / Ø75 dentro dos banheiros", "30 m"),
        ("Ramais Ø100 dos vasos sob o corredor até as caixas no pátio (3 travessias)", "14 m"),
        ("Coletor predial PVC Ø100, i = 1 %, CI1 → CI5 → rede pública (trecho sob a cozinha sem caixas)", "21 m"),
        ("Caixas de inspeção 60 × 60 com tampa (CI1 a CI5)", "5 un"),
        ("Caixas de gordura: CG1 cozinha/lavanderia e CG2 espera do gourmet", "2 un"),
        ("Caixas sifonadas 150 × 150 × 50 (3 banheiros + lavanderia)", "4 un"),
        ("Colunas de ventilação Ø50 subindo 0,30 m acima da cobertura", "3 un"),
    ], y, x1=0.78)
    y = table(tx, "ÁGUAS PLUVIAIS (linhas verdes tracejadas)", [
        ("Calhas C1 e C2 em chapa galvanizada, seção 15 × 10 cm", "22,05 m"),
        ("Condutores verticais PVC Ø100", "6 un"),
        ("Caixas de areia 40 × 40 com grelha no pátio e na garagem", "5 un"),
        ("Ralos de piso no pátio e no spa ligados ao coletor", "3 un"),
        ("Coletor pluvial PVC Ø100 / Ø150, i = 1 %, até a sarjeta", "36 m"),
    ], y, x1=0.78)
    notes(tx, y - 0.005, [
        "1. Considerada rede pública de esgoto (Sanepar) na rua. Se não houver, será preciso fossa séptica, filtro e",
        "    sumidouro na garagem, o que muda o projeto e o custo. Confirmar com a Sanepar.",
        "2. Esgoto e pluvial são redes totalmente separadas. É proibido ligar água de chuva no esgoto.",
        "3. O pátio é fechado nos quatro lados: toda a drenagem sai por tubo enterrado sob a cozinha e a garagem.",
        "    Essas tubulações devem ser assentadas ANTES dos baldrames e do contrapiso, com teste de estanqueidade.",
        "4. Nenhuma caixa de inspeção ou de gordura dentro da casa.",
        "5. Diâmetros são mínimos de norma por aparelho; a verificação por unidades Hunter e a vazão das calhas",
        "    (chuva de projeto de Cascavel) ficam para o projeto executivo.",
    ])
    footer(tx, "CP-HID-01")
    save(fig, "CP-HID-01_hidrossanitario")


# ----------------------------------------------------------------------------- quantitativos
def opening_area(kind_h):
    return sum(max(x1 - x0, y1 - y0) * kind_h[k] for x0, y0, x1, y1, k, t in OPEN if k in kind_h)


def quantitativos(est, ele):
    ext_idx = {0, 1, 2, 3}
    glass_idx = {5, 7}
    L_ext = sum(max(w[2] - w[0], w[3] - w[1]) for i, w in enumerate(WALLS) if i in ext_idx)
    L_int = sum(max(w[2] - w[0], w[3] - w[1]) for i, w in enumerate(WALLS) if i not in ext_idx | glass_idx)
    doors = [(o[2] - o[0]) if (o[2] - o[0]) > (o[3] - o[1]) else (o[3] - o[1]) for o in OPEN if o[4] == "door"]
    A_doors = sum(d * 2.10 for d in doors)
    A_win = 1.8 * 1.2 + 1.4 * 1.0 + 2 * 1.2 * 1.2
    A_v3 = 1.8 * 2.1
    alv_ext = L_ext * H_EXT - (0.9 * 2.1 + 1.8 * 1.2 + 1.4 * 1.0)
    alv_int = L_int * H_INT - (A_doors - 0.9 * 2.1) - 2 * 1.2 * 1.2 - A_v3
    L_muro = 5.5 * 2 + 14.65 + 3.0 + 2.8
    perims = {n: 2 * (w + d) for _, _, n, w, d in ROOMS}
    P_tot = sum(perims.values()) + 2 * (1.10 + 11.45)
    reb_int = P_tot * PD - 2 * A_doors - A_win - A_v3 - (2.8 + 11.45) * 2.6 - 4.5 * PD * 2
    molhados = ["BANHO SUÍTE", "BANHO COMPARTILHADO", "LAVABO", "LAVANDERIA"]
    az = sum(perims[m] for m in molhados) * PD - 6 * 0.7 * 2.1 + 5.0 * 0.6  # + faixa da bancada da cozinha
    reb_ext = (8.0 * 3.9) + (2.95 + 14.45) * 0.6 + 3.0 * 3.3 + 8.0 * 0.6 + (19.5 + 5.0 + 4.85) * 0.6
    A_piso_molh = 5.10 + 5.10 + 4.08 + 3.675
    A_vidro = (2.8 + 11.45) * 2.6 + A_v3
    Q = []  # (etapa, descrição, un, quantidade, observação)
    add = lambda e, d, u, q, o="": Q.append((e, d, u, round(q, 2), o))
    add("01 Serviços preliminares", "Sondagem SPT (2 furos)", "furo", 2, "NBR 8036")
    add("01 Serviços preliminares", "Projetos legais e executivos com ART/RRT, alvará", "vb", 1)
    add("01 Serviços preliminares", "Ligação provisória de água e energia", "vb", 1)
    add("01 Serviços preliminares", "Barracão/depósito e tapume frontal", "m", 8.0, "tapume na testada")
    add("01 Serviços preliminares", "Locação da obra com gabarito", "m²", A_CONST)
    add("02 Limpeza do terreno", "Limpeza e raspagem mecanizada do terreno", "m²", 200.0)
    add("03 Terraplenagem", "Aterro compactado para elevar o piso interno 15 cm", "m³", A_CONST * 0.15 * 1.25, "empolamento 25 %")
    add("03 Terraplenagem", "Escavação manual de valas para baldrames", "m³", est["lb"] * 0.25 * 0.35)
    add("04 Fundação", "Estaca escavada Ø25 cm, profundidade adotada 4,0 m", "m", est["n"] * 4.0, "confirmar por sondagem")
    add("04 Fundação", "Concreto fck 20 MPa para estacas", "m³", est["conc_est"])
    add("04 Fundação", "Viga baldrame 15 × 30 — concreto fck 25 MPa", "m³", est["conc_bal"], f"{br(est['lb'], 1)} m lineares")
    add("04 Fundação", "Forma de madeira para baldrame", "m²", est["lb"] * 0.6)
    add("04 Fundação", "Blocos de espera do pergolado 40 × 40 × 40 (Etapa 2)", "un", 4)
    add("04 Fundação", "Radier armado da base do spa 2,20 × 1,80 × 0,15", "m³", 0.59)
    add("05 Estrutura", "Pilares 15 × 30 — concreto fck 25 MPa", "m³", est["conc_pil"], f"{est['n']} pilares")
    add("05 Estrutura", "Cinta de respaldo e vigas — concreto fck 25 MPa", "m³", est["conc_cin"] + 0.11)
    add("05 Estrutura", "Aço CA-50 / CA-60 cortado e dobrado", "kg",
        (est["conc_bal"] + est["conc_pil"] + est["conc_cin"]) * 90 + est["conc_est"] * 40, "taxa adotada 90 kg/m³")
    add("05 Estrutura", "Forma de madeira para pilares e cintas", "m²", est["n"] * 0.9 * 3.2 + est["lb"] * 0.5)
    add("05 Estrutura", "Laje pré-moldada treliçada h = 12 cm (reservatório)", "m²", 5.10)
    add("06 Alvenaria", "Alvenaria de bloco cerâmico 14 × 19 × 29 — externas e divisas, h = 3,60", "m²", alv_ext, f"{br(L_ext, 2)} m lineares")
    add("06 Alvenaria", "Alvenaria de bloco cerâmico 11,5 × 19 × 29 — internas, h = 3,00", "m²", alv_int, f"{br(L_int, 2)} m lineares")
    add("06 Alvenaria", "Muros de divisa novos h = 2,20 em bloco cerâmico 14 cm (garagem, pátio, fundos, pátio/spa)", "m²", L_muro * H_MURO, f"{br(L_muro, 2)} m lineares")
    add("06 Alvenaria", "Muros: brocas Ø20 × 2,0 m (13 un)", "m", 26.0, "uma a cada 2,50 m")
    add("06 Alvenaria", "Muros: baldrame 15 × 25 e pilaretes 15 × 15 — concreto fck 20 MPa", "m³", L_muro * 0.15 * 0.25 + 13 * 0.15 * 0.15 * 2.2)
    add("06 Alvenaria", "Muros: aço CA-50 / CA-60", "kg", (L_muro * 0.15 * 0.25 + 13 * 0.15 * 0.15 * 2.2) * 80, "taxa adotada 80 kg/m³")
    add("06 Alvenaria", "Muros: chapisco + reboco nas faces internas e topo", "m²", L_muro * H_MURO + L_muro * 0.2)
    add("06 Alvenaria", "Pórtico frontal: 3 pilares 30 × 30 e viga 20 × 30 — concreto fck 25 MPa", "m³", 3 * 0.3 * 0.3 * 2.7 + 8.0 * 0.2 * 0.3 + 3 * 0.5 * 0.5 * 0.5)
    add("07 Vergas e contravergas", "Verga pré-moldada 10 × 10 sobre portas e janelas", "m", sum(d + 0.6 for d in doors) + (1.8 + 1.4 + 2.4 + 1.8) + 4 * 0.6)
    add("07 Vergas e contravergas", "Contraverga pré-moldada 10 × 10 sob janelas", "m", (1.8 + 1.4 + 2.4) + 4 * 0.6)
    add("08 Cobertura", "Estrutura metálica leve para telha (perfis U enrijecidos)", "m²", A_CONST)
    add("08 Cobertura", "Telha termoacústica trapezoidal 30 mm, i = 10 %", "m²", A_CONST * 1.005 * 1.05, "inclui 5 % de perdas")
    add("08 Cobertura", "Calha em chapa galvanizada 15 × 10", "m", 22.05)
    add("08 Cobertura", "Rufo e contra-rufo em chapa galvanizada", "m", 49.0)
    add("08 Cobertura", "Condutor vertical PVC Ø100", "m", 19.2, "6 descidas")
    add("09 Impermeabilização", "Baldrames: argamassa polimérica + emulsão asfáltica, 3 faces", "m²", est["lb"] * 0.75)
    add("09 Impermeabilização", "Pisos de banheiros, lavabo e lavanderia: argamassa polimérica, rodapé 30 cm", "m²", A_piso_molh + sum(perims[m] for m in molhados) * 0.3)
    add("09 Impermeabilização", "Paredes de box até 1,80 m: membrana acrílica", "m²", 2 * (1.5 + 0.9 + 0.9) * 1.8)
    add("09 Impermeabilização", "Laje do reservatório e base do spa: manta asfáltica 4 mm", "m²", 5.10 + 3.96 + 3.0)
    add("09 Impermeabilização", "Pé de parede externa (pátio e garagem), faixa de 60 cm", "m²", (14.45 + 2.95 + 8.0 + 3.0) * 0.6)
    add("10 Instalação hidráulica", "Tubo PVC soldável Ø25 (alimentação e distribuição)", "m", 90.0)
    add("10 Instalação hidráulica", "Tubo PVC soldável Ø32 (barrilete e descidas)", "m", 12.0)
    add("10 Instalação hidráulica", "Tubo PVC soldável Ø20 (ramais)", "m", 24.0)
    add("10 Instalação hidráulica", "Registros de gaveta e de pressão com acabamento", "un", 11, "9 gaveta + 2 pressão")
    add("10 Instalação hidráulica", "Reservatório de polietileno 1.000 L com boia", "un", 1)
    add("10 Instalação hidráulica", "Pontos de água fria (inclui 2 esperas da Etapa 2 / spa)", "pt", 15)
    add("11 Instalação sanitária", "Tubo PVC esgoto Ø100", "m", 35.0)
    add("11 Instalação sanitária", "Tubo PVC esgoto Ø40 / Ø50 / Ø75", "m", 30.0)
    add("11 Instalação sanitária", "Tubo PVC Ø100 / Ø150 para pluvial enterrado", "m", 36.0)
    add("11 Instalação sanitária", "Caixa de inspeção 60 × 60 com tampa", "un", 5)
    add("11 Instalação sanitária", "Caixa de gordura", "un", 2, "uma é espera do gourmet")
    add("11 Instalação sanitária", "Caixa sifonada 150 × 150 × 50", "un", 4)
    add("11 Instalação sanitária", "Caixa de areia 40 × 40 com grelha e ralos de pátio", "un", 8)
    add("11 Instalação sanitária", "Coluna de ventilação PVC Ø50", "m", 10.5, "3 colunas")
    add("12 Instalação elétrica", "Padrão de entrada trifásico Copel com medição", "un", 1)
    add("12 Instalação elétrica", "Quadro de distribuição 24–28 módulos com barramentos", "un", 1)
    add("12 Instalação elétrica", "Disjuntores termomagnéticos (18 circuitos + geral)", "un", 19)
    add("12 Instalação elétrica", "Interruptor diferencial residual 30 mA", "un", 4)
    add("12 Instalação elétrica", "DPS classe II 275 V 20 kA", "un", 4)
    add("12 Instalação elétrica", "Cabo flexível 1,5 mm²", "m", 300.0, "3 rolos de 100 m")
    add("12 Instalação elétrica", "Cabo flexível 2,5 mm²", "m", 900.0, "9 rolos de 100 m")
    add("12 Instalação elétrica", "Cabo flexível 4,0 mm²", "m", 60.0)
    add("12 Instalação elétrica", "Cabo flexível 6,0 mm²", "m", 150.0, "chuveiros")
    add("12 Instalação elétrica", "Cabo 16 mm² (ramal de entrada ao quadro)", "m", 70.0, "5 condutores × 14 m")
    add("12 Instalação elétrica", "Eletroduto corrugado Ø25 / Ø32", "m", 420.0)
    add("12 Instalação elétrica", "Caixas 4 × 2, 4 × 4 e octogonais", "un", ele["nL"] + ele["nT"] + ele["nE"] + ele["nI"] + 6)
    add("12 Instalação elétrica", "Tomadas 2P+T 10 A", "un", ele["nT"])
    add("12 Instalação elétrica", "Tomadas 2P+T 20 A / pontos de força", "un", ele["nE"] + 4)
    add("12 Instalação elétrica", "Interruptores", "un", ele["nI"])
    add("12 Instalação elétrica", "Aterramento: 3 hastes cobreadas 2,40 m, cabo nu 16 mm²", "cj", 1)
    add("12 Instalação elétrica", "Infraestrutura de ar-condicionado (tubulação, dreno, ponto) ", "pt", 4)
    add("13 Esquadrias", "Porta de entrada pivotante/abrir 0,90 × 2,10 (P1 externa)", "un", 1)
    add("13 Esquadrias", "Porta interna de madeira 0,90 × 2,10 com batente e ferragens", "un", 1)
    add("13 Esquadrias", "Porta interna de madeira 0,80 × 2,10 com batente e ferragens", "un", 3)
    add("13 Esquadrias", "Porta interna de madeira 0,70 × 2,10 com batente e ferragens", "un", 5)
    add("13 Esquadrias", "Janelas de alumínio de correr (J1, J2, 2 × J3)", "m²", A_win)
    add("13 Esquadrias", "Exaustor de banheiro com duto até a cobertura", "un", 4, "3 banheiros + closet")
    add("14 Revestimentos", "Chapisco + emboço/reboco interno", "m²", reb_int)
    add("14 Revestimentos", "Chapisco + reboco externo (fachada, pátio, platibandas)", "m²", reb_ext)
    add("14 Revestimentos", "Revestimento cerâmico de parede (banheiros, lavabo, lavanderia, faixa da pia)", "m²", az * 1.10, "inclui 10 % de perdas")
    add("15 Contrapiso", "Lastro de brita 5 cm + lona", "m²", A_UTIL)
    add("15 Contrapiso", "Contrapiso de concreto armado com tela, 7 cm", "m²", A_UTIL)
    add("15 Contrapiso", "Regularização para piso", "m²", A_UTIL)
    add("16 Pisos", "Porcelanato 60 × 60 ou maior — áreas secas", "m²", (A_UTIL - A_piso_molh) * 1.10, "inclui 10 % de perdas")
    add("16 Pisos", "Porcelanato antiderrapante — áreas molhadas", "m²", A_piso_molh * 1.10, "inclui 10 % de perdas")
    add("16 Pisos", "Rodapé", "m", P_tot - sum(perims[m] for m in molhados) - 20.0)
    add("16 Pisos", "Soleiras e peitoris em granito", "m", 10 * 0.9 + 6.2 + 14.25)
    add("16 Pisos", "Piso drenante da garagem (bloco intertravado vazado)", "m²", 44.0)
    add("16 Pisos", "Pisantes e preparo do jardim do pátio", "m²", 33.32)
    add("17 Forros", "Forro de gesso acartonado com tabica", "m²", A_UTIL)
    add("18 Pintura", "Massa corrida + tinta acrílica em paredes internas", "m²", reb_int - az)
    add("18 Pintura", "Tinta acrílica em forro", "m²", A_UTIL)
    add("18 Pintura", "Textura/tinta acrílica externa", "m²", reb_ext)
    add("19 Louças e metais", "Vaso sanitário com caixa acoplada", "un", 3)
    add("19 Louças e metais", "Cuba/lavatório com torneira e sifão", "un", 3)
    add("19 Louças e metais", "Chuveiro elétrico", "un", 2)
    add("19 Louças e metais", "Tanque com torneira", "un", 1)
    add("19 Louças e metais", "Cuba de cozinha em inox com torneira", "un", 1)
    add("19 Louças e metais", "Kit de acessórios de banheiro", "cj", 3)
    add("20 Bancadas", "Bancada de granito da cozinha com frontão", "m²", 5.0 * 0.6)
    add("20 Bancadas", "Bancadas de granito dos banheiros e lavabo", "m²", 3 * 1.2 * 0.55)
    add("21 Vidros", "Esquadria de alumínio com vidro temperado 8 mm, correr, piso ao teto (V1, V2)", "m²", (2.8 + 11.45) * 2.6)
    add("21 Vidros", "Porta de correr de vidro temperado (V3)", "m²", A_v3)
    add("21 Vidros", "Box de vidro temperado 8 mm", "m²", 2 * 1.5 * 1.9)
    add("21 Vidros", "Espelhos", "m²", 3 * 0.8)
    add("22 Iluminação", "Luminárias/painéis de LED de embutir", "un", ele["nL"] - 5)
    add("22 Iluminação", "Arandelas e luminárias externas", "un", 5)
    add("23 Acabamentos", "Portão basculante 6,10 × 2,40 com motor, contrapeso e sensor", "un", 1, "abre para cima; ver CP-ARQ-04")
    add("23 Acabamentos", "Portão social 1,00 × 2,40 com fechadura elétrica", "un", 1)
    add("23 Acabamentos", "Interfone / vídeo-porteiro", "un", 1)
    add("23 Acabamentos", "Pintura/textura dos muros (faces internas)", "m²", L_muro * H_MURO)
    add("23 Acabamentos", "Calçada/passeio público", "m²", 8.0 * 2.0, "largura do passeio a confirmar")
    add("24 Limpeza final", "Limpeza final e remoção de entulho", "m²", A_CONST)
    summary = dict(L_ext=L_ext, L_int=L_int, alv_ext=alv_ext, alv_int=alv_int, reb_int=reb_int, reb_ext=reb_ext,
                   az=az, A_vidro=A_vidro, P_tot=P_tot, L_muro=L_muro)
    return Q, summary


def planilha(Q, est, ele):
    wb = Workbook()
    bold = Font(bold=True)
    head_fill = PatternFill("solid", fgColor="1F3864")
    sec_fill = PatternFill("solid", fgColor="D9E1F2")

    def head(ws, cols, widths, row=1):
        for i, (c, w) in enumerate(zip(cols, widths), 1):
            cell = ws.cell(row=row, column=i, value=c)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = head_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws.column_dimensions[get_column_letter(i)].width = w

    ws = wb.active
    ws.title = "Orçamento-Quantitativos"
    ws["A1"] = "CASA PÁTIO — Cascavel/PR — Etapa 1 — Planilha de quantitativos e orçamento"
    ws["A1"].font = Font(bold=True, size=13)
    ws["A2"] = (f"Doc. CP-ORC-01 — Revisão {REV} — {DATA}. Quantidades calculadas sobre a planta aprovada "
                "(anteprojeto, precisão estimada de ±10 %). Preencher as colunas F a H com SINAPI-PR (informar mês/ano) "
                "ou cotação local; a coluna I calcula sozinha.")
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:K2")
    ws.row_dimensions[2].height = 32
    head(ws, ["Item", "Descrição", "Un.", "Quantidade", "Código SINAPI", "Material (R$/un)", "Mão de obra (R$/un)",
              "Equip./terceiros (R$/un)", "Total (R$)", "Fonte do preço (mês/ano)", "Observações técnicas"],
         [8, 70, 7, 12, 14, 14, 14, 14, 16, 22, 40], row=4)
    r = 5
    cur = None
    k = 0
    sec_rows = []
    first = None
    for etapa, d, u, q, o in Q:
        if etapa != cur:
            if cur is not None:
                sec_rows.append((sec_r, first, r - 1))
            cur = etapa
            sec_r = r
            for c in range(1, 12):
                ws.cell(row=r, column=c).fill = sec_fill
            ws.cell(row=r, column=1, value=etapa[:2]).font = bold
            ws.cell(row=r, column=2, value=etapa[3:].upper()).font = bold
            r += 1
            first = r
            k = 0
        k += 1
        ws.cell(row=r, column=1, value=f"{etapa[:2]}.{k:02d}")
        ws.cell(row=r, column=2, value=d)
        ws.cell(row=r, column=3, value=u)
        ws.cell(row=r, column=4, value=q).number_format = "#,##0.00"
        ws.cell(row=r, column=9, value=f"=D{r}*(F{r}+G{r}+H{r})").number_format = "#,##0.00"
        for c in (6, 7, 8):
            ws.cell(row=r, column=c).number_format = "#,##0.00"
        ws.cell(row=r, column=11, value=o)
        r += 1
    sec_rows.append((sec_r, first, r - 1))
    for sr, a, b in sec_rows:
        ws.cell(row=sr, column=9, value=f"=SUM(I{a}:I{b})").number_format = "#,##0.00"
        ws.cell(row=sr, column=9).font = bold
    r += 1
    sub = "+".join(f"I{sr}" for sr, _, _ in sec_rows)
    rows = [("CUSTO DIRETO", f"={sub}"), ("Custos indiretos (administração local, canteiro) — % sobre o custo direto", None),
            ("Reserva para imprevistos — % sobre o custo direto", None), ("BDI — % sobre o custo direto + indiretos", None)]
    ws.cell(row=r, column=2, value=rows[0][0]).font = bold
    ws.cell(row=r, column=9, value=rows[0][1]).number_format = "#,##0.00"
    cd = r
    for i, (lab, pct) in enumerate((("Custos indiretos (administração local, canteiro)", 0.05),
                                    ("Reserva para imprevistos", 0.05), ("BDI", 0.20)), 1):
        ws.cell(row=r + i, column=2, value=lab + " — percentual editável na coluna D")
        ws.cell(row=r + i, column=4, value=pct).number_format = "0.0%"
    ws.cell(row=r + 1, column=9, value=f"=I{cd}*D{r + 1}").number_format = "#,##0.00"
    ws.cell(row=r + 2, column=9, value=f"=I{cd}*D{r + 2}").number_format = "#,##0.00"
    ws.cell(row=r + 3, column=9, value=f"=(I{cd}+I{r + 1})*D{r + 3}").number_format = "#,##0.00"
    ws.cell(row=r + 4, column=2, value="PREÇO TOTAL DA ETAPA 1").font = bold
    ws.cell(row=r + 4, column=9, value=f"=SUM(I{cd}:I{r + 3})").number_format = "#,##0.00"
    ws.cell(row=r + 4, column=9).font = bold
    ws.cell(row=r + 5, column=2, value="Custo por m² construído (112,05 m²)")
    ws.cell(row=r + 5, column=9, value=f"=I{r + 4}/{A_CONST}").number_format = "#,##0.00"
    ws.cell(row=r + 7, column=2, value="Os percentuais de indiretos, imprevistos e BDI são valores de partida usuais, "
            "não cotações. Ajustar conforme a proposta da construtora.")
    ws.freeze_panes = "C5"

    # áreas
    wa = wb.create_sheet("Áreas")
    head(wa, ["Ambiente / grandeza", "Área (m²)", "Observação"], [58, 14, 60])
    r = 2
    for n, a in AREAS_UTEIS:
        wa.cell(row=r, column=1, value=n)
        wa.cell(row=r, column=2, value=round(a, 2)).number_format = "0.00"
        r += 1
    wa.cell(row=r, column=1, value="TOTAL ÁREA ÚTIL").font = bold
    wa.cell(row=r, column=2, value=f"=SUM(B2:B{r - 1})").number_format = "0.00"
    r += 2
    for n, a, o in [("Terreno", 200.0, "8,00 × 25,00"), ("Área construída / projeção — Etapa 1", A_CONST, "56,0 % do terreno"),
                    ("Limite de projeção com taxa de ocupação de 60 %", 120.0, "informado pelo proprietário; confirmar na Consulta Prévia"),
                    ("Saldo de projeção para a Etapa 2", 120.0 - A_CONST, "pergolado vazado ou cobertura de até 7,95 m²"),
                    ("Garagem descoberta", 44.0, "8,00 × 5,50; piso drenante"), ("Pátio central", 33.32, "2,80 × 11,90"),
                    ("Pátio do spa", 6.72, "2,80 × 2,40; só infraestrutura"), ("Muros e divisória", 3.91, ""),
                    ("Área gourmet — Etapa 2", 14.0, "2,80 × 5,00, no meio do pátio")]:
        wa.cell(row=r, column=1, value=n)
        wa.cell(row=r, column=2, value=round(a, 2)).number_format = "0.00"
        wa.cell(row=r, column=3, value=o)
        r += 1

    # quadro de cargas
    wc = wb.create_sheet("Quadro de cargas")
    head(wc, ["Nº", "Circuito", "Tensão (V)", "Potência (VA)", "Corrente (A)", "Cabo (mm²)", "Disjuntor (A)", "DR 30 mA"],
         [6, 56, 11, 13, 12, 11, 13, 10])
    for i, (n, d, v, p, cab, dj, dr) in enumerate(CIRC, 2):
        for c, val in enumerate([n, d, v, p, f"=D{i}/C{i}", cab, dj, dr], 1):
            wc.cell(row=i, column=c, value=val)
        wc.cell(row=i, column=5).number_format = "0.0"
    i = len(CIRC) + 2
    wc.cell(row=i, column=2, value="POTÊNCIA INSTALADA TOTAL").font = bold
    wc.cell(row=i, column=4, value=f"=SUM(D2:D{i - 1})").font = bold
    wc.cell(row=i + 2, column=2, value="Pré-dimensionamento conforme NBR 5410. Demanda, queda de tensão e categoria de "
            "atendimento Copel a calcular no projeto definitivo.")

    # cronograma físico
    wg = wb.create_sheet("Cronograma")
    acts = [("Projetos, sondagem, aprovação e alvará", 1, 6), ("Serviços preliminares, limpeza e locação", 7, 7),
            ("Redes enterradas de esgoto e pluvial", 8, 8), ("Fundações: estacas e baldrames", 8, 10),
            ("Impermeabilização de baldrames e aterro", 10, 11), ("Alvenaria, pilares e cintas", 11, 15),
            ("Laje do reservatório e cobertura", 16, 18), ("Instalações embutidas (elétrica e hidráulica)", 15, 19),
            ("Contrapiso", 18, 19), ("Reboco interno e externo", 19, 22), ("Impermeabilização de áreas molhadas", 22, 22),
            ("Forro de gesso", 23, 24), ("Revestimentos cerâmicos e pisos", 23, 26), ("Esquadrias e vidros", 25, 27),
            ("Pintura", 26, 29), ("Louças, metais, bancadas, elétrica final", 28, 30),
            ("Garagem, pátio, jardim e limpeza final", 29, 31), ("Vistoria final e habite-se", 31, 32)]
    head(wg, ["Atividade", "Início (sem.)", "Fim (sem.)"] + [str(s) for s in range(1, 33)], [48, 10, 10] + [3.2] * 32)
    bar = PatternFill("solid", fgColor="2E75B6")
    for i, (a, s, e) in enumerate(acts, 2):
        wg.cell(row=i, column=1, value=a)
        wg.cell(row=i, column=2, value=s)
        wg.cell(row=i, column=3, value=e)
        for w in range(s, e + 1):
            wg.cell(row=i, column=3 + w).fill = bar
    i = len(acts) + 3
    for j, t in enumerate([
        "Prazo de referência: 6 semanas de projetos e aprovação + 26 semanas de obra. Ajustar com a construtora.",
        "Pontos de inspeção: gabarito e locação (sem. 7); redes enterradas testadas antes do aterro (sem. 8); armadura dos "
        "baldrames (sem. 9); impermeabilização dos baldrames (sem. 10); prumo e esquadro da alvenaria (sem. 13); "
        "teste de estanqueidade de 72 h nos boxes (sem. 22); teste de pressão da água e de continuidade elétrica (sem. 19).",
        "Compras antecipadas: esquadrias de alumínio e vidros (encomendar na sem. 16), telha termoacústica (sem. 13), "
        "portas (sem. 20), porcelanato de um único lote (sem. 20).",
        "Marcos de pagamento sugeridos (medição por etapa concluída): fundações; alvenaria e estrutura; cobertura; "
        "instalações e reboco; revestimentos; entrega.",
    ]):
        wg.cell(row=i + j, column=1, value=t)
    wg.freeze_panes = "D2"
    wb.save(os.path.join(DOCS, f"CP-ORC-01_quantitativos-orcamento_{REV}.xlsx"))


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(DOCS, exist_ok=True)
    arq(1)
    arq(2)
    arq03()
    arq04()
    est = est01()
    ele = ele01()
    hid01()
    Q, s = quantitativos(est, ele)
    planilha(Q, est, ele)
    print("pilares", est["n"], "baldrame", round(est["lb"], 2))
    print({k: round(v, 2) for k, v in est.items()})
    print({k: round(v, 2) for k, v in s.items()})
    print(ele, "itens", len(Q))


if __name__ == "__main__":
    main()
