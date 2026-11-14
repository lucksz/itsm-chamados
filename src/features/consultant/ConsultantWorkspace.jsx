import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import { useTickets } from '../../hooks/useTickets'
import { TicketDetailPanel } from '../tickets/TicketDetailPanel'
import { PRIORITY_LABELS, STATUS_LABELS, getSlaState, formatDateTime, isFinishedTicket } from '../../domain/tickets'
import { PriorityChip, StatusChip, SlaChip } from '../../components/TicketBadges'
import { eventBus } from '../../mocks/eventBus'
import { useDemoClock } from '../../hooks/useDemoClock'

const EMPTY_TICKETS = []

export function ConsultantWorkspace({ user }) {
  const [scope, setScope] = useState('mine')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('sla')
  const [selectedId, setSelectedId] = useState('')
  const [unreadByTicket, setUnreadByTicket] = useState({})
  const detailRef = useRef(null)
  const demoNow = useDemoClock()
  const query = useTickets(user.id, {
    page: 1,
    pageSize: 100,
    search,
    status,
    priority,
    category,
    assignee: scope === 'mine' ? user.id : '',
    scope: scope === 'queue' ? 'unassigned' : '',
    sort,
  })

  const tickets = query.data?.items || EMPTY_TICKETS
  const categories = useMemo(() => {
    const seen = new Map(tickets.map((ticket) => [ticket.categoria_id, ticket.categoria]))
    return [...seen.values()].filter(Boolean)
  }, [tickets])

  const activeTicketId = tickets.some((ticket) => ticket.id === selectedId) ? selectedId : tickets[0]?.id || ''

  useEffect(() => eventBus.subscribe((event) => {
    if (event.tipo === 'mensagem.adicionada'
      && event.payload?.autor_id !== user.id
      && event.payload?.chamado_id !== activeTicketId) {
      setUnreadByTicket((current) => ({
        ...current,
        [event.payload.chamado_id]: (current[event.payload.chamado_id] || 0) + 1,
      }))
    }
  }), [activeTicketId, user.id])
  const urgentCount = tickets.filter((ticket) => !isFinishedTicket(ticket)
    && ['at_risk', 'breached'].includes(getSlaState(ticket, demoNow).state)).length
  const mineCount = scope === 'mine' ? query.data?.total : undefined

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Typography variant="overline" color="primary">Operação · Infraestrutura</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }} className="tracking-tight">Central de atendimento</Typography>
          <Typography color="textSecondary" className="mt-1">Escolha o próximo chamado pela urgência do SLA e continue o atendimento sem perder o contexto.</Typography>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2">
            <Typography variant="caption" color="error">Precisam de atenção</Typography>
            <Typography variant="h6" sx={{ fontWeight: 750 }} color="error">{urgentCount}</Typography>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
            <Typography variant="caption" color="textSecondary">{scope === 'mine' ? 'Meus chamados' : 'Fila sem responsável'}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 750 }}>{mineCount ?? query.data?.total ?? '—'}</Typography>
          </div>
        </div>
      </header>

      <Paper variant="outlined" className="overflow-hidden rounded-2xl">
        <div className="border-b border-slate-100 px-4">
          <Tabs value={scope} onChange={(_, value) => setScope(value)} aria-label="Fila de chamados">
            <Tab value="mine" label="Meus chamados" />
            <Tab value="queue" label="Fila do meu grupo" />
          </Tabs>
        </div>
        <div className="grid min-h-[720px] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-slate-100 xl:border-b-0 xl:border-r">
            <div className="space-y-3 p-4">
              <TextField
                size="small"
                fullWidth
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar número ou assunto"
                slotProps={{
                  htmlInput: { 'aria-label': 'Buscar chamados' },
                  input: { startAdornment: <SearchOutlinedIcon fontSize="small" className="mr-2 text-slate-400" /> },
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <FormControl size="small">
                  <InputLabel id="consultant-status">Status</InputLabel>
                  <Select labelId="consultant-status" label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel id="consultant-priority">Prioridade</InputLabel>
                  <Select labelId="consultant-priority" label="Prioridade" value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel id="consultant-category">Categoria</InputLabel>
                  <Select labelId="consultant-category" label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {categories.map((entry) => <MenuItem value={entry.id} key={entry.id}>{entry.nome}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel id="consultant-sort">Ordenar</InputLabel>
                  <Select labelId="consultant-sort" label="Ordenar" value={sort} onChange={(event) => setSort(event.target.value)}>
                    <MenuItem value="sla">Risco de SLA</MenuItem>
                    <MenuItem value="recent">Atividade recente</MenuItem>
                    <MenuItem value="priority">Prioridade</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </div>
            {query.isLoading && <div className="grid h-48 place-items-center"><CircularProgress size={26} /></div>}
            {query.isError && <Alert severity="error" className="m-4">{query.error.message}</Alert>}
            {!query.isLoading && !query.isError && tickets.length === 0 && (
              <div className="px-5 py-12 text-center">
                <AddCommentOutlinedIcon className="text-slate-300" fontSize="large" />
                <Typography variant="subtitle2" className="mt-2">Nenhum chamado nesta fila</Typography>
                <Typography variant="caption" color="textSecondary">Ajuste os filtros ou verifique novamente mais tarde.</Typography>
              </div>
            )}
            <div className="max-h-[570px] overflow-y-auto">
              {tickets.map((ticket) => {
                const sla = getSlaState(ticket, demoNow)
                const selected = activeTicketId === ticket.id
                return (
                  <button
                    type="button"
                    key={ticket.id}
                    onClick={() => {
                      setSelectedId(ticket.id)
                      setUnreadByTicket((current) => {
                        const next = { ...current }
                        delete next[ticket.id]
                        return next
                      })
                      // Em telas estreitas o detalhe fica abaixo da lista.
                      if (!window.matchMedia('(min-width: 1280px)').matches) {
                        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                    className={`block w-full border-t border-slate-100 px-4 py-4 text-left transition hover:bg-indigo-50/60 ${selected ? 'border-l-4 border-l-indigo-600 bg-indigo-50/50' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Typography variant="caption" color="textSecondary">#{ticket.numero}</Typography>
                        {unreadByTicket[ticket.id] > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white" aria-label={`${unreadByTicket[ticket.id]} mensagens novas`}>{unreadByTicket[ticket.id]} nova(s)</span>}
                      </div>
                      <SlaChip state={sla.state} />
                    </div>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} className="line-clamp-2">{ticket.titulo}</Typography>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusChip status={ticket.status} />
                      <PriorityChip priority={ticket.prioridade} />
                    </div>
                    <Typography variant="caption" color="textSecondary" className="mt-2 block">
                      {ticket.solicitante?.nome || 'Solicitante'} · {ticket.grupo?.nome}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" className="block">
                      Atualizado {formatDateTime(ticket.atualizado_em, user)}
                    </Typography>
                  </button>
                )
              })}
            </div>
          </aside>
          <section ref={detailRef} className="min-w-0 scroll-mt-20 p-4 sm:p-5">
            {activeTicketId
              ? <TicketDetailPanel user={user} ticketId={activeTicketId} />
              : <div className="grid min-h-[600px] place-items-center text-center"><div><Typography variant="h6">Selecione um chamado</Typography><Typography color="textSecondary">A conversa e os próximos passos aparecerão aqui.</Typography></div></div>}
          </section>
        </div>
      </Paper>
    </div>
  )
}
