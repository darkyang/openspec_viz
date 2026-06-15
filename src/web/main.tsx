import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import { Layout } from './components/Layout'
import { BoardRoute } from './routes/Board'
import { TimelineRoute } from './routes/Timeline'
import { ChangeCardsRoute } from './routes/ChangeCards'
import { ChangeDetailRoute } from './routes/ChangeDetail'
import { RequirementDetailRoute } from './routes/RequirementDetail'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* 主线中心：需求交付看板（lens 切换：路线图 / 概览 / 变更日志 / QA） */}
          <Route index element={<BoardRoute />} />
          {/* 钻取：需求 → change */}
          <Route path="/requirements/:id" element={<RequirementDetailRoute />} />
          <Route path="/changes/:id" element={<ChangeDetailRoute />} />
          {/* 次要（非主线）：全量 change 列表 / 活动流 */}
          <Route path="/changes" element={<ChangeCardsRoute />} />
          <Route path="/timeline" element={<TimelineRoute />} />
          {/* 旧的平级页 → 收敛为看板上的 lens */}
          <Route path="/requirements" element={<Navigate to="/?lens=overview" replace />} />
          <Route path="/pm-roadmap" element={<Navigate to="/?lens=roadmap" replace />} />
          <Route path="/pm-changelog" element={<Navigate to="/?lens=changelog" replace />} />
          <Route path="/qa-dashboard" element={<Navigate to="/?lens=qa" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
