type Props = {
  status: 'pending' | 'success' | 'warning'
  label?: string
}

export function StatusPill({ status, label }: Props) {
  return <span className={`pill ${status}`}>{label ?? status}</span>
}

