import { useMemo } from 'react';
import type { StatePrediction } from '../../types';
import { STATE_NAMES } from '../../types';

interface SwingStatesPanelProps {
  statePredictions: Record<string, StatePrediction>;
  actualResults?: Record<string, 'rep' | 'dem'>;
  showComparison?: boolean;
}

export default function SwingStatesPanel({ statePredictions, actualResults, showComparison = false }: SwingStatesPanelProps) {
  const swingStates = useMemo(
    () => Object.entries(statePredictions)
      .filter(([, p]) => p.confidence < 0.7)
      .map(([abbr, p]) => ({ abbr, name: STATE_NAMES[abbr] || abbr, ...p }))
      .sort((a, b) => Math.abs(a.confidence - 0.5) - Math.abs(b.confidence - 0.5)),
    [statePredictions]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
      {swingStates.length > 0 ? swingStates.map(s => {
        const actual = actualResults?.[s.abbr];
        const isCorrect = showComparison && actual ? s.winner === actual : undefined;
        return (
          <div key={s.abbr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc', width: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#1a1a2e', overflow: 'hidden' }}>
              <div style={{ width: `${(1 - s.confidence) * 100}%`, height: '100%', background: s.winner === 'rep' ? '#dc2626' : '#2563eb', borderRadius: 2, opacity: 0.8 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: s.winner === 'rep' ? '#ef4444' : '#3b82f6' }}>
              {s.winner === 'rep' ? 'R' : 'D'}
            </span>
            <span style={{ fontSize: 12, color: '#888', width: 20 }}>{s.ev}</span>
            {showComparison && actual && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: isCorrect ? '#22c55e' : '#ef4444',
                padding: '2px 6px',
                borderRadius: 4,
                background: isCorrect ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              }}>
                {isCorrect ? '正确' : `实际: ${actual === 'rep' ? 'R' : 'D'}`}
              </span>
            )}
          </div>
        );
      }) : <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>未检测到摇摆州</div>}
    </div>
  );
}
