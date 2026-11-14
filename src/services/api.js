import { eventBus } from '../mocks/eventBus'

const API_URL = '/api'

async function request(path, userId, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-User': userId,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir a solicitação.')
  return body
}

function jsonBody(value) {
  return { method: 'POST', body: JSON.stringify(value) }
}

export const api = {
  session: (userId) => request('/session', userId),
  listTickets(userId, params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null))
    return request(`/tickets?${query}`, userId)
  },
  ticket: (userId, ticketId) => request(`/tickets/${ticketId}`, userId),
  createTicket: (userId, input) => request('/tickets', userId, jsonBody(input)),
  addMessage: (userId, ticketId, input) => request(`/tickets/${ticketId}/messages`, userId, jsonBody(input)),
  assign: (userId, ticketId, consultantId) => request(`/tickets/${ticketId}/assign`, userId, jsonBody({ consultor_id: consultantId })),
  changeStatus: (userId, ticketId, status, reason) => request(`/tickets/${ticketId}/status`, userId, jsonBody({ status, motivo: reason })),
  consultants: (userId) => request('/consultants', userId),
  analytics(userId, params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
    return request(`/analytics?${query}`, userId)
  },
  emitDemoEvent: (userId, input) => request('/demo/events', userId, jsonBody(input)),
  resetDemo: (userId) => request('/demo/reset', userId, jsonBody({})),
}

export { eventBus }
