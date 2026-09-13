import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Join from './pages/Join'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminRoundDetail from './pages/AdminRoundDetail'
import AdminNewRound from './pages/AdminNewRound'
import AdminFacilities from './pages/AdminFacilities'
import ScoreForm from './pages/ScoreForm'
import LiveDashboard from './pages/LiveDashboard'
import Report from './pages/Report'
import RequireAdmin from './components/RequireAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/facilities"
          element={
            <RequireAdmin>
              <AdminFacilities />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/rounds/new"
          element={
            <RequireAdmin>
              <AdminNewRound />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/rounds/:roundId"
          element={
            <RequireAdmin>
              <AdminRoundDetail />
            </RequireAdmin>
          }
        />

        <Route path="/round/:roundId/score" element={<ScoreForm />} />
        <Route path="/round/:roundId/live" element={<LiveDashboard />} />
        <Route path="/round/:roundId/report" element={<Report />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
