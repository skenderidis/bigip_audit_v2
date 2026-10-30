import { useEffect, useRef, useState } from 'react'

/**
 * Anchors a floating panel (dropdown, popover) to a trigger button while
 * rendering it outside the normal flow, so a card's `overflow-hidden` or a
 * table's scroll container can't clip it.
 *
 * Returns refs to attach to the trigger and the panel, plus a ready-made
 * `position: fixed` style. Callers render the panel through `createPortal`
 * into document.body.
 *
 * Two things this handles that a naive `absolute` panel does not:
 *  - Re-measures on scroll (capture phase, so inner scroll containers count)
 *    and resize, keeping the panel glued to a trigger that moves.
 *  - Treats clicks inside the portalled panel as inside, not outside. The
 *    panel is no longer a DOM descendant of the trigger, so a plain
 *    `wrapper.contains(target)` check would close the menu on the first
 *    click of any item within it.
 */
export function useAnchoredPanel(open: boolean, onClose: () => void) {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Parked offscreen until measured, so the panel never flashes at 0,0.
  // zIndex sits below the z-[70] event-modal overlay, above all page content.
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: pos?.top ?? -9999,
    right: pos?.right ?? 0,
    zIndex: 50,
  }

  return { btnRef, panelRef, panelStyle }
}
