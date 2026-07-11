import { useRef, useEffect } from 'react'

function MessageInput({ inputValue, onInputChange, onSend, isTyping }) {
  const textareaRef = useRef(null)

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
  }, [inputValue])

  const handleSubmit = () => {
    if (inputValue.trim() && !isTyping) {
      onSend(inputValue.trim())
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = '44px'
        }
      }, 100)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full">
      <div className="relative bg-[#212121] rounded-xl border border-[#2f2f2f] shadow-lg focus-within:border-[#4f4f4f] transition-colors">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          disabled={isTyping}
          className="w-full bg-transparent text-white placeholder-[#6b6b6b] px-4 py-3 pr-12 resize-none outline-none text-sm max-h-[200px] min-h-[44px]"
        />
        <div className="absolute right-2 top-2">
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isTyping}
            className={`p-1.5 rounded-md transition-colors ${inputValue.trim() && !isTyping
                ? 'text-white hover:bg-[#2f2f2f]'
                : 'text-[#6b6b6b] cursor-default'
              }`}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 19V5M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#6b6b6b] mt-2 px-4">
        Qwen can make mistakes. Consider checking important information.
      </p>
    </div>
  )
}

export default MessageInput