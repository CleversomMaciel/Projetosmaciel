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
REV = "P4"
DATA = "16/11/2026"

WALLS = [
    (0, 5.50, 0.20, 25.00), (0, 5.50, 8.00, 5.70), (7.80, 5.50, 8.00, 12.70), (0, 24.80, 4.80, 25.00),
    (0.20, 12.55, 3.55, 12.70), (4.65, 12.55, 7.80, 12.70), (3.40, 12.70, 3.55, 21.05), (4.65, 12.70, 4.80, 24.80),
    (0.20, 14.20, 3.40, 14.35), (0.20, 17.55, 3.40, 17.70), (0.20, 19.30, 3.40, 19.45), (0.20, 21.05, 4.65, 21.20),
    (5.20, 5.70, 5.35, 7.35), (5.35, 7.20, 7.80, 7.35),
]
MUROS = [(0, 0, 0.20, 5.5), (7.80, 0, 8, 5.5), (7.80, 12.7, 8, 25), (4.80, 24.80, 7.80, 25)]
OPEN = [
    (4.20, 5.50, 5.10, 5.70, "door", "P1"), (1.00, 5.50, 3.40, 5.70, "win", "J1"), (6.00, 5.50, 7.40, 5.70, "win", "J2"),
    (5.55, 7.20, 6.35, 7.35, "door", "P2"), (4.80, 12.55, 7.80, 12.70, "glass", "V1"),
    (3.40, 12.95, 3.55, 13.75, "door", "P2"), (3.40, 14.50, 3.55, 15.30, "door", "P2"), (3.40, 15.75, 3.55, 17.35, "win", "J4"),
    (4.65, 12.70, 4.80, 21.05, "glass", "V2"), (4.65, 21.35, 4.80, 22.15, "win", "J3"), (4.65, 22.60, 4.80, 24.40, "glass", "V3"),
    (1.40, 19.30, 2.20, 19.45, "door", "P2"), (1.40, 21.05, 2.20, 21.20, "door", "P3"), (3.70, 21.05, 4.50, 21.20, "door", "P2"),
]
A_SOCIAL = 7.60 * 6.85 - 2.60 * 1.65
ROOMS = [  # (x, y, nome, largura, profundidade, área)
    (3.3, 9.6, "ESTAR / JANTAR / COZINHA", 7.60, 6.85, A_SOCIAL),
    (6.45, 6.75, "LAVANDERIA", 2.45, 1.50, 2.45 * 1.50),
    (1.8, 13.75, "BANHO SOCIAL", 3.20, 1.50, 4.80),
    (1.8, 15.2, "QUARTO 02", 3.20, 3.20, 10.24),
    (1.8, 18.85, "BANHO SUÍTE", 3.20, 1.60, 5.12),
    (1.8, 20.55, "CLOSET", 3.20, 1.60, 5.12),
    (2.4, 22.15, "SUÍTE MASTER", 4.45, 3.60, 16.02),
]
A_CORR = 1.10 * 8.35
A_UTIL = sum(r[5] for r in ROOMS) + A_CORR
A_CONST = 8.00 * 7.20 + 4.80 * 12.30
FURN = [
    (1.65, 22.80, 3.25, 24.80), (1.20, 24.40, 1.65, 24.80), (3.25, 24.40, 3.70, 24.80), (0.35, 23.90, 0.95, 24.50),
    (0.20, 19.45, 0.75, 21.05), (2.85, 19.45, 3.40, 21.05),
    (2.40, 17.70, 3.40, 19.30), (1.85, 17.70, 2.25, 18.35), (0.25, 17.70, 1.65, 18.20),
    (0.30, 14.35, 2.50, 14.90), (1.00, 15.55, 2.60, 17.55), (0.55, 17.15, 1.00, 17.55), (2.60, 17.15, 3.05, 17.55),
    (0.20, 12.70, 1.20, 14.20), (2.60, 12.70, 3.00, 13.35), (1.35, 12.70, 2.35, 13.18),
    (0.20, 6.70, 0.65, 8.90), (2.60, 6.50, 3.55, 9.00), (1.50, 7.20, 2.10, 8.30),
    (1.60, 10.20, 2.50, 12.00), (1.16, 10.3, 1.56, 11.9), (2.54, 10.3, 2.94, 11.9),
    (7.20, 7.35, 7.80, 11.30), (7.12, 11.30, 7.80, 11.98), (5.45, 8.40, 6.25, 10.60), (4.95, 8.60, 5.30, 10.40),
    (7.20, 5.75, 7.80, 6.35), (7.20, 6.45, 7.80, 7.00), (5.90, 5.70, 7.10, 6.15),
    (7.25, 13.30, 7.80, 16.50), (5.55, 13.70, 6.45, 15.70), (5.60, 22.80, 7.60, 24.60), (5.10, 13.85, 5.50, 15.55), (6.50, 13.85, 6.90, 15.55),
]
CLEAR = [
    (3.55, 16.4, 4.65, 16.4, "1,10"), (4.80, 18.6, 7.80, 18.6, "3,00"),
    (0.20, 16.5, 1.00, 16.5, "0,80"), (2.60, 16.5, 3.40, 16.5, "0,80"), (1.8, 14.90, 1.8, 15.55, "0,65"),
    (0.20, 23.6, 1.65, 23.6, "1,45"), (3.25, 23.6, 4.65, 23.6, "1,40"), (2.4, 21.20, 2.4, 22.80, "1,60"),
    (0.75, 20.75, 2.85, 20.75, "2,10"), (0.65, 7.8, 2.60, 7.8, "1,95"), (3.55, 7.6, 4.95, 7.6, "1,40"),
    (6.25, 9.5, 7.20, 9.5, "0,95"), (2.94, 10.9, 4.95, 10.9, "2,01"), (3.75, 3.0, 5.60, 3.0, "1,85"), (4.80, 23.2, 5.60, 23.2, "0,80"),
    (6.90, 14.7, 7.25, 14.7, "0,35"), (4.80, 14.3, 5.10, 14.3, "0,30"),
]


def planta(ax):
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.6, ls=(0, (6, 3)))
    rect(ax, (0.20, 0, 7.80, 5.50), fc="#eeeeee", ec="none")
    rect(ax, (4.80, 12.70, 7.80, 22.25), fc="#dcebd2", ec="none")
    rect(ax, (4.80, 12.70, 7.80, 16.70), fc="#efe2c8", ec="none")
    rect(ax, (4.80, 22.40, 7.80, 24.80), fc="#e8dcc8", ec="none")
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
    ax.text(4.1, 16.9, f"CORREDOR INTERNO  1,10 × 8,35 = {br(A_CORR)} m²", fontsize=4.3, rotation=90, ha="center", va="center")
    ax.text(6.3, 19.9, "JARDIM\n3,00 × 5,55", fontsize=4.5, ha="center", va="center")
    ax.text(6.3, 16.95, "ÁREA GOURMET 3,00 × 4,00", fontsize=4.2, ha="center", va="center", color="#7d5029")
    ax.text(6.6, 23.7, "JACUZZI\n2,00 × 1,80\nsob pergolado", fontsize=4.5, ha="center", va="center")
    ax.text(4.5, 1.2, "GARAGEM DESCOBERTA  7,60 × 5,50", fontsize=4.5, ha="center", va="center")
    for x0 in (1.9, 5.6):
        rect(ax, (x0, 0.45, x0 + 1.85, 5.35), fill=False, ec="#777777", lw=0.5, ls="--")
    for x0, x1 in ((0, 0.20), (1.20, 1.40), (7.80, 8.00)):
        rect(ax, (x0, 0, x1, 0.30), fc="#2f3133", ec="none")
    ax.plot([1.40, 7.80], [0.15, 0.15], color="#2f3133", lw=2.2)
    ax.plot([0.20, 1.20], [0.15, 0.15], color="#7d5029", lw=2.2)
    ax.text(0.7, -0.25, "social\n1,00", fontsize=3.6, ha="center", va="top", color="#7d5029")
    ax.text(4.55, -0.25, "portão basculante 6,40", fontsize=3.8, ha="center", va="top")
    for x0, y0, x1, y1, lab in CLEAR:
        ax.annotate("", xy=(x1, y1), xytext=(x0, y0), arrowprops=dict(arrowstyle="<->", color="#b00000", lw=0.6, shrinkA=0,
                                                                     shrinkB=0, mutation_scale=4))
        horiz = abs(x1 - x0) > abs(y1 - y0)
        ax.text((x0 + x1) / 2 + (0 if horiz else 0.07), (y0 + y1) / 2 + (0.07 if horiz else 0), lab, fontsize=3.8, color="#b00000",
                ha="center" if horiz else "left", va="bottom" if horiz else "center", fontweight="bold")
    ys = [0, 5.50, 5.70, 12.55, 12.70, 14.20, 14.35, 17.55, 17.70, 19.30, 19.45, 21.05, 21.20, 24.80, 25.00]
    dim_chain(ax, ys, -0.45, True)
    dim_chain(ax, [0, 25.00], -1.25, True, fs=6)
    dim_chain(ax, [0, 0.20, 3.40, 3.55, 4.65, 4.80, 7.80, 8.00], -0.95, False, min_label=0.8)
    dim_chain(ax, [0, 8.00], -1.55, False, fs=6)
    dim_chain(ax, [5.50, 5.70, 7.20, 7.35, 12.55, 12.70, 16.70, 22.25, 22.40, 24.80, 25.00], 8.75, True, fs=4.4)
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
    tx.text(0, 0.925, "Sem corredor lateral: pátio com 3,00 m de largura. Quartos à esquerda e corredor envidraçado entre eles e o pátio. "
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
    amb = [(n.title(), f"{br(w)} × {br(d)}", br(a) + " m²", v2[n] + " m²", "4,30" if n.startswith("ESTAR") else ("2,80" if n in ("SUÍTE MASTER", "LAVANDERIA") else "3,45"), "")
           for _, _, n, w, d, a in ROOMS]
    amb += [("Corredor Interno", "1,10 × 8,35", br(A_CORR) + " m²", "10,13 m²", "2,80", ""),
            ("Quarto 03", "retirado", "—", "8,10 m²", "", ""),
            ("TOTAL ÁREA ÚTIL", "", br(A_UTIL) + " m²", "80,03 m²", "", ""),
            ("Pátio (gourmet + jardim)", "3,00 × 9,55", "28,65 m²", "20,50 m²", "", ""),
            ("Área construída (projeção)", "", br(A_CONST) + " m²", "94,50 m²", "", ""),
            ("Taxa de ocupação (limite 60 %)", "", br(A_CONST / 2, 1) + " %", "47,2 %", "", "")]
    y1 = grid("MEDIDAS DOS AMBIENTES", ["Ambiente", "Largura × profund.", "Área V3", "Antes (V2)", "Pé-direito"],
              [0, 0.16, 0.27, 0.35, 0.43], amb, 0.89)
    esq = [("P1", "Porta de entrada", "0,90 × 2,10", ""), ("P2", "Quartos, banheiros, lavanderia", "0,80 × 2,10", ""),
           ("P3", "Closet (pela suíte)", "0,70 × 2,10", ""), ("J1", "Janela do estar (frente)", "2,40 × 1,50", ""),
           ("J2", "Janela da lavanderia (frente)", "1,40 × 1,00", ""), ("J3", "Janela da suíte (pátio)", "0,80 × 1,20", ""),
           ("J4", "Janela do quarto 02 para o corredor de vidro", "1,60 × 1,20", ""),
           ("V1", "Vidro de correr cozinha / gourmet", "3,00 × 2,60", ""), ("V2", "Vidro do corredor / pátio, piso ao teto", "8,35 × 2,60", ""),
           ("V3", "Porta de vidro suíte / spa", "1,80 × 2,60", ""), ("FA", "Faixa alta da sala: vidro frente e fundo", "15,60 × 0,70", ""),
           ("FQ", "Faixa alta dos quartos e banheiros, que abre", "7,90 × 0,40", "")]
    grid("PORTAS, JANELAS E VIDROS", ["Cód.", "Local", "Largura × altura"], [0, 0.04, 0.27], esq, 0.89, x0=0.60)
    an = [("Spa com pergolado", "deck de 3,00 × 2,40 m", "Jacuzzi de 2,00 × 1,80 com 0,80 m de chegada pela suíte. Pergolado vazado.", "CABE BEM", "ok"),
          ("Pátio", "3,00 m de largura", "Antes 1,90 m. Cabe mesa de seis com cadeiras dos dois lados, bancada e churrasqueira.", "BOM", "ok"),
          ("Área gourmet", "3,00 × 4,00 m", "Sobra 0,30 a 0,35 m atrás das cadeiras: senta-se bem, mas não se passa por trás.", "FUNCIONA", "ok"),
          ("Sala, jantar e cozinha", "47,77 m², 7,60 m de largura", "Sofá a 1,95 m do rack, 1,40 m de passagem, ilha com 0,95 m de corredor.", "AMPLA", "ok"),
          ("Quarto 02", "3,20 × 3,20 m", "Cama queen com 0,80 m dos dois lados e 0,65 m até o guarda-roupa.", "BOM", "ok"),
          ("Suíte master", "4,45 × 3,60 m", "1,40 m livres de cada lado e 1,60 m no pé da cama.", "AMPLA", "ok"),
          ("Corredor interno", "1,10 m × 8,35 m", "Todo envidraçado para o jardim, com porta de correr para o pátio.", "BOM", "ok"),
          ("Ventilação da sala", "frente + pátio + faixa alta", "Cruzada: janela da frente, 3,00 m de vidro para o gourmet e painéis altos.", "MUITO BOA", "ok"),
          ("Luz e ar do quarto 02", "janela interna + faixa alta", "Vê o jardim através do corredor de vidro. O ar sai pela faixa alta que abre.", "ATENDE", "at"),
          ("Luz e ar da suíte", "janela e porta de vidro", "Abre direto para o jardim e para o deck do spa.", "BOA", "ok"),
          ("Banheiros e closet", "faixa alta que abre", "Ventilam por cima. Recomendo exaustor nos dois banheiros.", "ATENDE", "at"),
          ("Taxa de ocupação", "58,3 % de 60 %", "Sobram só 3,36 m² de cobertura. O pergolado do gourmet precisa ser vazado.", "NO LIMITE", "at"),
          ("Garagem", "7,60 × 5,50 m", "Dois carros com 1,85 m de passagem no meio.", "AMPLA", "ok")]
    y2 = grid("ANÁLISE DE ESPAÇO E VENTILAÇÃO", ["Local", "Medida", "Avaliação", "Situação"], [0, 0.13, 0.30, 0.74], an, y1 - 0.004)
    notes = (
        "O QUE MUDEI PARA O PÁTIO CRESCER\n"
        "1. Tirei o corredor lateral de 0,90 m. Ele e a parede ocupavam 1,10 m da largura, não podiam ter janela e não davam acesso ao pátio.\n"
        "2. A casa encostou na divisa esquerda e toda essa largura foi para o pátio, que passou de 1,90 para 3,00 m (de 18 para 28,65 m²).\n"
        "3. A área gourmet ficou com 3,00 × 4,00 m, com mesa de seis lugares e cadeiras dos dois lados. O deck do spa passou a 3,00 × 2,40 m.\n"
        "4. A sala e cozinha ganharam a largura inteira da casa: 7,60 m e 47,77 m².\n"
        "5. Os quartos e o corredor envidraçado continuam na mesma posição e com as mesmas medidas.\n"
        "\n"
        "O QUE VOCÊ PRECISA SABER\n"
        "A. A parede esquerda da casa fica sobre a divisa e não pode ter abertura. O quarto 02 recebe luz por uma janela para o corredor de vidro, por onde\n"
        "    vê o jardim, e ventila por uma faixa de vidro alta que abre para o pátio, acima do telhado do corredor. Os banheiros ventilam do mesmo jeito.\n"
        "B. A ocupação chegou a 58,3 % dos 60 % permitidos. O pergolado da área gourmet tem de ser vazado, sem telha, e a garagem não pode ser coberta.\n"
        "C. O acesso ao pátio e aos fundos passa a ser por dentro da casa, pela cozinha ou pelo corredor.\n"
        "\n"
        "SE VOCÊ PREFERIR MANTER O CORREDOR LATERAL\n"
        "Com o corredor de 0,90 m, o máximo de pátio é 2,50 m, e para isso o quarto 02 e os banheiros caem de 3,20 para 2,60 m de largura."
    )
    tx.text(0, y2 - 0.002, notes, fontsize=5.7, va="top", linespacing=1.32)
    tx.text(0, 0.0, f"Doc. CP-ARQ-V3   |   Revisão {REV} — {DATA}   |   Escala 1:100 (folha A3)   |   Unidade: metro   |   "
            "Estudo para aprovação do proprietário", fontsize=6, va="bottom", fontweight="bold")
    for ext, kw in (("pdf", {}), ("png", {"dpi": 200})):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-V3_proposta_{REV}.{ext}"), **kw)
    print("util", round(A_UTIL, 2), "social", round(A_SOCIAL, 2), "const", round(A_CONST, 2), "TO", round(A_CONST / 2, 1))


if __name__ == "__main__":
    main()
