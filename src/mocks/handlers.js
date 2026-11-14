import { http, HttpResponse } from 'msw'
import { database } from './database'
import { eventBus, createEvent } from './eventBus'
import { now } from './demoClock'
import { canAccessTicket } from './permissions'
import { canReopenTicket, filterAndSortTickets, getSlaState, STATUS_LABELS } from '../domain/tickets'
import { visibleMessagesFor } from './permissions'

const ticketInputSchema = {
  titulo: (value) => typeof value === 'string' && value.trim().length >= 5,
  descricao: (value) => typeof value === 'string' && value.trim().length >= 10,
  categoria_id: (value) => typeof value === 'string',
  prioridade: (value) => ['baixa', 'media', 'alta', 'critica'].includes(value),
}

function respondError(message, status = 400) {
  return HttpResponse.json({ message }, { status })
}

function getUser(request) {
  const userId = request.headers.get('x-demo-user')
  const user = database.metadata().usuarios.find((entry) => entry.id === userId)
  if (!user) throw Object.assign(new Error('Selecione um perfil de demonstração.'), { status: 401 })
  return user
}

function requireAccess(user, ticket) {
  if (!canAccessTicket(user, ticket)) {
    throw Object.assign(new Error('Você não tem acesso a este chamado.'), { status: 403 })
  }
}

function enrich(ticket) {
  const data = database.metadata()
  return {
    ...ticket,
    solicitante: data.usuarios.find((user) => user.id === ticket.solicitante_id),
    responsavel: data.usuarios.find((user) => user.id === ticket.responsavel_id) || null,
    grupo: data.grupos.find((group) => group.id === ticket.grupo_id),
    categoria: data.categorias.find((category) => category.id === ticket.categoria_id),
  }
}

function forClient(ticket, user) {
  if (user.perfil !== 'cliente') return ticket
  const clientTicket = { ...ticket }
  delete clientTicket.grupo_id
  delete clientTicket.categoria_id
  delete clientTicket.prioridade
  delete clientTicket.grupo
  delete clientTicket.categoria
  delete clientTicket.solicitante_id
  delete clientTicket.responsavel_id
  for (const key of ['solicitante', 'responsavel']) {
    if (clientTicket[key]) {
      clientTicket[key] = { id: clientTicket[key].id, nome: clientTicket[key].nome }
    }
  }
  return clientTicket
}

function emit(type, payload) {
  const event = createEvent(type, payload, now())
  eventBus.emit(event)
  return event
}

function handleError(error) {
  return respondError(error.message || 'Não foi possível concluir a operação.', error.status || 400)
}

let lastDemoEvent = null

export const handlers = [
  http.get('/api/session', ({ request }) => {
    try {
      const user = getUser(request)
      const metadata = database.metadata()
      return HttpResponse.json({
        user,
        meta: metadata.meta,
        categorias: metadata.categorias,
        ...(user.perfil === 'cliente' ? {} : { grupos: metadata.grupos, sla: metadata.sla }),
      })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.get('/api/tickets', ({ request }) => {
    try {
      const user = getUser(request)
      const url = new URL(request.url)
      const params = url.searchParams
      let tickets = database.listTickets().filter((ticket) => canAccessTicket(user, ticket))
      const filters = {
        search: params.get('search') || '',
        status: params.get('status') || '',
        priority: params.get('priority') || '',
        category: params.get('category') || '',
        group: params.get('group') || '',
        assignee: params.get('assignee') || '',
        scope: params.get('scope') || '',
        sort: params.get('sort') || 'sla',
      }
      tickets = tickets.filter((ticket) => (!filters.status || ticket.status === filters.status)
        && (!filters.priority || ticket.prioridade === filters.priority)
        && (!filters.category || ticket.categoria_id === filters.category)
        && (!filters.group || ticket.grupo_id === filters.group)
        && (!filters.assignee || ticket.responsavel_id === filters.assignee)
        && (filters.scope !== 'unassigned' || !ticket.responsavel_id)
        && (!filters.search || `${ticket.numero} ${ticket.titulo} ${ticket.descricao}`
          .toLocaleLowerCase()
          .includes(filters.search.toLocaleLowerCase())))

      const sorted = filterAndSortTickets(tickets, filters, now(), database.metadata().usuarios)
      const page = Math.max(1, Number(params.get('page')) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 50))
      const start = (page - 1) * pageSize
      return HttpResponse.json({
        items: sorted.slice(start, start + pageSize).map((ticket) => forClient(enrich(ticket), user)),
        total: sorted.length,
        page,
        pageSize,
      })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.get('/api/tickets/:ticketId', ({ params, request }) => {
    try {
      const user = getUser(request)
      const { ticket, mensagens, historico } = database.getTicket(params.ticketId)
      requireAccess(user, ticket)
      const visibleMessages = visibleMessagesFor(user, mensagens)
      return HttpResponse.json({
        ticket: forClient(enrich(ticket), user),
        mensagens: visibleMessages.map((message) => {
          const author = database.metadata().usuarios.find((entry) => entry.id === message.autor_id)
          return {
            ...message,
              ...(user.perfil === 'cliente' ? { autor_id: undefined } : {}),
              autor: user.perfil === 'cliente' && author ? { id: author.id, nome: author.nome } : author,
          }
        }),
        historico: historico
          .filter((entry) => user.perfil !== 'cliente' || entry.tipo === 'status')
          .map((entry) => {
            const users = database.metadata().usuarios
            const person = users.find((candidate) => candidate.id === entry.usuario_id)
            return {
              ...entry,
              usuario: user.perfil === 'cliente' && person ? { id: person.id, nome: person.nome } : person,
              responsavelAnterior: users.find((candidate) => candidate.id === entry.de),
              responsavelNovo: users.find((candidate) => candidate.id === entry.para),
            }
          }),
      })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.post('/api/tickets', async ({ request }) => {
    try {
      const user = getUser(request)
      if (user.perfil !== 'cliente') return respondError('Somente clientes podem abrir chamados.', 403)
      const input = await request.json()
      if (!Object.entries(ticketInputSchema).every(([key, check]) => check(input[key]))) {
        return respondError('Confira título, descrição, categoria e prioridade.')
      }
      const ticket = database.createTicket(input, user.id)
      emit('chamado.aberto', enrich(ticket))
      return HttpResponse.json(forClient(enrich(ticket), user), { status: 201 })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.post('/api/tickets/:ticketId/messages', async ({ params, request }) => {
    try {
      const user = getUser(request)
      const { ticket } = database.getTicket(params.ticketId)
      requireAccess(user, ticket)
      if (ticket.status === 'fechado') return respondError('Reabra o chamado antes de enviar uma mensagem.', 409)
      const input = await request.json()
      if (typeof input.texto !== 'string' || !input.texto.trim()) return respondError('Escreva uma mensagem.')
      if (user.perfil === 'cliente' && input.interna) {
        return respondError('Clientes não podem enviar anotações internas.', 403)
      }
      const message = database.addMessage(params.ticketId, input, user.id)
      const enrichedMessage = { ...message, autor: user }
      emit('mensagem.adicionada', enrichedMessage)
      return HttpResponse.json(enrichedMessage, { status: 201 })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.post('/api/tickets/:ticketId/assign', async ({ params, request }) => {
    try {
      const user = getUser(request)
      const { ticket } = database.getTicket(params.ticketId)
      requireAccess(user, ticket)
      const input = await request.json()
      const unassign = input.consultor_id === '' || input.consultor_id === null
      if (unassign && user.perfil !== 'gestor') return respondError('Somente o gestor pode remover um responsável.', 403)
      const consultant = database.metadata().usuarios.find((entry) => entry.id === input.consultor_id
        && entry.perfil === 'consultor')
      if (!unassign && !consultant) return respondError('Consultor inválido.')
      if (user.perfil === 'consultor' && (ticket.responsavel_id || consultant.id !== user.id)) {
        return respondError('Você só pode assumir chamados sem responsável do seu grupo.', 403)
      }
      if (user.perfil !== 'gestor' && user.perfil !== 'consultor') {
        return respondError('Atribuição não permitida.', 403)
      }
      if (!unassign && consultant.grupo_id !== ticket.grupo_id) return respondError('O consultor precisa pertencer ao grupo do chamado.')
      const result = database.assign(params.ticketId, unassign ? null : consultant.id, user.id)
      const updatedTicket = enrich(result.ticket)
      emit('chamado.atribuido', { chamado_id: ticket.id, consultor_id: consultant?.id || null })
      return HttpResponse.json({ ticket: updatedTicket, historico: result.history })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.post('/api/tickets/:ticketId/status', async ({ params, request }) => {
    try {
      const user = getUser(request)
      const { ticket } = database.getTicket(params.ticketId)
      requireAccess(user, ticket)
      const input = await request.json()
      if (!Object.hasOwn(STATUS_LABELS, input.status) || !input.motivo?.trim()) {
        return respondError('Selecione um status e informe o motivo.')
      }
      if (user.perfil === 'cliente' && !(input.status === 'aberto' && canReopenTicket(ticket, user))) {
        return respondError('Só é possível reabrir um chamado fechado.', 403)
      }
      const result = database.changeStatus(params.ticketId, input.status, input.motivo, user.id)
      emit('status.alterado', {
        chamado_id: ticket.id,
        de: ticket.status,
        para: input.status,
        motivo: input.motivo.trim(),
        usuario_id: user.id,
      })
      return HttpResponse.json({ ticket: forClient(enrich(result.ticket), user), historico: result.history })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.get('/api/consultants', ({ request }) => {
    try {
      const user = getUser(request)
      if (user.perfil !== 'gestor' && user.perfil !== 'consultor') return respondError('Acesso não permitido.', 403)
      return HttpResponse.json(database.metadata().usuarios
        .filter((entry) => entry.perfil === 'consultor')
        .map(({ id, nome, grupo_id, locale, zoneinfo }) => ({ id, nome, grupo_id, locale, zoneinfo })))
    } catch (error) {
      return handleError(error)
    }
  }),

  http.get('/api/analytics', ({ request }) => {
    try {
      const user = getUser(request)
      if (user.perfil !== 'gestor') return respondError('Apenas o gestor pode consultar indicadores.', 403)
      const url = new URL(request.url)
      const groupId = url.searchParams.get('group') || ''
      const consultantId = url.searchParams.get('consultant') || ''
      const allTickets = database.listTickets().filter((ticket) => (!groupId || ticket.grupo_id === groupId)
        && (!consultantId || ticket.responsavel_id === consultantId))
      const currentTime = now()
      const statusCounts = Object.keys(STATUS_LABELS).map((status) => ({
        status,
        label: STATUS_LABELS[status],
        value: allTickets.filter((ticket) => ticket.status === status).length,
      }))
      const priorityCounts = ['critica', 'alta', 'media', 'baixa'].map((priority) => ({
        prioridade: priority,
        value: allTickets.filter((ticket) => ticket.prioridade === priority).length,
      }))
      const active = allTickets.filter((ticket) => !['resolvido', 'fechado'].includes(ticket.status))
      const atRisk = active.filter((ticket) => ['at_risk', 'breached'].includes(getSlaState(ticket, currentTime).state)
        || ['at_risk', 'breached'].includes(getSlaState(ticket, currentTime, 'response').state))
      const overdue = allTickets.filter((ticket) => getSlaState(ticket, currentTime).state === 'breached'
        || getSlaState(ticket, currentTime, 'response').state === 'breached')
      const consultants = database.metadata().usuarios
        .filter((entry) => entry.perfil === 'consultor'
          && (!groupId || entry.grupo_id === groupId)
          && (!consultantId || entry.id === consultantId))
        .map((consultant) => ({
          id: consultant.id,
          nome: consultant.nome,
          grupo_id: consultant.grupo_id,
          assigned: database.listTickets().filter((ticket) => ticket.responsavel_id === consultant.id
            && !['resolvido', 'fechado'].includes(ticket.status)).length,
        }))
      return HttpResponse.json({
        statusCounts,
        priorityCounts,
        atRisk: atRisk.length,
        overdue: overdue.length,
        unassigned: allTickets.filter((ticket) => !ticket.responsavel_id).length,
        consultants,
        totals: allTickets.length,
      })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.post('/api/demo/events', async ({ request }) => {
    try {
      const user = getUser(request)
      if (user.perfil !== 'gestor') return respondError('Apenas o gestor pode simular eventos.', 403)
      const input = await request.json()
      if (input.duplicate && !lastDemoEvent) return respondError('Emita um evento antes de repeti-lo.', 409)
      if (input.duplicate) {
        const applied = eventBus.emit(lastDemoEvent)
        return HttpResponse.json({ event: lastDemoEvent, applied })
      }

      const ticket = database.listTickets().find((entry) => entry.id === input.chamado_id)
      if (!ticket && input.tipo !== 'chamado.aberto') return respondError('Escolha um chamado válido.')
      let event
      if (input.tipo === 'mensagem.adicionada') {
        const message = database.addMessage(ticket.id, { texto: input.texto || 'Atualização de demonstração', interna: false }, user.id)
        event = createEvent(input.tipo, { ...message, autor: user }, now())
      } else if (input.tipo === 'chamado.atribuido') {
        const consultant = database.metadata().usuarios.find((entry) => entry.id === input.consultor_id
          && entry.perfil === 'consultor'
          && entry.grupo_id === ticket.grupo_id)
        if (!consultant) return respondError('Escolha um consultor do grupo do chamado.')
        const result = database.assign(ticket.id, input.consultor_id, user.id)
        event = createEvent(input.tipo, { chamado_id: ticket.id, consultor_id: input.consultor_id }, now())
        void result
      } else if (input.tipo === 'status.alterado') {
        const result = database.changeStatus(ticket.id, input.status || 'em_atendimento', input.motivo || 'Alteração simulada pelo gestor.', user.id)
        event = createEvent(input.tipo, {
          chamado_id: ticket.id,
          de: ticket.status,
          para: result.ticket.status,
          motivo: input.motivo || 'Alteração simulada pelo gestor.',
          usuario_id: user.id,
        }, now())
      } else if (input.tipo === 'chamado.aberto') {
        const category = database.metadata().categorias[0]
        const created = database.createTicket({
          titulo: input.titulo || 'Chamado aberto durante a demonstração',
          descricao: input.texto || 'Chamado de exemplo criado pelo simulador de eventos.',
          categoria_id: category.id,
          prioridade: 'alta',
        }, database.metadata().usuarios.find((entry) => entry.perfil === 'cliente').id)
        event = createEvent(input.tipo, enrich(created), now())
      } else {
        return respondError('Tipo de evento inválido.')
      }
      eventBus.emit(event)
      lastDemoEvent = event
      return HttpResponse.json({ event, applied: true }, { status: 201 })
    } catch (error) {
      return handleError(error)
    }
  }),

  http.post('/api/demo/reset', ({ request }) => {
    try {
      if (getUser(request).perfil !== 'gestor') return respondError('Apenas o gestor pode restaurar a demonstração.', 403)
      database.reset()
      lastDemoEvent = null
      return HttpResponse.json({ ok: true })
    } catch (error) {
      return handleError(error)
    }
  }),
]
