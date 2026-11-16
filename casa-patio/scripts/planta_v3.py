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
REV = "P6"
DATA = "16/11/2026"

WALLS = [
    (0, 5.50, 0.20, 25.00), (0, 5.50, 8.00, 5.70), (7.80, 5.50, 8.00, 11.75), (0, 24.80, 4.80, 25.00),
    (0.20, 11.60, 3.55, 11.75), (4.65, 11.60, 7.80, 11.75), (3.40, 11.75, 3.55, 21.35), (4.65, 11.75, 4.80, 24.80),
    (0.20, 13.25, 3.40, 13.40), (0.20, 16.40, 3.40, 16.55), (0.20, 18.05, 3.40, 18.20), (0.20, 19.70, 3.40, 19.85),
    (0.20, 21.35, 4.65, 21.50), (5.20, 5.70, 5.35, 7.35), (5.35, 7.20, 7.80, 7.35), (1.00, 11.75, 1.15, 13.25),
]
MUROS = [(0, 0, 0.20, 5.5), (7.80, 0, 8, 5.5), (7.80, 11.75, 8, 25), (4.80, 24.80, 7.80, 25)]
OPEN = [
    (4.20, 5.50, 5.10, 5.70, "door", "P1"), (1.00, 5.50, 3.40, 5.70, "win", "J1"), (6.00, 5.50, 7.40, 5.70, "win", "J2"),
    (5.55, 7.20, 6.35, 7.35, "door", "P2"), (4.80, 11.60, 7.80, 11.75, "glass", "V1"),
    (3.40, 12.35, 3.55, 13.15, "door", "P2"), (1.00, 12.10, 1.15, 12.90, "win", "J5"), (3.40, 13.55, 3.55, 14.35, "door", "P2"),
    (0.60, 16.40, 3.00, 16.55, "glass", "V4"), (3.40, 16.65, 3.55, 17.95, "glass", "V5"), (0.35, 18.05, 1.15, 18.20, "win", "J6"),
    (4.65, 11.75, 4.80, 21.35, "glass", "V2"), (4.65, 21.65, 4.80, 22.25, "win", "J3"), (4.65, 22.60, 4.80, 24.40, "glass", "V3"),
    (2.00, 19.70, 2.80, 19.85, "door", "P2"), (1.40, 21.35, 2.20, 21.50, "door", "P3"), (3.70, 21.35, 4.50, 21.50, "door", "P2"),
]
A_SOCIAL = 7.60 * 5.90 - 2.60 * 1.65
ROOMS = [  # (x, y, nome, largura, profundidade, área)
    (3.6, 9.2, "ESTAR / JANTAR / COZINHA", 7.60, 5.90, A_SOCIAL),
    (6.45, 6.75, "LAVANDERIA", 2.45, 1.50, 2.45 * 1.50),
    (2.3, 12.85, "BANHO SOCIAL", 2.25, 1.50, 3.375),
    (2.6, 14.5, "QUARTO 02", 3.20, 3.00, 9.60),
    (2.0, 19.35, "BANHO SUÍTE", 3.20, 1.50, 4.80),
    (1.8, 20.9, "CLOSET", 3.20, 1.50, 4.80),
    (2.4, 22.2, "SUÍTE MASTER", 4.45, 3.30, 14.685),
]
A_CORR = 1.10 * 9.60
A_UTIL = sum(r[5] for r in ROOMS) + A_CORR
A_CONST = 8.00 * 6.25 + 4.80 * 13.25 - 0.80 * 1.50 - 3.20 * 1.50
FURN = [
    (1.65, 22.80, 3.25, 24.80), (1.20, 24.40, 1.65, 24.80), (3.25, 24.40, 3.70, 24.80), (0.35, 23.90, 0.95, 24.50),
    (0.20, 19.85, 0.75, 21.35), (2.85, 19.85, 3.40, 21.35),
    (0.20, 18.20, 1.20, 19.70), (1.45, 18.20, 1.85, 18.85), (2.05, 18.20, 3.35, 18.70),
    (0.30, 13.40, 2.50, 13.92), (0.20, 14.55, 2.20, 16.13), (0.20, 14.08, 0.60, 14.48),
    (1.15, 11.75, 2.05, 13.25), (2.20, 11.75, 2.60, 12.40), (2.75, 11.75, 3.40, 12.20),
    (0.20, 6.50, 0.65, 8.60), (2.60, 6.40, 3.55, 8.70), (1.50, 7.00, 2.10, 8.10),
    (1.60, 9.50, 2.50, 11.10), (1.16, 9.6, 1.56, 11.0), (2.54, 9.6, 2.94, 11.0),
    (7.20, 7.35, 7.80, 10.60), (7.12, 10.60, 7.80, 11.28), (5.45, 8.30, 6.25, 10.10), (4.95, 8.40, 5.30, 10.00),
    (7.20, 5.75, 7.80, 6.35), (7.20, 6.45, 7.80, 7.00), (5.90, 5.70, 7.10, 6.15),
    (7.25, 12.35, 7.80, 15.55), (5.55, 12.75, 6.45, 14.75), (5.10, 12.9, 5.50, 14.6), (6.50, 12.9, 6.90, 14.6),
    (5.60, 22.80, 7.60, 24.60),
]
CLEAR = [
    (3.55, 15.4, 4.65, 15.4, "1,10"), (4.80, 18.9, 7.80, 18.9, "3,00"),
    (2.20, 15.3, 3.40, 15.3, "1,20"), (1.4, 13.92, 1.4, 14.55, "0,63"),
    (0.20, 23.6, 1.65, 23.6, "1,45"), (3.25, 23.6, 4.65, 23.6, "1,40"), (2.4, 21.50, 2.4, 22.80, "1,30"),
    (0.75, 20.3, 2.85, 20.3, "2,10"), (0.65, 7.6, 2.60, 7.6, "1,95"), (3.55, 7.4, 4.95, 7.4, "1,40"),
    (6.25, 9.2, 7.20, 9.2, "0,95"), (2.94, 10.3, 4.95, 10.3, "2,01"), (3.75, 3.0, 5.60, 3.0, "1,85"),
    (4.80, 23.2, 5.60, 23.2, "0,80"),
]


def planta(ax):
    rect(ax, (0, 0, 8, 25), fill=False, ec="k", lw=0.6, ls=(0, (6, 3)))
    rect(ax, (0.20, 0, 7.80, 5.50), fc="#eeeeee", ec="none")
    rect(ax, (4.80, 11.75, 7.80, 22.25), fc="#dcebd2", ec="none")
    rect(ax, (4.80, 11.75, 7.80, 15.75), fc="#efe2c8", ec="none")
    rect(ax, (4.80, 22.40, 7.80, 24.80), fc="#e8dcc8", ec="none")
    rect(ax, (0.20, 11.75, 1.00, 13.25), fc="#fff3c4", ec="none", hatch="..")           # fosso de luz do banho social
    ax.text(0.6, 12.5, "FOSSO", fontsize=3.6, rotation=90, ha="center", va="center", color="#7a5a00")
    rect(ax, (0.20, 16.55, 3.40, 18.05), fc="#cfe8bf", ec="none", hatch="..")           # jardim de inverno
    ax.text(1.8, 17.3, "JARDIM DE INVERNO  3,20 × 1,50\naberto para o céu", fontsize=4.3, ha="center", va="center", color="#245c1a")
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
    ax.text(4.1, 16.9, f"CORREDOR INTERNO  1,10 × 9,60 = {br(A_CORR)} m²", fontsize=4.3, rotation=90, ha="center", va="center")
    ax.text(6.3, 20.4, "JARDIM\n3,00 × 6,50", fontsize=4.5, ha="center", va="center")
    ax.text(6.3, 16.0, "ÁREA GOURMET 3,00 × 4,00", fontsize=4.2, ha="center", va="center", color="#7d5029")
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
    ys = [0, 5.50, 5.70, 11.60, 11.75, 13.25, 13.40, 16.40, 16.55, 18.05, 18.20, 19.70, 19.85, 21.35, 21.50, 24.80, 25.00]
    dim_chain(ax, ys, -0.45, True)
    dim_chain(ax, [0, 25.00], -1.25, True, fs=6)
    dim_chain(ax, [0, 0.20, 3.40, 3.55, 4.65, 4.80, 7.80, 8.00], -0.95, False, min_label=0.8)
    dim_chain(ax, [0, 8.00], -1.55, False, fs=6)
    dim_chain(ax, [5.50, 5.70, 7.20, 7.35, 11.60, 11.75, 15.75, 22.40, 24.80, 25.00], 8.75, True, fs=4.4)
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
    tx.text(0, 0.925, "Pátio com 3,00 m de largura. Quarto 02 com porta de vidro para um jardim de inverno aberto para o céu. "
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
    amb += [("Corredor Interno", "1,10 × 9,60", br(A_CORR) + " m²", "10,13 m²", "2,80", ""),
            ("Quarto 03", "retirado", "—", "8,10 m²", "", ""),
            ("TOTAL ÁREA ÚTIL", "", br(A_UTIL) + " m²", "80,03 m²", "", ""),
            ("Jardim de inverno (descoberto)", "3,20 × 1,50", "4,80 m²", "—", "", ""),
            ("Pátio (gourmet + jardim)", "3,00 × 10,50", "31,50 m²", "20,50 m²", "", ""),
            ("Área construída (projeção)", "", br(A_CONST) + " m²", "94,50 m²", "", ""),
            ("Taxa de ocupação (limite 60 %)", "", br(A_CONST / 2, 1) + " %", "47,2 %", "", "")]
    y1 = grid("MEDIDAS DOS AMBIENTES", ["Ambiente", "Largura × profund.", "Área V3", "Antes (V2)", "Pé-direito"],
              [0, 0.16, 0.27, 0.35, 0.43], amb, 0.89)
    esq = [("P1", "Porta de entrada", "0,90 × 2,10", ""), ("P2", "Quartos, banheiros, lavanderia", "0,80 × 2,10", ""),
           ("P3", "Closet (pela suíte)", "0,70 × 2,10", ""), ("J1", "Janela do estar (frente)", "2,40 × 1,50", ""),
           ("J2", "Janela da lavanderia (frente)", "1,40 × 1,00", ""), ("J3", "Janela da suíte (pátio)", "0,60 × 1,20", ""),
           ("J5", "Janela do banho social para o fosso de luz", "0,80 × 1,10", ""),
           ("J6", "Janela alta do banho da suíte (jardim de inverno)", "0,80 × 0,70", ""),
           ("V1", "Vidro de correr cozinha / gourmet", "3,00 × 2,60", ""), ("V2", "Vidro do corredor / pátio, piso ao teto", "9,60 × 2,60", ""),
           ("V3", "Porta de vidro suíte / spa", "1,80 × 2,60", ""), ("V4", "Porta de vidro quarto 02 / jardim de inverno", "2,40 × 2,60", ""),
           ("V5", "Vidro fixo corredor / jardim de inverno", "1,30 × 2,60", ""),
           ("FA", "Faixa alta da sala: vidro frente e fundo", "15,60 × 0,70", ""), ("FQ", "Faixa alta dos quartos e banheiros, que abre", "6,00 × 0,40", "")]
    grid("PORTAS, JANELAS E VIDROS", ["Cód.", "Local", "Largura × altura"], [0, 0.04, 0.27], esq, 0.89, x0=0.60)
    an = [("Quarto 02: janela", "porta de vidro de 2,40 m", "Abre para o jardim de inverno, a céu aberto. Luz e ventilação diretas, legal.", "BOA", "ok"),
          ("Quarto 02: espaço", "3,20 × 3,00 m", "Cama queen com 1,20 m no pé e 0,63 m até o guarda-roupa. Um lado fica junto ao vidro.", "BOM", "ok"),
          ("Jardim de inverno", "3,20 × 1,50 m", "Serve o quarto 02, o banho da suíte e ilumina o corredor. Precisa de ralo.", "BOM", "ok"),
          ("Pátio", "3,00 × 10,50 m", "Mesa de seis com cadeiras dos dois lados, bancada, churrasqueira e jardim.", "BOM", "ok"),
          ("Spa com pergolado", "deck de 3,00 × 2,40 m", "Jacuzzi de 2,00 × 1,80 com 0,80 m de chegada pela suíte. Pergolado vazado.", "CABE BEM", "ok"),
          ("Sala, jantar e cozinha", "40,55 m², 7,60 m de largura", "Perdeu 0,95 m de profundidade para o jardim de inverno. Sofá a 1,95 m do rack.", "AMPLA", "ok"),
          ("Suíte master", "4,45 × 3,30 m", "1,40 m livres de cada lado e 1,30 m no pé da cama.", "AMPLA", "ok"),
          ("Closet", "2,10 m entre armários", "Largo, com passagem para o banho.", "AMPLO", "ok"),
          ("Corredor interno", "1,10 m × 9,60 m", "Envidraçado para o pátio e com um vidro para o jardim de inverno.", "BOM", "ok"),
          ("Banho social", "fosso de luz de 0,80 m", "Janela do box para o fosso, aberto para o céu.", "BOA", "ok"),
          ("Banho da suíte", "janela alta de 0,80 m", "Abre para o jardim de inverno. Voltou a ter 3,20 m de largura.", "BOA", "ok"),
          ("Ventilação da sala", "frente + pátio + faixa alta", "Cruzada: janela da frente, 3,00 m de vidro para o gourmet e painéis altos.", "MUITO BOA", "ok"),
          ("Taxa de ocupação", "53,8 % de 60 %", "Sobram 12,4 m² de cobertura. Jardim de inverno e fosso não contam como cobertos.", "ATENDE", "ok"),
          ("Garagem", "7,60 × 5,50 m", "Dois carros com 1,85 m de passagem no meio.", "AMPLA", "ok")]
    y2 = grid("ANÁLISE DE ESPAÇO E VENTILAÇÃO", ["Local", "Medida", "Avaliação", "Situação"], [0, 0.13, 0.30, 0.74], an, y1 - 0.004)
    notes = (
        "POR QUE NÃO VOLTEI COM O CORREDOR NA ESQUERDA\n"
        "Um corredor lateral só permite janela se tiver 1,50 m (Código Civil, art. 1.301). Com a parede, ele tira 1,70 m da largura do terreno: o pátio\n"
        "voltaria de 3,00 para 1,30 m. Com 0,90 m ele não pode ter janela, e foi por isso que o quarto tinha ficado com janela para dentro da casa.\n"
        "\n"
        "O QUE FIZ NO LUGAR\n"
        "1. Criei um jardim de inverno de 3,20 × 1,50 m, aberto para o céu, entre o quarto 02 e o banho da suíte.\n"
        "2. O quarto 02 ganhou uma porta de vidro de 2,40 m, do piso ao teto, para esse jardim: janela de verdade, com luz, ar e planta na frente.\n"
        "3. A janela fica de lado para a divisa, e nesse caso a lei pede só 0,75 m de distância. A parede da divisa continua fechada.\n"
        "4. O banho da suíte passou a ventilar para o mesmo jardim e voltou a ter 3,20 m de largura. O banho social mantém o fosso de luz.\n"
        "5. Tirei a janela do quarto para o corredor. O corredor ganhou um vidro fixo para o jardim de inverno.\n"
        "\n"
        "O QUE ISSO CUSTOU\n"
        "O jardim de inverno ocupa 1,65 m do comprimento da casa. Tirei 0,95 m da sala (de 47,77 para 40,55 m²), 0,30 m da suíte (de 16,02 para\n"
        "14,69 m²), 0,20 m do quarto 02 e 0,10 m do closet e do banho da suíte. O pátio continua com 3,00 m de largura e ficou 0,95 m mais comprido.\n"
        "\n"
        "ATENÇÃO\n"
        "• O jardim de inverno recebe chuva: precisa de ralo ligado à rede pluvial e de impermeabilização no pé das paredes.\n"
        "• Confirme no Código de Obras de Cascavel a medida mínima de pátio interno para dormitório. Se exigir mais de 1,50 m, a sala cede a diferença."
    )
    tx.text(0, y2 - 0.002, notes, fontsize=5.7, va="top", linespacing=1.32)
    tx.text(0, 0.0, f"Doc. CP-ARQ-V3   |   Revisão {REV} — {DATA}   |   Escala 1:100 (folha A3)   |   Unidade: metro   |   "
            "Estudo para aprovação do proprietário", fontsize=6, va="bottom", fontweight="bold")
    for ext, kw in (("pdf", {}), ("png", {"dpi": 200})):
        fig.savefig(os.path.join(OUT, f"CP-ARQ-V3_proposta_{REV}.{ext}"), **kw)
    print("util", round(A_UTIL, 2), "social", round(A_SOCIAL, 2), "const", round(A_CONST, 2), "TO", round(A_CONST / 2, 1))


if __name__ == "__main__":
    main()
