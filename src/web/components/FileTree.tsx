import { useState } from 'react'
import type { FileTreeNode } from '../../shared/types'

interface Props {
  tree: FileTreeNode
  selectedPath: string | null
  onSelect: (filePath: string) => void
}

export function FileTree({ tree, selectedPath, onSelect }: Props) {
  return (
    <div className="text-sm">
      {tree.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

interface NodeProps {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  onSelect: (filePath: string) => void
}

function TreeNode({ node, depth, selectedPath, onSelect }: NodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded((x) => !x)}
          className="w-full text-left flex items-center gap-1 px-2 py-1 hover:bg-zinc-100 rounded"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <span className="text-zinc-400 text-[10px] w-3">{expanded ? '▾' : '▸'}</span>
          <span className="text-zinc-700">{node.name}/</span>
          <span className="ml-auto text-[10px] text-zinc-400">
            {node.children?.length ?? 0}
          </span>
        </button>
        {expanded &&
          node.children?.map((c) => (
            <TreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    )
  }

  const isSelected = selectedPath === node.path
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full text-left flex items-center gap-1 px-2 py-1 rounded ${
        isSelected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-700'
      }`}
      style={{ paddingLeft: depth * 12 + 4 + 12 }}
    >
      <span className={`text-[10px] ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
        {fileIcon(node.name)}
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  )
}

function fileIcon(name: string): string {
  if (name.endsWith('.md')) return '✎'
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return '⚙'
  if (name.endsWith('.json')) return '{}'
  return '·'
}
