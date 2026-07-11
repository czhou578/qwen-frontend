import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables from this file's directory
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(scriptDir, '.env')
dotenv.config({ path: envPath, override: true })

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001
const VLLM_BASE_URL = process.env.VLLM_BASE_URL || 'http://localhost:8000'
const VLLM_API_KEY = process.env.VLLM_API_KEY || ''

// Allow CORS for frontend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', vllmUrl: VLLM_BASE_URL, apiKey: VLLM_API_KEY ? '***' : 'none' })
})

// Proxy /api/chat to vLLM
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now()

  try {
    const { messages, model, stream, max_tokens, temperature, top_p } = req.body

    console.log('=== Proxy request ===')
    console.log('URL:', `${VLLM_BASE_URL}/v1/chat/completions`)
    console.log('Model:', model || 'qwen3.6-35b-a3b-nvfp4')
    console.log('Stream:', stream ?? true)
    console.log('Messages:', JSON.stringify(messages).slice(0, 100))

    const vllmUrl = `${VLLM_BASE_URL}/v1/chat/completions`
    const headers = { 'Content-Type': 'application/json' }
    if (VLLM_API_KEY && VLLM_API_KEY !== '') {
      headers['Authorization'] = `Bearer ${VLLM_API_KEY}`
    }

    console.log('Request headers:', JSON.stringify(headers))

    const response = await fetch(vllmUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'qwen3.6-35b-a3b-nvfp4',
        messages: messages || [],
        stream: stream ?? true,
        max_tokens: max_tokens || 4096,
        temperature: temperature || 0.7,
        top_p: top_p || 0.95,
      }),
    })

    console.log('vLLM status:', response.status, response.statusText)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('vLLM error response:', errorText)
      console.error('Elapsed:', Date.now() - startTime, 'ms')
      return res.status(response.status).json({
        error: `vLLM returned ${response.status}: ${errorText.slice(0, 500)}`,
        status: response.status,
        statusText: response.statusText,
      })
    }

    // Stream the response if requested
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      // Pipe the vLLM response body directly to the client
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const data = decoder.decode(value, { stream: true })
          const lines = data.split('\n').filter(line => line.trim())
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6)
              if (payload === '[DONE]') {
                res.write(`${line}\n\n`)
                res.end()
                return
              }
              res.write(`${line}\n\n`)
            }
          }
        }
      } catch (err) {
        console.error('Stream read error:', err.message)
      } finally {
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      }

      return
    } else {
      // Non-streaming response
      const data = await response.json()
      res.json(data)
    }

    console.log('Request completed:', Date.now() - startTime, 'ms')
  } catch (err) {
    console.error('Proxy error:', err.message)
    console.error('Stack:', err.stack)
    console.error('Elapsed:', Date.now() - startTime, 'ms')
    res.status(500).json({
      error: `Proxy error: ${err.message}`,
      details: err.toString(),
      vllmUrl: VLLM_BASE_URL,
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`)
  console.log(`vLLM API: ${VLLM_BASE_URL}`)
  console.log(`API Key: ${VLLM_API_KEY ? '*** configured' : 'none (vLLM should accept requests without auth)'}`)
})