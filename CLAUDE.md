# openspec-viz — 项目约束（AI 第一入口）

> 加任何功能前先读这份。它定义"这个工具是什么、为谁、核心流程是什么"。**每个新功能必须服从这条主线**，否则就是在制造割裂。

## 一句话定位

**openspec-viz 是一块「需求交付看板」**：以 requirement 为中心，把一个需求（含多个 change）从**规划 → 上线**的交付过程，呈现在一块看板上；PM / QA / 工程各看**同一块看板的不同切面（lens）**；change 是需求下的**单元**。

它**不是**"一堆可视化视图的集合"。任何让它变成"又一个独立面板/独立页"的功能，都是在制造割裂。

## 核心业务流程（主线）

```
需求 requirement ──规划 → 设计 → 实施 → 测试 → 上线──▶ 交付
        │
        ├─ 工程 lens：每个 change 的 13 节点工作流 / 文件 / AI session
        ├─ PM   lens：需求按 stage / effort / risk 排布（roadmap）
        └─ QA   lens：需求 / change 的 test_status / 失败 / 派生 bug
```

- **中心** = requirement，一切从需求进入。
- **单元** = change（在某需求下打开）。
- **切面（lens）** = 同一份需求数据的不同看法，**不是不同的页 / 不同的产品**。

## 新功能规则（硬约束）

新增任何功能前，先回答两个锚点：

1. **它落在「需求交付旅程」的哪一环？**（规划 / 设计 / 实施 / 测试 / 上线）
2. **它服务哪个角色 lens？**（PM / QA / 工程 / 跨角色）

- 两个都答不上来 → 它是**孤岛**，**不在本工具做**（或拆成独立工具）。
- 答得上来 → 把它实现成"那一环 × 那个 lens"上的能力，**复用需求看板这个中心**，而不是新开一个平级页。

描述功能时用 [`docs/FEATURE_TEMPLATE.md`](docs/FEATURE_TEMPLATE.md)，它强制填这两个锚点。

## 现状 IA → 目标 IA（收敛中）

| 功能 | 相对主线的定位 | 目标 |
|---|---|---|
| Requirements / RequirementDetail | 主线中心 | 默认入口 / 导航重心 |
| PM Roadmap / QA Dashboard | 角色 lens | 收成需求看板上的 **lens 切换**（同数据换 facet），非独立页 |
| ChangeCards / ChangeDetail（13 节点 / 文件 / 评论 / checkbox） | 需求下的单元钻取 | 从平级页降为"在某需求里打开一个 change" |
| Timeline | off-axis | "某需求的活动流" facet（或保留全局但明确次要） |
| AI Sessions 可观测 | off-axis | change / 需求详情内的 facet（或拆成独立工具） |

> 这是"现状 → 目标"的迁移地图，不是现状描述。新功能按**目标**列对齐。

## 已健康的技术骨架（别破坏，直接复用）

- **模型**只在 `src/shared/types.ts`（`src/server/types.ts` 仅 `export *` re-export）。
- **13 节点**只在 `src/server/parser/workflow-spec.ts`（声明式 `WORKFLOW_NODES`）。
- **HTTP** 只走 `src/web/lib/api.ts` 的 `api` 对象；**取数**只用 `useFetch`、**实时**只用 `useLiveEvents`（`src/web/hooks/`）。
- 服务端字段 **snake_case**、TS 类型 **camelCase**，转换只在 `parser/`。

新功能必须复用这套，不要新开数据通道 / 自定义重复类型 / 绕过 `api.ts`。
