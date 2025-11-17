type Props<T extends string> = {
  tabs: readonly T[]
  activeTab: T
  onChange: (tab: T) => void
}

export function TabNav<T extends string>({ tabs, activeTab, onChange }: Props<T>) {
  return (
    <nav className="tab-nav">
      {tabs.map((tab) => (
        <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </nav>
  )
}

