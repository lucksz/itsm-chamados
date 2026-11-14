import { PieChart } from '@mui/x-charts/PieChart'

export default function PriorityChart({ data }) {
  return (
    <PieChart
      series={[{
        data: data.map((entry, index) => ({
          id: entry.prioridade,
          value: entry.value,
          label: { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' }[entry.prioridade],
          color: ['#dc2626', '#f97316', '#6366f1', '#94a3b8'][index],
        })),
        innerRadius: 48,
        paddingAngle: 2,
        cornerRadius: 4,
      }]}
      height={250}
      slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
    />
  )
}
