"""FastAPI service wrapping Kokoro TTS — listens on port 8002."""

import logging
import os
import tempfile

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from kokoro.tts import _SUPPORTED_VOICES as _SUPPORTED_VOICES, save_to_wav

logger = logging.getLogger(__name__)


class TtsRequest(BaseModel):
    """TTS request body."""

    text: str
    voice: str = "af_bella"
    speed: float = 1.0
    lang_code: str = "a"


class TtsResponse(BaseModel):
    """TTS API response."""

    text: str
    voice: str
    sample_rate: int = 24000


app = FastAPI(
    title="Kokoro TTS Service",
    description="Text-to-speech API backed by kokoro (24 kHz WAV output).",
)


@app.post("/tts", response_model=TtsResponse)
async def synthesize(
    req: TtsRequest,
):
    """Synthesise text to speech and stream the WAV file as a download.

    Returns JSON metadata plus streams the audio file so browsers can
    download or play it immediately.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    if req.voice not in _SUPPORTED_VOICES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown voice '{req.voice}'. Supported: {sorted(_SUPPORTED_VOICES)}",
        )

    tmp = tempfile.mktemp(prefix="qwen_tts_", suffix=".wav")
    try:
        save_to_wav(
            req.text,
            tmp,
            voice=req.voice,
            speed=req.speed,
            lang_code=req.lang_code,
        )
        # Stream the WAV file as the response body.
        return FileResponse(tmp, media_type="audio/wav", filename="speech.wav")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@app.post("/tts/json")
async def synthesize_json(
    req: TtsRequest,
):
    """Synthesise text to speech and return JSON metadata only (no audio)."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    if req.voice not in _SUPPORTED_VOICES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown voice '{req.voice}'. Supported: {sorted(_SUPPORTED_VOICES)}",
        )

    tmp = tempfile.mktemp(prefix="qwen_tts_", suffix=".wav")
    try:
        save_to_wav(
            req.text,
            tmp,
            voice=req.voice,
            speed=req.speed,
            lang_code=req.lang_code,
        )
        return TtsResponse(text=req.text, voice=req.voice)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@app.get("/health")
async def health():
    """Health-check endpoint."""
    return {"status": "ok", "service": "kokoro-tts"}


@app.get("/voices")
async def list_voices():
    """List all supported voice identifiers."""
    return {"voices": sorted(_SUPPORTED_VOICES)}


def main():
    """Run the service."""
    uvicorn.run(
        "backend.api.tts_service:app",
        host="0.0.0.0",
        port=8002,
        log_level="info",
    )


if __name__ == "__main__":
    main()