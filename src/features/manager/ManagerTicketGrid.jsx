import { DataGrid } from '@mui/x-data-grid'
import { ptBR } from '@mui/x-data-grid/locales'
import { PriorityChip, SlaChip, StatusChip } from '../../components/TicketBadges'

const localeText = { ...ptBR.components.MuiDataGrid.defaultProps.localeText, noRowsLabel: 'Nenhum chamado encontrado' }

export default function ManagerTicketGrid({ rows, rowCount, page, loading, onPageChange, onOpenTicket }) {
  const columns = [
    { field: 'numero', headerName: 'Chamado', width: 100, renderCell: (params) => <button type="button" className="font-semibold text-indigo-700 hover:underline" onClick={() => onOpenTicket(params.row.id)}>#{params.value}</button> },
    { field: 'titulo', headerName: 'Assunto', flex: 1, minWidth: 240 },
    { field: 'grupoNome', headerName: 'Grupo', width: 150 },
    { field: 'responsavelNome', headerName: 'Consultor', width: 170 },
    { field: 'status', headerName: 'Status', width: 160, renderCell: (params) => <StatusChip status={params.value} /> },
    { field: 'prioridade', headerName: 'Prioridade', width: 125, renderCell: (params) => <PriorityChip priority={params.value} /> },
    { field: 'sla', headerName: 'SLA', width: 150, renderCell: (params) => <SlaChip state={params.value} /> },
    { field: 'prazo', headerName: 'Prazo de resolução', width: 175 },
  ]

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={loading}
      rowCount={rowCount}
      paginationMode="server"
      paginationModel={{ page, pageSize: 25 }}
      onPaginationModelChange={(model) => onPageChange(model.page)}
      pageSizeOptions={[25]}
      disableRowSelectionOnClick
      disableColumnSorting
      disableColumnMenu
      onRowClick={(params) => onOpenTicket(params.row.id)}
      autoHeight
      localeText={localeText}
      sx={{
        border: 0,
        '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8fafc' },
        '& .MuiDataGrid-row': { cursor: 'pointer' },
        '& .MuiDataGrid-cell:focus': { outline: 'none' },
      }}
    />
  )
}
