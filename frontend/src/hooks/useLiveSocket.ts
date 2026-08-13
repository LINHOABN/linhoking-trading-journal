import { useEffect, useRef, useState } from 'react'
import { wsUrl, getToken } from '../lib/api'

export function useLiveSocket(enabled: boolean, onEvent: () => void) {
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return

    let socket: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let isCancelled = false

    function connect() {
      const token = getToken()
      if (!token) {
        scheduleReconnect()
        return
      }

      try {
        socket = new WebSocket(wsUrl())
      } catch {
        scheduleReconnect()
        return
      }

      socket.onopen = () => {
        if (!isCancelled) setConnected(true)
      }

      socket.onclose = (event) => {
        if (!isCancelled) {
          setConnected(false)
          // Code 4401 = auth error (token invalide/expiré) — ne pas boucler
          if (event.code === 4401) return
          scheduleReconnect()
        }
      }

      socket.onerror = () => {
        if (!isCancelled) {
          setConnected(false)
        }
      }

      socket.onmessage = () => {
        onEventRef.current()
      }
    }

    function scheduleReconnect() {
      if (isCancelled) return
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      reconnectTimeout = setTimeout(() => {
        if (!isCancelled) connect()
      }, 3000)
    }

    connect()

    return () => {
      isCancelled = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (socket) socket.close()
    }
  }, [enabled])

  return connected
}

