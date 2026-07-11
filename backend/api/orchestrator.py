"""FastAPI orchestrator — wires ASR → vLLM → Kokoro TTS into a single endpoint.

End-to-end flow::

    frontend (audio)  →  ASR  →  text
    text              →  vLLM →  response text
    response text     →  Kokoro →  audio bytes
    audio bytes       →  streamed back to frontend

Listens on port 8080.
"""

import json
import logging
import os
import sys
import tempfile

# Ensure the backend parent directory is on the path so sibling packages
# (kokoro, parakeet, api) are importable when this script is run directly.
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_root = os.path.dirname(_current_dir)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

import uvicorn
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from kokoro_service.tts import save_to_wav, synthesize
from parakeet_service.asr import transcribe

logger = logging.getLogger(__name__)

# --------------- configuration ---------------

VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://localhost:8000")
VLLM_API_KEY = os.environ.get("VLLM_API_KEY", "")
VLLM_MODEL = os.environ.get("VLLM_MODEL", "qwen3.6-35b-a3b-nvfp4")
TTS_VOICE = os.environ.get("TTS_VOICE", "af_bella")

# --------------- app ---------------

app = FastAPI(
    title="Qwen Orchestrator",
    description="ASR → vLLM → Kokoro TTS pipeline (single audio-in / audio-out endpoint).",
)


# --------------- request / response models ---------------


class ChatRequest(BaseModel):
    """Text-chat variant: send text, get streamed audio back."""

    text: str
    model: str = VLLM_MODEL
    max_tokens: int = 2048
    temperature: float = 0.7
    top_p: float = 0.95
    voice: str = TTS_VOICE


class ChatResponse(BaseModel):
    """Metadata returned alongside the streamed audio blob."""

    text: str
    model: str
    voice: str


# --------------- helpers ---------------


async def _call_vllm(text: str, *, model: str, max_tokens: int,
                     temperature: float, top_p: float) -> str:
    """Send *text* to vLLM and return the assistant reply as a plain string."""

    url = f"{VLLM_BASE_URL.rstrip('/')}/v1/chat/completions"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if VLLM_API_KEY:
        headers["Authorization"] = f"Bearer {VLLM_API_KEY}"

    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": text}],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
        "stream": False,  # non-streaming for simplicity; audio is the payload anyway.
    })

    import httpx

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, data=payload)
        if not resp.is_success:
            detail = resp.text[:500]
            logger.error("vLLM error %s: %s", resp.status_code, detail)
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"vLLM returned {resp.status_code}: {detail}",
            )
        body = resp.json()
        return body["choices"][0]["message"]["content"].strip()


async def _tts_stream(text: str, voice: str) -> StreamingResponse:
    """Generate audio from *text* with Kokoro and stream the WAV bytes back."""

    tmp = tempfile.mktemp(prefix="qwen_tts_", suffix=".wav")
    try:
        save_to_wav(text, tmp, voice=voice)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}") from exc

    def stream_bytes():
        with open(tmp, "rb") as fh:
            while True:
                chunk = fh.read(8192)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        stream_bytes(),
        media_type="audio/wav",
        headers={
            "Content-Disposition": 'attachment; filename="speech.wav"',
            "X-Content-Type-Options": "nosniff",
        },
    )


# --------------- endpoints ---------------


@app.post("/orchestrate/audio", response_description="WAV audio streaming response")
async def orchestrate_audio(file: UploadFile = File(...), voice: str = Query(TTS_VOICE)):
    """Full pipeline: audio → ASR → vLLM → Kokoro → audio.

    Accepts any audio format supported by the Parakeet pipeline
    (WAV, FLAC, MP3, M4A, OGG) and streams back a WAV response.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    # 1. Write audio to temp file for ASR
    tmp_audio = tempfile.mktemp(prefix="qwen_asr_")
    try:
        content = await file.read()
        with open(tmp_audio, "wb") as fh:
            fh.write(content)

        # 2. ASR → text
        logger.info("Running ASR on uploaded audio…")
        text = transcribe(tmp_audio)
        if not text:
            raise HTTPException(status_code=400, detail="ASR returned empty transcription.")
        logger.info("ASR result: %s", text)

        # 3. vLLM → response
        logger.info("Calling vLLM with: %s", text)
        response_text = await _call_vllm(text)
        logger.info("vLLM response length: %d bytes", len(response_text))

    finally:
        if os.path.exists(tmp_audio):
            os.unlink(tmp_audio)

    # 4. Kokoro TTS → stream audio
    return await _tts_stream(response_text, voice=voice)


@app.post("/orchestrate/text",
          description="Text-chat variant: send text directly, get streamed audio back.")
async def orchestrate_text(req: ChatRequest):
    """Text input → vLLM → Kokoro → audio. Skips the ASR step."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")

    logger.info("vLLM chat input (%s): %s", req.model, req.text)

    # 1. vLLM → response text
    response_text = await _call_vllm(
        req.text,
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
        top_p=req.top_p,
    )
    logger.info("vLLM response length: %d bytes", len(response_text))

    # 2. Kokoro TTS → stream audio
    return await _tts_stream(response_text, req.voice)


@app.get("/orchestrate")
async def health():
    """Health-check & config summary."""
    return {
        "status": "ok",
        "service": "qwen-orchestrator",
        "vllm_base_url": VLLM_BASE_URL,
        "vllm_model": VLLM_MODEL,
        "tts_voice": TTS_VOICE,
        "endpoints": {
            "audio_pipeline": "POST /orchestrate/audio",
            "text_chat": "POST /orchestrate/text",
        },
    }


def main():
    """Run the orchestrator service."""
    uvicorn.run(
        "api.orchestrator:app",
        host="0.0.0.0",
        port=8080,
        log_level="info",
    )


if __name__ == "__main__":
    main()