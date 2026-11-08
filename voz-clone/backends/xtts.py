"""Motor local usando Coqui XTTS-v2 (clonagem zero-shot, roda no seu computador).

Instale com:  pip install coqui-tts
Na primeira execução o modelo (~2 GB) é baixado automaticamente.
"""
import io
import os
import re
import wave
from pathlib import Path

MAX_CHARS = 200  # o XTTS perde qualidade em trechos muito longos


class XTTSBackend:
    name = "xtts"
    media_type = "audio/wav"
    extension = "wav"

    def __init__(self):
        try:
            import torch
            from TTS.api import TTS
        except ImportError as e:
            raise RuntimeError("Motor XTTS não instalado. Rode: pip install coqui-tts") from e
        os.environ.setdefault("COQUI_TOS_AGREED", "1")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        self.language = os.getenv("XTTS_LANGUAGE", "pt")
        self.voices: dict[str, list[str]] = {}

    def clone(self, name: str, samples: list[Path]) -> str:
        # XTTS é zero-shot: o "clone" são as próprias amostras de referência.
        return "|".join(str(p) for p in samples)

    def speak(self, remote_id: str, text: str, style: float = 0.3) -> bytes:
        speaker_wav = remote_id.split("|")
        rate = self.tts.synthesizer.output_sample_rate
        pause = [0.0] * int(rate * 0.25)
        audio: list[float] = []
        for chunk in split_text(text):
            wav = self.tts.tts(
                text=chunk,
                speaker_wav=speaker_wav,
                language=self.language,
                temperature=0.6 + 0.3 * style,
            )
            audio.extend(list(wav) + pause)
        return to_wav_bytes(audio, rate)

    def delete(self, remote_id: str) -> None:
        pass


def split_text(text: str, limit: int = MAX_CHARS) -> list[str]:
    """Quebra o texto em frases, juntando-as em blocos de até `limit` caracteres."""
    sentences = re.split(r"(?<=[.!?…;:])\s+", " ".join(text.split()))
    chunks, cur = [], ""
    for s in sentences:
        while len(s) > limit:  # frase gigante: corta na última vírgula/espaço
            cut = max(s.rfind(",", 0, limit), s.rfind(" ", 0, limit))
            cut = cut if cut > 0 else limit
            chunks.append(s[: cut + 1].strip())
            s = s[cut + 1 :].strip()
        if cur and len(cur) + len(s) + 1 > limit:
            chunks.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        chunks.append(cur)
    return [c for c in chunks if c]


def to_wav_bytes(samples: list[float], rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(
            b"".join(
                int(max(-1.0, min(1.0, x)) * 32767).to_bytes(2, "little", signed=True)
                for x in samples
            )
        )
    return buf.getvalue()
