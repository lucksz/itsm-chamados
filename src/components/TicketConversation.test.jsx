import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { TicketConversation } from './TicketConversation'
import { useDraftStore } from '../store/draftStore'

vi.mock('../services/api', () => ({
  api: { addMessage: vi.fn() },
  eventBus: { subscribe: () => () => {} },
}))

function renderConversation(messages) {
  const queryClient = new QueryClient()
  const user = { id: 'consultant-1', perfil: 'consultor', locale: 'pt-BR', zoneinfo: 'America/Sao_Paulo' }
  const ticket = { id: 'ticket-1', status: 'em_atendimento' }
  return render(
    <QueryClientProvider client={queryClient}>
      <TicketConversation user={user} ticket={ticket} messages={messages} />
    </QueryClientProvider>,
  )
}

describe('TicketConversation', () => {
  it('preserva o rascunho enquanto chegam novas mensagens', () => {
    useDraftStore.getState().clearAll()
    const { rerender } = renderConversation([])
    const composer = screen.getByRole('textbox', { name: 'Mensagem do chamado' })
    fireEvent.change(composer, { target: { value: 'Rascunho que não pode desaparecer' } })

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TicketConversation
          user={{ id: 'consultant-1', perfil: 'consultor', locale: 'pt-BR', zoneinfo: 'America/Sao_Paulo' }}
          ticket={{ id: 'ticket-1', status: 'em_atendimento' }}
          messages={[{
            id: 'incoming',
            autor_id: 'customer-1',
            autor: { nome: 'Cliente' },
            criada_em: '2026-11-03T13:00:00Z',
            texto: 'Nova mensagem',
            interna: false,
          }]}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('textbox', { name: 'Mensagem do chamado' })).toHaveValue('Rascunho que não pode desaparecer')
  })
})
