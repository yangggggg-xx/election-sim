import type { ReactNode } from 'react';
import YearSelector from '../YearSelector';

interface TopBarProps {
  /** Optional element after the title (badge, subtitle, etc.) */
  subtitle?: ReactNode;
  /** Extra controls inserted BEFORE YearSelector on the right side.
   *  YearSelector is always the rightmost element for consistent positioning. */
  rightExtra?: ReactNode;
}

export default function TopBar({ subtitle, rightExtra }: TopBarProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Left: title + optional subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
          美国总统选举模拟器
        </span>
        {subtitle}
      </div>

      {/* Right: extra controls + YearSelector (always rightmost) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {rightExtra}
        <YearSelector />
      </div>
    </div>
  );
}
