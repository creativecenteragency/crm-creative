import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import LeadsPage from './pages/LeadsPage'
import KanbanPage from './pages/KanbanPage'
import AdminWorkspaces from './pages/admin/AdminWorkspaces'
import WorkspaceSettings from './pages/admin/WorkspaceSettings'

function Home() {
  const { profile, workspaces, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-slate-500">Cargando…</div>
  if (workspaces.length > 0) return <Navigate to={`/w/${workspaces[0].id}/leads`} replace />
  if (profile?.is_master) return <Navigate to="/admin" replace />
  return <div className="p-8 text-sm text-slate-500">Todavía no tenés ningún cliente asignado.</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Home />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/w/:workspaceId/leads"
        element={
          <ProtectedRoute>
            <Layout>
              <LeadsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/w/:workspaceId/kanban"
        element={
          <ProtectedRoute>
            <Layout>
              <KanbanPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute masterOnly>
            <Layout>
              <AdminWorkspaces />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/workspaces/:workspaceId"
        element={
          <ProtectedRoute masterOnly>
            <Layout>
              <WorkspaceSettings />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
