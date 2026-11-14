import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
} from '@mui/material'
import { api } from '../../services/api'
import { STATUS_LABELS } from '../../domain/tickets'

const EVENT_TYPES = [
  ['chamado.aberto', 'Chamado aberto'],
  ['chamado.atribuido', 'Chamado atribuído'],
  ['mensagem.adicionada', 'Mensagem adicionada'],
  ['status.alterado', 'Status alterado'],
]

export function EventSimulator({ userId, tickets, consultants }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('mensagem.adicionada')
  const [ticketId, setTicketId] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [status, setStatus] = useState('em_atendimento')
  const [text, setText] = useState('Nova atualização recebida durante a demonstração.')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const selectedTicket = tickets.find((ticket) => ticket.id === ticketId) || tickets[0]
  const availableConsultants = consultants.filter((consultant) => consultant.grupo_id === selectedTicket?.grupo_id)
  const mutation = useMutation({
    mutationFn: (input) => api.emitDemoEvent(userId, input),
    onSuccess: (result) => {
      setError('')
      setNotice(result.applied ? `Evento ${result.event.tipo} emitido.` : 'Evento duplicado ignorado corretamente.')
      queryClient.invalidateQueries({ queryKey: ['tickets', userId] })
      queryClient.invalidateQueries({ queryKey: ['ticket', userId] })
    },
    onError: (reason) => setError(reason.message),
  })

  function emit() {
    mutation.mutate({
      tipo: type,
      chamado_id: selectedTicket?.id,
      consultor_id: availableConsultants.some((entry) => entry.id === consultantId)
        ? consultantId
        : availableConsultants[0]?.id,
      status,
      texto: text,
      motivo: text,
      titulo: text,
    })
  }

  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setOpen(true)}>Simular evento</Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Simular atualização em tempo real</DialogTitle>
        <DialogContent className="space-y-4 pt-3">
          <p className="text-sm text-slate-600">Dispare um evento de demonstração e observe a atualização da fila e dos detalhes sem recarregar a página.</p>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl fullWidth size="small">
            <InputLabel id="event-type-label">Tipo de evento</InputLabel>
            <Select labelId="event-type-label" label="Tipo de evento" value={type} onChange={(event) => setType(event.target.value)}>
              {EVENT_TYPES.map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          {type !== 'chamado.aberto' && (
            <FormControl fullWidth size="small">
              <InputLabel id="event-ticket-label">Chamado</InputLabel>
              <Select labelId="event-ticket-label" label="Chamado" value={selectedTicket?.id || ''} onChange={(event) => setTicketId(event.target.value)}>
                {tickets.map((ticket) => <MenuItem value={ticket.id} key={ticket.id}>#{ticket.numero} · {ticket.titulo}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {type === 'chamado.atribuido' && (
            <FormControl fullWidth size="small">
              <InputLabel id="event-consultant-label">Consultor</InputLabel>
              <Select
                labelId="event-consultant-label"
                label="Consultor"
                value={availableConsultants.some((entry) => entry.id === consultantId)
                  ? consultantId
                  : availableConsultants[0]?.id || ''}
                onChange={(event) => setConsultantId(event.target.value)}
              >
                {availableConsultants.map((consultant) => <MenuItem value={consultant.id} key={consultant.id}>{consultant.nome}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {type === 'status.alterado' && (
            <FormControl fullWidth size="small">
              <InputLabel id="event-status-label">Novo status</InputLabel>
              <Select labelId="event-status-label" label="Novo status" value={status} onChange={(event) => setStatus(event.target.value)}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <TextField fullWidth label={type === 'chamado.aberto' ? 'Título e descrição' : 'Conteúdo / justificativa'} value={text} onChange={(event) => setText(event.target.value)} />
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button onClick={() => setOpen(false)}>Fechar</Button>
          <Button variant="outlined" disabled={mutation.isPending} onClick={() => mutation.mutate({ duplicate: true })}>Repetir último evento</Button>
          <Button variant="contained" disabled={mutation.isPending || (type !== 'chamado.aberto' && !tickets.length)} onClick={emit}>Emitir</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice('')} message={notice} />
    </>
  )
}
