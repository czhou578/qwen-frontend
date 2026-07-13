# Single-stage build: Python 3.11 + GPU-ready system deps.
# The NVIDIA Container Toolkit will make the GPU visible at runtime.
FROM python:3.11-slim

# System deps: libsndfile is required by torchaudio + transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# System timezone (helps with deterministic logging timestamps)
ENV TZ=Etc/UTC

# PyTorch CUDA 12.4 wheel (pip installs the non-cuda variants if no GPU,
# but on an NVIDIA host with nvidia-container-toolkit it picks CUDA).
ENV PYTORCH_CUDAArch="8.0"

WORKDIR /app

# 1. Copy requirements first (layer caching).
COPY backend/requirements.txt /app/requirements.txt
COPY backend/api/requirements.txt /app/api_requirements.txt
COPY backend/api/ /app/api/
# kokoro_service and parakeet_service must be at /app/ for Python imports
# (orchestrator.py uses: from kokoro_service.tts import ...)
COPY backend/kokoro_service/ /app/kokoro_service/
COPY backend/parakeet_service/ /app/parakeet_service/

# 2. Install Python deps
#    Use --no-cache-dir to save space in the image.
#    The PyTorch pip index is pinned to CUDA 12.4 (stable).
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cu124 \
    -r api_requirements.txt \
    -r requirements.txt

# Also install the heavier deps that weren't in requirements.txt
# but are needed at runtime (ASR model loading).
RUN pip install --no-cache-dir \
    torch --extra-index-url https://download.pytorch.org/whl/cu124 \
    torchaudio \
    transformers \
    misaki \
    librosa

# Create HF cache dir (ownership set at runtime by the volume mount,
# so we run as root to allow writes to /hf).
RUN mkdir -p /hf/models

# 3. Pre-download models at build time so containers start ready.
#    Set HF_HUB_ENABLE_MPI_TRANSFER=0 to avoid HuggingFace hub hangs.
#    The orchestrator's _preload_models() will also do this on startup,
#    but doing it here means `docker compose up` has already downloaded
#    the ~2 GB model before the first request.
#
#    NOTE: Model downloading during build requires network access
#    and may exceed the default 10-minute Docker build timeout.
#    If it times out, remove the RUN lines below and rely on the
#    _preload_models() startup hook (which downloads during container
#    first-start instead).
#
# RUN HF_HOME=/hf huggingface-cli download nvidia/parakeet-tdt-0.6b-v3 --local-dir /hf/models/parakeet-tdt-0.6b-v3 2>/dev/null || true
# RUN pip install kokoro 2>/dev/null && python -c "\
#     from kokoro_service.tts import _get_pipeline; _get_pipeline()" 2>/dev/null || true
#
# Environment for model caching:
ENV HF_HOME=/hf/models

EXPOSE 8080

# Start the FastAPI orchestrator
CMD ["uvicorn", "api.orchestrator:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]