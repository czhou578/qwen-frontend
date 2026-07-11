function MessageBubble({ message }) {
  const isUser = message.role === 'user'

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
          className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-[#2f2f2f] text-white'
              : 'text-[#d9d9d9]'
          }`}
        >
          {message.content}
        </div>

        {!isUser && message.id && (
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
            <button
              className="p-1 rounded hover:bg-[#202020] transition-colors text-[#8a8a8a] hover:text-white"
              title="Thumbs up"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 9V5C14 3.90356 13.3696 3.10364 12.5591 2.72863C11.829 2.39266 11.0021 2.44621 10.3426 2.87617L6 5.5L7 13H14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 22L20 17H13C12.2044 17 11.5 16.2956 11.5 15.5C11.5 14.902 11.8378 14.3796 12.3611 14.165L17 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="p-1 rounded hover:bg-[#202020] transition-colors text-[#8a8a8a] hover:text-white"
              title="Thumbs down"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 15V19C14 20.0964 13.3696 20.8964 12.5591 21.2714C11.829 21.6073 11.0021 21.5538 10.3426 21.1238L6 18.5L7 10H14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 2L20 7H13C12.2044 7 11.5 6.29563 11.5 5.5C11.5 4.90203 11.8378 4.37959 12.3611 4.16505L17 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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