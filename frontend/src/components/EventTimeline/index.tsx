import type { SimEvent } from '../../types';

interface EventTimelineProps {
  events: SimEvent[];
  readonly?: boolean;
  highlightEventId?: string;
  onEventClick?: (eventId: string) => void;
}

export default function EventTimeline({ events, readonly = false, highlightEventId, onEventClick }: EventTimelineProps) {
  return (
    <div className="glass-card" style={{ padding: 14, flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
        {events.map(e => {
          const isHighlighted = highlightEventId === e.id;
          return (
            <div
              key={e.id}
              onClick={() => onEventClick?.(e.id)}
              style={{
                display: 'flex',
                gap: 6,
                padding: '5px 8px',
                borderRadius: 5,
                background: isHighlighted
                  ? 'rgba(251,191,36,0.08)'
                  : e.status === 'completed'
                    ? 'rgba(34,197,94,0.04)'
                    : 'rgba(255,255,255,0.01)',
                borderLeft: `2px solid ${isHighlighted ? '#fbbf24' : e.status === 'completed' ? '#22c55e' : e.status === 'processing' ? '#3b82f6' : '#333'}`,
                cursor: onEventClick ? 'pointer' : 'default',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: isHighlighted ? '#fbbf24' : '#bbb', fontWeight: isHighlighted ? 600 : 500 }}>
                  {e.title}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>{e.date}</div>
              </div>
              {!readonly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: e.status === 'completed' ? '#22c55e' : e.status === 'processing' ? '#3b82f6' : '#555',
                      flexShrink: 0,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {events.length === 0 && <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 12 }}>暂无事件</div>}
      </div>
    </div>
  );
}
