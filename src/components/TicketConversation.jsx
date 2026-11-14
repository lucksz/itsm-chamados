import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import { api, eventBus } from '../services/api'
import { formatDateTime } from '../domain/tickets'
import { useDraftStore } from '../store/draftStore'

export function TicketConversation({ user, ticket, messages }) {
  const draftKey = `${user.id}::${ticket.id}`
  const userId = user.id
  const userProfile = user.perfil
  const draft = useDraftStore((state) => state.drafts[draftKey] || '')
  const setDraft = useDraftStore((state) => state.setDraft)
  const clearDraft = useDraftStore((state) => state.clearDraft)
  const internal = useDraftStore((state) => state.internalNotes[draftKey] || false)
  const setInternalNote = useDraftStore((state) => state.setInternalNote)
  const [visibleCount, setVisibleCount] = useState(80)
  const [newMessages, setNewMessages] = useState(0)
  const endRef = useRef(null)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input) => api.addMessage(user.id, ticket.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', user.id, ticket.id] }),
  })

  useEffect(() => eventBus.subscribe((event) => {
    if (event.tipo === 'mensagem.adicionada'
      && event.payload?.chamado_id === ticket.id
      && event.payload?.autor_id !== userId
      && !(userProfile === 'cliente' && event.payload?.interna)) {
      setNewMessages((count) => count + 1)
    }
  }), [ticket.id, userId, userProfile])

  const ordered = messages.slice(-visibleCount)

  function send(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || mutation.isPending) return
    mutation.mutate({ texto: text, interna: user.perfil === 'consultor' && internal }, {
      onSuccess: () => {
        if (useDraftStore.getState().drafts[draftKey] === text) clearDraft(draftKey)
      },
    })
  }

  return (
    <Paper variant="outlined" className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Conversa</Typography>
          <Typography variant="caption" color="text.secondary">
            {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}
          </Typography>
        </div>
        {newMessages > 0 && (
          <Button
            size="small"
            endIcon={<KeyboardDoubleArrowDownIcon />}
            onClick={() => {
              endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
              setNewMessages(0)
            }}
          >
            {newMessages} nova(s)
          </Button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-5" aria-live="polite">
        {messages.length > visibleCount && (
          <Button size="small" onClick={() => setVisibleCount((count) => count + 80)}>
            Carregar mensagens anteriores
          </Button>
        )}
        {ordered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">Ainda não há mensagens neste chamado.</div>
        )}
        {ordered.map((message) => {
          const own = message.autor_id === user.id
          return (
            <div className={`flex gap-3 ${own ? 'flex-row-reverse' : ''}`} key={message.id}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: message.interna ? '#fef3c7' : '#e0e7ff', color: '#334155', fontSize: 12 }}>
                {message.autor?.nome?.split(' ').map((part) => part[0]).slice(0, 2).join('') || '?'}
              </Avatar>
              <div className={`max-w-[86%] sm:max-w-[76%] ${own ? 'text-right' : ''}`}>
                <div className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 ${own ? 'justify-end' : ''}`}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{message.autor?.nome || 'Usuário'}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatDateTime(message.criada_em, user)}</Typography>
                  {message.interna && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Nota interna</span>}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-left text-sm leading-6 ${message.interna ? 'border border-amber-200 bg-amber-50' : own ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white'}`}>
                  <p className="whitespace-pre-wrap">{message.texto}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <Divider />
      <form onSubmit={send} className="space-y-2 bg-white p-4">
        {mutation.isError && <Alert severity="error">{mutation.error.message}</Alert>}
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={5}
          value={draft}
          onChange={(event) => setDraft(draftKey, event.target.value)}
          placeholder={user.perfil === 'cliente' ? 'Escreva uma mensagem para o suporte…' : 'Responder ao chamado…'}
          slotProps={{ htmlInput: { 'aria-label': 'Mensagem do chamado' } }}
          disabled={ticket.status === 'fechado'}
        />
        <div className="flex items-center justify-between gap-2">
          {user.perfil === 'consultor' ? (
            <FormControlLabel
              control={<input type="checkbox" checked={internal} onChange={(event) => setInternalNote(draftKey, event.target.checked)} className="mr-2 accent-indigo-600" />}
              label={<Typography variant="caption">Anotação interna</Typography>}
            />
          ) : (
            <span className="text-xs text-slate-400">
              {ticket.status === 'fechado'
                ? 'Reabra o chamado com uma justificativa para continuar a conversa.'
                : user.perfil === 'cliente'
                  ? 'Apenas a equipa de suporte verá esta mensagem.'
                  : 'Mensagens internas são visíveis apenas à equipa.'}
            </span>
          )}
          <Button
            type="submit"
            variant="contained"
            endIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SendOutlinedIcon />}
            disabled={!draft.trim() || mutation.isPending}
          >
            Enviar
          </Button>
        </div>
      </form>
    </Paper>
  )
}
