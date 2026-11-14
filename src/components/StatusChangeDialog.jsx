import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { STATUS_LABELS } from '../domain/tickets'

export function StatusChangeDialog({ open, onClose, currentStatus, onSubmit, reopenOnly = false }) {
  const [status, setStatus] = useState(reopenOnly ? 'aberto' : currentStatus)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    if (!status || !reason.trim()) {
      setError('Selecione um status e informe o motivo.')
      return
    }
    onSubmit(status, reason.trim())
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{reopenOnly ? 'Reabrir pedido' : 'Alterar status'}</DialogTitle>
        <DialogContent className="flex flex-col gap-4 pt-3">
          {!reopenOnly && (
            <FormControl fullWidth size="small">
              <InputLabel id="status-label">Novo status</InputLabel>
              <Select
                labelId="status-label"
                label="Novo status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <MenuItem value={value} key={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            autoFocus={reopenOnly}
            label={reopenOnly ? 'Por que o problema continua?' : 'Motivo da alteração'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={3}
            required
            error={Boolean(error)}
            helperText={error || 'Obrigatório para registrar a mudança no histórico.'}
          />
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="contained" type="submit">{reopenOnly ? 'Solicitar reabertura' : 'Salvar alteração'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
