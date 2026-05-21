/**
 * ContextMenu.tsx — Right-click context menu rendered via React Portal.
 *
 * Dismisses on Escape, click outside, or scroll.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

export interface ContextMenuItem {
  label: string
  icon: React.ElementType
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // Delay so the triggering right-click doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener('keydown', onKey)
      document.addEventListener('mousedown', onClick)
      window.addEventListener('scroll', onClose, { once: true })
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll', onClose)
    }
  }, [onClose])

  // Clamp to viewport
  const style: React.CSSProperties = { position: 'fixed', zIndex: 9999 }
  if (typeof window !== 'undefined') {
    const w = 200 // estimated menu width
    const h = items.length * 38 + 16 // estimated height
    style.left = Math.min(position.x, window.innerWidth - w - 8)
    style.top = Math.min(position.y, window.innerHeight - h - 8)
  } else {
    style.left = position.x
    style.top = position.y
  }

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      style={style}
      className="w-48 bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1.5 overflow-hidden"
    >
      {items.map((item, i) => {
        const Icon = item.icon as React.ComponentType<{ className?: string }>
        return (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          disabled={item.disabled}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
            ${item.danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20' : 'text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/8'}
            ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}
          `}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
        </button>
        )
      })}
    </motion.div>,
    document.body,
  )
}
