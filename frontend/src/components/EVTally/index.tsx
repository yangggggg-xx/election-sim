interface EVTallyProps {
  repEV: number;
  demEV: number;
  repLabel?: string;
  demLabel?: string;
  showComparison?: boolean;
  simRepEV?: number;
  simDemEV?: number;
}

export default function EVTally({ repEV, demEV, repLabel = 'Trump', demLabel = 'Harris', showComparison = false, simRepEV, simDemEV }: EVTallyProps) {
  const total = repEV + demEV || 538;
  const repPct = (repEV / total) * 100;
  const hasWinner = repEV >= 270 || demEV >= 270;

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#dc2626', fontFamily: "'Inter',monospace", lineHeight: 1 }}>{repEV}</div>
          <div style={{ fontSize: 13, color: '#ef4444', marginTop: 3 }}><span style={{ color: '#dc2626' }}>R</span> {repLabel}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#333', letterSpacing: 1 }}>270 票胜出</div>
          {hasWinner && <div style={{ fontSize: 18 }}>&#x1F3C6;</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#2563eb', fontFamily: "'Inter',monospace", lineHeight: 1 }}>{demEV}</div>
          <div style={{ fontSize: 13, color: '#3b82f6', marginTop: 3 }}><span style={{ color: '#2563eb' }}>D</span> {demLabel}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: '#111', display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: `${repPct}%`, background: 'linear-gradient(90deg,#991b1b,#dc2626)', transition: 'width 0.8s', borderRadius: 3 }} />
        <div style={{ flex: 1, background: 'linear-gradient(90deg,#1d4ed8,#3b82f6)', borderRadius: 3 }} />
      </div>

      {showComparison && simRepEV !== undefined && simDemEV !== undefined && (
        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>模拟 vs 实际</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <div>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>R</span>
              <span style={{ color: '#aaa', marginLeft: 4 }}>{simRepEV}</span>
              <span style={{ color: '#555', marginLeft: 4 }}>对比 {repEV}</span>
              <span style={{ color: simRepEV === repEV ? '#22c55e' : '#ef4444', marginLeft: 4, fontSize: 11 }}>
                {simRepEV === repEV ? '一致' : `${simRepEV > repEV ? '+' : ''}${simRepEV - repEV}`}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#2563eb', fontWeight: 700 }}>D</span>
              <span style={{ color: '#aaa', marginLeft: 4 }}>{simDemEV}</span>
              <span style={{ color: '#555', marginLeft: 4 }}>对比 {demEV}</span>
              <span style={{ color: simDemEV === demEV ? '#22c55e' : '#ef4444', marginLeft: 4, fontSize: 11 }}>
                {simDemEV === demEV ? '一致' : `${simDemEV > demEV ? '+' : ''}${simDemEV - demEV}`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
