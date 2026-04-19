import path from 'node:path'
import { listChanges } from '../src/server/parser/change.js'

const root = path.resolve(process.cwd(), 'examples/openspec')
const summaries = listChanges(root)

for (const s of summaries) {
  console.log(`\n── ${s.id} ─ ${s.title}`)
  console.log(`   status: ${s.status}  archived: ${s.archived}  tasks: ${s.taskProgress.done}/${s.taskProgress.total}`)
  for (const n of s.workflow) {
    const flag =
      n.state === 'done' ? '🟢' : n.state === 'missing-required' ? '🔴' : '🔘'
    const extra = n.count !== undefined ? ` (count=${n.count})` : ''
    console.log(`   ${flag} ${n.id.padEnd(18)} ${n.label}${extra}`)
  }
}
