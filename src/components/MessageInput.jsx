import { useRef, useEffect, useState } from 'react'

function MessageInput({
  inputValue,
  onInputChange,
  onSend,
  isTyping,
  onRecording,
  isRecording: parentIsRecording,
  onMicStart,
  onMicStop,
}) {
  const textareaRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const [permissionError, setPermissionError] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

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

  // --- Audio recording ---
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []
        if (onRecording) onRecording(blob)
      }

      mediaRecorder.start()
      if (onMicStart) onMicStart()
      setPermissionError(false)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch {
      setPermissionError(true)
      setTimeout(() => setPermissionError(false), 3000)
    }
  }

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (onMicStop) onMicStop()
  }

  const handleMicToggle = () => {
    // If already recording, stop it
    if (parentIsRecording) {
      stopRecording()
    } else if (isTyping) {
      return  // prevent re-entry while backend is processing
    } else {
      startRecording()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="w-full">
      <div className="relative bg-[#212121] rounded-xl border border-[#2f2f2f] shadow-lg focus-within:border-[#4f4f4f] transition-colors">
        <div className="flex items-end gap-0 px-2 py-2">
          {/* Mic button */}
          <button
            onClick={handleMicToggle}
            disabled={isTyping}
            className={`flex-shrink-0 p-2 rounded-md transition-colors ${isTyping ? 'opacity-40 cursor-default' : ''
              } ${parentIsRecording
                ? 'text-red-400 bg-[#2f2f2f]'
                : inputValue.trim() && !isTyping
                  ? 'text-white hover:bg-[#2f2f2f]'
                  : 'text-[#6b6b6b] cursor-default'
              }`}
            aria-label={parentIsRecording ? 'Stop recording' : 'Record audio'}
          >
            {parentIsRecording ? (
              /* Stop icon */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            ) : (
              /* Mic icon */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1C13.6569 1 15 2.34315 15 4V10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10V4C9 2.34315 10.3431 1 12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            disabled={isTyping}
            className="flex-1 bg-transparent text-white placeholder-[#6b6b6b] resize-none outline-none text-sm max-h-[200px] min-h-[44px]"
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isTyping}
            className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${inputValue.trim() && !isTyping
                ? 'text-white hover:bg-[#2f2f2f]'
                : 'text-[#6b6b6b] cursor-default'
              } ${isTyping ? 'opacity-40' : ''}`}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 19V5M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Recording indicator */}
        {parentIsRecording && (
          <div className="flex items-center gap-2 px-4 py-1.5 border-t border-[#2f2f2f]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-medium text-red-400 tabular-nums">{formatTime(recordingTime)}</span>
            <span className="text-xs text-[#6b6b6b]">Tap to stop</span>
          </div>
        )}

        {/* Permission error toast */}
        {permissionError && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#3d2f2f] border border-[#4f3a3a] text-red-300 text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
            Microphone access denied
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-[#6b6b6b] mt-2 px-4">
        Qwen can make mistakes. Consider checking important information.
      </p>
    </div>
  )
}

export default MessageInput