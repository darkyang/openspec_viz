import { useEffect } from 'react'

export interface LiveChangeEvent {
  type: 'change-updated'
  changeId: string | null
  archived: boolean
  filePath?: string
}

export interface LiveAiSessionEvent {
  type: 'ai-session-updated'
  sessionId: string
  filePath: string
  kind: 'add' | 'change' | 'unlink'
}

export type LiveEvent = LiveChangeEvent | LiveAiSessionEvent

type EventTypeMap = {
  'change-updated': LiveChangeEvent
  'ai-session-updated': LiveAiSessionEvent
}

export function useLiveEvents<T extends keyof EventTypeMap = 'change-updated'>(
  handler: (event: EventTypeMap[T]) => void,
  eventType: T = 'change-updated' as T
) {
  useEffect(() => {
    const es = new EventSource('/sse')
    const onEvent = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as EventTypeMap[T]
        handler(data)
      } catch {
        // ignore
      }
    }
    es.addEventListener(eventType, onEvent)
    return () => {
      es.removeEventListener(eventType, onEvent)
      es.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType])
}
