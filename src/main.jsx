import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CssBaseline, GlobalStyles, StyledEngineProvider, ThemeProvider, createTheme } from '@mui/material'
import './index.css'
import App from './App.jsx'
import { worker } from './mocks/browser'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10000 },
    mutations: { retry: 0 },
  },
})
const theme = createTheme({
  palette: { primary: { main: '#4f46e5' }, background: { default: '#f8fafc' } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
})

async function start() {
  try {
    await worker.start({
      onUnhandledFrame: ({ frame, defaults }) => {
        const request = frame.data?.request
        if (request && new URL(request.url).pathname.startsWith('/api/')) defaults.warn()
      },
    })
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <StyledEngineProvider enableCssLayer>
          {/* O MUI injeta seus estilos globais antes do CSS do Tailwind; sem declarar a ordem aqui, a camada "mui" fica abaixo do reset (base). */}
          <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </QueryClientProvider>
          </ThemeProvider>
        </StyledEngineProvider>
      </StrictMode>,
    )
  } catch (error) {
    console.error('Não foi possível iniciar a API de demonstração.', error)
    document.getElementById('root').textContent = 'Não foi possível iniciar a aplicação. Verifique o suporte a Service Worker no navegador.'
  }
}

start()
