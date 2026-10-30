import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import useAuthStore from './store/useAuthStore'

import Login from './pages/Login'
import SecurityPosture from './pages/SecurityPosture'
import PolicyDetail from './pages/PolicyDetail'
import OwaspDetail from './pages/OwaspDetail'
import RiskDetail from './pages/RiskDetail'
import PolicyEditor from './pages/PolicyEditor'
import Settings from './pages/Settings'
import ReportSettings from './pages/ReportSettings'
import IHealthSettings from './pages/IHealthSettings'
import IgnoreDiagnostics from './pages/IgnoreDiagnostics'
import SignatureSettings from './pages/SignatureSettings'
import TemplateV2 from './pages/TemplateV2'
import DeviceAudits from './pages/DeviceAudits'
import LtmDetail from './pages/LtmDetail'

const queryClient = new QueryClient()

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function App({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login"      element={<Login />} />
          <Route path="/waf"    element={<App><SecurityPosture /></App>} />
          <Route path="/policies/:id" element={<App><PolicyDetail /></App>} />
          <Route path="/policies/:id/owasp" element={<App><OwaspDetail /></App>} />
          <Route path="/policies/:id/risk" element={<App><RiskDetail /></App>} />
          <Route path="/policies/:id/edit" element={<App><PolicyEditor /></App>} />
          <Route path="/settings"   element={<App><Settings /></App>} />
          <Route path="/settings/report" element={<App><ReportSettings /></App>} />
          <Route path="/settings/ihealth" element={<App><IHealthSettings /></App>} />
          <Route path="/settings/ignore-diagnostics" element={<App><IgnoreDiagnostics /></App>} />
          <Route path="/signatures" element={<App><SignatureSettings /></App>} />
          <Route path="/ltm"  element={<App><DeviceAudits domain="ltm" /></App>} />
          <Route path="/ltm/:id" element={<App><LtmDetail /></App>} />
          <Route path="/templates"  element={<App><TemplateV2 /></App>} />
          {/* v2 is the Templates page; keep the old /templates-v2 link working. */}
          <Route path="/templates-v2" element={<Navigate to="/templates" replace />} />

          {/* Security Posture is the landing page. */}
          <Route path="/" element={<Navigate to="/waf" replace />} />
          <Route path="*" element={<Navigate to="/waf" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
