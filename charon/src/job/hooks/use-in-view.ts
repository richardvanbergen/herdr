import { useLayoutEffect, useRef, useState } from 'react'

function isNearViewport(element: Element, margin: number) {
  const { bottom, left, right, top } = element.getBoundingClientRect()

  return (
    bottom >= -margin &&
    top <= window.innerHeight + margin &&
    right >= -margin &&
    left <= window.innerWidth + margin
  )
}

/**
 * IntersectionObserver is a DOM subscription, so an effect is required here.
 * It controls only query eligibility, never job content state.
 */
export function useInView<T extends Element>(prefetchMargin = 240) {
  const ref = useRef<T | null>(null)
  const [isInView, setIsInView] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || isNearViewport(element, prefetchMargin)) {
      setIsInView(true)
      return
    }

    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: `${prefetchMargin}px` },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [prefetchMargin])

  return { isInView, ref }
}
