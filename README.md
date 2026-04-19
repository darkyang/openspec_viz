# openspec-viz

> 本地可视化工具:扫描 OpenSpec 目录 → 以 13 节点工作流卡片展示每个 change 的真实进展,实时跟随文件变更。

## 为什么做

[OpenSpec](https://github.com/Fission-AI/OpenSpec) 是一个 spec-driven 开发框架,原生只有 `proposal.md / design.md / tasks.md / specs/` 四件套,`openspec view` 只能在终端里看全局摘要。但真实工作流里,一个需求从"初稿 → 讨论 → 评审 → 设计 → 实施 → 测试"经过十几个节点,原生目录无处承载。

`openspec-viz` 提供:

- **13 节点工作流图** —— 需求(4) + 设计(5) + 实施(4)三阶段,每个节点自动从文件存在性推断状态
- **本地离线 Web 面板** —— `openspec-viz` 一行启动,不需要部署、账号、数据库
- **文件树 + Markdown 渲染** —— 边看 change 目录结构边浏览文档,代码块语法高亮
- **chokidar + SSE 实时刷新** —— 编辑器里改 md,浏览器面板立即跟随

## 快速开始

```bash
git clone git@github.com:darkyang/openspec_viz.git
cd openspec_viz
pnpm install
pnpm build

# 在你的 OpenSpec 项目根目录下运行
cd ~/your-openspec-project
node /path/to/openspec_viz/bin/cli.js
# 或指定路径
node /path/to/openspec_viz/bin/cli.js ./apps/api
```

默认监听 **4567 端口**,被占自动 +1。启动后自动打开浏览器。

```
用法:
  openspec-viz [path]              扫描当前目录或指定路径
  openspec-viz --no-open           不自动打开浏览器
  openspec-viz --version
  openspec-viz --help
```

## 目录约定

兼容 OpenSpec 原生结构,**在 change 目录下新增三个子目录**承载扩展工作流:

```
openspec/changes/<change-name>/
├── proposal.md              # OpenSpec 原生 = 需求评审终稿      [must]
├── design.md                # OpenSpec 原生 = 技术方案           [must]
├── tasks.md                 # OpenSpec 原生 = 任务拆分           [must]
├── specs/                   # OpenSpec 原生 spec delta
│
├── requirement/             # 扩展:需求阶段
│   ├── 01-draft.md          # 需求初稿                           [must]
│   ├── 02-discussion.md     # 讨论录音转写                       [opt]
│   ├── 03-review.md         # 评审录音转写                       [opt]
│   └── 04-changes/          # 历次变更(count badge)             [opt]
│
├── design-extras/           # 扩展:设计阶段
│   ├── 01-analysis.md       # 需求分析录音                       [opt]
│   ├── 02-ui/               # UI / 协议(图 / Figma 链接 / yaml) [opt]
│   ├── 03-review.md         # 技术方案评审录音                   [opt]
│   └── 04-test-cases.md     # 测试用例                           [opt]
│
└── implementation/          # 扩展:实施阶段
    └── 01-debug-log.md      # 调试日志                           [opt]
```

## 13 节点工作流

```
需求阶段              设计阶段                 实施阶段
─────────            ─────────               ─────────
●─初稿      [must]    ●─需求分析录音 [opt]     ●─任务拆分 [must]
●─讨论录音  [opt]     ●─技术方案     [must]    ●─代码生成 [must]
●─评审终稿  [must]    ●─UI / 协议    [opt]     ●─调试     [opt]
●─变更      [opt]     ●─方案评审录音 [opt]     ●─测试验证 [must]
                     ●─测试用例     [opt]
```

**节点三态**:
- 🟢 已完成 — 对应文件存在(或满足条件)
- ⚪ 未开始 / optional 缺失 — 中性灰,不报警
- 🔴 must 缺失 — 警告色,触发整体 incomplete

**Change 整体状态推断**:

| 状态 | 条件 |
|---|---|
| `archived` | 位于 `changes/archive/` 下 |
| `incomplete` | 任一"文档类 must 节点"缺失(`tasks.md` 相关节点除外) |
| `in_progress` | 文档齐全,但 `tasks.md` 未全勾完 |
| `done` | 文档齐全且 `tasks.md` 全部勾完 |

## 实施阶段节点如何推断

无需手动维护,全部从 `tasks.md` 解析:

| 节点 | 信号 |
|---|---|
| 任务拆分 | `tasks.md` 存在 |
| 代码生成 | `tasks.md` 至少一个 `[x]` |
| 测试验证 | `tasks.md` 全部 `[x]` |
| 调试 | `implementation/01-debug-log.md` 存在(手动维护) |

## 开发

```bash
pnpm dev          # server (4567) + vite dev server (5173)
pnpm test         # parser 单测(Vitest,29 个 case)
pnpm typecheck    # tsc --noEmit
pnpm build        # 产出 dist/web/ + dist/server/
```

## 技术栈

- **Runtime**: Node 20+ / TypeScript
- **Backend**: [Hono](https://hono.dev/) + [chokidar](https://github.com/paulmillr/chokidar) + SSE
- **Frontend**: [Vite](https://vite.dev/) + React 18 + [Tailwind CSS v4](https://tailwindcss.com/)
- **Markdown**: react-markdown + remark-gfm + [Shiki](https://shiki.style/)(按需 ts/js/json/yaml/bash/markdown)
- **Test**: Vitest

## 路线图

**v1(当前)**:只读可视化,三视图(Timeline / Change cards / Change detail),单机离线。

**v2(规划中)**:
- [ ] Capability 视图(按 `specs/<capability>/` 聚合)
- [ ] 全局 Search / 命令面板
- [ ] `fixes/` 目录约定 + Bug ↔ Spec 双向联结
- [ ] AI 协作可观测(Claude Code session 日志,token 消耗 / 一次过率)
- [ ] 局域网 / Docker 部署(支持非工程师协作者)
- [ ] 音频播放器(挂 `recordings/`)
- [ ] 写操作(checkbox 点击回写、评论追加)

## License

[MIT](./LICENSE) © 2026 darkyang
