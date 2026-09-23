import { useEffect, useRef } from 'react'

/** Keep keyboard navigation inside an open modal and restore its trigger on close. */
export function useDialogFocus(enabled: boolean, onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!enabled || !ref.current) return
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0)
      const first = controls[0],
        last = controls.at(-1)
      if (!first) {
        event.preventDefault()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', handleKey)
    return () => {
      dialog.removeEventListener('keydown', handleKey)
      previous?.focus()
    }
  }, [enabled])
  return ref
}
