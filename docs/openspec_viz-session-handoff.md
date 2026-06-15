# openspec-viz — 会话上下文交接（2026-06-15）

> 跨机器/跨会话接力用。先读根目录 `CLAUDE.md`（产品主线 + 新功能规则）与 `docs/FEATURE_TEMPLATE.md`（功能描述模板）——它们是给新会话对齐用的常驻文档；本文件是“这次做了什么、为什么、还剩什么、怎么接”的对话级补充快照。

## 0. 仓库 & 状态
- 仓库 `darkyang/openspec_viz`；`origin = git@github-darkyang:darkyang/openspec_viz.git`（SSH host alias **github-darkyang**，新机器需配好该 alias 才能 push）。
- 成果 commit：**`a46e05e`**（`feat(viz): converge to requirement-delivery board`），已在 `main` / `origin/main`。`git pull` 即得全部成果（本交接文档为其后的纯文档提交）。
- 栈：Node 20+/TS · Hono + chokidar + SSE 后端 · Vite + React 18 + Tailwind v4 前端 · Vitest。
- 跑：`pnpm install && pnpm build && node bin/cli.js ./examples --no-open`（默认 :4567，examples 自带 openspec 数据）；开发 `pnpm dev`（:5173 + :4567）。

## 1. 核心问题与诊断（为什么动它）
- 痛点：**单功能满意，功能加多后整体业务流程割裂、AI 结果越偏**。
- 根因（关键认知）：**不是描述不完整、也不是一次给太多**，而是缺一条写下来的产品主线让每个功能服从 → 功能被孤立描述就各自成岛（曾是 8 个平级路由），而非“同一条流程的环节”。

## 2. 锁定的产品主线（spine）
**openspec-viz = 需求交付看板**：以 requirement 为中心，一个需求（含多 change）从规划 → 上线；PM/QA/工程是**同一块看板的不同 lens**；change 是需求下的**单元**。
**新功能硬规则**：先答「在需求交付旅程哪一环 × 服务哪个角色 lens」，答不上 = 孤岛 = 不做 / 拆出。详见 `CLAUDE.md`，描述功能走 `docs/FEATURE_TEMPLATE.md`。

## 3. 已做（都在 a46e05e）
- **Phase 0**：`CLAUDE.md`（主线 + 规则 + 现状→目标 IA 表 + “已健康骨架别破坏”）、`docs/FEATURE_TEMPLATE.md`。
- **Phase 1（IA 重排）**：
  - `src/web/routes/Board.tsx`（新）：Board 首页 + lens 切换（路线图/概览/变更日志/QA），`?lens=` URL 参数，默认 `roadmap`。
  - `Requirements / PmRoadmap / PmChangelog / QaDashboard.tsx`：各加 `embedded` prop（嵌入 Board 时隐藏自身页头，渲染逻辑**原样复用**）。
  - `src/web/main.tsx`：index→Board；`/requirements/:id`、`/changes/:id` 为钻取；Timeline 降为 `/timeline`；旧 `/requirements`、`/pm-roadmap`、`/pm-changelog`、`/qa-dashboard` → 重定向到对应 lens。
  - `src/web/components/Layout.tsx`：顶导收敛为 **看板 / Changes / Timeline**。
  - **数据层（`lib/api.ts`/`shared/types.ts`/`parser`/`hooks`）未动**。
- **打磨**：`src/web/routes/ChangeDetail.tsx` 面包屑按 `change.requirementId` 指回所属需求（`← <requirement> · Changes`）。
- **验证**：`pnpm typecheck` 0 err · `pnpm exec vitest run` 76/76 · `pnpm build` 通过 · 浏览器实走（看板→lens→需求详情→change 详情、旧路径重定向、面包屑回跳）全过。
- ⚠️ 该 commit **打包了之前未提交的 WIP**（PM Roadmap / QA Dashboard / Changelog 视图 + parser/types 改动）——与本次改动混在同几个文件，无法按文件拆，故同一 commit。

## 4. 还剩（可选，未做）
- change 详情页**顶导仍高亮「Changes」**（路由 `/changes/:id` 命中 NavLink）。面包屑那层已修；若要在有 requirement 时不点亮 Changes，改 `Layout.tsx` 的 NavLink active 判定即可。小事。
- 代码语义层收口（取色谓词 `endsWith('high')` vs `=== 'high'`、`TASK_DERIVED` 常量两份去重）——次要打磨，不急。

## 5. 另一台机器怎么接着干
1. `git pull`（确认到 `a46e05e` 之后）；配好 `github-darkyang` SSH alias。
2. **先读 `CLAUDE.md` + `docs/FEATURE_TEMPLATE.md`**。
3. 加功能：先填 FEATURE_TEMPLATE 两个锚点 → 实现成 Board 的一个 lens 或某 change/需求详情里的能力，复用 `shared/types.ts`/`api.ts`/`useFetch`/`useLiveEvents`，**别新开平级页**。
4. 验证：`pnpm typecheck && pnpm exec vitest run` + `pnpm dev` 走主流程。

## 6. 范围边界
本工作线只处理 openspec_viz。其它仓（如 capmind-Android）里产生的 PM 工件不属于本仓、另行处理。
