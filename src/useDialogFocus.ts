import { useEffect, useRef } from 'react'

export function useDialogFocus<T extends HTMLElement>(onClose: () => void, enabled = true) {
  const ref = useRef<T>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!enabled) return
    const previous = document.activeElement as HTMLElement | null
    const panel = ref.current
    const selector = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, a[href], [tabindex="0"]'
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(selector) ?? []).filter(element => element.getClientRects().length > 0)
    const firstInput = panel?.querySelector<HTMLElement>('input:not([type="hidden"])')
    ;(firstInput ?? focusable()[0] ?? panel)?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); panel?.focus(); return }
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
  }, [enabled])
  return ref
}
