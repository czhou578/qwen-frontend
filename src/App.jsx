import { useState, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'

const API_BASE = '/orchestrate'

function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const uploadAbortRef = useRef(null)

  const sendMessage = useCallback((text) => {
    if (!text.trim() || isTyping) return

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    // Create placeholder for assistant response
    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', _streaming: true }])

    // Stream through proxy server (API key handled server-side)
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.6-35b-a3b-nvfp4',
        messages: [{ role: 'user', content: text }],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.95,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') break

            try {
              const json = JSON.parse(data)
              const token = json.choices?.[0]?.delta?.content
              if (token) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + token }
                    : m
                ))
              }
            } catch {
              // skip malformed SSE fragments
            }
          }
        }

        // Remove streaming flag
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, _streaming: false } : m
        ))
        setIsTyping(false)
      })
      .catch((err) => {
        // Error fallback
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `\n\n⚠ Error connecting to proxy: ${err.message}`, _streaming: false }
            : m
        ))
        setIsTyping(false)
      })
  }, [isTyping])

  const newChat = () => {
    setMessages([])
    setInputValue('')
  }

  // Handle recorded audio blob → full pipeline
  const handleRecording = useCallback((blob) => {
    if (isTyping) return

    // 1. Create user audio message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      type: 'audio',
      url: URL.createObjectURL(blob),
      contentType: blob.type,
    }
    setMessages(prev => [...prev, userMsg])

    // Create placeholder for assistant text response
    const assistantId = Date.now() + 1
    const assistantMsg = { id: assistantId, role: 'assistant', content: '', _streaming: true, _voiceStatus: 'uploading' }

    // 2. Two parallel requests:
    //    a) Text from audio (transcript + vLLM response)
    //    b) Audio from audio (TTS WAV blob)
    const controller = new AbortController()
    uploadAbortRef.current = () => controller.abort()

    setMessages(prev => [...prev, assistantMsg])

    const uploadText = fetch(`${API_BASE}/text-from-audio`, {
      method: 'POST',
      body: blob,
      signal: controller.signal,
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })

    const uploadAudio = fetch(`${API_BASE}/audio`, {
      method: 'POST',
      body: blob,
      signal: controller.signal,
    })
    .then(async res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const audioBlob = await res.blob()
      return URL.createObjectURL(audioBlob)
    })

    // 3. Wait for text response to update the streaming message
    uploadText
      .then(data => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, _streaming: false, _voiceStatus: null, content: data.text }
            : m
        ))
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, _streaming: false, _voiceStatus: null, content: `\n\n⚠ Error: ${err.message}` }
              : m
          ))
        }
      })

    // 4. When audio is ready, attach TTS URL to the same assistant message
    uploadAudio
      .then(audioUrl => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, audioUrl }
            : m
        ))
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('TTS audio failed:', err)
        }
      })
      .finally(() => {
        setIsTyping(false)
        uploadAbortRef.current = null
      })
  }, [isTyping])

  return (
    <div className="flex h-screen w-full bg-[#171717] text-white overflow-hidden">
      <Sidebar onNewChat={newChat} />
      <ChatArea
        messages={messages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={sendMessage}
        isTyping={isTyping}
        onRecording={handleRecording}
        isRecording={isRecording}
        onMicStart={() => setIsRecording(true)}
        onMicStop={() => setIsRecording(false)}
      />
    </div>
  )
}

export default App