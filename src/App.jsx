import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'

function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = (text) => {
    if (!text.trim()) return
    const userMessage = { id: Date.now(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    setTimeout(() => {
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `This is a simulated response to: "${text}"

In a real implementation, this would connect to an AI model to generate intelligent responses.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1500)
  }

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