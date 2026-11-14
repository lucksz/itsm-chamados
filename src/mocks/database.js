import { initialDataPromise } from './seedData'
import { appendUniqueMessage, assignTicket, changeTicketStatus } from '../domain/tickets'
import { clockReady, now } from './demoClock'

const STORAGE_KEY = 'itsm-demo-delta-v1'
const initialData = await initialDataPromise
await clockReady

function readDelta() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch (error) {
    throw new Error('As alterações locais da demonstração estão inválidas. Limpe os dados do site e tente novamente.', { cause: error })
  }
}

function persistDelta(delta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(delta))
  } catch (error) {
    throw new Error(`Não foi possível persistir a alteração local: ${error.message}`, { cause: error })
  }
}

function clone(value) {
  return structuredClone(value)
}

function load() {
  const delta = readDelta()
  const merge = (base, changes) => {
    const map = new Map(base.map((item) => [item.id, item]))
    for (const item of changes || []) map.set(item.id, item)
    return [...map.values()]
  }
  return {
    meta: initialData.meta,
    grupos: initialData.grupos,
    categorias: initialData.categorias,
    sla: initialData.sla,
    usuarios: initialData.usuarios,
    chamados: merge(initialData.chamados, delta.chamados),
    mensagens: merge(initialData.mensagens, delta.mensagens),
    historico: merge(initialData.historico, delta.historico),
  }
}

let data = load()
let delta = readDelta()

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      delta = readDelta()
      data = load()
    }
  })
}

function saveEntity(collection, item) {
  const items = delta[collection] || []
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index >= 0) items[index] = item
  else items.push(item)
  delta = { ...delta, [collection]: items }
  persistDelta(delta)
}

function saveMany(collection, items) {
  for (const item of items) saveEntity(collection, item)
}

function requireTicket(ticketId) {
  const ticket = data.chamados.find((entry) => entry.id === ticketId)
  if (!ticket) throw new Error('Chamado não encontrado.')
  return ticket
}

export const database = {
  metadata: () => clone({
    meta: data.meta,
    grupos: data.grupos,
    categorias: data.categorias,
    sla: data.sla,
    usuarios: data.usuarios,
  }),
  listTickets: () => clone(data.chamados),
  getTicket(ticketId) {
    const ticket = requireTicket(ticketId)
    return clone({
      ticket,
      mensagens: data.mensagens.filter((message) => message.chamado_id === ticketId),
      historico: data.historico.filter((entry) => entry.chamado_id === ticketId),
    })
  },
  createTicket(input, requesterId) {
    const category = data.categorias.find((entry) => entry.id === input.categoria_id)
    if (!category) throw new Error('Selecione uma categoria válida.')
    const sla = data.sla.find((entry) => entry.prioridade === input.prioridade)
    if (!sla) throw new Error('Prioridade inválida.')

    const openedAt = now()
    const id = crypto.randomUUID()
    const ticket = {
      id,
      numero: Math.max(...data.chamados.map((entry) => entry.numero)) + 1,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      categoria_id: category.id,
      grupo_id: category.grupo_id,
      prioridade: input.prioridade,
      status: 'aberto',
      solicitante_id: requesterId,
      responsavel_id: null,
      aberto_em: openedAt.toISOString(),
      atualizado_em: openedAt.toISOString(),
      primeira_resposta_em: null,
      prazo_primeira_resposta: new Date(openedAt.getTime() + sla.primeira_resposta_horas * 3600000).toISOString(),
      prazo_resolucao: new Date(openedAt.getTime() + sla.resolucao_horas * 3600000).toISOString(),
      sla_pausado: false,
      resolvido_em: null,
      fechado_em: null,
    }
    data.chamados.push(ticket)
    saveEntity('chamados', ticket)
    return clone(ticket)
  },
  addMessage(ticketId, input, authorId) {
    requireTicket(ticketId)
    const createdAt = now()
    const author = data.usuarios.find((entry) => entry.id === authorId)
    const message = {
      id: crypto.randomUUID(),
      chamado_id: ticketId,
      criada_em: createdAt.toISOString(),
      autor_id: authorId,
      texto: input.texto.trim(),
      interna: Boolean(input.interna),
    }
    data.mensagens = appendUniqueMessage(data.mensagens, message)
    data.chamados = data.chamados.map((entry) => entry.id === ticketId ? {
      ...entry,
      atualizado_em: createdAt.toISOString(),
      ...(entry.primeira_resposta_em || message.interna || author?.perfil === 'cliente'
        ? {}
        : { primeira_resposta_em: createdAt.toISOString() }),
    } : entry)
    saveEntity('mensagens', message)
    saveEntity('chamados', requireTicket(ticketId))
    return clone(message)
  },
  assign(ticketId, consultantId, userId) {
    const current = requireTicket(ticketId)
    const result = assignTicket(current, consultantId, now(), userId)
    data.chamados = data.chamados.map((entry) => entry.id === ticketId ? result.ticket : entry)
    data.historico.push(result.history)
    saveMany('chamados', [result.ticket])
    saveMany('historico', [result.history])
    return clone(result)
  },
  changeStatus(ticketId, status, reason, userId) {
    const current = requireTicket(ticketId)
    const result = changeTicketStatus(current, status, reason, userId, now())
    data.chamados = data.chamados.map((entry) => entry.id === ticketId ? result.ticket : entry)
    data.historico.push(result.history)
    saveMany('chamados', [result.ticket])
    saveMany('historico', [result.history])
    return clone(result)
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY)
    delta = {}
    data = load()
  },
}
