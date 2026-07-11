import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'

function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)

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

  return (
    <div className="flex h-screen w-full bg-[#171717] text-white overflow-hidden">
      <Sidebar onNewChat={newChat} />
      <ChatArea
        messages={messages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={sendMessage}
        isTyping={isTyping}
      />
    </div>
  )
}

export default App
