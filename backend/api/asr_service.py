"""FastAPI service wrapping the Parakeet ASR module — listens on port 8001."""

import logging
import os
import tempfile

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from parakeet.asr import transcribe, transcribe_raw

logger = logging.getLogger(__name__)


class AsrResponse(BaseModel):
    """Standard ASR API response."""

    text: str
    timing: dict | None = None


app = FastAPI(
    title="Parakeet ASR Service",
    description="Speech-to-text API backed by nvidia/parakeet-tdt-0.6b-v3.",
)


@app.post("/asr", response_model=AsrResponse)
async def recognize(file: UploadFile = File(...)):
    """Transcribe uploaded audio to text.

    Accepted formats: WAV, FLAC, MP3, M4A, OGG (handled by the pipeline).
    Returns the recognised text in uppercase.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    tmp = tempfile.mktemp(prefix="qwen_asr_")
    try:
        with open(tmp, "wb") as fh:
            fh.write(content)
        text = transcribe(tmp)
        return AsrResponse(text=text)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@app.post("/asr/raw")
async def recognize_raw(file: UploadFile = File(...)):
    """Transcribe and return the full pipeline output (timing, chunks, etc.)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    tmp = tempfile.mktemp(prefix="qwen_asr_")
    try:
        with open(tmp, "wb") as fh:
            fh.write(content)
        result = transcribe_raw(tmp)
        return JSONResponse(content=result)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@app.get("/health")
async def health():
    """Health-check endpoint."""
    return {"status": "ok", "service": "parakeet-asr"}


def main():
    """Run the service."""
    uvicorn.run(
        "backend.api.asr_service:app",
        host="0.0.0.0",
        port=8001,
        log_level="info",
    )


if __name__ == "__main__":
    main()