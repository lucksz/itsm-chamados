import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import AssignmentLateOutlinedIcon from '@mui/icons-material/AssignmentLateOutlined'
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined'
import { api } from '../../services/api'
import { useTickets } from '../../hooks/useTickets'
import { useDemoClock } from '../../hooks/useDemoClock'
import { formatDateTime, getSlaState } from '../../domain/tickets'
import { EventSimulator } from './EventSimulator'

const StatusChart = lazy(() => import('./StatusChart'))
const PriorityChart = lazy(() => import('./PriorityChart'))
const ManagerTicketGrid = lazy(() => import('./ManagerTicketGrid'))

function MetricCard({ label, value, note, icon: Icon, tone }) {
  return (
    <Card variant="outlined" className="rounded-2xl">
      <CardContent className="flex items-start justify-between gap-2 p-5">
        <div>
          <Typography variant="body2" color="textSecondary">{label}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }} className="mt-1">{value ?? '—'}</Typography>
          <Typography variant="caption" color="textSecondary">{note}</Typography>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon />
        </span>
      </CardContent>
    </Card>
  )
}

export function ManagerDashboard({ user }) {
  const navigate = useNavigate()
  const [group, setGroup] = useState('')
  const [consultant, setConsultant] = useState('')
  const [page, setPage] = useState(0)
  const demoNow = useDemoClock()
  const sessionQuery = useQuery({ queryKey: ['session', user.id], queryFn: () => api.session(user.id) })
  const analyticsQuery = useQuery({
    queryKey: ['analytics', user.id, group, consultant],
    queryFn: () => api.analytics(user.id, { group, consultant }),
    refetchInterval: 30000,
  })
  const ticketQuery = useTickets(user.id, {
    page: page + 1,
    pageSize: 25,
    group,
    assignee: consultant,
    sort: 'sla',
  })
  const consultantsQuery = useQuery({ queryKey: ['consultants', user.id], queryFn: () => api.consultants(user.id) })
  const groups = sessionQuery.data?.grupos || []
  const consultants = consultantsQuery.data || []
  const analytics = analyticsQuery.data
  const tickets = ticketQuery.data?.items || []
  const activeLoads = useMemo(() => analytics?.consultants.slice().sort((a, b) => b.assigned - a.assigned) || [], [analytics])
  const rows = tickets.map((ticket) => ({
    id: ticket.id,
    numero: ticket.numero,
    titulo: ticket.titulo,
    grupoNome: ticket.grupo?.nome || '—',
    responsavelNome: ticket.responsavel?.nome || 'Sem responsável',
    status: ticket.status,
    prioridade: ticket.prioridade,
    sla: getSlaState(ticket, demoNow).state,
    prazo: formatDateTime(ticket.prazo_resolucao, user),
  }))

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Typography variant="overline" color="primary">Visão de equipe</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }} className="tracking-tight">Painel operacional</Typography>
          <Typography color="textSecondary" className="mt-1">Uma visão da carga, dos prazos e dos pontos que precisam de redistribuição.</Typography>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EventSimulator userId={user.id} tickets={tickets} consultants={consultants} />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="manager-group-label">Grupo</InputLabel>
            <Select labelId="manager-group-label" label="Grupo" value={group} onChange={(event) => { setGroup(event.target.value); setConsultant(''); setPage(0) }}>
              <MenuItem value="">Todos os grupos</MenuItem>
              {groups.map((entry) => <MenuItem value={entry.id} key={entry.id}>{entry.nome}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="manager-consultant-label">Consultor</InputLabel>
            <Select labelId="manager-consultant-label" label="Consultor" value={consultant} onChange={(event) => { setConsultant(event.target.value); setPage(0) }}>
              <MenuItem value="">Toda a equipe</MenuItem>
              {consultants.filter((entry) => !group || entry.grupo_id === group).map((entry) => <MenuItem value={entry.id} key={entry.id}>{entry.nome}</MenuItem>)}
            </Select>
          </FormControl>
        </div>
      </header>

      {analyticsQuery.isError && <Alert severity="error">{analyticsQuery.error.message}</Alert>}
      {analyticsQuery.isLoading ? <div className="grid h-32 place-items-center"><CircularProgress /></div> : analytics && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Em risco de SLA" value={analytics.atRisk} note="Chamados ativos próximos ou além do prazo" icon={WarningAmberOutlinedIcon} tone="bg-amber-50 text-amber-700" />
            <MetricCard label="SLA violado" value={analytics.overdue} note="Prazo excedido no histórico, incluindo encerrados" icon={AssignmentLateOutlinedIcon} tone="bg-rose-50 text-rose-700" />
            <MetricCard label="Sem responsável" value={analytics.unassigned} note="Disponíveis para atribuição" icon={PersonOffOutlinedIcon} tone="bg-indigo-50 text-indigo-700" />
            <MetricCard label="Chamados no recorte" value={analytics.totals} note="Volume conforme os filtros selecionados" icon={AssignmentLateOutlinedIcon} tone="bg-slate-100 text-slate-700" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Paper variant="outlined" className="rounded-2xl p-4 sm:p-5">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Chamados por status</Typography>
              <Typography variant="caption" color="textSecondary" className="block">Volume no grupo ou consultor selecionado</Typography>
              <Suspense fallback={<div className="grid h-[250px] place-items-center"><CircularProgress size={24} /></div>}>
                <StatusChart data={analytics.statusCounts} />
              </Suspense>
            </Paper>
            <Paper variant="outlined" className="rounded-2xl p-4 sm:p-5">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Chamados por prioridade</Typography>
              <Typography variant="caption" color="textSecondary" className="block">Use a prioridade técnica com o risco de SLA para orientar a fila.</Typography>
              <Suspense fallback={<div className="grid h-[250px] place-items-center"><CircularProgress size={24} /></div>}>
                <PriorityChart data={analytics.priorityCounts} />
              </Suspense>
            </Paper>
          </div>

          <Paper variant="outlined" className="rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Carga atual por consultor</Typography>
                <Typography variant="caption" color="textSecondary" className="block">Chamados ativos atribuídos agora; não representa tempo histórico sem atribuição.</Typography>
              </div>
              <Typography variant="caption" color="textSecondary">Referência de acompanhamento: 0–5 poucos · acima de 40 alta carga</Typography>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeLoads.map((entry) => {
                const busy = entry.assigned > 40
                const low = entry.assigned <= 5
                return (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" key={entry.id}>
                    <div className="flex items-center justify-between gap-2">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.nome}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 750 }}>{entry.assigned}</Typography>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${busy ? 'bg-rose-500' : low ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, entry.assigned / 50 * 100)}%` }} />
                    </div>
                    <Typography variant="caption" color={busy ? 'error' : low ? 'warning' : 'textSecondary'}>
                      {busy ? 'Carga alta' : low ? 'Poucos chamados atribuídos' : 'Carga equilibrada'}
                    </Typography>
                  </div>
                )
              })}
            </div>
          </Paper>

          <Paper variant="outlined" className="overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5">
              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Fila operacional</Typography>
                <Typography variant="caption" color="textSecondary" className="block">Chamados ativos primeiro, do maior para o menor risco de SLA; encerrados ao final.</Typography>
              </div>
              {ticketQuery.isError && <Alert severity="error">{ticketQuery.error.message}</Alert>}
            </div>
            <Suspense fallback={<div className="grid h-32 place-items-center"><CircularProgress size={24} /></div>}>
              <ManagerTicketGrid
                rows={rows}
                rowCount={ticketQuery.data?.total || 0}
                page={page}
                loading={ticketQuery.isLoading}
                onPageChange={setPage}
                onOpenTicket={(ticketId) => navigate(`/tickets/${ticketId}`)}
              />
            </Suspense>
          </Paper>
        </>
      )}
    </div>
  )
}
