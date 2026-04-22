import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import { Layout } from './components/Layout'
import { TimelineRoute } from './routes/Timeline'
import { ChangeCardsRoute } from './routes/ChangeCards'
import { ChangeDetailRoute } from './routes/ChangeDetail'
import { RequirementsRoute } from './routes/Requirements'
import { RequirementDetailRoute } from './routes/RequirementDetail'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TimelineRoute />} />
          <Route path="/requirements" element={<RequirementsRoute />} />
          <Route path="/requirements/:id" element={<RequirementDetailRoute />} />
          <Route path="/changes" element={<ChangeCardsRoute />} />
          <Route path="/changes/:id" element={<ChangeDetailRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
