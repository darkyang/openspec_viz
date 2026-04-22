# openspec-viz

> 本地可视化工具:扫描 OpenSpec 目录 → 以 13 节点工作流卡片展示每个 change 的真实进展,实时跟随文件变更。

## 为什么做

[OpenSpec](https://github.com/Fission-AI/OpenSpec) 是一个 spec-driven 开发框架,原生只有 `proposal.md / design.md / tasks.md / specs/` 四件套,`openspec view` 只能在终端里看全局摘要。但真实工作流里,一个需求从"初稿 → 讨论 → 评审 → 设计 → 实施 → 测试"经过十几个节点,原生目录无处承载。

`openspec-viz` 提供:

- **13 节点工作流图** —— 需求(4) + 设计(5) + 实施(4)三阶段,每个节点自动从文件存在性推断状态
- **本地离线 Web 面板** —— `openspec-viz` 一行启动,不需要部署、账号、数据库
- **文件树 + Markdown 渲染** —— 边看 change 目录结构边浏览文档,代码块语法高亮
- **chokidar + SSE 实时刷新** —— 编辑器里改 md,浏览器面板立即跟随
- **AI 协作可观测** —— 读取本地 Claude Code session 日志,按 change 归因展示 token 消耗、工具调用、耗时与错误数
- **最小写操作** —— `tasks.md` 中的 checkbox 可直接点击勾选/取消,每个 change 可在 Comments tab 追加评论(落到 `<change>/comments.md`)
- **需求维度聚合** —— 多个 change 可归入同一 requirement,按需求看整体进度(by-status 条 + task/node 汇总)

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

## AI 协作可观测

在 Change 详情页右侧切到 **Sessions** 标签，可以看到用 [Claude Code](https://claude.com/claude-code) 改这个 change 时的每次会话：

- **归因**：按 session 里 `tool_use`（Read/Edit/Write/MultiEdit/NotebookEdit/Glob/Grep）命中 `openspec/changes/<id>/` 下文件的次数计数；命中最多的标 `primary`，其余标 `partial`
- **指标**：持续时间、累计 token（input/output/cacheRead/cacheCreation 四项分别汇总）、user/assistant 轮次、工具调用 top-5、`tool_result.is_error` 错误数、受影响文件列表
- **实时**：对 `~/.claude/projects/<project-slug>/` 的 JSONL 追加写做监听，浏览器通过 SSE 自动刷新

**数据来源**：`~/.claude/projects/<slug>/<sessionId>.jsonl`，其中 `slug` = 项目根 cwd 把所有非 `[a-zA-Z0-9-]` 字符（`/`、`_`、`.` 等）替换为 `-`。目录不存在（没装或没用过 Claude Code）时，Sessions 标签显示空状态，不报错。

**隐私**：只读、只在本进程内存里聚合；不外发、不落盘、不入库。

## 需求维度聚合

一个大需求通常拆成多个 change。在 change 的 `proposal.md` 头部加 YAML frontmatter 声明归属：

```markdown
---
requirement: user-identity
---
# 添加用户身份认证
…
```

可选地建 `openspec/requirements/<slug>.md` 给需求一个首页：

```markdown
# 用户身份系统

从注册登录到凭证管理,把"用户是谁"做稳。

## 范围
…
```

导航 → **Requirements** 即可看到所有需求卡片。每张卡片含：

- **状态条**：done / in_progress / incomplete / archived 按比例切段
- **整体状态**：取最严者（`incomplete > in_progress > done > archived`）
- **tasks / nodes 汇总**：所有成员 change 的 `taskProgress` 与 13 节点完成数相加

没有 frontmatter 的 change 会进入 **ungrouped** 虚拟桶，不影响归档/删除。`requirements/<slug>.md` 存在但无 change 引用时列为孤儿需求（方便先写需求再拆 change）。

API：`GET /api/requirements` · `GET /api/requirements/:id`（`__ungrouped__` 为合法 id）。

## 写操作

openspec-viz v1 主体仍是只读可视化，但开放了两个高频的最小写入：

- **Checkbox 回写** —— 打开 `tasks.md` 后，checkbox 可以直接点击；点击时走 `PATCH /api/changes/:id/tasks`，服务端按行号 + `CHECKBOX_RE` 校验后原地 toggle。文件一改，watcher 推 SSE，浏览器自动刷新，工作流的"代码生成 / 测试验证"节点也会联动重算。
- **Comments 追加** —— Change Detail 右侧切到 **Comments** tab，每条评论追加到 `<change>/comments.md` 的尾部，格式：
  ```
  ---

  **YYYY-MM-DD HH:mm:ss**

  <正文>
  ```
  文件不存在会自动创建并写 `# Comments\n\n` 头。纯追加，v1 不提供删除/编辑——历史以 git 为准。

**安全约束**：
- 行号漂移保护：若点击瞬间服务端读到的目标行已不是 checkbox（比如编辑器在改），返 `409 Conflict`，前端提示"文件已变更，请刷新后重试"，不做静默回写
- Path 安全：沿用只读接口的 `path.resolve` + `startsWith(changeRoot)` 套路，不可越界
- 并发：单用户本地工具，不做 mtime-CAS；评论是纯追加天然并发安全

## 开发

```bash
pnpm dev          # server (4567) + vite dev server (5173)
pnpm test         # parser + writer 单测(Vitest,73 个 case)
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

**已实现**:
- [x] AI 协作可观测(Claude Code session 日志,token 消耗 / 工具调用 / 错误数,按 change 归因)
- [x] 写操作最小集(checkbox 点击回写、评论追加到 `comments.md`)
- [x] 需求维度聚合多 changes(`requirements/<slug>.md` + proposal 里 frontmatter)

**v2(规划中)**:
- [ ] Capability 视图(按 `specs/<capability>/` 聚合)
- [ ] 全局 Search / 命令面板
- [ ] `fixes/` 目录约定 + Bug ↔ Spec 双向联结
- [ ] 全局 Sessions 视图(跨 change 的 session 时间线与总览)
- [ ] 局域网 / Docker 部署(支持非工程师协作者)
- [ ] 音频播放器(挂 `recordings/`)

## License

[MIT](./LICENSE) © 2026 darkyang
