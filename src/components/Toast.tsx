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
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }[type]

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-lg text-white shadow-lg ${colorClass} animate-fadeInUp`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
    </div>
  )
}

export type ToastState = {
  message: string
  type: 'success' | 'error' | 'info'
} | null
