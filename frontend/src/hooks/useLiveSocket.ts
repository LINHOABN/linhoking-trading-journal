import { useEffect, useRef, useState } from 'react'
import { wsUrl } from '../lib/api'

export function useLiveSocket(enabled: boolean, onEvent: () => void) {
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return

    let socket: WebSocket
    let cancelled = false

    try {
      socket = new WebSocket(wsUrl())
    } catch {
      return
    }

    socket.onopen = () => !cancelled && setConnected(true)
    socket.onclose = () => !cancelled && setConnected(false)
    socket.onerror = () => !cancelled && setConnected(false)
    socket.onmessage = () => onEventRef.current()

    return () => {
      cancelled = true
      socket.close()
    }
  }, [enabled])

  return connected
}
