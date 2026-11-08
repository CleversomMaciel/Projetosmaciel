"""voz-clone — clone a SUA voz e faça ela ler qualquer texto.

Rodar:  uvicorn app:app --reload   e abra http://localhost:8000
"""
import json
import os
import shutil
import subprocess
import threading
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

ROOT = Path(__file__).parent
DATA = ROOT / "data"
SAMPLES = DATA / "samples"
OUTPUT = DATA / "output"
DB = DATA / "voices.json"
for d in (SAMPLES, OUTPUT):
    d.mkdir(parents=True, exist_ok=True)

MAX_TEXT = 5000
_lock = threading.Lock()
_backend = None


def backend():
    """Carrega o motor configurado só quando for usado (o XTTS demora para iniciar)."""
    global _backend
    if _backend is None:
        choice = os.getenv("TTS_BACKEND", "elevenlabs").lower()
        try:
            if choice == "xtts":
                from backends.xtts import XTTSBackend
                _backend = XTTSBackend()
            else:
                from backends.elevenlabs import ElevenLabsBackend
                _backend = ElevenLabsBackend()
        except RuntimeError as e:
            raise HTTPException(500, str(e))
    return _backend


def load_db() -> dict:
    return json.loads(DB.read_text()) if DB.exists() else {}


def save_db(db: dict):
    DB.write_text(json.dumps(db, indent=2, ensure_ascii=False))


def to_wav(src: Path) -> Path:
    """Converte qualquer áudio (webm do navegador, mp3, m4a...) para WAV mono 22 kHz."""
    if not shutil.which("ffmpeg"):
        if src.suffix.lower() == ".wav":
            return src
        raise HTTPException(500, "Instale o ffmpeg para converter áudios que não são .wav")
    dst = src.with_suffix(".wav") if src.suffix.lower() != ".wav" else src.with_name(src.stem + "_c.wav")
    r = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "22050", str(dst)],
        capture_output=True,
    )
    if r.returncode != 0:
        raise HTTPException(400, f"Não consegui ler o áudio {src.name}: {r.stderr.decode()[:200]}")
    src.unlink(missing_ok=True)
    return dst


app = FastAPI(title="voz-clone")


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/voices")
def list_voices():
    return [
        {"id": vid, "name": v["name"], "backend": v["backend"], "samples": len(v["samples"])}
        for vid, v in load_db().items()
    ]


@app.post("/api/voices")
async def create_voice(
    name: str = Form(...),
    consent: bool = Form(False),
    files: list[UploadFile] = File(...),
):
    if not consent:
        raise HTTPException(400, "Confirme que a voz é sua (ou que você tem autorização do dono).")
    if not files:
        raise HTTPException(400, "Envie pelo menos uma amostra de áudio.")

    vid = uuid.uuid4().hex[:10]
    folder = SAMPLES / vid
    folder.mkdir()
    paths = []
    for i, f in enumerate(files):
        ext = Path(f.filename or "a.webm").suffix or ".webm"
        p = folder / f"amostra_{i}{ext}"
        p.write_bytes(await f.read())
        paths.append(to_wav(p))

    be = backend()
    try:
        remote_id = be.clone(name, paths)
    except RuntimeError as e:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(502, str(e))

    with _lock:
        db = load_db()
        db[vid] = {"name": name, "backend": be.name, "remote_id": remote_id,
                   "samples": [str(p) for p in paths]}
        save_db(db)
    return {"id": vid, "name": name}


class SpeakIn(BaseModel):
    voice_id: str
    text: str = Field(..., min_length=1, max_length=MAX_TEXT)
    style: float = Field(0.3, ge=0, le=1, description="0 = neutro, 1 = bem expressivo")


@app.post("/api/speak")
def speak(body: SpeakIn):
    v = load_db().get(body.voice_id)
    if not v:
        raise HTTPException(404, "Voz não encontrada")
    be = backend()
    if v["backend"] != be.name:
        raise HTTPException(400, f"Essa voz foi criada com '{v['backend']}', mas o motor ativo é '{be.name}'.")
    try:
        audio = be.speak(v["remote_id"], body.text.strip(), body.style)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    out = OUTPUT / f"{body.voice_id}_{uuid.uuid4().hex[:6]}.{be.extension}"
    out.write_bytes(audio)
    return Response(audio, media_type=be.media_type,
                    headers={"Content-Disposition": f'inline; filename="{out.name}"'})


@app.delete("/api/voices/{vid}")
def delete_voice(vid: str):
    with _lock:
        db = load_db()
        v = db.pop(vid, None)
        if not v:
            raise HTTPException(404, "Voz não encontrada")
        save_db(db)
    try:
        if v["backend"] == backend().name:
            backend().delete(v["remote_id"])
    except (RuntimeError, HTTPException):
        pass
    shutil.rmtree(SAMPLES / vid, ignore_errors=True)
    return {"ok": True}


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
