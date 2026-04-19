import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubLight from 'shiki/themes/github-light.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import jsx from 'shiki/langs/jsx.mjs'
import jsonLang from 'shiki/langs/json.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import bash from 'shiki/langs/bash.mjs'
import markdown from 'shiki/langs/markdown.mjs'

const SHIKI_LANGS = ['typescript', 'tsx', 'javascript', 'jsx', 'json', 'yaml', 'bash', 'markdown'] as const
const SHIKI_THEME = 'github-light'

const highlighterPromise = createHighlighterCore({
  themes: [githubLight],
  langs: [typescript, tsx, javascript, jsx, jsonLang, yaml, bash, markdown],
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
})

interface Props {
  content: string
  filePath?: string
}

const LANG_BY_EXT: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  json: 'json',
  md: 'md',
  yaml: 'yaml',
  yml: 'yaml',
  bash: 'bash',
  sh: 'bash',
  py: 'python',
}

function extToLang(file?: string): string | null {
  if (!file) return null
  const m = /\.([a-z0-9]+)$/i.exec(file)
  if (!m) return null
  return LANG_BY_EXT[m[1].toLowerCase()] ?? null
}

export function MarkdownView({ content, filePath }: Props) {
  const isMarkdown = filePath ? filePath.endsWith('.md') : true

  if (isMarkdown) {
    return (
      <div className="md-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className ?? '')
              const lang = match?.[1]
              const text = String(children ?? '').replace(/\n$/, '')
              if (lang && !text.includes('\n')) {
                // inline-ish single-line code block with language marker — still render highlighted
              }
              if (lang) {
                return <ShikiBlock code={text} lang={lang} />
              }
              return (
                <code className="px-1 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[90%]" {...props}>
                  {children}
                </code>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  // Non-markdown: render as pre with shiki if we know the language
  const lang = extToLang(filePath) ?? 'text'
  if (lang === 'text') {
    return (
      <pre className="text-sm bg-zinc-50 p-4 rounded border border-zinc-200 whitespace-pre-wrap font-mono">
        {content}
      </pre>
    )
  }
  return <ShikiBlock code={content} lang={lang} block />
}

function ShikiBlock({ code, lang, block = false }: { code: string; lang: string; block?: boolean }) {
  const [html, setHtml] = useState<string | null>(null)
  const cacheKey = useMemo(() => `${lang}\u0001${code}`, [code, lang])

  useEffect(() => {
    let cancelled = false
    const supported = (SHIKI_LANGS as readonly string[]).includes(lang) ? lang : 'text'
    if (supported === 'text') {
      setHtml(null)
      return
    }
    highlighterPromise
      .then((h) => h.codeToHtml(code, { lang: supported, theme: SHIKI_THEME }))
      .then((h) => {
        if (!cancelled) setHtml(h)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  if (html === null) {
    return (
      <pre className={`text-sm bg-zinc-50 p-4 rounded border border-zinc-200 ${block ? '' : 'my-3'} whitespace-pre-wrap font-mono`}>
        {code}
      </pre>
    )
  }
  return (
    <div
      className={`shiki-wrap text-sm rounded border border-zinc-200 overflow-hidden ${block ? '' : 'my-3'}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
