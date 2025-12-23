type Role = 'merchant' | 'payer'

type Props = {
  role: Role
  onSelect: (role: Role) => void
}

export function RoleSelector({ role, onSelect }: Props) {
  return (
    <nav className="tab-nav">
      <button className={role === 'merchant' ? 'active' : ''} onClick={() => onSelect('merchant')}>
        Merchant
      </button>
      <button className={role === 'payer' ? 'active' : ''} onClick={() => onSelect('payer')}>
        Payer
      </button>
    </nav>
  )
}


