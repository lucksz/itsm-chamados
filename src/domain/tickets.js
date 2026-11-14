import { differenceInMilliseconds } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { pt, ptBR } from 'date-fns/locale'

export const STATUS_LABELS = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
}

export const PRIORITY_LABELS = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

const CLOSED_STATUSES = new Set(['resolvido', 'fechado'])
const PRIORITY_WEIGHT = { critica: 0, alta: 1, media: 2, baixa: 3 }

export function getDemoNow(reference, startedAt = Date.now()) {
  return new Date(new Date(reference).getTime() + (Date.now() - startedAt))
}

export function formatDateTime(value, user, options = {}) {
  if (!value) return '—'
  const locale = user?.locale === 'pt-PT' ? pt : ptBR
  const formatted = formatInTimeZone(value, user?.zoneinfo || 'UTC', 'd MMM yyyy, HH:mm', { locale })
  if (options.dateOnly) return formatted.split(',')[0]
  return formatted
}

export function getSlaState(ticket, now, kind = 'resolution') {
  const firstResponse = kind === 'response'
  const deadline = firstResponse ? ticket.prazo_primeira_resposta : ticket.prazo_resolucao
  const actual = firstResponse
    ? ticket.primeira_resposta_em
    : ticket.resolvido_em || ticket.fechado_em
  const done = Boolean(actual) || (CLOSED_STATUSES.has(ticket.status) && !firstResponse)

  if (ticket.sla_pausado && !done) return { state: 'paused', remainingMs: null, deadline }
  if (done) {
    const state = actual && new Date(actual) <= new Date(deadline) ? 'met' : 'breached'
    return { state, remainingMs: null, deadline, actual }
  }

  const remainingMs = differenceInMilliseconds(new Date(deadline), new Date(now))
  if (remainingMs <= 0) return { state: 'breached', remainingMs, deadline }
  if (remainingMs <= 2 * 60 * 60 * 1000) return { state: 'at_risk', remainingMs, deadline }
  return { state: 'on_track', remainingMs, deadline }
}

export function getTicketUrgency(ticket, now) {
  const response = getSlaState(ticket, now, 'response')
  const resolution = getSlaState(ticket, now)
  const rank = { breached: 0, at_risk: 1, on_track: 2, paused: 3, met: 4 }
  return Math.min(rank[response.state], rank[resolution.state])
}

export function isFinishedTicket(ticket) {
  return CLOSED_STATUSES.has(ticket.status)
}

export function getCustomerNextStep(ticket) {
  if (ticket.status === 'aguardando_cliente') return 'A equipa precisa da sua resposta.'
  if (ticket.status === 'fechado') return 'Pedido encerrado. Reabra-o se o problema continuar.'
  if (ticket.status === 'resolvido') return 'A equipa marcou o pedido como resolvido. Responda na conversa se ainda precisar de ajuda.'
  return ticket.responsavel?.nome
    ? `${ticket.responsavel.nome} está a acompanhar o pedido.`
    : 'A equipa está a procurar um responsável.'
}

export function filterAndSortTickets(tickets, filters, now, users = []) {
  const normalizedQuery = (filters.search || '').trim().toLocaleLowerCase()
  const visible = tickets.filter((ticket) => {
    const requester = users.find((user) => user.id === ticket.solicitante_id)?.nome || ''
    return (!filters.status || ticket.status === filters.status)
      && (!filters.priority || ticket.prioridade === filters.priority)
      && (!filters.category || ticket.categoria_id === filters.category)
      && (!filters.group || ticket.grupo_id === filters.group)
      && (!filters.assignee || ticket.responsavel_id === filters.assignee)
      && (!normalizedQuery
        || `${ticket.numero} ${ticket.titulo} ${ticket.descricao} ${requester}`
          .toLocaleLowerCase()
          .includes(normalizedQuery))
  })

  return visible.sort((a, b) => {
    if (filters.sort === 'recent') return new Date(b.atualizado_em) - new Date(a.atualizado_em)
    // Chamados encerrados nunca disputam o topo da fila operacional com os ativos.
    const finishedOrder = Number(isFinishedTicket(a)) - Number(isFinishedTicket(b))
    if (finishedOrder) return finishedOrder
    if (isFinishedTicket(a)) return new Date(b.atualizado_em) - new Date(a.atualizado_em)
    if (filters.sort === 'priority') {
      return PRIORITY_WEIGHT[a.prioridade] - PRIORITY_WEIGHT[b.prioridade]
        || getTicketUrgency(a, now) - getTicketUrgency(b, now)
    }
    return getTicketUrgency(a, now) - getTicketUrgency(b, now)
      || new Date(a.prazo_resolucao) - new Date(b.prazo_resolucao)
  })
}

export function validateStatusChange(status, reason) {
  return Boolean(status && reason?.trim())
}

export function canReopenTicket(ticket, user) {
  return Boolean(ticket && user && ticket.status === 'fechado'
    && (user.perfil === 'cliente' ? ticket.solicitante_id === user.id : user.perfil === 'consultor' || user.perfil === 'gestor'))
}

export function changeTicketStatus(ticket, status, reason, userId, now, id = crypto.randomUUID()) {
  if (!validateStatusChange(status, reason)) {
    throw new Error('Informe o novo status e o motivo da alteração.')
  }
  if (!Object.hasOwn(STATUS_LABELS, status)) throw new Error('Status inválido.')

  const updated = {
    ...ticket,
    status,
    atualizado_em: new Date(now).toISOString(),
    ...(status === 'resolvido' ? { resolvido_em: new Date(now).toISOString() } : {}),
    ...(status === 'fechado' ? { fechado_em: new Date(now).toISOString() } : {}),
    ...(status === 'aberto' || status === 'em_atendimento' ? { resolvido_em: null, fechado_em: null } : {}),
  }
  const history = {
    id,
    chamado_id: ticket.id,
    de: ticket.status,
    para: status,
    tipo: 'status',
    usuario_id: userId,
    motivo: reason.trim(),
    ocorrido_em: new Date(now).toISOString(),
  }
  return { ticket: updated, history }
}

export function assignTicket(ticket, consultantId, now, userId, id = crypto.randomUUID()) {
  if (consultantId !== null && !consultantId) throw new Error('Selecione um consultor responsável.')
  const updated = { ...ticket, responsavel_id: consultantId, atualizado_em: new Date(now).toISOString() }
  const history = {
    id,
    chamado_id: ticket.id,
    de: ticket.responsavel_id || null,
    para: consultantId,
    tipo: 'atribuicao',
    usuario_id: userId,
    motivo: null,
    ocorrido_em: new Date(now).toISOString(),
  }
  return { ticket: updated, history }
}

export function appendUniqueMessage(messages, incoming) {
  if (messages.some((message) => message.id === incoming.id)) return messages
  return [...messages, incoming].sort((a, b) => new Date(a.criada_em) - new Date(b.criada_em))
}

export function getTicketSummary(ticket, data) {
  return {
    ...ticket,
    solicitante: data.usuarios.find((user) => user.id === ticket.solicitante_id),
    responsavel: data.usuarios.find((user) => user.id === ticket.responsavel_id) || null,
    grupo: data.grupos.find((group) => group.id === ticket.grupo_id),
    categoria: data.categorias.find((category) => category.id === ticket.categoria_id),
  }
}

