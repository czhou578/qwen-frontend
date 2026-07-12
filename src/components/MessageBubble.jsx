import AudioPlayer from './AudioPlayer'

function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  // Helper: render content based on message type
  function renderContent() {
    // User audio message
    if (message.type === 'audio') {
      return (
        <AudioPlayer src={message.url} />
      )
    }

    // Assistant audio-text combo: content is text, audioUrl triggers audio player
    if (message.role === 'assistant' && message.audioUrl) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm whitespace-pre-wrap text-[#d9d9d9] pr-1">{message.content}</p>
          <div className="mt-1">
            <AudioPlayer src={message.audioUrl} />
          </div>
        </div>
      )
    }

    // Regular text message
    return <p className="text-sm whitespace-pre-wrap text-[#d9d9d9] pr-1">{message.content}</p>
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        /* AI avatar */
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" />
          </svg>
        </div>
      )}

      {/* Message content container */}
      <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2 rounded-2xl text-sm break-words ${
            isUser
              ? 'bg-[#2f2f2f] text-white'
              : 'text-[#d9d9d9]'
          }`}
        >
          {renderContent()}
        </div>

        {/* Action buttons for assistant messages */}
        {!isUser && message.id && message.content && (
          <div className="flex items-center gap-2 mt-1.5 ml-1">
            <button
              className="p-1 rounded hover:bg-[#202020] transition-colors text-[#8a8a8a] hover:text-white"
              title="Copy"
              onClick={() => navigator.clipboard?.writeText(message.content)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="p-1 rounded hover:bg-[#202020] transition-colors text-[#8a8a8a] hover:text-white"
              title="Regenerate"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.55 13.39A9 9 0 1 0 6.4 6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isUser && (
        /* User avatar - right side */
        <div className="w-7 h-7 rounded-full bg-[#4f4f4f] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
          C
        </div>
      )}
    </div>
  )
}

export default MessageBubble