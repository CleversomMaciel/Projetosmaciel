"""Motor de clonagem na nuvem usando a API da ElevenLabs (Instant Voice Cloning)."""
import os
from pathlib import Path

import httpx

API = "https://api.elevenlabs.io/v1"


class ElevenLabsBackend:
    name = "elevenlabs"
    media_type = "audio/mpeg"
    extension = "mp3"

    def __init__(self):
        self.key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        if not self.key:
            raise RuntimeError("Defina ELEVENLABS_API_KEY no arquivo .env")
        self.model = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
        self.headers = {"xi-api-key": self.key}

    def clone(self, name: str, samples: list[Path]) -> str:
        files = [("files", (p.name, p.read_bytes(), "audio/wav")) for p in samples]
        r = httpx.post(
            f"{API}/voices/add",
            headers=self.headers,
            data={"name": name, "description": "Voz clonada pelo próprio dono (voz-clone)"},
            files=files,
            timeout=120,
        )
        _check(r)
        return r.json()["voice_id"]

    def speak(self, remote_id: str, text: str, style: float = 0.3) -> bytes:
        r = httpx.post(
            f"{API}/text-to-speech/{remote_id}",
            headers={**self.headers, "Accept": "audio/mpeg"},
            json={
                "text": text,
                "model_id": self.model,
                "voice_settings": {
                    # estabilidade menor = mais expressivo/natural; maior = mais constante
                    "stability": 0.45,
                    "similarity_boost": 0.85,
                    "style": style,
                    "use_speaker_boost": True,
                },
            },
            timeout=300,
        )
        _check(r)
        return r.content

    def delete(self, remote_id: str) -> None:
        r = httpx.delete(f"{API}/voices/{remote_id}", headers=self.headers, timeout=60)
        if r.status_code not in (200, 404):
            _check(r)


def _check(r: httpx.Response):
    if r.is_success:
        return
    try:
        detail = r.json().get("detail", r.text)
    except ValueError:
        detail = r.text
    raise RuntimeError(f"ElevenLabs respondeu {r.status_code}: {detail}")
