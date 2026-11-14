import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Typography,
} from '@mui/material'
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import { api } from '../../services/api'
import { PRIORITY_LABELS, STATUS_LABELS, formatDateTime, getCustomerNextStep, getSlaState, isFinishedTicket } from '../../domain/tickets'
import { useTicket } from '../../hooks/useTickets'
import { StatusChip, SlaChip } from '../../components/TicketBadges'
import { TicketConversation } from '../../components/TicketConversation'
import { StatusChangeDialog } from '../../components/StatusChangeDialog'
import { useDemoClock } from '../../hooks/useDemoClock'

function SlaLine({ label, state, deadline, user, customer }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
          <AccessTimeOutlinedIcon fontSize="small" className="text-slate-400" />
          {label}
        </span>
        <SlaChip state={state.state} audience={customer ? 'customer' : 'internal'} />
      </div>
      <Typography variant="caption" color="textSecondary" className="block pl-[26px]">
        {state.state === 'paused' ? 'Contagem suspensa' : `Prazo: ${formatDateTime(deadline, user)}`}
      </Typography>
    </div>
  )
}

export function TicketDetailPanel({ user, ticketId, backAction }) {
  const queryClient = useQueryClient()
  const [statusDialog, setStatusDialog] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(8)
  const demoNow = useDemoClock()
  const ticketQuery = useTicket(user.id, ticketId)
  const consultantsQuery = useQuery({
    queryKey: ['consultants', user.id],
    queryFn: () => api.consultants(user.id),
    enabled: user.perfil !== 'cliente',
  })
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }) => api.changeStatus(user.id, ticketId, status, reason),
    onSuccess: () => {
      setStatusDialog(false)
      queryClient.invalidateQueries({ queryKey: ['tickets', user.id] })
      queryClient.invalidateQueries({ queryKey: ['ticket', user.id, ticketId] })
    },
  })
  const assignMutation = useMutation({
    mutationFn: (consultantId) => api.assign(user.id, ticketId, consultantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', user.id] })
      queryClient.invalidateQueries({ queryKey: ['ticket', user.id, ticketId] })
    },
  })

  if (ticketQuery.isLoading) return <Paper variant="outlined" className="rounded-2xl p-6"><Skeleton height={36} /><Skeleton height={100} /><Skeleton height={300} /></Paper>
  if (ticketQuery.isError) return <Alert severity="error">{ticketQuery.error.message}</Alert>
  const { ticket, mensagens, historico } = ticketQuery.data
  const customer = user.perfil === 'cliente'
  const responseSla = getSlaState(ticket, demoNow, 'response')
  const resolutionSla = getSlaState(ticket, demoNow)
  const consultants = consultantsQuery.data?.filter((consultant) => consultant.grupo_id === ticket.grupo_id) || []
  const sortedHistory = historico.slice().sort((a, b) => new Date(b.ocorrido_em) - new Date(a.ocorrido_em))

  return (
    <div className="space-y-4">
      {backAction}
      {(statusMutation.isError || assignMutation.isError) && (
        <Alert severity="error">{statusMutation.error?.message || assignMutation.error?.message}</Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Paper variant="outlined" className="rounded-2xl p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Typography variant="overline" color="textSecondary">{customer ? 'Pedido' : 'Chamado'} #{ticket.numero}</Typography>
              <StatusChip status={ticket.status} audience={customer ? 'customer' : 'internal'} />
            </div>
            <Typography variant="h5" sx={{ fontWeight: 750 }} className="mb-3">{ticket.titulo}</Typography>
            <Typography variant="body2" className="whitespace-pre-wrap leading-6 text-slate-600">{ticket.descricao}</Typography>
          </Paper>
          <TicketConversation user={user} ticket={ticket} messages={mensagens} />
          {historico.length > 0 && (
            <Paper variant="outlined" className="rounded-2xl p-5">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }} className="mb-3">Histórico do atendimento</Typography>
              <div className="space-y-3">
                {sortedHistory.slice(0, historyLimit).map((entry) => (
                  <div className="flex gap-3" key={entry.id}>
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                    <div className="min-w-0 flex-1">
                      <Typography variant="body2">
                        {entry.tipo === 'status'
                          ? `${entry.usuario?.nome || 'Equipe'} alterou para ${STATUS_LABELS[entry.para] || entry.para?.replaceAll('_', ' ')}`
                          : `Responsável: ${entry.responsavelAnterior?.nome || 'Sem responsável'} → ${entry.responsavelNovo?.nome || 'Sem responsável'}`}
                      </Typography>
                      {entry.motivo && <Typography variant="body2" color="textSecondary">{entry.motivo}</Typography>}
                      <Typography variant="caption" color="textSecondary">{formatDateTime(entry.ocorrido_em, user)}</Typography>
                    </div>
                  </div>
                ))}
              </div>
              {sortedHistory.length > historyLimit && (
                <Button className="mt-3" size="small" onClick={() => setHistoryLimit((limit) => limit + 8)}>
                  Ver alterações anteriores
                </Button>
              )}
            </Paper>
          )}
        </div>

        <aside className="space-y-4">
          <Paper variant="outlined" className="space-y-4 rounded-2xl p-5">
            {!customer && (
              <>
                <div>
                  <Typography variant="caption" color="textSecondary">Solicitante</Typography>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar sx={{ width: 30, height: 30, bgcolor: '#f1f5f9', color: '#334155', fontSize: 12 }}>
                      {ticket.solicitante?.nome?.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{ticket.solicitante?.nome}</Typography>
                  </div>
                </div>
                <Divider />
              </>
            )}
            {customer ? (
              <>
                <div>
                  <Typography variant="caption" color="textSecondary">Responsável</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} className="mt-1">
                    {ticket.responsavel?.nome || 'A equipa irá assumir o seu pedido'}
                  </Typography>
                </div>
                <div>
                  <Typography variant="caption" color="textSecondary">Próximo passo</Typography>
                  <Typography variant="body2" className="mt-1">{getCustomerNextStep(ticket)}</Typography>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Typography variant="caption" color="textSecondary">Grupo · categoria</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} className="mt-1">{ticket.grupo?.nome} · {ticket.categoria?.nome}</Typography>
                </div>
                <div>
                  <Typography variant="caption" color="textSecondary">Prioridade</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} className="mt-1">{PRIORITY_LABELS[ticket.prioridade] || ticket.prioridade}</Typography>
                </div>
                <Divider />
                {user.perfil === 'gestor' ? (
                  <FormControl size="small" fullWidth>
                    <InputLabel id="assignee-label">Responsável</InputLabel>
                    <Select
                      labelId="assignee-label"
                      value={ticket.responsavel_id || ''}
                      label="Responsável"
                      onChange={(event) => assignMutation.mutate(event.target.value)}
                      disabled={assignMutation.isPending || consultantsQuery.isLoading}
                    >
                      <MenuItem value=""><em>Sem responsável</em></MenuItem>
                      {consultants.map((consultant) => <MenuItem value={consultant.id} key={consultant.id}>{consultant.nome}</MenuItem>)}
                    </Select>
                  </FormControl>
                ) : (
                  <div>
                    <Typography variant="caption" color="textSecondary">Responsável</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} className="mt-1">{ticket.responsavel?.nome || 'Sem responsável'}</Typography>
                  </div>
                )}
                {user.perfil === 'consultor' && !ticket.responsavel_id && (
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<AssignmentIndOutlinedIcon />}
                    disabled={assignMutation.isPending}
                    onClick={() => assignMutation.mutate(user.id)}
                  >
                    Assumir chamado
                  </Button>
                )}
              </>
            )}
            {(!customer || !isFinishedTicket(ticket)) && (
              <>
                <Divider />
                <Typography variant="caption" color="textSecondary">Prazos de atendimento</Typography>
                <SlaLine label="Primeira resposta" state={responseSla} deadline={ticket.prazo_primeira_resposta} user={user} customer={customer} />
                <SlaLine label="Resolução" state={resolutionSla} deadline={ticket.prazo_resolucao} user={user} customer={customer} />
              </>
            )}
            {!customer && (
              <>
                <Divider />
                <Button fullWidth variant="outlined" onClick={() => setStatusDialog(true)}>Alterar status</Button>
              </>
            )}
            {customer && ticket.status === 'fechado' && (
              <Button fullWidth variant="contained" onClick={() => setStatusDialog(true)}>Reabrir pedido</Button>
            )}
            <Typography variant="caption" color="textSecondary" className="block">
              Aberto em {formatDateTime(ticket.aberto_em, user)}
            </Typography>
          </Paper>
          {customer && (
            <Paper variant="outlined" className="rounded-2xl p-4">
              <Typography variant="caption" color="textSecondary">
                A conversa e as atualizações deste pedido são visíveis apenas para si e para a equipa de suporte.
              </Typography>
            </Paper>
          )}
        </aside>
      </div>
      {statusDialog && <StatusChangeDialog
        open
        onClose={() => setStatusDialog(false)}
        currentStatus={ticket.status}
        reopenOnly={customer}
        onSubmit={(status, reason) => statusMutation.mutate({ status, reason })}
      />}
      {(statusMutation.isPending || assignMutation.isPending) && <CircularProgress className="fixed bottom-5 right-5" size={24} />}
    </div>
  )
}
