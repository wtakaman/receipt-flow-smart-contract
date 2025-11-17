type MetricProps = {
  label: string
  value: string | number
}

export function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}
type MetricProps = {
  label: string
  value: string | number
}

export function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

