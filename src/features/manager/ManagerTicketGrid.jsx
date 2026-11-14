import { DataGrid } from '@mui/x-data-grid'
import { PriorityChip, StatusChip } from '../../components/TicketBadges'

export default function ManagerTicketGrid({ rows, rowCount, page, loading, onPageChange, onOpenTicket }) {
  const columns = [
    { field: 'numero', headerName: 'Chamado', width: 100, renderCell: (params) => <button className="font-semibold text-indigo-700 hover:underline" onClick={() => onOpenTicket(params.row.id)}>#{params.value}</button> },
    { field: 'titulo', headerName: 'Assunto', flex: 1, minWidth: 180 },
    { field: 'responsavelNome', headerName: 'Consultor', width: 170 },
    { field: 'status', headerName: 'Status', width: 155, renderCell: (params) => <StatusChip status={params.value} /> },
    { field: 'prioridade', headerName: 'Prioridade', width: 135, renderCell: (params) => <PriorityChip priority={params.value} /> },
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
      autoHeight
      localeText={{ noRowsLabel: 'Nenhum chamado encontrado', footerRowSelected: (count) => `${count} selecionados` }}
      sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8fafc' }, '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
    />
  )
}
