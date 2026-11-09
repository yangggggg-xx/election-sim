import { useNavigate, useLocation } from 'react-router-dom';
import { LockOutlined, ThunderboltOutlined } from '@ant-design/icons';

const YEAR_OPTIONS = [
  { year: 2020, path: '/2020', label: '2020 历史验证' },
  { year: 2024, path: '/2024', label: '2024 验证 + 情绪' },
  { year: 2026, path: '/2026', label: '2026 中期预测' },
] as const;

export default function YearSelector() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeYear = YEAR_OPTIONS.find(opt => location.pathname.startsWith(opt.path))?.year ?? 2020;

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {YEAR_OPTIONS.map(opt => {
        const isActive = activeYear === opt.year;
        const isInteractive = opt.year === 2026;
        return (
          <button
            key={opt.year}
            onClick={() => navigate(opt.path)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
              background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
              color: isActive ? '#fff' : '#777',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s',
              fontFamily: "'Inter',system-ui,sans-serif",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLElement).style.color = '#aaa';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                (e.currentTarget as HTMLElement).style.color = '#777';
              }
            }}
          >
            {isInteractive ? <ThunderboltOutlined style={{ fontSize: 12 }} /> : <LockOutlined style={{ fontSize: 11 }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
