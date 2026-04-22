import { useEffect, useRef, useState, useCallback } from 'react'

export interface FetchState<T> {
  data: T | null
  /** 首次加载（data 尚未到达）时为 true；后续 reload 中若已有旧数据则保持 false。 */
  loading: boolean
  /** 后台刷新中（有旧数据且正在重新请求）。组件可据此显示细微的 "refreshing…" 提示，但不要因此清空内容。 */
  refreshing: boolean
  error: Error | null
  reload: () => void
}

export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)
  // 用 ref 跟踪是否已拿到过数据，避免在 setData 的 updater 里连环 setState（React 警告）
  const hasDataRef = useRef(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoFetch = useCallback(fetcher, deps)

  useEffect(() => {
    let cancelled = false
    // 关键：reload 时不把 data 清掉，也不把 loading 翻 true；改用 refreshing 标志位。
    // 这样旧内容继续渲染，避免"清空→重绘"导致的上下抖动。
    if (hasDataRef.current) setRefreshing(true)
    else setInitialLoading(true)
    setError(null)
    memoFetch()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          hasDataRef.current = true
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) {
          setInitialLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [memoFetch, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading: initialLoading, refreshing, error, reload }
}
