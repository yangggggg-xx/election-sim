import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Tooltip as RTooltip,
} from 'recharts';
import type { EmotionWaveData, EmotionTimePoint, PartyEmotionSnapshot } from '../../types';

/* ─── Props ───────────────────────────────────────────── */

interface EmotionWavePanelProps {
  waves: EmotionWaveData[];
  /** Full events list — events without emotion_waves will be shown as Impact Flash cards */
  events?: ImpactEvent[];
}

/** Minimal interface — only what we need from the events data */
interface ImpactEvent {
  id: string;
  title: string;
  date: string;
  content: string;
  impact: {
    rep_happy: number; rep_sad: number; rep_angry: number;
    dem_happy: number; dem_sad: number; dem_angry: number;
    ind_happy: number; ind_sad: number; ind_angry: number;
    rep_positive: number; dem_positive: number; ind_positive: number;
  };
}

/* ─── Helpers ──────────────────────────────────────────── */

function getVal(snapshot: PartyEmotionSnapshot, key: string): number {
  return snapshot[key as keyof PartyEmotionSnapshot] as number;
}

function findPeak(timeline: EmotionTimePoint[], partyKey: string, emotionKey: string) {
  let peak = 0, peakDay = 0;
  for (const tp of timeline) {
    const snap = tp[partyKey as keyof EmotionTimePoint] as PartyEmotionSnapshot;
    const val = getVal(snap, emotionKey);
    if (val > peak) { peak = val; peakDay = tp.day_offset; }
  }
  return { peak, peakDay };
}

function getBaseline(timeline: EmotionTimePoint[], partyKey: string, emotionKey: string) {
  const before = timeline.find(tp => tp.day_offset === -1) || timeline[0];
  const snap = before[partyKey as keyof EmotionTimePoint] as PartyEmotionSnapshot;
  return getVal(snap, emotionKey);
}

function calcRecovery(timeline: EmotionTimePoint[], partyKey: string, emotionKey: string) {
  const baseline = getBaseline(timeline, partyKey, emotionKey);
  const { peak, peakDay } = findPeak(timeline, partyKey, emotionKey);
  const threshold = baseline + 0.03;
  let recoveredDay: number | null = null;
  for (const tp of timeline) {
    if (tp.day_offset > peakDay) {
      const snap = tp[partyKey as keyof EmotionTimePoint] as PartyEmotionSnapshot;
      if (getVal(snap, emotionKey) <= threshold) {
        recoveredDay = tp.day_offset;
        break;
      }
    }
  }
  const lastTp = timeline[timeline.length - 1];
  const lastSnap = lastTp[partyKey as keyof EmotionTimePoint] as PartyEmotionSnapshot;
  const stillElevated = recoveredDay === null && getVal(lastSnap, emotionKey) > baseline + 0.02;
  return { baseline, peak, peakDay, recoveredDay, stillElevated };
}

/* ─── Emotion visual config ──────────────────────────── */

const EMOTION_META: Record<string, { color: string; label: string; emoji: string }> = {
  angry: { color: '#ef4444', label: '愤怒', emoji: '😡' },
  sad:   { color: '#3b82f6', label: '悲伤',   emoji: '😢' },
  happy: { color: '#22c55e', label: '喜悦', emoji: '😊' },
};

/* ─── Event-specific config for timeline cards ────────── */

interface EventConfig {
  icon: string;
  title: string;
  date: string;
  desc: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  heroEmoji: string;
  heroLabel: string;
  heroParty: string;
  heroEmotion: string;
  repDominant: 'angry' | 'sad' | 'happy';
  demDominant: 'angry' | 'sad' | 'happy';
  indDominant: 'angry' | 'sad' | 'happy';
}

const PARTY_COLORS: Record<string, { main: string; bg: string; border: string }> = {
  republicans: { main: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)' },
  democrats:   { main: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)' },
  independents: { main: '#a855f7', bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.15)' },
};

const DOMAIN_ICONS: Record<string, string> = {
  politics: '🏛️',
  economy: '📊',
  security: '🛡️',
};

function findDominantEmotion(timeline: EmotionTimePoint[], partyKey: string): 'angry' | 'sad' | 'happy' {
  let maxPeak = 0;
  let dominant: 'angry' | 'sad' | 'happy' = 'angry';
  for (const emo of ['angry', 'sad', 'happy'] as const) {
    const { peak } = findPeak(timeline, partyKey, emo);
    if (peak > maxPeak) {
      maxPeak = peak;
      dominant = emo;
    }
  }
  return dominant;
}

/** Derive event config from data — replaces hardcoded getEventConfig */
function deriveEventConfig(wave: EmotionWaveData, events?: ImpactEvent[]): EventConfig {
  const timeline = wave.timeline;

  // Find dominant emotion per party
  const repDominant = findDominantEmotion(timeline, 'republicans');
  const demDominant = findDominantEmotion(timeline, 'democrats');
  const indDominant = findDominantEmotion(timeline, 'independents');

  // Find hero: biggest baseline→peak shift across all parties/emotions
  let heroDelta = 0;
  let heroParty = 'republicans';
  let heroEmotion: 'angry' | 'sad' | 'happy' = 'angry';
  for (const party of ['republicans', 'democrats', 'independents'] as const) {
    for (const emo of ['angry', 'sad', 'happy'] as const) {
      const rec = calcRecovery(timeline, party, emo);
      const delta = rec.peak - rec.baseline;
      if (delta > heroDelta) {
        heroDelta = delta;
        heroParty = party;
        heroEmotion = emo;
      }
    }
  }

  const partyStyle = PARTY_COLORS[heroParty] || PARTY_COLORS.republicans;
  const heroMeta = EMOTION_META[heroEmotion];

  // Match event from events list for title, date, desc, domain icon
  const matchedEvent = (events || []).find(e => e.id === wave.event_id);
  const icon = (matchedEvent && DOMAIN_ICONS[matchedEvent.domain]) || '📰';
  const title = wave.event_title || matchedEvent?.title || 'Event';
  const date = wave.event_date || matchedEvent?.date || '';
  const desc = matchedEvent?.content || '';

  const heroLabels: Record<string, string> = {
    republicans: '共和党',
    democrats: '民主党',
    independents: '独立选民',
  };

  return {
    icon,
    title,
    date,
    desc: desc.length > 180 ? desc.slice(0, 177) + '...' : desc,
    accentColor: partyStyle.main,
    accentBg: partyStyle.bg,
    accentBorder: partyStyle.border,
    heroEmoji: heroMeta.emoji,
    heroLabel: `${heroLabels[heroParty]} ${heroMeta.label}`,
    heroParty,
    heroEmotion,
    repDominant,
    demDominant,
    indDominant,
  };
}

/** Derive flash config from event data — replaces hardcoded getFlashConfig */
function deriveFlashConfig(event: ImpactEvent) {
  const icon = DOMAIN_ICONS[event.domain] || '📰';
  return {
    icon,
    title: event.title,
    date: event.date,
    desc: event.content.length > 150 ? event.content.slice(0, 147) + '...' : event.content,
  };
}

/* ─── Custom Tooltip ──────────────────────────────────── */

function EmotionTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'rgba(15,15,30,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 12,
      lineHeight: 1.8,
    }}>
      <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>
        {label === 0 ? '📢 事件日' : `第 ${label > 0 ? '+' : ''}${label} 天`}
      </div>
      {payload.map((entry: any) => {
        const meta = EMOTION_META[entry.dataKey];
        if (!meta) return null;
        return (
          <div key={entry.dataKey} style={{ color: meta.color, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{meta.emoji}</span>
            <span>{meta.label}: <b>{(entry.value * 100).toFixed(1)}%</b></span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Party Chart (with timeline) ─────────────────────── */

function PartyChart({
  timeline,
  partyKey,
  partyLabel,
  partyColor,
  dominantEmotion,
}: {
  timeline: EmotionTimePoint[];
  partyKey: string;
  partyLabel: string;
  partyColor: string;
  dominantEmotion: 'angry' | 'sad' | 'happy';
}) {
  const domStyle = EMOTION_META[dominantEmotion];
  const { peak, peakDay } = findPeak(timeline, partyKey, dominantEmotion);
  const baseline = getBaseline(timeline, partyKey, dominantEmotion);
  const recovery = calcRecovery(timeline, partyKey, dominantEmotion);

  const chartData = timeline.map(tp => {
    const snap = tp[partyKey as keyof EmotionTimePoint] as PartyEmotionSnapshot;
    return {
      day: tp.day_offset,
      angry: getVal(snap, 'angry'),
      sad: getVal(snap, 'sad'),
      happy: getVal(snap, 'happy'),
    };
  });

  // Only show emotions with a meaningful peak (> 6%)
  const visibleEmotions = (['angry', 'sad', 'happy'] as const)
    .filter(e => findPeak(timeline, partyKey, e).peak > 0.06)
    .sort((a, b) => {
      if (a === dominantEmotion) return -1;
      if (b === dominantEmotion) return 1;
      return findPeak(timeline, partyKey, b).peak - findPeak(timeline, partyKey, a).peak;
    });

  const peakIndex = chartData.findIndex(d => d.day === peakDay);

  // Custom peak dot: circle + value label on the dominant emotion's peak
  const renderPeakDot = (props: any) => {
    const { cx, cy, index } = props;
    if (index !== peakIndex) return <circle key={`dot-${index}`} r={0} />;
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={5} fill={domStyle.color} stroke="#fff" strokeWidth={2} />
        <text
          x={cx}
          y={(cy as number) - 14}
          fill={domStyle.color}
          fontSize={12}
          fontWeight={800}
          textAnchor="middle"
        >
          {(peak * 100).toFixed(0)}%
        </text>
      </g>
    );
  };

  // ─── Sentiment Shift data ───
  const sentimentData = timeline.map(tp => ({
    day: tp.day_offset,
    val: getVal(tp[partyKey as keyof EmotionTimePoint] as PartyEmotionSnapshot, 'positive'),
  }));
  const maxSent = sentimentData.reduce((a, b) => b.val > a.val ? b : a, sentimentData[0]);
  const minSent = sentimentData.reduce((a, b) => b.val < a.val ? b : a, sentimentData[0]);
  const hasSentShift = Math.abs(maxSent.val) > 0.02 || Math.abs(minSent.val) > 0.02;

  return (
    <div>
      {/* Party header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: partyColor, display: 'inline-block' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: partyColor }}>{partyLabel}</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 700,
          color: domStyle.color,
          background: `${domStyle.color}18`,
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          {domStyle.emoji} Peak {(peak * 100).toFixed(0)}%
        </span>
      </div>

      {/* Area chart with phase zones */}
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={chartData} margin={{ top: 18, right: 8, left: -22, bottom: 0 }}>
          {/* Phase background zones */}
          <ReferenceArea x1={-2} x2={-0.5} fill="rgba(130,130,200,0.03)" />
          <ReferenceArea x1={-0.5} x2={2.5} fill="rgba(251,191,36,0.05)" />
          <ReferenceArea x1={2.5} x2={7} fill="rgba(100,200,100,0.03)" />

          <XAxis
            dataKey="day"
            tick={{ fill: '#666', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            ticks={[-2, -1, 0, 1, 2, 3, 5, 7]}
            tickFormatter={(v: number) => {
              if (v === 0) return '';
              return `D${v > 0 ? '+' : ''}${v}`;
            }}
          />
          <YAxis
            domain={[0, 0.55]}
            tick={{ fill: '#444', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          />
          <RTooltip content={<EmotionTooltip />} />
          <ReferenceLine x={0} stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 3" />

          {visibleEmotions.map(eKey => {
            const style = EMOTION_META[eKey];
            const isDominant = eKey === dominantEmotion;
            return (
              <Area
                key={eKey}
                type="monotone"
                dataKey={eKey}
                stroke={style.color}
                fill={isDominant ? `${style.color}22` : `${style.color}08`}
                strokeWidth={isDominant ? 2.5 : 1.2}
                dot={isDominant ? renderPeakDot : false}
                activeDot={isDominant
                  ? { r: 4, fill: style.color, stroke: '#fff', strokeWidth: 2 }
                  : { r: 2, fill: style.color }
                }
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      {/* Phase labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 0, padding: '0 10px' }}>
        <span style={{ color: '#8888cc' }}>平静</span>
        <span style={{ color: '#fbbf24', fontWeight: 700 }}>📢 事件</span>
        <span style={{ color: '#88cc88' }}>恢复</span>
      </div>

      {/* Key stat: baseline → peak */}
      <div style={{
        marginTop: 8,
        padding: '8px 12px',
        borderRadius: 6,
        background: `${domStyle.color}08`,
        border: `1px solid ${domStyle.color}15`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap' as const,
      }}>
        <span style={{ fontSize: 15, color: domStyle.color }}>{domStyle.emoji}</span>
        <span style={{ fontSize: 12, color: '#aaa' }}>{domStyle.label}:</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#777' }}>{(baseline * 100).toFixed(0)}%</span>
        <span style={{ fontSize: 14, color: '#555' }}>→</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: domStyle.color }}>{(peak * 100).toFixed(0)}%</span>
        {peak > baseline && (
          <span style={{
            fontSize: 11,
            color: domStyle.color,
            fontWeight: 700,
            background: `${domStyle.color}18`,
            padding: '1px 7px',
            borderRadius: 3,
          }}>
            +{((peak - baseline) * 100).toFixed(0)}pp
          </span>
        )}
      </div>

      {/* Recovery indicator */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: '#888' }}>恢复:</span>
        {recovery.recoveredDay !== null ? (
          <span style={{ color: '#22c55e' }}>✅ 第 +{recovery.recoveredDay} 天恢复正常</span>
        ) : recovery.stillElevated ? (
          <span style={{ color: '#fbbf24' }}>⏳ 7天后仍处于高位</span>
        ) : (
          <span style={{ color: '#22c55e' }}>✅ 已恢复</span>
        )}
      </div>

      {/* ─── Sentiment Shift ─── */}
      {hasSentShift && (
        <div style={{
          marginTop: 6,
          padding: '6px 10px',
          borderRadius: 5,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          fontSize: 11,
        }}>
          <div style={{ color: '#888', marginBottom: 3, fontWeight: 600 }}>态度偏移</div>
          {maxSent.val > 0.02 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span>📈</span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>+{(maxSent.val * 100).toFixed(0)}%</span>
              <span style={{ color: '#777' }}>(第 {maxSent.day >= 0 ? '+' : ''}{maxSent.day} 天)</span>
              <span style={{ color: '#666' }}>— 倾向候选人</span>
            </div>
          )}
          {minSent.val < -0.02 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>📉</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>{(minSent.val * 100).toFixed(0)}%</span>
              <span style={{ color: '#777' }}>(第 {minSent.day >= 0 ? '+' : ''}{minSent.day} 天)</span>
              <span style={{ color: '#666' }}>— 远离候选人</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Takeaways ───────────────────────────────────────── */

function Takeaways({ wave, config }: { wave: EmotionWaveData; config: EventConfig }) {
  const recs = {
    republicans: {
      dominant: calcRecovery(wave.timeline, 'republicans', config.repDominant),
      label: '共和党',
      color: '#ef4444',
    },
    democrats: {
      dominant: calcRecovery(wave.timeline, 'democrats', config.demDominant),
      label: '民主党',
      color: '#3b82f6',
    },
    independents: {
      dominant: calcRecovery(wave.timeline, 'independents', config.indDominant),
      label: '独立选民',
      color: '#a855f7',
    },
  };

  const bullets: React.ReactNode[] = [];

  for (const [, rec] of Object.entries(recs)) {
    const { baseline, peak, recoveredDay, stillElevated } = rec.dominant;
    const delta = peak - baseline;
    if (delta > 0.02) {
      const partyEmo = rec === recs.republicans ? config.repDominant :
        rec === recs.democrats ? config.demDominant : config.indDominant;
      const partyEmoMeta = EMOTION_META[partyEmo];
      bullets.push(
        <li key={rec.label}>
          <span style={{ fontWeight: 600, color: rec.color }}>{rec.label}</span>{' '}
          {partyEmoMeta.label}从 {(baseline * 100).toFixed(0)}% 激增至{' '}
          <span style={{ fontWeight: 700, color: partyEmoMeta.color }}>{(peak * 100).toFixed(0)}%</span>
          {recoveredDay !== null
            ? ` — 第 +${recoveredDay} 天恢复`
            : stillElevated
            ? ' — 7天后仍处于高位'
            : ''}
        </li>
      );
    }
  }

  // 主导党派高亮
  const heroRec = calcRecovery(wave.timeline, config.heroParty, config.heroEmotion);
  if (heroRec.peak - heroRec.baseline > 0.05) {
    const heroPartyLabel = config.heroParty === 'republicans' ? '共和党' :
      config.heroParty === 'democrats' ? '民主党' : '独立选民';
    bullets.push(
      <li key="hero">
        最大偏移: <span style={{ fontWeight: 600, color: PARTY_COLORS[config.heroParty]?.main }}>
        {heroPartyLabel}{EMOTION_META[config.heroEmotion].label}</span>{' '}
        跃升 +{((heroRec.peak - heroRec.baseline) * 100).toFixed(0)} 个百分点
      </li>
    );
  }

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10,
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#d4a843', marginBottom: 8, letterSpacing: 0.5 }}>💡 解读</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#bbb', fontSize: 13, lineHeight: 2 }}>
        {bullets.length > 0 ? bullets : <li style={{ color: '#666' }}>各群体情绪冲击较为温和</li>}
      </ul>
    </div>
  );
}

/* ─── Event Wave Card (with full timeline) ────────────── */

function EventWaveCard({ wave, events }: { wave: EmotionWaveData; events?: ImpactEvent[] }) {
  const config = deriveEventConfig(wave, events);
  const heroRecovery = calcRecovery(wave.timeline, config.heroParty, config.heroEmotion);

  return (
    <div style={{
      padding: 24, borderRadius: 12,
      border: `1px solid ${config.accentBorder}`,
      background: `linear-gradient(135deg, ${config.accentBg}, transparent 60%)`,
    }}>
      {/* Event Header */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 36 }}>{config.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{config.title}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{config.date}</div>
        </div>
      </div>
      <div style={{ fontSize: 14, color: '#999', lineHeight: 1.6, marginBottom: 18, fontStyle: 'italic' }}>
        {config.desc}
      </div>

      {/* Hero Highlight */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px', borderRadius: 10, marginBottom: 20,
        background: config.accentBg, border: `1px solid ${config.accentBorder}`,
      }}>
        <span style={{ fontSize: 40 }}>{config.heroEmoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Biggest Shift</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: config.accentColor }}>{config.heroLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#777' }}>{(heroRecovery.baseline * 100).toFixed(0)}%</span>
            <span style={{ fontSize: 14, color: '#555', margin: '0 6px' }}>→</span>
            <span style={{ fontSize: 30, fontWeight: 900, color: config.accentColor }}>{(heroRecovery.peak * 100).toFixed(0)}%</span>
          </div>
          <div style={{ fontSize: 13, color: config.accentColor, fontWeight: 700 }}>
            +{((heroRecovery.peak - heroRecovery.baseline) * 100).toFixed(0)} 个百分点
          </div>
        </div>
      </div>

      {/* Two-column charts: Rep vs Dem */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 14, borderRadius: 10, background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.08)' }}>
          <PartyChart timeline={wave.timeline} partyKey="republicans" partyLabel="共和党选民" partyColor="#ef4444" dominantEmotion={config.repDominant} />
        </div>
        <div style={{ padding: 14, borderRadius: 10, background: 'rgba(37,99,235,0.03)', border: '1px solid rgba(37,99,235,0.08)' }}>
          <PartyChart timeline={wave.timeline} partyKey="democrats" partyLabel="民主党选民" partyColor="#3b82f6" dominantEmotion={config.demDominant} />
        </div>
      </div>

      {/* Independent Voters */}
      <div style={{ padding: 14, borderRadius: 10, background: 'rgba(168,85,247,0.03)', border: '1px solid rgba(168,85,247,0.08)', marginBottom: 16 }}>
        <PartyChart timeline={wave.timeline} partyKey="independents" partyLabel="独立选民" partyColor="#a855f7" dominantEmotion={config.indDominant} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 16, fontSize: 12 }}>
        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#ef4444', borderRadius: 1 }} /> Angry
        </span>
        <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#3b82f6', borderRadius: 1 }} /> Sad
        </span>
        <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#22c55e', borderRadius: 1 }} /> Happy
        </span>
        <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#fbbf24', borderRadius: 1 }} /> 事件日
        </span>
      </div>

      <Takeaways wave={wave} config={config} />
    </div>
  );
}

/* ─── Impact Flash Card (no timeline, instant snapshot) ── */

function ImpactFlashCard({ event }: { event: ImpactEvent }) {
  const flashCfg = deriveFlashConfig(event);
  const impact = event.impact;

  const parties = [
    {
      key: 'rep', label: '共和党', color: '#ef4444',
      emotions: [
        { key: 'happy', value: impact.rep_happy },
        { key: 'sad',   value: impact.rep_sad },
        { key: 'angry', value: impact.rep_angry },
      ],
      positive: impact.rep_positive,
    },
    {
      key: 'dem', label: '民主党', color: '#3b82f6',
      emotions: [
        { key: 'happy', value: impact.dem_happy },
        { key: 'sad',   value: impact.dem_sad },
        { key: 'angry', value: impact.dem_angry },
      ],
      positive: impact.dem_positive,
    },
    {
      key: 'ind', label: '独立选民', color: '#a855f7',
      emotions: [
        { key: 'happy', value: impact.ind_happy },
        { key: 'sad',   value: impact.ind_sad },
        { key: 'angry', value: impact.ind_angry },
      ],
      positive: impact.ind_positive,
    },
  ];

  return (
    <div style={{
      padding: 20, borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 28 }}>{flashCfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{flashCfg.title}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{flashCfg.date}</div>
        </div>
        <span style={{
          fontSize: 10, color: '#888', background: 'rgba(255,255,255,0.05)',
          padding: '3px 10px', borderRadius: 4, letterSpacing: 0.5,
        }}>
          冲击快照
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#999', lineHeight: 1.5, marginBottom: 14, fontStyle: 'italic' }}>
        "{event.content.length > 150 ? event.content.slice(0, 150) + '...' : event.content}"
      </div>

      {/* Three-column party impact grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {parties.map(p => {
          // Sort emotions by value descending — dominant first
          const sorted = [...p.emotions].sort((a, b) => b.value - a.value);
          const dominant = sorted[0];
          const domMeta = EMOTION_META[dominant.key];
          const secondary = sorted.slice(1).filter(e => e.value > 0.05);

          return (
            <div key={p.key} style={{
              padding: 12, borderRadius: 8,
              background: `${p.color}06`, border: `1px solid ${p.color}12`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 8 }}>{p.label}</div>

              {/* Dominant emotion */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>{domMeta.emoji}</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: domMeta.color }}>
                    {(dominant.value * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>{domMeta.label}</div>
                </div>
              </div>

              {/* Secondary emotions (if notable) */}
              {secondary.map(e => {
                const meta = EMOTION_META[e.key];
                return (
                  <div key={e.key} style={{ fontSize: 11, color: '#777', display: 'flex', gap: 4, marginTop: 2 }}>
                    <span>{meta.emoji}</span>
                    <span>{meta.label}: {(e.value * 100).toFixed(0)}%</span>
                  </div>
                );
              })}

              {/* Sentiment shift */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {p.positive > 0.02 && (
                  <div style={{ fontSize: 11, color: '#22c55e', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span>📈</span>
                    <span style={{ fontWeight: 700 }}>+{(p.positive * 100).toFixed(0)}%</span>
                    <span style={{ color: '#666' }}>态度</span>
                  </div>
                )}
                {p.positive < -0.02 && (
                  <div style={{ fontSize: 11, color: '#ef4444', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span>📉</span>
                    <span style={{ fontWeight: 700 }}>{(p.positive * 100).toFixed(0)}%</span>
                    <span style={{ color: '#666' }}>态度</span>
                  </div>
                )}
                {Math.abs(p.positive) <= 0.02 && (
                  <div style={{ fontSize: 11, color: '#555' }}>态度: 中性</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Export ──────────────────────────────────────── */

export default function EmotionWavePanel({ waves, events }: EmotionWavePanelProps) {
  if (!waves || waves.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: 14, textAlign: 'center', padding: 24 }}>
        暂无情绪波浪数据。
      </div>
    );
  }

  // Find events that have no corresponding emotion_wave timeline
  const waveEventIds = new Set(waves.map(w => w.event_id));
  const flashEvents = (events || []).filter(e => !waveEventIds.has(e.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Full timeline cards */}
      {waves.map((wave) => (
        <EventWaveCard key={wave.event_id} wave={wave} events={events} />
      ))}

      {/* Impact Flash cards for events without timelines */}
      {flashEvents.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#888', letterSpacing: 1 }}>其他事件冲击</span>
            <span style={{ fontSize: 12, color: '#555' }}>— 即时情绪快照</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: flashEvents.length === 1 ? '1fr' : '1fr 1fr', gap: 16 }}>
            {flashEvents.map((event) => (
              <ImpactFlashCard key={event.id} event={event} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
