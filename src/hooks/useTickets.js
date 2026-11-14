import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function useTickets(userId, params = {}) {
  return useQuery({
    queryKey: ['tickets', userId, params],
    queryFn: () => api.listTickets(userId, params),
    enabled: Boolean(userId),
    staleTime: 15000,
  })
}

export function useTicket(userId, ticketId) {
  return useQuery({
    queryKey: ['ticket', userId, ticketId],
    queryFn: () => api.ticket(userId, ticketId),
    enabled: Boolean(userId && ticketId),
    staleTime: 10000,
  })
}
