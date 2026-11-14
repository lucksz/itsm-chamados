import { BarChart } from '@mui/x-charts/BarChart'

export default function StatusChart({ data }) {
  return (
    <BarChart
      dataset={data}
      xAxis={[{ scaleType: 'band', dataKey: 'label' }]}
      series={[{ dataKey: 'value', label: 'Chamados', color: '#4f46e5' }]}
      height={250}
      margin={{ left: 34, right: 12, top: 24, bottom: 42 }}
    />
  )
}
