import { useEffect } from 'react'

export interface LiveChangeEvent {
  type: 'change-updated'
  changeId: string | null
  archived: boolean
  filePath?: string
}

type Handler = (event: LiveChangeEvent) => void

export function useLiveEvents(handler: Handler) {
  useEffect(() => {
    const es = new EventSource('/sse')
    const onChange = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as LiveChangeEvent
        handler(data)
      } catch {
        // ignore
      }
    }
    es.addEventListener('change-updated', onChange)
    return () => {
      es.removeEventListener('change-updated', onChange)
      es.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
