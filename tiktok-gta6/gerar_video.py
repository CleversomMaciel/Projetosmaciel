"""Gera um vídeo vertical (1080x1920) para TikTok: "GTA 6 sai amanhã - 5 coisas".

Visual 100% original (estética neon/synthwave de Miami), sem assets da Rockstar.
Uso: python3 gerar_video.py  ->  gera gta6_5_coisas.mp4 nesta pasta.
"""
import math, os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
AQUI = os.path.dirname(os.path.abspath(__file__))
FONT_B = "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ROSA, CIANO, AMARELO, BRANCO = (255, 60, 172), (40, 230, 255), (255, 214, 64), (255, 255, 255)

# (duração s, título grande, subtítulo, cor do destaque)
CENAS = [
    (2.8, "GTA 6 SAI\nAMANHÃ", "5 coisas pra saber ANTES de jogar", AMARELO),
    (3.2, "1. 19 DE\nNOVEMBRO", "Libera à meia-noite no seu horário local", ROSA),
    (3.2, "2. LIBERA\n212 GB", "É o espaço pedido pro pré-download", CIANO),
    (3.2, "3. PS5 E\nXBOX SERIES", "Versão de PC? Ainda não foi anunciada", ROSA),
    (3.2, "4. VICE CITY\n+ LEONIDA", "Com a dupla Jason e Lucia", CIANO),
    (3.2, "5. ONLINE\nSÓ DEPOIS", "No lançamento é só o modo história", ROSA),
    (3.4, "VAI JOGAR\nNO DIA 1?", "Comenta aí e segue pra cobertura diária", AMARELO),
]
DUR = sum(c[0] for c in CENAS)
N = int(DUR * FPS)
BPM = 112
BEAT = 60 / BPM


def fonte(path, size):
    return ImageFont.truetype(path, size)


# ---------- fundo estático: céu, sol listrado, palmeiras ----------
def fundo_base():
    img = Image.new("RGB", (W, H))
    px = np.zeros((H, W, 3), np.float32)
    t = np.linspace(0, 1, H)[:, None]
    topo, meio, horiz = np.array([18, 6, 48]), np.array([120, 20, 110]), np.array([255, 110, 90])
    k = np.clip(t / 0.62, 0, 1)
    ceu = np.where(k < 0.6, topo + (meio - topo) * (k / 0.6), meio + (horiz - meio) * ((k - 0.6) / 0.4))
    px[:] = ceu[:, None, :] if ceu.ndim == 2 else ceu
    px[int(H * 0.62):] = [14, 4, 30]
    img = Image.fromarray(px.astype(np.uint8))
    d = ImageDraw.Draw(img)
    # estrelas
    rng = np.random.default_rng(7)
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(0, int(H * 0.4))
        r = rng.choice([1, 1, 2])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    # sol com faixas
    cx, cy, R = W // 2, int(H * 0.56), 330
    sol = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sol)
    for yy in range(cy - R, cy + 1):
        f = (yy - (cy - R)) / R
        cor = (255, int(220 - 150 * f), int(80 + 60 * f), 255)
        dx = int(math.sqrt(max(R * R - (yy - cy) ** 2, 0)))
        faixa = f > 0.45 and int((yy - cy) / 18) % 2 == 0
        if not faixa:
            sd.line([(cx - dx, yy), (cx + dx, yy)], fill=cor)
    glow = sol.filter(ImageFilter.GaussianBlur(40))
    img.paste(glow, (0, 0), glow)
    img.paste(sol, (0, 0), sol)
    # palmeiras em silhueta
    for bx, esc, lado in [(90, 1.15, 1), (W - 80, 1.0, -1), (W - 230, 0.7, -1)]:
        palmeira(d, bx, int(H * 0.62), esc, lado)
    return img


def palmeira(d, bx, by, s, lado):
    cor = (12, 2, 24)
    pts, x, y = [], bx, by
    for i in range(30):
        pts.append((x, y))
        y -= 22 * s
        x += lado * (3 + i * 0.25) * s
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=cor, width=int((26 - i * 0.5) * s))
    tx, ty = pts[-1]
    for ang in [-170, -140, -110, -70, -40, -10, 20, 200]:
        a = math.radians(ang)
        folha = []
        for j in range(16):
            r = j * 17 * s
            folha.append((tx + math.cos(a) * r, ty + math.sin(a) * r + (j ** 2) * 0.9 * s))
        for j in range(len(folha) - 1):
            d.line([folha[j], folha[j + 1]], fill=cor, width=max(2, int((20 - j) * s)))


def grade(img, t):
    """Chão em perspectiva andando pra frente (neon)."""
    d = ImageDraw.Draw(img, "RGBA")
    hy = int(H * 0.62)
    cx = W // 2
    for i in range(-14, 15):
        d.line([(cx + i * 30, hy), (cx + i * 260, H)], fill=(255, 60, 172, 170), width=3)
    off = (t * 1.2) % 1
    for i in range(14):
        z = (i + off) / 14
        y = hy + (H - hy) * z ** 2.2
        d.line([(0, y), (W, y)], fill=(255, 60, 172, int(60 + 150 * z)), width=3)


# ---------- texto ----------
def texto_contorno(base, xy, txt, f, cor, contorno=8, anchor="mm", glow_cor=None, spacing=10):
    camada = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    d.multiline_text(xy, txt, font=f, fill=cor, anchor=anchor, align="center", spacing=spacing,
                     stroke_width=contorno, stroke_fill=(10, 0, 25))
    if glow_cor:
        g = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).multiline_text(xy, txt, font=f, fill=glow_cor + (255,), anchor=anchor,
                                         align="center", spacing=spacing, stroke_width=contorno + 6,
                                         stroke_fill=glow_cor + (255,))
        g = g.filter(ImageFilter.GaussianBlur(22))
        base.alpha_composite(g)
    base.alpha_composite(camada)


def quebrar(d, txt, f, largura):
    linhas, atual = [], ""
    for p in txt.split():
        teste = (atual + " " + p).strip()
        if d.textlength(teste, font=f) <= largura:
            atual = teste
        else:
            linhas.append(atual); atual = p
    linhas.append(atual)
    return "\n".join(linhas)


def ease_out_back(x):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def render_cena(t_global, idx, t_local, dur, fundo):
    dur_s, titulo, sub, destaque = CENAS[idx]
    img = fundo.copy()
    grade(img, t_global)
    frame = img.convert("RGBA")

    # pulso no beat
    fase_beat = (t_global % BEAT) / BEAT
    pulso = 1 + 0.035 * math.exp(-fase_beat * 6)

    # barra de progresso (topo) - prende retenção
    d = ImageDraw.Draw(frame)
    d.rectangle([0, 0, W, 14], fill=(0, 0, 0, 160))
    d.rectangle([0, 0, int(W * t_global / DUR), 14], fill=destaque + (255,))

    # título grande: pop-in
    k = min(t_local / 0.35, 1)
    escala = max(ease_out_back(k), 0.01) * pulso
    tam = 150 if "\n" in titulo else 170
    if len(max(titulo.split("\n"), key=len)) > 11:
        tam = 128
    f = fonte(FONT_B, int(tam * escala))
    texto_contorno(frame, (W // 2, int(H * 0.30)), titulo, f, BRANCO, contorno=9, glow_cor=destaque)

    # subtítulo: desliza de baixo
    k2 = min(max((t_local - 0.25) / 0.35, 0), 1)
    if k2 > 0:
        dy = int((1 - ease_out_back(k2)) * 80)
        fs = fonte(FONT_R, 54)
        caixa = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        cd = ImageDraw.Draw(caixa)
        sub_q = quebrar(cd, sub, fs, 860)
        pos = (W // 2, int(H * 0.48) + dy)
        bb = cd.multiline_textbbox(pos, sub_q, font=fs, anchor="mm", align="center", spacing=14)
        cd.rounded_rectangle([bb[0] - 36, bb[1] - 26, bb[2] + 36, bb[3] + 26], 26,
                             fill=(10, 0, 30, int(215 * k2)), outline=destaque + (int(255 * k2),), width=5)
        cd.multiline_text(pos, sub_q, font=fs, fill=(255, 255, 255, int(255 * k2)), anchor="mm",
                          align="center", spacing=14)
        frame.alpha_composite(caixa)

    # selo "AMANHÃ" piscando na 1ª cena / CTA na última
    if idx == 0:
        if int(t_global * 4) % 2 == 0:
            texto_contorno(frame, (W // 2, int(H * 0.13)), "19/11", fonte(FONT_B, 90), AMARELO, contorno=6)
    if idx == len(CENAS) - 1 and t_local > 0.6:
        texto_contorno(frame, (W // 2, int(H * 0.13)), "SEGUE AÍ  +", fonte(FONT_B, 80), ROSA, contorno=6)

    # flash de transição
    if t_local < 0.08:
        fl = Image.new("RGBA", frame.size, (255, 255, 255, int(180 * (1 - t_local / 0.08))))
        frame.alpha_composite(fl)
    return frame.convert("RGB")


# ---------- trilha sonora sintetizada (original) ----------
def gerar_audio(path):
    sr = 44100
    n = int(DUR * sr)
    t = np.arange(n) / sr
    audio = np.zeros(n)
    passo = BEAT / 2
    baixo_notas = [55.0, 55.0, 65.41, 73.42, 49.0, 49.0, 58.27, 65.41]  # A, C, D, G, Bb...
    for i in range(int(DUR / passo) + 1):
        ini = int(i * passo * sr)
        fim = min(ini + int(passo * sr), n)
        if ini >= n:
            break
        tt = np.arange(fim - ini) / sr
        f0 = baixo_notas[(i // 2) % len(baixo_notas)]
        saw = 2 * ((tt * f0) % 1) - 1
        audio[ini:fim] += 0.22 * saw * np.exp(-tt * 5)
        # chimbal
        hh = np.random.default_rng(i).standard_normal(fim - ini) * np.exp(-tt * 60)
        audio[ini:fim] += 0.05 * hh
        # bumbo no tempo, caixa no 2 e 4
        if i % 2 == 0:
            k = np.sin(2 * np.pi * (50 + 120 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9)
            audio[ini:fim] += 0.55 * k
        if i % 4 == 2:
            sn = np.random.default_rng(999 + i).standard_normal(fim - ini) * np.exp(-tt * 18)
            audio[ini:fim] += 0.18 * sn
    # pad de acordes
    acordes = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 246.94, 293.66), (164.81, 207.65, 246.94)]
    compasso = BEAT * 4
    for ci in range(int(DUR / compasso) + 1):
        ini = int(ci * compasso * sr)
        fim = min(ini + int(compasso * sr), n)
        if ini >= n:
            break
        tt = np.arange(fim - ini) / sr
        env = np.minimum(tt / 0.3, 1) * np.minimum((compasso - tt) / 0.3, 1)
        for fr in acordes[ci % 4]:
            audio[ini:fim] += 0.045 * env * (np.sin(2 * np.pi * fr * tt) + 0.5 * np.sin(2 * np.pi * fr * 1.005 * tt))
    # "whoosh" nas trocas de cena
    acc = 0
    for dur_s, *_ in CENAS:
        ini = int(acc * sr)
        m = min(int(0.25 * sr), n - ini)
        tt = np.arange(m) / sr
        audio[ini:ini + m] += 0.2 * np.random.default_rng(int(acc * 10)).standard_normal(m) * np.exp(-tt * 14)
        acc += dur_s
    fade = np.minimum(1, (n - np.arange(n)) / (0.6 * sr))
    audio = np.tanh(audio * 1.3) * 0.8 * fade
    pcm = (np.stack([audio, audio], 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())


def main():
    wav = os.path.join(AQUI, "_trilha.wav")
    out = os.path.join(AQUI, "gta6_5_coisas.mp4")
    gerar_audio(wav)
    fundo = fundo_base()
    proc = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
        "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out,
    ], stdin=subprocess.PIPE)
    limites, acc = [], 0
    for c in CENAS:
        limites.append((acc, acc + c[0])); acc += c[0]
    for fi in range(N):
        tg = fi / FPS
        idx = next(i for i, (a, b) in enumerate(limites) if a <= tg < b or i == len(limites) - 1)
        frame = render_cena(tg, idx, tg - limites[idx][0], CENAS[idx][0], fundo)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close(); proc.wait()
    os.remove(wav)
    print("OK:", out)


if __name__ == "__main__":
    main()
