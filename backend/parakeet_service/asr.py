"""Parakeet ASR — speech-to-text using nvidia/parakeet-tdt-0.6b-v3."""

import logging
from pathlib import Path
from transformers import pipeline

logger = logging.getLogger(__name__)

# Module-level singleton so the model is loaded once and reused.
_pipe: pipeline = None


def _get_pipeline():
    """Lazy-initialise the ASR pipeline.

    First call downloads and loads the ~2 GB model; subsequent calls
    return the cached instance.
    """
    global _pipe
    if _pipe is None:
        logger.info("Loading Parakeet ASR model (first run downloads ~2 GB)…")
        _pipe = pipeline(
            "automatic-speech-recognition",
            model="nvidia/parakeet-tdt-0.6b-v3",
            local_files_only=False,  # set True after first download
        )
        logger.info("Parakeet ASR model loaded.")
    return _pipe


def transcribe(audio_path: str | Path) -> str:
    """Transcribe an audio file to text.

    Parameters
    ----------
    audio_path : str or Path
        Path to a WAV/FLAC audio file.

    Returns
    -------
    str
        The recognised text, uppercased and stripped.
    """
    audio_path = Path(audio_path)
    if not audio_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    pipe = _get_pipeline()
    result = pipe(str(audio_path))
    return result.get("text", "").upper().strip()


def transcribe_raw(audio_path: str | Path) -> dict:
    """Return the full pipeline output dict (timing, chunks, etc.)."""
    pipe = _get_pipeline()
    return pipe(str(audio_path))


# --------------- CLI entry point ---------------

if __name__ == "__main__":
    import sys
    import logging

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    audio_file = sys.argv[1] if len(sys.argv) > 1 else "../backend/output.wav"
    print(f"Transcribing: {audio_file}")
    text = transcribe(audio_file)
    print(f"Result: {text}")