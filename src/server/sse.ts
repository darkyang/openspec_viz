import type { Context } from 'hono'

export type SseMessage =
  | { type: 'change-updated'; changeId: string | null; archived: boolean; filePath?: string }
  | { type: 'hello'; serverTime: number }
  | { type: 'ping' }

export class SseHub {
  private clients = new Set<WritableStreamDefaultWriter<Uint8Array>>()
  private pingInterval: NodeJS.Timeout | null = null

  start() {
    this.pingInterval = setInterval(() => this.broadcast({ type: 'ping' }), 30_000)
  }

  stop() {
    if (this.pingInterval) clearInterval(this.pingInterval)
  }

  broadcast(msg: SseMessage) {
    const payload = formatSse(msg)
    const enc = new TextEncoder().encode(payload)
    for (const w of this.clients) {
      w.write(enc).catch(() => this.clients.delete(w))
    }
  }

  handle(c: Context) {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    this.clients.add(writer)
    writer.write(new TextEncoder().encode(formatSse({ type: 'hello', serverTime: Date.now() })))

    c.req.raw.signal.addEventListener('abort', () => {
      this.clients.delete(writer)
      writer.close().catch(() => {})
    })

    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    })
  }
}

function formatSse(msg: SseMessage): string {
  return `event: ${msg.type}\ndata: ${JSON.stringify(msg)}\n\n`
}
