# 🎙️ Voz Clone

App web que **clona a sua voz** a partir de algumas gravações e depois **lê qualquer texto** que você mandar, com a sua voz, de forma natural.

## Como funciona

1. **Grave** 1–3 minutos da sua voz direto no navegador (ou envie arquivos `.mp3`, `.wav`, `.m4a`…).
2. O app cria o clone usando um dos motores:
   - **ElevenLabs** (padrão) — na nuvem, o resultado mais natural em português. Precisa de uma chave de API (o plano gratuito/Starter já permite clonagem instantânea).
   - **XTTS-v2** — roda 100% no seu computador, grátis e privado. Mais pesado (ideal com placa de vídeo NVIDIA).
3. **Cole um texto** (até 5.000 caracteres) e clique em *Falar*. O áudio toca e pode ser baixado.

## Instalação

Requisitos: Python 3.10+ e [ffmpeg](https://ffmpeg.org/download.html) (para converter as gravações do navegador).

```bash
cd voz-clone
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # depois edite o .env
```

### Opção A — ElevenLabs (recomendado)
1. Crie uma conta em https://elevenlabs.io e gere uma chave em *Settings → API Keys*.
2. No `.env`: `TTS_BACKEND=elevenlabs` e `ELEVENLABS_API_KEY=sua_chave`.

### Opção B — XTTS-v2 local
```bash
pip install coqui-tts
```
No `.env`: `TTS_BACKEND=xtts`. Na primeira vez o modelo (~2 GB) será baixado.

## Rodar

```bash
uvicorn app:app --reload
```
Abra http://localhost:8000

## Dicas para um clone bem natural

- Grave em ambiente silencioso, sem eco, com o microfone a ~15 cm da boca.
- Fale no seu jeito normal — com variação de tom, perguntas e exclamações (o roteiro na tela já ajuda).
- Mais áudio limpo = melhor. 1 a 3 minutos é o ideal para clonagem instantânea.
- No texto, use pontuação: vírgulas e reticências viram pausas, `?` e `!` mudam a entonação.
- *Expressividade*: 0 = leitura neutra; 1 = bem emotivo.

## API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/voices` | Lista as vozes clonadas |
| `POST` | `/api/voices` | `multipart`: `name`, `consent=true`, `files[]` → cria o clone |
| `POST` | `/api/speak` | JSON `{voice_id, text, style}` → retorna o áudio |
| `DELETE` | `/api/voices/{id}` | Apaga a voz (local e na ElevenLabs) |

Exemplo pelo terminal:
```bash
curl -X POST localhost:8000/api/speak -H 'Content-Type: application/json' \
  -d '{"voice_id":"SEU_ID","text":"Olá! Essa é a minha voz clonada."}' -o fala.mp3
```

## Uso responsável

Clone apenas a **sua** voz ou a de quem te deu autorização expressa. O app exige essa confirmação antes de criar um clone. Não use para se passar por outra pessoa ou enganar ninguém.

Os arquivos ficam em `voz-clone/data/` (ignorado pelo git).
