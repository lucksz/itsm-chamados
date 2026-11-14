import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import { useSessionStore } from '../store/sessionStore'
import { api } from '../services/api'

const DEMO_PROFILES = [
  { id: 'ae4d6fdf-bd5b-4fe0-879a-f86c41012b99', name: 'Marina Almeida', role: 'Consultora', path: '/consultant' },
  { id: '875d257a-0dff-4428-a233-5332d0e67b86', name: 'Ricardo Monteiro', role: 'Gestor', path: '/manager' },
  { id: '56d2d480-1bd4-4e12-93cd-61db0bdf21e6', name: 'Helena Fernandes', role: 'Cliente', path: '/customer' },
]

export function AppShell({ user, children }) {
  const { userId, setUserId } = useSessionStore()
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)
  const profile = DEMO_PROFILES.find((entry) => entry.id === userId) || DEMO_PROFILES[0]

  async function restoreDemo() {
    if (!window.confirm('Restaurar todos os dados ao estado inicial desta demonstração?')) return
    setResetting(true)
    try {
      await api.resetDemo(userId)
      window.location.assign(profile.path)
    } catch (error) {
      window.alert(error.message)
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppBar position="sticky" color="inherit" elevation={0} className="border-b border-slate-200">
        <Toolbar className="mx-auto flex w-full max-w-[1600px] gap-3 px-4 sm:px-7">
          <Link to={profile.path} className="flex items-center gap-2 text-inherit no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <ConfirmationNumberOutlinedIcon fontSize="small" />
            </span>
            <span className="hidden sm:block">
              <Typography variant="subtitle1" sx={{ fontWeight: 750, lineHeight: 1.2 }}>Nexo</Typography>
              <Typography variant="caption" color="textSecondary">Central de atendimento</Typography>
            </span>
          </Link>
          <div className="flex-1" />
          {user?.perfil === 'gestor' && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              disabled={resetting}
              onClick={restoreDemo}
              className="hidden border-slate-300 text-slate-700 sm:inline-flex"
            >
              Restaurar dados
            </Button>
          )}
          <div className="hidden items-center gap-2 md:flex">
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#e0e7ff', color: '#4338ca', fontSize: 13 }}>
              {user?.nome?.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </Avatar>
            <div className="hidden lg:block">
              <Typography variant="body2" sx={{ fontWeight: 650 }}>{user?.nome}</Typography>
              <Typography variant="caption" color="textSecondary">{profile.role}</Typography>
            </div>
          </div>
          <FormControl size="small" sx={{ minWidth: { xs: 152, sm: 220 } }}>
            <Select
              value={userId}
              aria-label="Perfil de demonstração"
              onChange={(event) => {
                setUserId(event.target.value)
                navigate(DEMO_PROFILES.find((entry) => entry.id === event.target.value)?.path || '/')
              }}
              sx={{ bgcolor: '#fff', borderRadius: 2 }}
            >
              {DEMO_PROFILES.map((entry) => (
                <MenuItem value={entry.id} key={entry.id}>{entry.name} · {entry.role}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Toolbar>
      </AppBar>
      <Box component="main" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8">
        {children}
      </Box>
      <div className="mx-auto max-w-[1600px] px-7 pb-5 text-xs text-slate-400">
        Demonstração local · os dados e eventos são simulados
      </div>
    </div>
  )
}
