import { Chip } from '@mui/material'
import { PRIORITY_LABELS, STATUS_LABELS } from '../domain/tickets'

const STATUS_COLORS = {
  aberto: 'info',
  em_atendimento: 'primary',
  aguardando_cliente: 'warning',
  resolvido: 'success',
  fechado: 'default',
}
const SLA_LABELS = {
  on_track: 'No prazo',
  at_risk: 'Próximo do vencimento',
  breached: 'SLA violado',
  met: 'SLA cumprido',
  paused: 'SLA pausado',
}
const SLA_COLORS = {
  on_track: 'success',
  at_risk: 'warning',
  breached: 'error',
  met: 'success',
  paused: 'default',
}
const CUSTOMER_STATUS_LABELS = {
  ...STATUS_LABELS,
  aguardando_cliente: 'Aguardamos a sua resposta',
}
const CUSTOMER_SLA_LABELS = {
  on_track: 'No prazo',
  at_risk: 'Prazo próximo',
  breached: 'Prazo ultrapassado',
  met: 'Resposta no prazo',
  paused: 'A aguardar resposta',
}

export function StatusChip({ status, size = 'small', audience = 'internal' }) {
  const labels = audience === 'customer' ? CUSTOMER_STATUS_LABELS : STATUS_LABELS
  return <Chip size={size} label={labels[status] || status} color={STATUS_COLORS[status] || 'default'} />
}

export function PriorityChip({ priority }) {
  const color = priority === 'critica' ? 'error' : priority === 'alta' ? 'warning' : 'default'
  return <Chip size="small" variant="outlined" color={color} label={PRIORITY_LABELS[priority] || priority} />
}

export function SlaChip({ state, audience = 'internal' }) {
  const labels = audience === 'customer' ? CUSTOMER_SLA_LABELS : SLA_LABELS
  return <Chip size="small" color={SLA_COLORS[state] || 'default'} label={labels[state] || state} />
}
