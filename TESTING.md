# How to Test the Full Orchestration Pipeline

You need two things running:

1. **vLLM** on port 8000 (already in `vllm.txt`)
2. **The orchestrator** on port 8080

---

## 1. Start vLLM (in one terminal)

```bash
docker run -d \
  --name vllm-qwen36-nvfp4 \
  --gpus all \
  --ipc=host \
  -p 8000:8000 \
  -e HF_HUB_DISABLE_XET=1 \
  -e HF_HUB_DOWNLOAD_TIMEOUT=60 \
  -e HF_HUB_ETAG_TIMEOUT=60 \
  -e HF_HOME=/hf \
  -v "$HOME/.cache/huggingface:/hf" \
  ghcr.io/spark-arena/dgx-vllm-eugr-nightly-tf5:latest \
  vllm serve RedHatAI/Qwen3.6-35B-A3B-NVFP4 \
    --served-model-name qwen3.6-35b-a3b-nvfp4 \
    --host 0.0.0.0 \
    --port 8000 \
    --tensor-parallel-size 1 \
    --gpu-memory-utilization 0.93 \
    --max-model-len 262144 \
    --moe_backend flashinfer_cutlass \
    --enable-auto-tool-choice \
    --tool-call-parser qwen3_xml \
    --reasoning-parser qwen3 \
    --speculative-config '{"method":"mtp","num_speculative_tokens":3}' \
    --trust-remote-code \
    --kv-cache-dtype fp8_e4m3 \
    --enable-prefix-caching \
    --enable-chunked-prefill \
    --max-num-batched-tokens 8192 \
    --async-scheduling
```

Wait for it to load (check `docker logs vllm-qwen36-nvfp4`).

---

## 2. Install the orchestrator's extra dependency

```bash
cd /home/colin-spark/Projects/qwen-frontend/backend && pip install httpx
```

---

## 3. Start the orchestrator (in another terminal)

```bash
cd /home/colin-spark/Projects/qwen-frontend/backend
VLLM_BASE_URL=http://localhost:8000 \
python -m api.orchestrator
```

Or alternatively:

```bash
cd /home/colin-spark/Projects/qwen-frontend/backend
python api/orchestrator.py
```

---

## 4. Test it

### Health check

```bash
curl -s http://localhost:8080/orchestrate | python3 -m json.tool
```

### Text-chat variant (no ASR, skips straight to vLLM → TTS → WAV)

```bash
curl -s -X POST http://localhost:8080/orchestrate/text \
  -H 'Content-Type: application/json' \
  -d '{"text": "Say hello in a friendly way"}' \
  -o /tmp/response.wav \
  -w "%{http_code}"
```

This will download a WAV file you can play with:

```bash
aplay /tmp/response.wav
# or
vlc /tmp/response.wav
```

### Full audio pipeline (upload audio → ASR → vLLM → TTS → WAV)

```bash
# Use any audio file you have
curl -s -X POST "http://localhost:8080/orchestrate/audio?voice=af_bella" \
  -F 'file=@/path/to/your/audio.wav' \
  -o /tmp/response.wav \
  -w "%{http_code}"
```

---

## Key things to know

The orchestrator imports `parakeet.asr` and `kokoro.tts` directly as Python modules (not as separate HTTP services), so it needs to be run from the `backend/` directory on the same machine where those packages are installed. Only vLLM is called over HTTP.