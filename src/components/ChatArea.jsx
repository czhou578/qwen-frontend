import { useEffect, useRef } from 'react'
import MessageInput from './MessageInput'
import MessageBubble from './MessageBubble'
import Footer from './Footer'

function ChatArea({ messages, inputValue, onInputChange, onSend, isTyping, onToggleSidebar }) {
  const scrollRef = useRef(null)

  // Auto-scroll when messages change or typing ends
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  return (
    <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2f2f2f]">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-[#202020] transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-lg hover:bg-[#202020] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <span className="font-medium">Qwen</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="w-24" />
      </div>

      {/* Chat content - scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Welcome state */
          <div className="flex flex-col items-center h-full">
            <div className="flex flex-col items-center pt-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" />
                </svg>
              </div>
              <h1 className="text-2xl font-normal text-white mb-6">
                How can I help you today?
              </h1>
            </div>
          </div>
        ) : (
          /* Messages list - full width */
          <div className="pb-4">
            {messages.map((msg) => {
              // Streaming messages: render the accumulated content with a cursor
              if (msg._streaming) {
                return (
                  <div key={msg.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      {msg.content ? (
                        <>
                          <p className="text-sm whitespace-pre-wrap text-[#d9d9d9] pr-1">{msg.content}</p>
                          <span className="inline-block w-[2px] h-[1em] bg-white animate-pulse ml-0.5"></span>
                        </>
                      ) : (
                        <>
                          <div className="flex gap-1 mt-3">
                            <span className="w-2 h-2 bg-[#8a8a8a] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-[#8a8a8a] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-[#8a8a8a] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span className="inline-block w-[2px] h-[1em] bg-white animate-pulse ml-0.5 mt-1.5"></span>
                        </>
                      )}
                    </div>
                  </div>
                )
              }
              return <MessageBubble key={msg.id} message={msg} />
            })}
          </div>
        )}
      </div>

      {/* Input bar - fixed at bottom, full width */}
      <div className="flex-shrink-0 pb-6 px-4">
        <MessageInput
          inputValue={inputValue}
          onInputChange={onInputChange}
          onSend={onSend}
          isTyping={isTyping}
        />
      </div>

      {/* Footer - only shown during conversations */}
      {messages.length > 0 && (
        <div className="flex-shrink-0 border-t border-[#2f2f2f]">
          <Footer />
        </div>
      )}
    </div>
  )
}

export default ChatArea