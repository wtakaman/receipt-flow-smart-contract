export function shortAddress(value?: string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

export function formatDateFromSeconds(seconds?: bigint) {
  if (!seconds || seconds === 0n) return '—'
  return new Date(Number(seconds) * 1000).toLocaleDateString()
}

