import { ExpandOutlined } from '@ant-design/icons';

interface SectionHeaderProps {
  title: string;
  icon?: string;
  page?: string;
  onExpand?: (page: string) => void;
}

export default function SectionHeader({ title, icon = '', page = '', onExpand }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: '#d4a843', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>{icon} {title}</div>
      {onExpand && (
        <button
          onClick={() => onExpand(page)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#aaa', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff'; (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = '#aaa'; (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <ExpandOutlined style={{ fontSize: 13 }} /> 详情
        </button>
      )}
    </div>
  );
}
