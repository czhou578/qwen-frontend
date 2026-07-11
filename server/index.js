import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env')
dotenv.config({ path: envPath })

const app = express()
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

// Proxy /api/chat to vLLM
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, stream, max_tokens, temperature, top_p } = req.body

    const vllmBody = {
      model: model || 'qwen3.6-35b-a3b-nvfp4',
      messages,
      stream: stream ?? true,
      max_tokens: max_tokens || 4096,
      temperature: temperature || 0.7,
      top_p: top_p || 0.95,
    }

    const response = await fetch(`${VLLM_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VLLM_API_KEY}`,
      },
      body: JSON.stringify(vllmBody),
    })

    if (!response.ok) {
      const error = await response.text()
      return res.status(response.status).json({ error })
    }

    // Stream the response if requested
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') break

            res.write(`data: ${data}\n\n`)
          }
        }
      } finally {
        reader.releaseLock()
      }
    } else {
      // Non-streaming response
      const data = await response.json()
      res.json(data)
    }

  } catch (err) {
    console.error('Proxy error:', err.message)
    res.status(500).json({ error: 'Failed to proxy request to vLLM' })
  }
})

// Serve static files from dist (production)
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '..', 'dist')
  app.use(express.static(distPath))

  // Serve index.html for all routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`)
  console.log(`vLLM API: ${VLLM_BASE_URL}`)
})