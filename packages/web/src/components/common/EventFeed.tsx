import type { EventEntry } from '../../types/invoice'

type Props = {
  events: EventEntry[]
  emptyLabel?: string
}

export function EventFeed({ events, emptyLabel = 'No events yet.' }: Props) {
  if (!events.length) {
    return <p className="empty">{emptyLabel}</p>
  }

  return (
    <ul className="event-feed">
      {events.map((event, idx) => (
        <li key={`${event.title}-${idx}`}>
          <strong>{event.title}</strong>
          <span>{event.subtitle}</span>
        </li>
      ))}
    </ul>
  )
}
