import { useRef, useState, useCallback } from 'react'

/**
 * Simple audio player with play/pause toggle and progress indicator.
 *
 * @param {string} src - Audio blob URL
 * @param {string} [durationText] - Optional fixed duration display (e.g. "Recording…")
 */
function AudioPlayer({ src, durationText }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(null)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const onPlay = useCallback(() => setIsPlaying(true), [])
  const onPause = useCallback(() => setIsPlaying(false), [])
  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    setProgress(audio.currentTime / audio.duration)
  }, [])

  const onEnded = useCallback(() => {
    setIsPlaying(false)
    setProgress(1)
  }, [])

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current?.duration) {
      setProgress(0)
    }
  }, [])

  const seek = useCallback((e) => {
    if (!progressRef.current || !audioRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = x * audioRef.current.duration
    setProgress(x)
  }, [])

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  const audioDuration = audioRef.current?.duration || 0

  return (
    <div className="flex items-center gap-2">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        onPlay={onPlay}
        onPaused={onPause}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        className="hidden"
      />

      {/* Play/pause button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2f2f2f] flex items-center justify-center hover:bg-[#3a3a3a] transition-colors"
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? (
          // Pause icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          // Play icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5.13v13.74a1 1 0 0 0 1.53.85l11-6.87a1 1 0 0 0 0-1.71l-11-6.87A1 1 0 0 0 8 5.13Z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="flex-1 h-2 bg-[#2f2f2f] rounded-full cursor-pointer overflow-hidden"
        onClick={seek}
      >
        <div
          className="h-full bg-white rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Time / status */}
      <span className="text-xs text-[#8a8a8a] tabular-nums min-w-[3.5rem] text-right">
        {durationText || (audioDuration ? formatTime(audioDuration) : '0:00')}
      </span>
    </div>
  )
}

export default AudioPlayer