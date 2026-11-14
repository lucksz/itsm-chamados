import { describe, expect, it } from 'vitest'
import {
  assignTicket,
  canReopenTicket,
  changeTicketStatus,
  filterAndSortTickets,
  formatDateTime,
  getSlaState,
} from './tickets'
import { canAccessTicket, visibleMessagesFor } from '../mocks/permissions'
import { eventBus } from '../mocks/eventBus'
import { appendUniqueMessage } from './tickets'

const now = new Date('2026-11-03T13:00:00Z')
const baseTicket = {
  id: 'ticket-1',
  numero: 1,
  titulo: 'VPN indisponível',
  descricao: 'Falha ao conectar à rede.',
  categoria_id: 'category-1',
  grupo_id: 'group-1',
  prioridade: 'alta',
  status: 'em_atendimento',
  solicitante_id: 'customer-1',
  responsavel_id: 'consultant-1',
  atualizado_em: '2026-11-03T12:00:00Z',
  prazo_primeira_resposta: '2026-11-03T14:00:00Z',
  prazo_resolucao: '2026-11-03T21:00:00Z',
  primeira_resposta_em: null,
  resolvido_em: null,
  fechado_em: null,
  sla_pausado: false,
}

describe('SLA e horários', () => {
  it('separa SLA de primeira resposta e de resolução', () => {
    expect(getSlaState(baseTicket, now, 'response').state).toBe('at_risk')
    expect(getSlaState(baseTicket, now, 'resolution').state).toBe('on_track')
  })

  it('não decrementa prazos com SLA pausado', () => {
    const paused = { ...baseTicket, sla_pausado: true, prazo_resolucao: '2026-11-02T10:00:00Z' }
    expect(getSlaState(paused, now).state).toBe('paused')
    expect(getSlaState(paused, now).remainingMs).toBeNull()
  })

  it('avalia chamados finalizados pelo instante de resolução, não pelo relógio atual', () => {
    const completed = {
      ...baseTicket,
      status: 'fechado',
      prazo_resolucao: '2026-11-03T15:00:00Z',
      resolvido_em: '2026-11-03T14:00:00Z',
    }
    expect(getSlaState(completed, now).state).toBe('met')
    expect(getSlaState({ ...completed, resolvido_em: '2026-11-03T16:00:00Z' }, now).state).toBe('breached')
    expect(getSlaState({
      ...completed,
      prazo_primeira_resposta: '2026-11-03T12:30:00Z',
      primeira_resposta_em: '2026-11-03T13:00:00Z',
    }, now, 'response').state).toBe('breached')
  })

  it('formata o mesmo instante no fuso e locale de cada utilizador', () => {
    const instant = '2026-11-03T13:00:00Z'
    expect(formatDateTime(instant, { locale: 'pt-BR', zoneinfo: 'America/Sao_Paulo' })).toContain('10:00')
    expect(formatDateTime(instant, { locale: 'pt-PT', zoneinfo: 'Europe/Lisbon' })).toContain('13:00')
  })
})

describe('operações e visibilidade', () => {
  it('exige justificativa para alterar status e limpa datas ao reabrir', () => {
    expect(() => changeTicketStatus(baseTicket, 'resolvido', '  ', 'agent', now)).toThrow(/motivo/i)
    const result = changeTicketStatus(
      { ...baseTicket, status: 'fechado', resolvido_em: '2026-11-02T10:00:00Z', fechado_em: '2026-11-02T12:00:00Z' },
      'aberto',
      'O problema voltou.',
      'agent',
      now,
      'history-1',
    )
    expect(result.ticket.status).toBe('aberto')
    expect(result.ticket.resolvido_em).toBeNull()
    expect(result.history.motivo).toBe('O problema voltou.')
  })

  it('atribui um consultor e registra a atribuição no histórico', () => {
    const result = assignTicket(baseTicket, 'consultant-2', now, 'manager-1', 'history-2')
    expect(result.ticket.responsavel_id).toBe('consultant-2')
    expect(result.history.de).toBe('consultant-1')
    expect(result.history.para).toBe('consultant-2')
    const unassigned = assignTicket(baseTicket, null, now, 'manager-1', 'history-3')
    expect(unassigned.ticket.responsavel_id).toBeNull()
    expect(unassigned.history.para).toBeNull()
  })

  it('protege chamados alheios e oculta anotações internas de clientes', () => {
    const ownClient = { id: 'customer-1', perfil: 'cliente' }
    const otherClient = { id: 'customer-2', perfil: 'cliente' }
    const consultant = { id: 'consultant-1', perfil: 'consultor', grupo_id: 'group-1' }
    const manager = { id: 'manager-1', perfil: 'gestor' }
    expect(canAccessTicket(ownClient, baseTicket)).toBe(true)
    expect(canAccessTicket(otherClient, baseTicket)).toBe(false)
    expect(canAccessTicket(consultant, baseTicket)).toBe(true)
    expect(canAccessTicket({ ...consultant, grupo_id: 'group-2' }, baseTicket)).toBe(false)
    expect(canAccessTicket(manager, baseTicket)).toBe(true)
    expect(visibleMessagesFor(ownClient, [
      { id: 'public', interna: false },
      { id: 'internal', interna: true },
    ]).map((message) => message.id)).toEqual(['public'])
  })

  it('permite reabertura apenas pelo titular de um chamado fechado', () => {
    const closed = { ...baseTicket, status: 'fechado' }
    expect(canReopenTicket(closed, { id: 'customer-1', perfil: 'cliente' })).toBe(true)
    expect(canReopenTicket(closed, { id: 'customer-2', perfil: 'cliente' })).toBe(false)
    expect(canReopenTicket(baseTicket, { id: 'customer-1', perfil: 'cliente' })).toBe(false)
  })

  it('filtra e ordena chamados pela urgência de SLA e atividade', () => {
    const urgent = { ...baseTicket, id: 'urgent', prazo_resolucao: '2026-11-03T12:30:00Z' }
    const recent = { ...baseTicket, id: 'recent', titulo: 'Erro de email', atualizado_em: '2026-11-03T12:50:00Z' }
    const result = filterAndSortTickets([recent, urgent], { search: 'vpn', sort: 'sla' }, now)
    expect(result.map((ticket) => ticket.id)).toEqual(['urgent'])
    expect(filterAndSortTickets([urgent, recent], { sort: 'recent' }, now)[0].id).toBe('recent')
  })

  it('não duplica mensagens nem reaplica UUID de evento', () => {
    const message = { id: 'message-1', criada_em: '2026-11-03T12:00:00Z' }
    const once = appendUniqueMessage([], message)
    expect(appendUniqueMessage(once, message)).toBe(once)

    const eventId = 'c9158345-044a-4a56-9e3d-c28fed2e8b3c'
    const received = []
    const unsubscribe = eventBus.subscribe((event) => received.push(event.id))
    const event = { id: eventId, tipo: 'status.alterado', payload: {} }
    expect(eventBus.emit(event)).toBe(true)
    expect(eventBus.emit(event)).toBe(false)
    expect(received).toEqual([eventId])
    unsubscribe()
  })
})
