'use client'

import { useEffect } from 'react'

type ToastProps = {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colorClass = {
    success: 'bg-[#0f766e]',
    error: 'bg-[#a54036]',
    info: 'bg-[#356d82]',
  }[type]

  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl px-5 py-3 text-white shadow-lg ${colorClass}`}>
      <span className="text-sm font-medium">{message}</span>
      <button aria-label="알림 닫기" onClick={onClose} className="ml-auto text-lg leading-none text-white/80 hover:text-white">&times;</button>
    </div>
  )
}

export type ToastState = {
  message: string
  type: 'success' | 'error' | 'info'
} | null
