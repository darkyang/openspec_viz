# openspec-viz 优化 — 会话启动 brief（2026-06-16）

> 给“专做 openspec_viz 优化”的新会话用：自包含、可直接作为开场上下文。**只聚焦工具本身的优化**，不含团队 PM 计划 / MossAura 上线那条线。先读 `CLAUDE.md`（主线 + 规则）、`docs/FEATURE_TEMPLATE.md`、`docs/openspec_viz-session-handoff.md`（上一阶段做了什么）。

## 0. 起步
- 仓库 `darkyang/openspec_viz`；`origin = git@github-darkyang:darkyang/openspec_viz.git`（SSH alias **github-darkyang**）。分支 `main`，`git pull` 取最新。
- 跑：`pnpm install && pnpm build && node bin/cli.js <含 openspec/ 的项目> --no-open`（默认 :4567）。
- **用真实数据压测**：`node bin/cli.js /Users/simon/Workspace/capmind/capmind-Android/openspec`（86 个 change，能暴露 examples 看不到的问题）。
- 验证：`pnpm typecheck && pnpm exec vitest run`（76 测试）+ `pnpm dev` 走主流程。

## 1. 产品主线（优化不得违背）
**openspec-viz = 需求交付看板**：requirement 为中心，PM/QA/工程是同一看板的 lens，change 是单元。新功能/改动先过两锚点（旅程环节 × 角色 lens）。
**已健康、别破坏**：模型只在 `src/shared/types.ts`、13 节点只在 `parser/workflow-spec.ts`、HTTP 只走 `lib/api.ts`、取数/实时只用 `useFetch` / `useLiveEvents`。

## 2. 实测发现（对 capmind 真实 openspec 跑出来的，优化依据）
- **86 个 change，81 个 ungrouped**（只 5 个写了 `requirement:` frontmatter）→ 需求聚合视图（路线图/概览）被严重低估。
- **全部显示 incomplete**：capmind 用**轻量级 proposal**（只有 proposal.md，无 design.md / requirement/01-draft.md 等 13 节点文档）→ “must 文档节点”缺失 → 判 incomplete，13 节点几乎全空。**工具的 13 节点/状态模型贴的是完整型 change，对轻量级 fix-*/tweak-* 失真。**
- **真正好用的是 变更日志 + QA 两个 frontmatter 驱动的 lens**（等于把 `CHANGELOG.md` / `qa-tracking.md` 可视化）。

## 3. 优化 backlog（按收益排序）

### P0 — 状态改由 frontmatter 驱动（修“全红 incomplete” + 兑现“进度从提交识别”）
- 现状：`ChangeStatus` = 文档节点完整度 → 轻量级 change 全判 incomplete（`parser/change.ts` 的 `inferStatus`，约 :106）。
- 优化：对**无扩展文档结构的轻量级 change**，状态改由 frontmatter `status`（drafted/in-review/shipped/…）+ `commit` + `test_status` 推导，而非 13 节点完整度。让 capmind 86 个 change 显示有意义的状态；也呼应“进度别手动勾、从提交/frontmatter 自动识别”。
- 注意仓里“两个状态机正交”的思路：`ChangeStatus`（文档完整度）vs `RequirementStage`（业务阶段）vs `lifecycle`（commit/PR 进度，frontmatter）。

### P1 — 语义层收口（防割裂，见 `CLAUDE.md`「已健康骨架」）
- frontmatter 取值 codec 重复：`parser/change.ts:15-38`（asString/asStringArray/asStringDict）vs `parser/requirement.ts` 另写一套 → 抽 `src/shared/codec.ts` 单点。
- 取色谓词不一致：risk `endsWith('high')`（`FrontmatterPanel.tsx`）vs `=== 'high'`（`ChangeCard.tsx` / `routes/PmChangelog.tsx`）；lifecycle 取色散在 4 文件 → 抽 `src/web/lib/presentation.ts` 单点 + 统一谓词。
- `TASK_DERIVED` 常量两份：`parser/change.ts:104` 与 `parser/requirement.ts:159` → 收到 `workflow-spec.ts`。
- （树是新的，先 grep 复核行号。）

### P1 — 轻量级 / ungrouped 更可用
- 81 个 ungrouped 太多 → 考虑按 `area` frontmatter 做“伪需求”分组，或给 fix-*/tweak-* 一个简化卡（只显 date/area/lifecycle/test，不强推 13 节点）。

### P2 — UX / 性能
- change 详情页顶导：经由需求进入时不应高亮「Changes」（`components/Layout.tsx` 的 NavLink active 判定）。
- Sessions 标签现在有真实数据（capmind Claude 会话）→ 可价值化呈现。
- 86+ change 的加载 / 渲染性能核一遍（examples 仅 3 个，掩盖了 scale 问题）。

## 4. 范围边界
只优化 openspec_viz 工具本身。团队 PM 计划 / MossAura 上线 / capmind 那条线**不在此 session**。
