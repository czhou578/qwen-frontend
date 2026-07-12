"""FastAPI orchestrator — wires ASR → vLLM → Kokoro TTS into a single endpoint.

End-to-end flow::

    frontend (audio)  →  ASR  →  text
    text              →  vLLM →  response text
    response text     →  Kokoro →  audio bytes
    audio bytes       →  streamed back to frontend

Listens on port 8080.
"""

import asyncio
import json
import logging
import os
import sys
import tempfile
import warnings
import torch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)

logger = logging.getLogger("orchestrator")

# Suppress library-level noise from transformers/torch/kokoro.
# These are informational/deprecation warnings from third-party code — the pipeline
# works correctly with the defaults; we just don't want the noise in logs.
warnings.filterwarnings("ignore", module="transformers")
warnings.filterwarnings("ignore", module="torch")
warnings.filterwarnings("ignore", module="kokoro")
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# httpx logs every HTTP request at INFO level, including HF HEAD → 302 redirects.
# Suppress the request log; errors are still emitted via logger.error() above.
import httpx

httpx_logger = logging.getLogger("httpx")
httpx_logger.setLevel(logging.WARNING)

# Also quieten the hf hub / misaki / kokoro noise (HEAD → 302, deprecations, …)
for _quiet in ("huggingface_hub", "misaki", "kokoro"):
    logging.getLogger(_quiet).setLevel(logging.WARNING)

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

from kokoro_service.tts import save_to_wav, synthesize, _get_pipeline as _get_tts_pipeline
from parakeet_service.asr import transcribe, _get_pipeline as _get_asr_pipeline

# --------------- configuration ---------------

VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://localhost:8000")
VLLM_API_KEY = os.environ.get("VLLM_API_KEY", "")
VLLM_MODEL = os.environ.get("VLLM_MODEL", "qwen3.6-35b-a3b-nvfp4")
TTS_VOICE = os.environ.get("TTS_VOICE", "af_bella")

# --------------- app ---------------

def _preload_models():
    """Eagerly load ASR and TTS models at startup so the first request
    doesn't pay the cold-start latency or emit noisy warnings mid-request.
    """
    import torch

    # ASR — loads ~2 GB
    logger.info("Loading Parakeet ASR model (first run downloads ~2 GB)…")
    _get_asr_pipeline()
    logger.info("Parakeet ASR model loaded.")

    # Kokoro TTS — loads Kokoro weights on first pipeline call
    logger.info("Loading Kokoro TTS pipeline…")
    _get_tts_pipeline()
    logger.info("Kokoro TTS pipeline loaded.")


app = FastAPI(
    title="Qwen Orchestrator",
    description="ASR → vLLM → Kokoro TTS pipeline (single audio-in / audio-out endpoint).",
)

# --------------- startup ---------------


@app.on_event("startup")
def startup():
    """Warm up ASR and TTS models and make all log handlers flush
    after each write so logs appear in the terminal immediately."""
    _preload_models()

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


def _call_vllm_sync(text: str, *, model: str, max_tokens: int,
                     temperature: float, top_p: float) -> str:
    """Send *text* to vLLM and return the assistant reply as a plain string.

    Uses a synchronous httpx.Client so this can be called from sync endpoints
    without needing an event loop.
    """
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
        "stream": False,
    })

    import httpx

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(url, headers=headers, data=payload)
        if not resp.is_success:
            detail = resp.text[:500]
            logger.error("vLLM error %s: %s", resp.status_code, detail)
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"vLLM returned {resp.status_code}: {detail}",
            )
        body = resp.json()
        return body["choices"][0]["message"]["content"].strip()


def _tts_stream_sync(text: str, voice: str) -> StreamingResponse:
    """Synchronous version — used by sync endpoints so the generator
    runs in uvicorn's background thread rather than on the event loop."""

    def stream_bytes():
        tmp = tempfile.mktemp(prefix="qwen_tts_", suffix=".wav")
        try:
            logger.info("Running TTS for %d characters …", len(text))
            logger.info("Beginning save_to_wav()")
            logger.info(
                "Allocated: %.2f GB, Reserved: %.2f GB",
                torch.cuda.memory_allocated() / 1024**3,
                torch.cuda.memory_reserved() / 1024**3,
            )

            try:
                save_to_wav(text, tmp, voice=voice)
            except Exception:
                logger.exception("save_to_wav() failed")
                raise

            logger.info("save_to_wav() finished")
            logger.info("Saved TTS output to %s", tmp)
            with open(tmp, "rb") as fh:
                while True:
                    chunk = fh.read(8192)
                    if not chunk:
                        break
                    yield chunk
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

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

    All blocking calls (ASR, file I/O) are pushed off the event loop
    with ``asyncio.to_thread()``.  The TTS generation runs inside the
    ``StreamingResponse`` generator which Starlette executes on a
    background thread, so it never blocks the event loop.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    # 1. Write audio to temp file for ASR
    tmp_audio = tempfile.mktemp(prefix="qwen_asr_")
    try:
        content = await file.read()  # fastapi UploadFile.read() is async
        logger.info("Reading uploaded audio (%d bytes)…", len(content))
        with open(tmp_audio, "wb") as fh:
            fh.write(content)

        # 2. ASR → text (blocking GPU call → background thread)
        logger.info("Running ASR on uploaded audio …")
        text = await asyncio.to_thread(transcribe, tmp_audio)
        if not text:
            raise HTTPException(status_code=400, detail="ASR returned empty transcription.")
        logger.info("ASR result: %s", text)

        # 3. vLLM → response (async — httpx doesn't block the event loop)
        logger.info("Calling vLLM with: %s", text)
        response_text = await _call_vllm(
            text,
            model=VLLM_MODEL,
            max_tokens=2048,
            temperature=0.7,
            top_p=0.95,
        )
        logger.info("vLLM response length: %d bytes", len(response_text))

    finally:
        if os.path.exists(tmp_audio):
            os.unlink(tmp_audio)

    # 4. Kokoro TTS → stream audio (blocking done in background thread)
    return _tts_stream_sync(response_text, voice=voice)


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
    return await _tts_stream_sync(response_text, req.voice)


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