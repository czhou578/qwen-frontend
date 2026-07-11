import { useState } from 'react'

function Sidebar() {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="w-[260px] flex flex-col bg-[#171717] h-full">
      {/* Top section */}
      <div className="flex items-center justify-between px-2.5 py-3">
        <button className="flex items-center gap-3 px-3.5 py-2 text-sm text-white rounded-lg border border-[#2f2f2f] hover:bg-[#202020] transition-colors text-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          New chat
        </button>
        <button
          className="p-2 rounded-md hover:bg-[#202020] transition-colors"
          onClick={() => setShowMenu(!showMenu)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Conversation history - empty by default */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* No old conversations here */}
      </div>

      {/* Separator */}
      <div className="px-2.5">
        <div className="border-t border-[#2f2f2f]"></div>
      </div>

      {/* Upgrade button */}
      <div className="px-2.5 py-2">
        <button className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-white rounded-lg border border-[#2f2f2f] hover:bg-[#202020] transition-colors text-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          Upgrade to Plus
        </button>
      </div>

      {/* User menu */}
      <div className="px-2.5 py-2">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white rounded-lg hover:bg-[#202020] transition-colors text-left">
          <div className="w-6 h-6 rounded-full bg-[#4f4f4f] flex items-center justify-center text-xs font-medium">
            C
          </div>
          <span className="flex-1 truncate">Colin</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-[#8a8a8a]">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default Sidebar