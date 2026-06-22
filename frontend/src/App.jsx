import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login/Login'
import Dashboard from './pages/Admin/Dashboard'
import RouteForm from './pages/Admin/RouteForm'
import Templates from './pages/Admin/Templates'
import TemplateForm from './pages/Admin/TemplateForm'
import CsvImport from './pages/Admin/CsvImport'
import Analytics from './pages/Admin/Analytics'
import RouteAnalytics from './pages/Admin/RouteAnalytics'
import Users from './pages/Admin/Users'
import ChangePassword from './pages/Admin/ChangePassword'
import RouteViewer from './pages/RouteViewer/RouteViewer'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-indigo-600" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  )
}

// Default landing path for each role (analysts can't see the Routes dashboard)
function homePathForRole(role) {
  if (role === 'analyst') return '/admin/analytics'
  return '/admin'
}

function ProtectedRoute({ children }) {
  const { token, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen />
  }

  if (!token) {
    return <Navigate to="/admin/login" replace />
  }

  // Force first-login / post-reset password change before anything else
  if (user?.must_change_password && location.pathname !== '/admin/account/password') {
    return <Navigate to="/admin/account/password" replace />
  }

  return children
}

// Gate a route by role. Falls back to the user's home page if not permitted.
function RoleRoute({ roles, children }) {
  const { role } = useAuth()
  if (!roles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />
  }
  return children
}

function AdminRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="setup" element={<Login setupMode />} />
        <Route
          path=""
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Link & template management — admin + link_manager */}
          <Route index element={<RoleRoute roles={['admin', 'link_manager']}><Dashboard /></RoleRoute>} />
          <Route path="routes/new" element={<RoleRoute roles={['admin', 'link_manager']}><RouteForm /></RoleRoute>} />
          <Route path="routes/:id/edit" element={<RoleRoute roles={['admin', 'link_manager']}><RouteForm /></RoleRoute>} />
          <Route path="routes/import" element={<RoleRoute roles={['admin', 'link_manager']}><CsvImport /></RoleRoute>} />
          <Route path="templates" element={<RoleRoute roles={['admin', 'link_manager']}><Templates /></RoleRoute>} />
          <Route path="templates/new" element={<RoleRoute roles={['admin', 'link_manager']}><TemplateForm /></RoleRoute>} />
          <Route path="templates/:id/edit" element={<RoleRoute roles={['admin', 'link_manager']}><TemplateForm /></RoleRoute>} />

          {/* Analytics — admin + analyst */}
          <Route path="analytics" element={<RoleRoute roles={['admin', 'analyst']}><Analytics /></RoleRoute>} />
          <Route path="analytics/routes/:id" element={<RoleRoute roles={['admin', 'analyst']}><RouteAnalytics /></RoleRoute>} />

          {/* User management — admin only */}
          <Route path="users" element={<RoleRoute roles={['admin']}><Users /></RoleRoute>} />

          {/* Self-service password change — any authenticated user */}
          <Route path="account/password" element={<ChangePassword />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/:slug" element={<RouteViewer />} />
    </Routes>
  )
}
