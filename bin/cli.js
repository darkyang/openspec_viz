#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import open from 'open'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverEntry = path.resolve(__dirname, '../dist/server/server/index.js')

// --- arg parsing ---
const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  printHelp()
  process.exit(0)
}
if (argv.includes('--version') || argv.includes('-v')) {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
  )
  console.log(pkg.version)
  process.exit(0)
}

const noOpen = argv.includes('--no-open')
const positional = argv.find((a) => !a.startsWith('-'))

// --- locate openspec root ---
function looksLikeOpenspec(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false
  return fs.existsSync(path.join(dir, 'changes')) || fs.existsSync(path.join(dir, 'specs'))
}

function findOpenspecRoot(startDir) {
  let dir = path.resolve(startDir)
  if (looksLikeOpenspec(dir)) return dir
  // if dir contains openspec/, return that
  while (true) {
    const candidate = path.join(dir, 'openspec')
    if (looksLikeOpenspec(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const searchStart = positional ? path.resolve(positional) : process.cwd()
const openspecRoot = findOpenspecRoot(searchStart)
if (!openspecRoot) {
  console.error(`❌ 未找到 openspec 目录 (from ${searchStart})`)
  console.error(`   请在包含 openspec/ 的项目内启动,或指定路径:`)
  console.error(`     openspec-viz ./path/to/project`)
  process.exit(1)
}

// --- find available port ---
async function findPort(start) {
  for (let p = start; p < start + 100; p++) {
    if (await isFree(p)) return p
  }
  throw new Error(`no free port in ${start}..${start + 100}`)
}

function isFree(port) {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => {
      srv.close(() => resolve(true))
    })
    srv.listen(port, '127.0.0.1')
  })
}

const port = await findPort(Number(process.env.PORT) || 4567)

// --- spawn server ---
if (!fs.existsSync(serverEntry)) {
  console.error(`❌ server bundle missing: ${serverEntry}`)
  console.error(`   请先构建:pnpm build`)
  process.exit(1)
}

const env = {
  ...process.env,
  OPENSPEC_ROOT: openspecRoot,
  OPENSPEC_VIZ_NO_DEV_FALLBACK: '1',
  PORT: String(port),
}

console.log(`openspec-viz`)
console.log(`  openspec root: ${openspecRoot}`)
console.log(`  url: http://localhost:${port}`)

const child = spawn('node', [serverEntry], { stdio: 'inherit', env })

// open browser once server has had a moment to bind
if (!noOpen) {
  setTimeout(() => {
    open(`http://localhost:${port}`).catch(() => {
      // ignore; user can open manually
    })
  }, 500)
}

const onSignal = () => {
  child.kill()
  process.exit(0)
}
process.on('SIGINT', onSignal)
process.on('SIGTERM', onSignal)

child.on('exit', (code) => process.exit(code ?? 0))

function printHelp() {
  console.log(`openspec-viz — OpenSpec 目录本地可视化工具

用法:
  openspec-viz [path]              扫描当前目录或指定路径
  openspec-viz --no-open           不自动打开浏览器
  openspec-viz --version           显示版本
  openspec-viz --help              显示此帮助

示例:
  cd my-project && openspec-viz
  openspec-viz ./apps/api
`)
}
