"""Casa Pátio — PROPOSTA V3 para aprovação.

Corredor lateral de 0,90 m, dois quartos (suíte + quarto 02) abrindo para o pátio, sala e cozinha ampliadas
com pé-direito alto. Gera uma prancha em ../plantas/.
Coordenadas em metros: x = largura (0 a 8), y = profundidade (0 = rua, 25 = fundos).
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from planta_fase2 import br, rect, dim_chain

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plantas")
REV = "P1"
DATA = "16/11/2026"

WALLS = [
    (1.10, 5.50, 1.30, 25.00), (1.10, 5.50, 8.00, 5.70), (7.80, 5.50, 8.00, 12.70), (1.10, 24.80, 5.90, 25.00),
    (2.40, 12.55, 5.90, 12.70), (5.90, 12.55, 7.80, 12.70), (2.40, 12.70, 2.55, 21.05), (5.75, 12.70, 5.90, 24.80),
    (2.55, 14.20, 5.75, 14.35), (2.55, 17.55, 5.75, 17.70), (2.55, 19.30, 5.75, 19.45), (1.30, 21.05, 5.75, 21.20),
    (5.20, 5.70, 5.35, 7.35), (5.35, 7.20, 7.80, 7.35),
]
MUROS = [(0, 0, 0.20, 25), (7.80, 0, 8, 5.5), (7.80, 12.7, 8, 25), (0.20, 24.80, 1.10, 25), (5.90, 24.80, 7.80, 25),
         (5.90, 22.25, 7.80, 22.40)]
OPEN = [
    (4.20, 5.50, 5.10, 5.70, "door", "P1"), (1.60, 5.50, 4.00, 5.70, "win", "J1"), (6.00, 5.50, 7.40, 5.70, "win", "J2"),
    (5.55, 7.20, 6.35, 7.35, "door", "P2"), (5.90, 12.55, 7.80, 12.70, "glass", "V1"),
    (2.40, 12.95, 2.55, 13.75, "doorR", "P2"), (2.40, 14.50, 2.55, 15.30, "doorR", "P2"),
    (5.75, 12.95, 5.90, 13.95, "win", "J5"), (5.75, 14.75, 5.90, 17.15, "glass", "V4"), (5.75, 18.00, 5.90, 19.00, "win", "J5"),
    (5.75, 19.95, 5.90, 20.55, "win", "J6"), (5.75, 21.35, 5.90, 22.15, "win", "J3"), (5.75, 22.60, 5.90, 24.40, "glass", "V3"),
    (3.75, 19.30, 4.55, 19.45, "door", "P2"), (3.75, 21.05, 4.55, 21.20, "door", "P3"), (1.45, 21.05, 2.25, 21.20, "door", "P2"),
    (1.10, 13.60, 1.30, 15.60, "block", "TV"), (1.10, 17.00, 1.30, 19.00, "block", "TV"), (1.10, 22.30, 1.30, 23.90, "block", "TV"),
    (6.10, 22.25, 6.90, 22.40, "void", ""),
]
A_SOCIAL = 6.50 * 6.85 - 2.60 * 1.65 + 1e-6
ROOMS = [  # (x, y, nome, largura, profundidade, área)
    (3.2, 9.6, "ESTAR / JANTAR / COZINHA", 6.50, 6.85, A_SOCIAL),
    (6.45, 6.75, "LAVANDERIA", 2.45, 1.50, 2.45 * 1.50),
    (3.9, 13.75, "BANHO SOCIAL", 3.20, 1.50, 4.80),
    (4.3, 15.05, "QUARTO 02", 3.20, 3.20, 10.24),
    (4.6, 18.85, "BANHO SUÍTE", 3.20, 1.60, 5.12),
    (4.15, 20.55, "CLOSET", 3.20, 1.60, 5.12),
    (3.5, 22.15, "SUÍTE MASTER", 4.45, 3.60, 16.02),
]
A_CORR = 1.10 * 8.35
A_UTIL = sum(r[5] for r in ROOMS) + A_CORR
A_CONST = 6.90 * 7.20 + 4.80 * 12.30
FURN = [
    (2.75, 22.80, 4.35, 24.80), (2.30, 24.40, 2.75, 24.80), (4.35, 24.40, 4.80, 24.80), (1.45, 23.90, 2.05, 24.50),
    (2.55, 19.45, 3.10, 21.05), (5.20, 19.45, 5.75, 21.05),
    (2.55, 17.70, 3.55, 19.30), (3.70, 17.70, 4.10, 18.35), (4.30, 17.70, 5.70, 18.20),
    (3.45, 14.35, 5.65, 14.90), (3.35, 15.55, 4.95, 17.55), (2.90, 17.15, 3.35, 17.55), (4.95, 17.15, 5.40, 17.55),
    (4.75, 12.70, 5.75, 14.20), (2.95, 12.70, 3.35, 13.35), (3.60, 12.70, 4.60, 13.18),
    (1.30, 6.70, 1.75, 8.90), (3.35, 6.50, 4.30, 9.00), (2.30, 7.20, 2.90, 8.30), (1.50, 9.50, 2.25, 10.20),
    (3.00, 10.20, 3.90, 12.00), (2.56, 10.3, 2.96, 11.9), (3.94, 10.3, 4.34, 11.9),
    (7.20, 7.35, 7.80, 11.30), (7.12, 11.30, 7.80, 11.98), (5.45, 8.40, 6.25, 10.60), (4.95, 8.60, 5.30, 10.40),
    (7.20, 5.75, 7.80, 6.35), (7.20, 6.45, 7.80, 7.00), (5.90, 5.70, 7.10, 6.15),
    (7.25, 13.40, 7.80, 16.15), (6.05, 13.60, 6.65, 15.60),
]
CLEAR = [
    (0.20, 9.0, 1.10, 9.0, "0,90"), (1.30, 16.4, 2.40, 16.4, "1,10"), (5.90, 18.6, 7.80, 18.6, "1,90"),
    (2.55, 16.5, 3.35, 16.5, "0,80"), (4.95, 16.5, 5.75, 16.5, "0,80"), (4.2, 14.90, 4.2, 15.55, "0,65"),
    (1.30, 23.6, 2.75, 23.6, "1,45"), (4.35, 23.6, 5.75, 23.6, "1,40"), (3.5, 21.20, 3.5, 22.80, "1,60"),
    (3.10, 20.6, 5.20, 20.6, "2,10"), (1.75, 7.8, 3.35, 7.8, "1,60"), (4.30, 7.6, 5.20, 7.6, "0,90"),
    (6.25, 9.5, 7.20, 9.5, "0,95"), (4.34, 11.4, 4.95, 11.4, "0,61"), (1.30, 11.2, 2.56, 11.2, "1,26"),
    (3.60, 3.0, 5.55, 3.0, "1,95"), (3.55, 13.8, 4.75, 13.8, "1,20"),
]


def planta(ax):
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.6, ls=(0, (6, 3)))
    rect(ax, (0.20, 0, 7.80, 5.50), fc="#eeeeee", ec="none")
    rect(ax, (0.20, 5.50, 1.10, 24.80), fc="#f3ead7", ec="none")
    rect(ax, (5.90, 12.70, 7.80, 22.25), fc="#dcebd2", ec="none")
    rect(ax, (5.90, 12.70, 7.80, 16.20), fc="#efe2c8", ec="none")
    rect(ax, (5.90, 22.40, 7.80, 24.80), fc="#e8dcc8", ec="none")
    for w in MUROS:
        rect(ax, w, fc="#8a8a8a", ec="none")
    for w in WALLS:
        rect(ax, w, fc="#3a3a3a", ec="none")
    for x0, y0, x1, y1, kind, tag in OPEN:
        horiz = (x1 - x0) > (y1 - y0)
        if kind == "block":
            rect(ax, (x0, y0, x1, y1), fc="#bfe3e6", ec="#3a3a3a", lw=0.4, hatch="++")
        else:
            rect(ax, (x0, y0, x1, y1), fc="white", ec="none")
        if kind in ("win", "glass"):
            lw = 1.7 if kind == "glass" else 1.1
            if horiz:
                ax.plot([x0, x1], [(y0 + y1) / 2] * 2, color="#2f8fd0", lw=lw)
            else:
                ax.plot([(x0 + x1) / 2] * 2, [y0, y1], color="#2f8fd0", lw=lw)
        elif kind == "door":
            if horiz:
                ax.plot([x0, x0], [y1, y1 + (x1 - x0)], color="k", lw=0.5)
            else:
                ax.plot([x0, x0 - (y1 - y0)], [y0, y0], color="k", lw=0.5)
        elif kind == "doorR":
            ax.plot([x1, x1 + (y1 - y0)], [y0, y0], color="k", lw=0.5)
        if tag:
            if horiz:
                ax.text((x0 + x1) / 2, y0 - 0.12, tag, fontsize=4, ha="center", va="top", color="#b00000")
            else:
                ax.text(x1 + 0.08 if x0 > 3 else x0 - 0.08, (y0 + y1) / 2, tag, fontsize=4, ha="left" if x0 > 3 else "right",
                        va="center", color="#b00000")
    for f in FURN:
        rect(ax, f, fill=False, ec="#9a9a9a", lw=0.35)
    for cx, cy, name, w, d, a in ROOMS:
        ax.text(cx, cy, f"{name}\n{br(w)} × {br(d)}\n{br(a)} m²", fontsize=4.5, ha="center", va="center", linespacing=1.25,
                bbox=dict(fc="white", ec="none", pad=0.3, alpha=0.75))
    ax.text(1.85, 17.6, f"CORREDOR INTERNO  1,10 × 8,35 = {br(A_CORR)} m²", fontsize=4.3, rotation=90, ha="center", va="center")
    ax.text(0.65, 15.0, "CORREDOR LATERAL DESCOBERTO  0,90 × 19,30", fontsize=4.3, rotation=90, ha="center", va="center")
    ax.text(6.85, 19.6, "JARDIM\n1,90 × 6,05", fontsize=4.5, ha="center", va="center")
    ax.text(6.55, 16.45, "GOURMET 1,90 × 3,50", fontsize=4.2, ha="center", va="center", color="#7d5029")
    ax.text(6.85, 23.6, "SPA\n1,90 × 2,40", fontsize=4.5, ha="center", va="center")
    ax.text(4.5, 1.2, "GARAGEM DESCOBERTA  7,60 × 5,50", fontsize=4.5, ha="center", va="center")
    for x0 in (1.75, 5.55):
        rect(ax, (x0, 0.45, x0 + 1.85, 5.35), fill=False, ec="#777777", lw=0.5, ls="--")
    for x0, x1 in ((0, 0.20), (1.10, 1.30), (7.80, 8.00)):
        rect(ax, (x0, 0, x1, 0.30), fc="#2f3133", ec="none")
    ax.plot([1.30, 7.80], [0.15, 0.15], color="#2f3133", lw=2.2)
    ax.plot([0.20, 1.10], [0.15, 0.15], color="#7d5029", lw=2.2)
    ax.text(0.65, -0.25, "social\n0,90", fontsize=3.6, ha="center", va="top", color="#7d5029")
    ax.text(4.55, -0.25, "portão basculante 6,50", fontsize=3.8, ha="center", va="top")
    for x0, y0, x1, y1, lab in CLEAR:
        ax.annotate("", xy=(x1, y1), xytext=(x0, y0), arrowprops=dict(arrowstyle="<->", color="#b00000", lw=0.6, shrinkA=0,
                                                                     shrinkB=0, mutation_scale=4))
        horiz = abs(x1 - x0) > abs(y1 - y0)
        ax.text((x0 + x1) / 2 + (0 if horiz else 0.07), (y0 + y1) / 2 + (0.07 if horiz else 0), lab, fontsize=3.8, color="#b00000",
                ha="center" if horiz else "left", va="bottom" if horiz else "center", fontweight="bold")
    ys = [0, 5.50, 5.70, 12.55, 12.70, 14.20, 14.35, 17.55, 17.70, 19.30, 19.45, 21.05, 21.20, 24.80, 25.00]
    dim_chain(ax, ys, -0.45, True)
    dim_chain(ax, [0, 25.00], -1.25, True, fs=6)
    dim_chain(ax, [0, 0.20, 1.10, 1.30, 2.40, 2.55, 5.75, 5.90, 7.80, 8.00], -0.95, False, min_label=0.8)
    dim_chain(ax, [0, 8.00], -1.55, False, fs=6)
    dim_chain(ax, [5.50, 5.70, 7.20, 7.35, 12.55, 12.70, 16.20, 22.25, 22.40, 24.80, 25.00], 8.75, True, fs=4.4)
    ax.text(4.0, -2.1, "RUA  (testada 8,00 m)", fontsize=5.5, ha="center", va="center")
    ax.set_xlim(-1.9, 9.3); ax.set_ylim(-2.3, 25.7); ax.set_aspect("equal"); ax.axis("off")
    ax.text(3.7, 25.3, "PLANTA TÉRREA COTADA — V3", fontsize=8, fontweight="bold", ha="center")


def main():
    PW, PH = 42.0, 29.7
    fig = plt.figure(figsize=(PW / 2.54, PH / 2.54))
    ax = fig.add_axes([0.8 / PW, 0.5 / PH, 11.2 / PW, 28.0 / PH]); planta(ax)
    tx = fig.add_axes([12.8 / PW, 0.5 / PH, 28.6 / PW, 28.6 / PH]); tx.axis("off"); tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    tx.text(0, 0.985, "CASA PÁTIO — Cascavel/PR", fontsize=13, fontweight="bold", va="top")
    tx.text(0, 0.95, "PROPOSTA V3 PARA APROVAÇÃO", fontsize=10, fontweight="bold", va="top", color="#b00000")
    tx.text(0, 0.925, "Corredor lateral de 0,90 m, sem o quarto 03, sala e cozinha ampliadas, quartos abrindo para o pátio. "
            "Números vermelhos: passagem livre em metros.", fontsize=7, va="top")

    def grid(title, cols, xs, rows, y, x0=0.0, fs=5.9):
        tx.text(x0, y, title, fontsize=8, fontweight="bold", va="top"); y -= 0.022
        for c, x in zip(cols, xs):
            tx.text(x0 + x, y, c, fontsize=fs, fontweight="bold", va="top")
        y -= 0.016
        for r in rows:
            color = {"ok": "#1d6b2f", "at": "#a05a00", "no": "#b00000"}.get(r[-1], "k")
            for i, (c, x) in enumerate(zip(r[:-1], xs)):
                last = i == len(r) - 2 and r[-1]
                tx.text(x0 + x, y, c, fontsize=fs, va="top", color=color if last else "k", fontweight="bold" if last else "normal")
            tx.plot([x0, x0 + xs[-1] + 0.16], [y - 0.0128, y - 0.0128], color="#cccccc", lw=0.3); y -= 0.0150
        return y - 0.007

    v2 = {"ESTAR / JANTAR / COZINHA": "26,55", "LAVANDERIA": "3,00", "BANHO SOCIAL": "4,05", "QUARTO 02": "8,10",
          "BANHO SUÍTE": "4,05", "CLOSET": "4,05", "SUÍTE MASTER": "12,00"}
    amb = [(n.title(), f"{br(w)} × {br(d)}", br(a) + " m²", v2[n] + " m²", "4,30" if n.startswith("ESTAR") else "2,80", "")
           for _, _, n, w, d, a in ROOMS]
    amb += [("Corredor Interno", "1,10 × 8,35", br(A_CORR) + " m²", "10,13 m²", "2,80", ""),
            ("Quarto 03", "retirado", "—", "8,10 m²", "", ""),
            ("TOTAL ÁREA ÚTIL", "", br(A_UTIL) + " m²", "80,03 m²", "", ""),
            ("Área construída (projeção)", "", br(A_CONST) + " m²", "94,50 m²", "", ""),
            ("Taxa de ocupação (limite 60 %)", "", br(A_CONST / 2, 1) + " %", "47,2 %", "", "")]
    y1 = grid("MEDIDAS DOS AMBIENTES", ["Ambiente", "Largura × profund.", "Área V3", "Antes (V2)", "Pé-direito"],
              [0, 0.16, 0.27, 0.35, 0.43], amb, 0.89)
    esq = [("P1", "Porta de entrada", "0,90 × 2,10", ""), ("P2", "Quartos, banheiros, lavanderia", "0,80 × 2,10", ""),
           ("P3", "Closet (pela suíte)", "0,70 × 2,10", ""), ("J1", "Janela do estar (frente)", "2,40 × 1,50", ""),
           ("J2", "Janela da lavanderia (frente)", "1,40 × 1,00", ""), ("J3", "Janela da suíte (pátio)", "0,80 × 1,20", ""),
           ("J5", "Janela alta dos banheiros (pátio)", "1,00 × 0,60", ""), ("J6", "Janela alta do closet (pátio)", "0,60 × 0,60", ""),
           ("V1", "Vidro de correr cozinha / gourmet", "1,90 × 2,60", ""), ("V3", "Porta de vidro suíte / spa", "1,80 × 2,60", ""),
           ("V4", "Porta de vidro quarto 02 / jardim", "2,40 × 2,60", ""), ("FA", "Faixa alta da sala: vidro frente e fundo", "13,40 × 0,70", ""),
           ("TV", "Tijolo de vidro fixo (corredor, suíte, faixa lateral)", "ver planta", "")]
    grid("PORTAS, JANELAS E VIDROS", ["Cód.", "Local", "Largura × altura"], [0, 0.04, 0.27], esq, 0.89, x0=0.60)
    an = [("Sala, jantar e cozinha", "40,24 m², 6,50 m de largura", "Sofá a 1,60 m do rack, ilha com 0,95 m de corredor, passagem de 0,90 m.", "AMPLA", "ok"),
          ("Quarto 02", "3,20 × 3,20 m", "Cama queen com 0,80 m dos dois lados. Porta de vidro para o jardim.", "BOM", "ok"),
          ("Suíte master", "4,45 × 3,60 m", "1,40 m livres de cada lado e 1,60 m no pé da cama.", "AMPLA", "ok"),
          ("Closet", "2,10 m entre armários", "Largo. Cabe um banco ou ilha baixa no meio.", "AMPLO", "ok"),
          ("Corredor interno", "1,10 m × 8,35 m", "Duas pessoas se cruzam de lado. Mais curto e mais largo que antes.", "BOM", "ok"),
          ("Mesa de jantar", "0,61 m até as banquetas", "Passagem justa entre a mesa e a ilha quando as cadeiras estão ocupadas.", "JUSTA", "at"),
          ("Área gourmet", "1,90 m de largura", "Bancada de um lado, mesa estreita e banco. Só senta de um lado.", "APERTADA", "no"),
          ("Corredor lateral", "0,90 m", "Passa uma pessoa. NÃO PODE TER JANELA: fica a menos de 1,50 m da divisa.", "SÓ PASSAGEM", "at"),
          ("Ventilação da sala", "frente + pátio + faixa alta", "Cruzada: janela da frente, porta de vidro para o gourmet e painéis altos.", "MUITO BOA", "ok"),
          ("Ventilação dos quartos", "direto para o pátio", "Portas e janelas de vidro abrem para o jardim, a 1,90 m da divisa (legal).", "BOA", "ok"),
          ("Ventilação dos banheiros", "janela alta para o pátio", "Os dois banheiros e o closet têm janela para fora.", "BOA", "ok"),
          ("Garagem", "7,60 × 5,50 m", "Dois carros com 1,95 m de passagem no meio.", "AMPLA", "ok")]
    y2 = grid("ANÁLISE DE ESPAÇO E VENTILAÇÃO", ["Local", "Medida", "Avaliação", "Situação"], [0, 0.13, 0.30, 0.74], an, y1 - 0.004)
    notes = (
        "O QUE MUDOU A SEU PEDIDO\n"
        "1. Corredor lateral de 1,50 para 0,90 m. Os 0,60 m foram para dentro da casa.\n"
        "2. Corredor interno de 0,90 para 1,10 m, e mais curto (8,35 m em vez de 11,25 m).\n"
        "3. Quarto 03 retirado. O espaço foi para a sala e cozinha (de 26,55 para 40,24 m²), para o quarto 02 (de 8,10 para 10,24 m²) e para a suíte (de 12,00 para 16,02 m²).\n"
        "4. Pátio de 2,00 para 1,90 m de largura e área gourmet menor (3,50 m), agora encostada na cozinha, com porta de vidro direta.\n"
        "5. Vidros refeitos: caixilhos finos, menos divisões, porta de vidro do piso ao teto no quarto 02 e faixa alta só onde a lei permite.\n"
        "\n"
        "O QUE EU MUDEI POR CONTA PRÓPRIA, E POR QUÊ\n"
        "A. Com 0,90 m o corredor lateral não pode ter janela (Código Civil, art. 1.301: mínimo de 1,50 m da divisa). Por isso inverti a ala íntima: o corredor\n"
        "    interno ficou do lado esquerdo e os quartos passaram para o lado do pátio, onde podem ter janelas e portas de vidro de verdade.\n"
        "B. No lado do corredor lateral usei tijolo de vidro fixo e translúcido, que traz luz sem ser janela. Há entendimento do STF (Súmula 120) de que\n"
        "    ele pode ficar a menos de 1,50 m da divisa; confirme com o arquiteto e a Prefeitura.\n"
        "C. A lavanderia voltou para a frente, ao lado da cozinha, com janela para a garagem. Assim a cozinha abre direto para o pátio.\n"
        "\n"
        "PONTO PARA VOCÊ DECIDIR\n"
        "O corredor lateral de 0,90 m virou uma passagem sem saída: não tem janela, não dá acesso ao pátio e ocupa 1,10 m da largura do terreno.\n"
        "Se ele for eliminado, a casa encosta na divisa esquerda e o pátio pode passar de 1,90 para 3,00 m, o que resolve a área gourmet apertada.\n"
        "Mantive o corredor porque você pediu; me diga se prefere a versão sem ele."
    )
    tx.text(0, y2 - 0.002, notes, fontsize=5.7, va="top", linespacing=1.32)
    tx.text(0, 0.0, f"Doc. CP-ARQ-V3   |   Revisão {REV} — {DATA}   |   Escala 1:100 (folha A3)   |   Unidade: metro   |   "
            "Estudo para aprovação do proprietário", fontsize=6, va="bottom", fontweight="bold")
    for ext, kw in (("pdf", {}), ("png", {"dpi": 200})):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-V3_proposta_{REV}.{ext}"), **kw)
    print("util", round(A_UTIL, 2), "social", round(A_SOCIAL, 2), "const", round(A_CONST, 2), "TO", round(A_CONST / 2, 1))


if __name__ == "__main__":
    main()
