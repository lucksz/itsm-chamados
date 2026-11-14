import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import { useNavigate } from 'react-router'
import { api } from '../../services/api'
import { useTickets } from '../../hooks/useTickets'
import { formatDateTime, getSlaState, STATUS_LABELS } from '../../domain/tickets'
import { StatusChip, SlaChip } from '../../components/TicketBadges'
import { useDemoClock } from '../../hooks/useDemoClock'
import { eventBus } from '../../mocks/eventBus'

const ticketSchema = z.object({
  titulo: z.string().trim().min(5, 'Descreva o assunto com pelo menos 5 caracteres.'),
  descricao: z.string().trim().min(10, 'Inclua mais detalhes para ajudar a equipa.'),
  categoria_id: z.string().min(1, 'Selecione uma área para encaminhar o pedido.'),
})
const EMPTY_TICKETS = []

function findSimilarTickets(tickets, title) {
  const ignored = new Set(['para', 'com', 'uma', 'que', 'por', 'dos', 'das', 'the', 'and', 'from'])
  const terms = title.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3 && !ignored.has(word))
  if (!terms.length) return []
  return tickets.map((ticket) => {
    const text = `${ticket.titulo} ${ticket.descricao}`.toLocaleLowerCase()
    return { ticket, matches: terms.filter((term) => text.includes(term)).length }
  }).filter((entry) => entry.matches >= Math.min(2, terms.length))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 3)
}

export function CustomerPortal({ user }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [unreadByTicket, setUnreadByTicket] = useState({})
  const demoNow = useDemoClock()
  const sessionQuery = useQuery({ queryKey: ['session', user.id], queryFn: () => api.session(user.id) })
  const ticketsQuery = useTickets(user.id, { page: 1, pageSize: 100, search, status, sort: 'recent' })
  const tickets = ticketsQuery.data?.items || EMPTY_TICKETS
  const categories = sessionQuery.data?.categorias || []
  const createMutation = useMutation({
    mutationFn: (input) => api.createTicket(user.id, { ...input, prioridade: 'media' }),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', user.id] })
      setDialogOpen(false)
      reset()
      navigate(`/tickets/${ticket.id}`)
    },
  })
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: { titulo: '', descricao: '', categoria_id: '' },
  })
  const title = useWatch({ control, name: 'titulo' }) || ''
  const categoryId = useWatch({ control, name: 'categoria_id' }) || ''
  const similar = useMemo(() => findSimilarTickets(tickets, title), [tickets, title])

  useEffect(() => eventBus.subscribe((event) => {
    const ticketId = event.payload?.chamado_id
    if (!ticketId || !tickets.some((ticket) => ticket.id === ticketId)) return
    const isNewPublicMessage = event.tipo === 'mensagem.adicionada'
      && !event.payload?.interna
      && event.payload?.autor_id !== user.id
    if (isNewPublicMessage || event.tipo === 'status.alterado') {
      setUnreadByTicket((current) => ({ ...current, [ticketId]: true }))
    }
  }), [tickets, user.id])

  function openTicket(ticketId) {
    setUnreadByTicket((current) => ({ ...current, [ticketId]: false }))
    navigate(`/tickets/${ticketId}`)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-br from-indigo-700 to-violet-700 p-6 text-white sm:flex-row sm:items-end sm:p-8">
        <div>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,.72)' }}>Portal de suporte</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }} className="tracking-tight">Olá, {user.nome.split(' ')[0]}</Typography>
          <Typography className="mt-2 max-w-xl" sx={{ color: 'rgba(255,255,255,.82)' }}>
            Acompanhe os seus pedidos, fale com a equipa e saiba qual é o próximo passo.
          </Typography>
        </div>
        <Button
          variant="contained"
          color="inherit"
          startIcon={<AddOutlinedIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ color: '#4338ca', fontWeight: 700 }}
        >
          Abrir pedido
        </Button>
      </header>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Typography variant="h5" sx={{ fontWeight: 750 }}>Os seus pedidos</Typography>
          <Typography variant="body2" color="text.secondary">Consulte o andamento e retome uma conversa quando precisar.</Typography>
        </div>
        <div className="flex flex-wrap gap-2">
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nos meus pedidos"
            slotProps={{
              htmlInput: { 'aria-label': 'Buscar pedidos' },
              input: { startAdornment: <SearchOutlinedIcon fontSize="small" className="mr-2 text-slate-400" /> },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 165 }}>
            <InputLabel id="customer-status">Andamento</InputLabel>
            <Select labelId="customer-status" label="Andamento" value={status} onChange={(event) => setStatus(event.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
        </div>
      </div>

      {ticketsQuery.isError && <Alert severity="error">{ticketsQuery.error.message}</Alert>}
      {ticketsQuery.isLoading && <div className="grid h-48 place-items-center"><CircularProgress /></div>}
      {!ticketsQuery.isLoading && tickets.length === 0 && (
        <Paper variant="outlined" className="rounded-2xl px-6 py-14 text-center">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Ainda não há pedidos</Typography>
          <Typography color="text.secondary" className="mt-1">Quando abrir um pedido, poderá acompanhar tudo por aqui.</Typography>
          <Button className="mt-4" variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setDialogOpen(true)}>Abrir o primeiro pedido</Button>
        </Paper>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {tickets.map((ticket) => {
          const responseSla = getSlaState(ticket, demoNow, 'response')
          const nextStep = ticket.status === 'aguardando_cliente'
            ? 'A equipa precisa da sua resposta.'
            : ticket.responsavel?.nome
              ? `${ticket.responsavel.nome} está a acompanhar o pedido.`
              : 'A equipa está a procurar um responsável.'
          return (
            <Paper
              variant="outlined"
              key={ticket.id}
              className="cursor-pointer rounded-2xl p-5 transition hover:border-indigo-300 hover:shadow-sm"
              onClick={() => openTicket(ticket.id)}
              role="link"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') openTicket(ticket.id)
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Typography variant="caption" color="text.secondary">Pedido #{ticket.numero}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }} className="mt-1 line-clamp-2">{ticket.titulo}</Typography>
                </div>
                <ArrowForwardOutlinedIcon className="shrink-0 text-slate-400" fontSize="small" />
              </div>
              <div className="my-4 flex flex-wrap items-center gap-2">
                <StatusChip status={ticket.status} audience="customer" />
                <SlaChip state={responseSla.state} audience="customer" />
                {unreadByTicket[ticket.id] && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Novidade</span>}
              </div>
              <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <div>
                  <Typography variant="caption" color="text.secondary">Próximo passo</Typography>
                  <Typography variant="body2" className="mt-1">{nextStep}</Typography>
                </div>
                <div>
                  <Typography variant="caption" color="text.secondary">{ticket.primeira_resposta_em ? 'Primeira resposta' : 'Previsão da primeira resposta'}</Typography>
                  <Typography variant="body2" className="mt-1">{formatDateTime(ticket.primeira_resposta_em || ticket.prazo_primeira_resposta, user)}</Typography>
                </div>
              </div>
              <Typography variant="caption" color="text.secondary" display="block" className="mt-3">
                Atualizado {formatDateTime(ticket.atualizado_em, user)}
              </Typography>
            </Paper>
          )
        })}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <DialogTitle>Abrir um pedido de suporte</DialogTitle>
          <DialogContent className="space-y-4 pt-3">
            <Typography variant="body2" color="text.secondary">
              Conte o que aconteceu. A equipa encaminhará o pedido para a área adequada.
            </Typography>
            {createMutation.isError && <Alert severity="error">{createMutation.error.message}</Alert>}
            <TextField
              fullWidth
              label="Assunto"
              error={Boolean(errors.titulo)}
              helperText={errors.titulo?.message}
              {...register('titulo')}
            />
            {similar.length > 0 && (
              <Alert severity="info">
                Encontrámos pedidos seus que podem estar relacionados:
                <ul className="mt-2 list-inside list-disc">
                  {similar.map(({ ticket }) => (
                    <li key={ticket.id}>
                      <button type="button" className="font-semibold underline" onClick={() => { setDialogOpen(false); navigate(`/tickets/${ticket.id}`) }}>
                        #{ticket.numero} · {ticket.titulo}
                      </button>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
            <FormControl fullWidth error={Boolean(errors.categoria_id)}>
              <InputLabel id="ticket-category-label">Área do pedido</InputLabel>
              <Select
                labelId="ticket-category-label"
                label="Área do pedido"
                value={categoryId}
                onChange={(event) => setValue('categoria_id', event.target.value, { shouldValidate: true })}
              >
                {categories.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.nome}</MenuItem>)}
              </Select>
              {errors.categoria_id && <Typography variant="caption" color="error" className="ml-3 mt-1">{errors.categoria_id.message}</Typography>}
            </FormControl>
            <TextField
              fullWidth
              multiline
              minRows={4}
              label="O que aconteceu?"
              error={Boolean(errors.descricao)}
              helperText={errors.descricao?.message || 'Inclua mensagens de erro, quando começou e o que já tentou.'}
              {...register('descricao')}
            />
          </DialogContent>
          <DialogActions className="px-6 pb-5">
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'A abrir…' : 'Enviar pedido'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  )
}
