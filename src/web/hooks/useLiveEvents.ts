import { useEffect, useRef } from 'react'

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

// 同一轮事件风暴（chokidar 对单次写入可能连发 add+change+addDir）只触发一次 handler。
const COALESCE_MS = 120

export function useLiveEvents<T extends keyof EventTypeMap = 'change-updated'>(
  handler: (event: EventTypeMap[T]) => void,
  eventType: T = 'change-updated' as T
) {
  // 保持 handler 最新引用，避免 effect 里闭包捕获到旧的 reload 函数
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const es = new EventSource('/sse')
    let pending: { data: EventTypeMap[T] } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      timer = null
      if (pending) {
        const data = pending.data
        pending = null
        handlerRef.current(data)
      }
    }
    const onEvent = (ev: MessageEvent) => {
      try {
        pending = { data: JSON.parse(ev.data) as EventTypeMap[T] }
      } catch {
        return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, COALESCE_MS)
    }
    es.addEventListener(eventType, onEvent)
    return () => {
      if (timer) clearTimeout(timer)
      es.removeEventListener(eventType, onEvent)
      es.close()
    }
  }, [eventType])
}
