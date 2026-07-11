"""Kokoro TTS — text-to-speech.

Wraps the kokoro library (KPipeline) so the model is loaded once and reused.

Usage
-----
    from kokoro.tts import synthesize, save_to_wav

    samples, sample_rate = synthesize("Hello, world!")
    save_to_wav(samples, sample_rate, "output.wav")
"""

import logging
from pathlib import Path

from kokoro import KPipeline

logger = logging.getLogger(__name__)

# Supported voice names: "a" / "b" (American English) or "j" / "k" (Japanese)
# Full list lives in the misaki library — run the quick lookup in __main__ below.
_SUPPORTED_VOICES = {"a", "b", "j", "k", "af_bella", "af_nicole", "am_adam", "am_emma", "am_michael",
                     "bm_george", "bm_lewis", "bf_sarah", "bf_yara", "af_jaffle", "af_sky",
                     "am_orell", "am_steven", "af_nicole", "af_rachel", "am_brian", "af_swoop",
                     "am_tim", "am_ursula", "am_wendy", "bf_hailey", "bf_mia", "bf_willow",
                     "af_alice", "af_wren", "am_santa", "bm_daniel", "am_sarah", "am_michael"}

# Module-level singleton — lazy-init so we don't load on import.
_pipeline = None


def _get_pipeline(lang_code: str = "a", device: str | None = None):
    """Lazy-initialise and return the KPipeline singleton.

    lang_code: "a" = American English, "b" = British English.
    """
    global _pipeline
    if _pipeline is None:
        logger.info("Loading Kokoro TTS pipeline (lang=%s) …", lang_code)
        _pipeline = KPipeline(lang_code=lang_code, device=device)
        logger.info("Kokoro TTS pipeline loaded.")
    return _pipeline


def synthesize(
    text: str,
    *,
    voice: str = "af_bella",
    speed: float = 1.0,
    lang_code: str = "a",
    device: str | None = None,
) -> tuple:
    """Generate audio samples from text.

    Parameters
    ----------
    text : str
        Text to speak.
    voice : str
        Voice identifier (e.g. "af_bella", "am_adam").
    speed : float
        Speed multiplier (> 1 = faster).
    lang_code : str
        Language code ("a" = US English, "b" = UK English).
    device : str, optional
        "cuda", "cpu", or None for auto.

    Returns
    -------
    tuple of (samples: torch.Tensor, sample_rate: int)
    """
    pipeline = _get_pipeline(lang_code=lang_code, device=device)
    generator = pipeline.generate_from_tokens(text, voice=voice, speed=speed)

    # kokero generate_from_tokens is a generator — consume the first result.
    for result in generator:
        audio = result.audio  # torch.Tensor
        break
    else:
        raise ValueError("Kokoro returned no audio output — check the input text.")

    sample_rate = 24000  # Kokoro's fixed sample rate
    return audio, sample_rate


def save_to_wav(
    text: str,
    output_path: str | Path = "output.wav",
    *,
    voice: str = "af_bella",
    speed: float = 1.0,
    lang_code: str = "a",
    device: str | None = None,
) -> Path:
    """Generate audio and save to a WAV file.

    Parameters
    ----------
    text : str
        Text to speak.
    output_path : str or Path
        Where to write the WAV file.
    voice, speed, lang_code, device : see :func:`synthesize`

    Returns
    -------
    Path
        Path to the written WAV file.
    """
    import torch
    import torchaudio

    audio, sample_rate = synthesize(
        text, voice=voice, speed=speed, lang_code=lang_code, device=device
    )

    # Ensure 1D tensor and float32 for torchaudio
    audio = audio.float().cpu()
    if audio.dim() > 1:
        audio = audio.squeeze()

    output_path = Path(output_path)
    torchaudio.save(str(output_path), audio.unsqueeze(0), sample_rate)
    logger.info("Saved TTS output to %s", output_path)
    return output_path


# --------------- CLI entry point ---------------

if __name__ == "__main__":
    import sys

    text = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Hello, this is a test of the Kokoro text-to-speech engine."
    voice = sys.argv[2] if len(sys.argv) > 2 else "af_bella"
    out = sys.argv[3] if len(sys.argv) > 3 else "output.wav"

    print(f"Synthesising: {text!r}  voice={voice}")
    path = save_to_wav(text, out, voice=voice)
    print(f"Saved to {path}")