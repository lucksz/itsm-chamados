import { Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate, useParams } from 'react-router'
import { TicketDetailPanel } from './TicketDetailPanel'

export function TicketPage({ user }) {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const home = user.perfil === 'gestor' ? '/manager' : user.perfil === 'cliente' ? '/customer' : '/consultant'
  return (
    <TicketDetailPanel
      user={user}
      ticketId={ticketId}
      backAction={<Button startIcon={<ArrowBackIcon />} onClick={() => navigate(home)}>Voltar à lista</Button>}
    />
  )
}
