import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Join from './pages/Join'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminRoundDetail from './pages/AdminRoundDetail'
import AdminNewRound from './pages/AdminNewRound'
import AdminFacilities from './pages/AdminFacilities'
import AdminSettings from './pages/AdminSettings'
import AdminUsers from './pages/AdminUsers'
import AdminCommittee from './pages/AdminCommittee'
import AdminTopicNicknames from './pages/AdminTopicNicknames'
import ScoreForm from './pages/ScoreForm'
import LiveDashboard from './pages/LiveDashboard'
import Report from './pages/Report'
import PublicHistory from './pages/PublicHistory'
import RequireAdmin from './components/RequireAdmin'
import { ConfirmProvider } from './components/ConfirmProvider'

export default function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter basename="/pcustandard71">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/history" element={<PublicHistory />} />

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
            path="/admin/settings"
            element={
              <RequireAdmin>
                <AdminSettings />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsers />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/committee"
            element={
              <RequireAdmin>
                <AdminCommittee />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/topics"
            element={
              <RequireAdmin>
                <AdminTopicNicknames />
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
    </ConfirmProvider>
  )
}
