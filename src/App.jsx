import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, CircularProgress } from '@mui/material'
import { api } from './services/api'
import { AppShell } from './components/AppShell'
import { useSessionStore } from './store/sessionStore'
import { eventBus } from './mocks/eventBus'
import { useDraftStore } from './store/draftStore'

const ConsultantWorkspace = lazy(() => import('./features/consultant/ConsultantWorkspace').then((module) => ({ default: module.ConsultantWorkspace })))
const ManagerDashboard = lazy(() => import('./features/manager/ManagerDashboard').then((module) => ({ default: module.ManagerDashboard })))
const CustomerPortal = lazy(() => import('./features/customer/CustomerPortal').then((module) => ({ default: module.CustomerPortal })))
const TicketPage = lazy(() => import('./features/tickets/TicketPage').then((module) => ({ default: module.TicketPage })))

function SessionRoutes() {
  const userId = useSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const sessionQuery = useQuery({
    queryKey: ['session', userId],
    queryFn: () => api.session(userId),
  })

  useEffect(() => {
    useDraftStore.getState().clearAll()
    queryClient.removeQueries({
      predicate: (query) => {
        const isPrivateData = query.queryKey[0] === 'tickets' || query.queryKey[0] === 'ticket'
        return isPrivateData && query.queryKey[1] !== userId
      },
    })
  }, [queryClient, userId])

  useEffect(() => eventBus.subscribe((event) => {
    queryClient.invalidateQueries({ queryKey: ['tickets', userId] })
    if (event.payload?.chamado_id) {
      queryClient.invalidateQueries({ queryKey: ['ticket', userId, event.payload.chamado_id] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['ticket', userId] })
    }
  }), [queryClient, userId])

  useEffect(() => {
    const role = sessionQuery.data?.user?.perfil
    const path = { consultor: '/consultant', gestor: '/manager', cliente: '/customer' }[role]
    if (path && window.location.pathname === '/') navigate(path, { replace: true })
  }, [navigate, sessionQuery.data])

  if (sessionQuery.isLoading) {
    return <div className="grid min-h-screen place-items-center"><CircularProgress /></div>
  }
  if (sessionQuery.isError) {
    return <div className="mx-auto mt-16 max-w-xl"><Alert severity="error">{sessionQuery.error.message}</Alert></div>
  }

  const { user } = sessionQuery.data
  const home = user.perfil === 'gestor' ? '/manager' : user.perfil === 'cliente' ? '/customer' : '/consultant'
  return (
    <AppShell user={user}>
      <Suspense fallback={<div className="grid min-h-[50vh] place-items-center"><CircularProgress /></div>}>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/consultant" element={user.perfil === 'consultor' ? <ConsultantWorkspace user={user} /> : <Navigate to={home} replace />} />
          <Route path="/manager" element={user.perfil === 'gestor' ? <ManagerDashboard user={user} /> : <Navigate to={home} replace />} />
          <Route path="/customer" element={user.perfil === 'cliente' ? <CustomerPortal user={user} /> : <Navigate to={home} replace />} />
          <Route path="/tickets/:ticketId" element={<TicketPage user={user} />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  return <SessionRoutes />
}
