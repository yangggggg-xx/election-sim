import { API_BASE } from '../../utils/api';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Modal, Tooltip, Slider, Switch, Button, Input, Select } from 'antd';
import { PlayCircleOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { useSimStore } from '../../store';
import { fetchEvents, fetchState, createSimWebSocket, addEvent, deleteEvent, loadPreset } from '../../utils/api';
import USMap from '../../components/USMap';
import EVTally from '../../components/EVTally';
import EventTimeline from '../../components/EventTimeline';
import SwingStatesPanel from '../../components/SwingStatesPanel';
import TopBar from '../../components/TopBar';
import SectionHeader from '../../components/SectionHeader';
import EmotionWavePanel from '../../components/EmotionWavePanel';
import type { StatePrediction, SimEvent, EmotionWaveData, EmotionTimePoint, PartyEmotionSnapshot, GroupAgent, FineGrainedFactors, ActionStats } from '../../types';
import { STATE_NAMES } from '../../types';

// ── 情绪波浪数据转换 ──

function transformEmotionWaves(rawWaves: any[]): EmotionWaveData[] {
  if (!rawWaves || rawWaves.length === 0) return [];
  return rawWaves.map(wave => ({
    event_id: wave.event_id,
    event_title: wave.title || wave.event_title,
    event_date: wave.event_date || '',
    timeline: (wave.timeline || []).map((tp: any): EmotionTimePoint => ({
      day_offset: tp.day_offset,
      republicans: { happy: tp.rep_happy ?? 0, sad: tp.rep_sad ?? 0, angry: tp.rep_angry ?? 0, positive: tp.rep_positive ?? 0 } as PartyEmotionSnapshot,
      democrats: { happy: tp.dem_happy ?? 0, sad: tp.dem_sad ?? 0, angry: tp.dem_angry ?? 0, positive: tp.dem_positive ?? 0 } as PartyEmotionSnapshot,
      independents: { happy: tp.ind_happy ?? 0, sad: tp.ind_sad ?? 0, angry: tp.ind_angry ?? 0, positive: tp.ind_positive ?? 0 } as PartyEmotionSnapshot,
    })),
  }));
}

const DOMAIN_TAGS: Record<string, { label: string; color: string }> = {
  politics: { label: '政治', color: '#818cf8' },
  economy: { label: '经济', color: '#34d399' },
  security: { label: '安全', color: '#f87171' },
};

// ── 深蓝主题色值 ──
const C = {
  bg: 'linear-gradient(170deg, #070d1f 0%, #0b1735 35%, #091230 70%, #060c1e 100%)',
  card: 'rgba(15,30,65,0.55)',
  cardBorder: 'rgba(80,130,220,0.12)',
  cardHover: 'rgba(20,40,80,0.65)',
  accent: '#60a5fa',
  gold: '#c9a84c',
  textPrimary: '#e2e8f0',
  textSecondary: '#8899b4',
  textMuted: '#4c5f80',
  red: '#f87171',
  blue: '#60a5fa',
  green: '#34d399',
  yellow: '#fbbf24',
};

const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: 10,
  backdropFilter: 'blur(8px)',
};

// ── 主组件 ──

export default function InteractivePage2026() {
  const { staticData } = useSimStore();
  const staticResult = staticData[2026];
  const [ensembleData, setEnsembleData] = useState<any>(null);

  useEffect(() => {
    fetch('/election_2026_ensemble.json')
      .then(r => { if (r.ok) return r.json(); throw new Error('not found'); })
      .then(data => setEnsembleData(data))
      .catch(() => {});
  }, []);

  const [backendOnline, setBackendOnline] = useState(false);
  const [simMode, setSimMode] = useState(false);

  const [liveEvents, setLiveEvents] = useState<SimEvent[]>([]);
  const [liveAgents, setLiveAgents] = useState<GroupAgent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDay, setCurrentDay] = useState(0);
  const [liveRepEV, setLiveRepEV] = useState(0);
  const [liveDemEV, setLiveDemEV] = useState(0);
  const [livePredictions, setLivePredictions] = useState<Record<string, StatePrediction>>({});
  const [actionStats, setActionStats] = useState<ActionStats>({ views: 0, likes: 0, comments: 0, shares: 0 });
  const [factors, setFactors] = useState<FineGrainedFactors>({ population_weight: 1.0, emotion_fading: 0.1, forgetting_probability: 0.05, character_enabled: true });

  const snapshots: any[] = (staticResult as any)?.snapshots || [];
  const [snapshotIndex, setSnapshotIndex] = useState<number>(0);

  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stateModal, setStateModal] = useState<string | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch(API_BASE + '/health', { signal: AbortSignal.timeout(2000) })
      .then(r => { if (r.ok) setBackendOnline(true); })
      .catch(() => setBackendOnline(false));
  }, []);

  const enterSimMode = useCallback(async () => {
    try {
      const evData = await fetchEvents();
      setLiveEvents(evData.events || []);
      const stateData = await fetchState();
      if (stateData) {
        setLiveRepEV(stateData.rep_electoral_votes || 0);
        setLiveDemEV(stateData.dem_electoral_votes || 0);
        setLivePredictions(stateData.state_predictions || {});
        setLiveAgents((stateData.agents || []) as GroupAgent[]);
      }
      setSimMode(true);
    } catch { setBackendOnline(false); }
  }, []);

  const startSimulation = useCallback(() => {
    const ws = createSimWebSocket();
    wsRef.current = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ command: 'start' })); setIsRunning(true); };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'day_update' || msg.type === 'reset') {
        const d = msg.data || {};
        setCurrentDay(d.current_day || 0);
        setLiveRepEV(d.rep_electoral_votes || 0);
        setLiveDemEV(d.dem_electoral_votes || 0);
        setLivePredictions(d.state_predictions || {});
        setLiveAgents((d.agents || []) as GroupAgent[]);
        setActionStats(d.action_stats || { views: 0, likes: 0, comments: 0, shares: 0 });
      }
      if (msg.type === 'event_start') setLiveEvents(prev => prev.map(ev => ev.id === msg.event?.id ? { ...ev, status: 'processing' as const } : ev));
      if (msg.type === 'day_update' && msg.event_id) setLiveEvents(prev => prev.map(ev => ev.id === msg.event_id ? { ...ev, status: 'completed' as const } : ev));
      if (msg.type === 'simulation_complete') { setIsRunning(false); const p = msg.prediction || {}; setLiveRepEV(p.rep_electoral_votes || 0); setLiveDemEV(p.dem_electoral_votes || 0); if (p.state_predictions) setLivePredictions(p.state_predictions); }
    };
    ws.onclose = () => { setIsRunning(false); wsRef.current = null; };
  }, []);

  const resetSimulation = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ command: 'reset' }));
    setIsRunning(false); setCurrentDay(0);
  }, []);

  const updateFactorsWS = useCallback((newFactors: FineGrainedFactors) => {
    setFactors(newFactors);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ command: 'update_factors', factors: newFactors }));
  }, []);

  // ── 静态数据 ──
  const activeSnapshot = snapshots.length > 0 ? snapshots[snapshotIndex] : null;
  const staticPredictions = (activeSnapshot?.state_predictions || staticResult?.simulated?.state_predictions || {}) as Record<string, StatePrediction>;
  const staticEvents: SimEvent[] = (staticResult?.events || []) as SimEvent[];
  const staticEmotionWaves = useMemo(() => {
    const waves = activeSnapshot ? [activeSnapshot.emotion_wave] : (staticResult as any)?.emotion_waves;
    return transformEmotionWaves(waves);
  }, [staticResult, activeSnapshot]);

  const staticPartyEmotion = useMemo(() => {
    if (!staticEvents.length) return [];
    let rH = 0, rA = 0, dH = 0, dA = 0, n = 0;
    staticEvents.forEach(e => { if (e.impact) { rH += e.impact.rep_happy; rA += e.impact.rep_angry; dH += e.impact.dem_happy; dA += e.impact.dem_angry; n++; } });
    return n ? [{ party: '共和党', happy: +(rH / n).toFixed(3), angry: +(rA / n).toFixed(3) }, { party: '民主党', happy: +(dH / n).toFixed(3), angry: +(dA / n).toFixed(3) }] : [];
  }, [staticEvents]);

  const staticImpactful = useMemo(() =>
    staticEvents.filter(e => e.impact).map(e => ({ ...e, total: Math.abs(e.impact!.rep_happy) + Math.abs(e.impact!.rep_sad) + Math.abs(e.impact!.rep_angry) + Math.abs(e.impact!.dem_happy) + Math.abs(e.impact!.dem_sad) + Math.abs(e.impact!.dem_angry) })).sort((a, b) => b.total - a.total).slice(0, 5)
  , [staticEvents]);

  const livePartyEmotion = useMemo(() => {
    const reps = liveAgents.filter(a => a.party === 'republican');
    const dems = liveAgents.filter(a => a.party === 'democrat');
    const avg = (arr: GroupAgent[], key: 'happy' | 'angry') => arr.length ? arr.reduce((s, a) => s + a.emotions[key], 0) / arr.length : 0;
    return [
      { party: '共和党', happy: +avg(reps, 'happy').toFixed(3), angry: +avg(reps, 'angry').toFixed(3) },
      { party: '民主党', happy: +avg(dems, 'happy').toFixed(3), angry: +avg(dems, 'angry').toFixed(3) },
    ];
  }, [liveAgents]);

  const activePredictions = simMode ? livePredictions : staticPredictions;
  const activeRepEV = simMode ? liveRepEV : (activeSnapshot?.rep_electoral_votes || staticResult?.simulated?.rep_electoral_votes || 0);
  const activeDemEV = simMode ? liveDemEV : (activeSnapshot?.dem_electoral_votes || staticResult?.simulated?.dem_electoral_votes || 0);
  const activeEvents = simMode ? liveEvents : staticEvents;
  const activePartyEmotion = simMode ? livePartyEmotion : staticPartyEmotion;

  const confStats = useMemo(() => {
    const preds = Object.values(activePredictions);
    return { safe: preds.filter(p => p.confidence >= 0.15).length, lean: preds.filter(p => p.confidence >= 0.07 && p.confidence < 0.15).length, swing: preds.filter(p => p.confidence < 0.07).length, total: preds.length };
  }, [activePredictions]);

  const filteredAgents = useMemo(() => agentFilter ? liveAgents.filter(a => a.state_abbr === agentFilter) : liveAgents.slice(0, 50), [liveAgents, agentFilter]);

  const modalData = useMemo(() => {
    if (!stateModal) return null;
    const pred = activePredictions[stateModal];
    if (!pred) return null;
    return { abbr: stateModal, name: STATE_NAMES[stateModal] || stateModal, ...pred };
  }, [stateModal, activePredictions]);

  const currentImpact = activeSnapshot?.impact;

  if (!staticResult && !simMode) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.textSecondary }}>正在加载 2026 年数据...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.textPrimary, fontFamily: "'Inter','Microsoft YaHei',system-ui,sans-serif" }}>
      {/* 顶部导航栏 */}
      <TopBar
        rightExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: C.gold, fontWeight: 600, letterSpacing: 1 }}>
              {simMode ? '2026 实时模拟' : '2026 中期选举预测'}
            </span>
            {backendOnline && !isRunning && (
              <button onClick={() => simMode ? setSimMode(false) : enterSimMode()} style={{
                padding: '4px 12px', borderRadius: 6,
                border: `1px solid ${simMode ? 'rgba(96,165,250,0.4)' : 'rgba(201,168,76,0.4)'}`,
                background: simMode ? 'rgba(96,165,250,0.12)' : 'rgba(201,168,76,0.12)',
                color: simMode ? C.blue : C.gold,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                {simMode ? '查看 GLM 结果' : '实时模拟'}
              </button>
            )}
          </div>
        }
      />

      {/* 模拟控制栏（仅模拟模式） */}
      {simMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', margin: '0 10px', borderRadius: 10, ...cardStyle }}>
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={startSimulation} disabled={isRunning} loading={isRunning}>{isRunning ? '模拟中...' : '启动'}</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={resetSimulation} disabled={isRunning}>重置</Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddEventOpen(true)} disabled={isRunning}>添加事件</Button>
          <Button size="small" onClick={async () => { const d = await loadPreset(); setLiveEvents(d.events || []); }} disabled={isRunning}>加载预设</Button>
          {isRunning && <span style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>第 {currentDay} 天 -- 模拟中</span>}
          {!isRunning && currentDay > 0 && <span style={{ fontSize: 12, color: C.green }}>模拟完成</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11, color: C.textSecondary }}>
            <span>浏览 {(actionStats.views / 1e6).toFixed(1)}M</span>
            <span>点赞 {(actionStats.likes / 1e6).toFixed(1)}M</span>
            <span>评论 {(actionStats.comments / 1e6).toFixed(1)}M</span>
            <span>分享 {(actionStats.shares / 1e6).toFixed(1)}M</span>
          </div>
        </div>
      )}

      {/* 主网格布局 */}
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr 290px', gap: 8, padding: '8px 10px' }}>
        {/* 左栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EVTally repEV={activeRepEV} demEV={activeDemEV} repLabel="共和党" demLabel="民主党" />

          {/* 事件列表 */}
          <div style={{ ...cardStyle, padding: 14, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SectionHeader title="事件列表" />
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              <EventTimeline events={activeEvents} readonly={!simMode} />
            </div>
          </div>

          {/* 模型信息 */}
          <div style={{ ...cardStyle, padding: 14 }}>
            <SectionHeader title={simMode ? '参数调节' : '模型信息'} />
            {simMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div><div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 2 }}>人口权重: {factors.population_weight.toFixed(1)}</div><Slider min={0} max={1} step={0.1} value={factors.population_weight} onChange={v => updateFactorsWS({ ...factors, population_weight: v })} /></div>
                <div><div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 2 }}>情绪衰减: {factors.emotion_fading.toFixed(2)}</div><Slider min={0} max={1} step={0.05} value={factors.emotion_fading} onChange={v => updateFactorsWS({ ...factors, emotion_fading: v })} /></div>
                <div><div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 2 }}>遗忘概率: {factors.forgetting_probability.toFixed(2)}</div><Slider min={0} max={1} step={0.05} value={factors.forgetting_probability} onChange={v => updateFactorsWS({ ...factors, forgetting_probability: v })} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: C.textSecondary }}>性格特征</span><Switch size="small" checked={factors.character_enabled} onChange={v => updateFactorsWS({ ...factors, character_enabled: v })} /></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.textSecondary }}>模型</span><span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{(staticResult as any)?.provider_name || 'N/A'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.textSecondary }}>历史基线</span><span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{(staticResult as any)?.baseline_year || 2024} 年</span></div>
                {activeSnapshot && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.textSecondary }}>当前查看</span><span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>事件 {activeSnapshot.event_index}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.textSecondary }}>事件数</span><span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{snapshots.length || staticEvents.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.textSecondary }}>预测胜方</span><span style={{ fontSize: 13, fontWeight: 700, color: activeRepEV >= 270 ? C.red : C.blue }}>{activeRepEV >= 270 ? '共和党' : '民主党'}</span></div>
              </div>
            )}
          </div>

          {/* 置信度分布 */}
          <div style={{ ...cardStyle, padding: 14 }}>
            <SectionHeader title="置信度分布" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.green }}>稳固 (&gt;=15%)</span><span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{confStats.safe}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.yellow }}>倾向 (7-15%)</span><span style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>{confStats.lean}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: C.red }}>摇摆 (&lt;7%)</span><span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{confStats.swing}</span></div>
            </div>
          </div>
        </div>

        {/* 中栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 标题栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: 10, ...cardStyle }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: 1 }}>
              {simMode ? `实时模拟 -- 第 ${currentDay} 天` : '2026 中期选举预测'}
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>点击各州查看详情</span>
          </div>

          {/* 事件步骤导航 */}
          {!simMode && snapshots.length > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 10, ...cardStyle }}>
              <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1.5, marginBottom: 10, fontWeight: 600 }}>
                事件时间线 -- 各事件后的预测结果
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${snapshots.length}, 1fr)`, gap: 6 }}>
                {snapshots.map((snap: any, idx: number) => {
                  const isActive = idx === snapshotIndex;
                  const isRep = snap.rep_electoral_votes >= 270;
                  const dt = DOMAIN_TAGS[snap.event_domain] || { label: '其他', color: '#94a3b8' };
                  return (
                    <button key={snap.event_id} onClick={() => setSnapshotIndex(idx)} style={{
                      padding: '8px 6px', borderRadius: 8, border: 'none',
                      background: isActive ? (isRep ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)') : 'rgba(255,255,255,0.03)',
                      borderBottom: isActive ? `2px solid ${isRep ? C.red : C.blue}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: dt.color, letterSpacing: 0.5 }}>{dt.label} {snap.event_index}</span>
                      <span style={{ fontSize: 10, color: isActive ? C.gold : C.textSecondary, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {snap.event_title}
                      </span>
                      <span style={{ fontSize: 10, color: isRep ? C.red : C.blue, fontWeight: 700, marginTop: 2 }}>
                        共和{snap.rep_electoral_votes} - 民主{snap.dem_electoral_votes}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 选举地图 */}
          <div style={{ ...cardStyle, flex: 1, padding: 6, position: 'relative', minHeight: 380 }}>
            <USMap statePredictions={activePredictions} selectedState={selectedState} onSelectState={(abbr) => { setSelectedState(abbr); if (abbr) setStateModal(abbr); }} />
          </div>

          {/* 底部面板 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* 平均情绪 */}
            <div style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6, fontWeight: 600 }}>平均情绪</div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={activePartyEmotion} barSize={18}>
                  <XAxis dataKey="party" tick={{ fill: C.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 0.5]} tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="happy" radius={[3, 3, 0, 0]}>{activePartyEmotion.map((_, i) => <Cell key={i} fill={C.green} />)}</Bar>
                  <Bar dataKey="angry" radius={[3, 3, 0, 0]}>{activePartyEmotion.map((_, i) => <Cell key={i} fill={C.red} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 关键指标 / 代理详情 */}
            {simMode ? (
              <div style={{ ...cardStyle, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1.5, fontWeight: 600 }}>代理列表</span>
                  <Select size="small" value={agentFilter || 'all'} onChange={v => setAgentFilter(v === 'all' ? null : v)} style={{ width: 90 }}
                    options={[{ value: 'all', label: '全部' }, ...Object.keys(STATE_NAMES).map(s => ({ value: s, label: s }))]} />
                </div>
                <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filteredAgents.slice(0, 20).map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 4px', borderRadius: 3, background: a.party === 'republican' ? 'rgba(248,113,113,0.05)' : a.party === 'democrat' ? 'rgba(96,165,250,0.05)' : 'rgba(168,85,247,0.05)' }}>
                      <span style={{ fontWeight: 700, color: a.party === 'republican' ? C.red : a.party === 'democrat' ? C.blue : '#a855f7', width: 16 }}>{a.state_abbr}</span>
                      <span style={{ color: C.textSecondary }}>乐{(a.emotions.happy * 100).toFixed(0)} 怒{(a.emotions.angry * 100).toFixed(0)}</span>
                      <span style={{ color: a.attitudes.positive > 0.5 ? C.green : C.red, marginLeft: 'auto' }}>{(a.attitudes.positive * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6, fontWeight: 600 }}>关键指标</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: C.textSecondary }}>总州数</span><span style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary }}>{confStats.total}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: C.textSecondary }}>摇摆州</span><span style={{ fontSize: 11, fontWeight: 700, color: C.yellow }}>{confStats.swing}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: C.textSecondary }}>共和稳固</span><span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>{Object.values(activePredictions).filter(p => p.winner === 'rep' && p.confidence >= 0.15).length}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: C.textSecondary }}>民主稳固</span><span style={{ fontSize: 11, fontWeight: 700, color: C.blue }}>{Object.values(activePredictions).filter(p => p.winner === 'dem' && p.confidence >= 0.15).length}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 预测结果摘要 */}
          <div style={{ ...cardStyle, padding: 16, textAlign: 'center', background: activeRepEV >= 270 ? 'rgba(248,113,113,0.06)' : 'rgba(96,165,250,0.06)', border: `1px solid ${activeRepEV >= 270 ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)'}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 2, fontWeight: 600 }}>{simMode ? '实时预测' : '大模型预测'}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: activeRepEV >= 270 ? C.red : C.blue, marginTop: 4 }}>
              {activeRepEV >= 270 ? '共和党胜出' : '民主党胜出'}
            </div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 2 }}>
              <span style={{ color: C.red, fontWeight: 600 }}>共和</span> {activeRepEV}
              <span style={{ margin: '0 6px', color: C.textMuted }}>vs</span>
              <span style={{ color: C.blue, fontWeight: 600 }}>民主</span> {activeDemEV}
            </div>
            {!simMode && <div style={{ fontSize: 11, color: C.gold, marginTop: 6 }}>由 {(staticResult as any)?.provider_name || '大模型'} 驱动</div>}
            {!simMode && ensembleData?.monte_carlo && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.cardBorder}` }}>
                <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>蒙特卡洛不确定性</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 4 }}>
                  <div><div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{(ensembleData.monte_carlo.rep_win_probability * 100).toFixed(0)}%</div><div style={{ fontSize: 10, color: C.textMuted }}>共和胜率</div></div>
                  <div><div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{(ensembleData.monte_carlo.dem_win_probability * 100).toFixed(0)}%</div><div style={{ fontSize: 10, color: C.textMuted }}>民主胜率</div></div>
                </div>
                <div style={{ fontSize: 10, color: C.textSecondary }}>共和 90% 置信区间: [{ensembleData.monte_carlo.rep_ev_p5}--{ensembleData.monte_carlo.rep_ev_p95}]</div>
                <div style={{ fontSize: 10, color: C.textSecondary }}>民主 90% 置信区间: [{ensembleData.monte_carlo.dem_ev_p5}--{ensembleData.monte_carlo.dem_ev_p95}]</div>
                <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>{ensembleData.monte_carlo.n_simulations} 次模拟</div>
              </div>
            )}
          </div>

          {/* 摇摆州 */}
          <div style={{ ...cardStyle, padding: 14, flex: 1 }}>
            <SectionHeader title="摇摆州" />
            <SwingStatesPanel statePredictions={activePredictions} />
          </div>

          {/* 当前事件影响 / 代理详情 */}
          {!simMode ? (
            <div style={{ ...cardStyle, padding: 14 }}>
              <SectionHeader title="当前事件影响" />
              {activeSnapshot && currentImpact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>各群体态度偏移</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: '共和党', pos: currentImpact.rep_positive, color: C.red },
                      { label: '民主党', pos: currentImpact.dem_positive, color: C.blue },
                      { label: '独立选民', pos: currentImpact.ind_positive, color: '#a78bfa' },
                    ].map(g => (
                      <div key={g.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 2 }}>{g.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: g.pos >= 0 ? C.green : C.red }}>
                          {g.pos >= 0 ? '+' : ''}{g.pos.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, marginBottom: 2 }}>情绪强度</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: '共和', happy: currentImpact.rep_happy, sad: currentImpact.rep_sad, angry: currentImpact.rep_angry },
                      { label: '民主', happy: currentImpact.dem_happy, sad: currentImpact.dem_sad, angry: currentImpact.dem_angry },
                      { label: '独立', happy: currentImpact.ind_happy, sad: currentImpact.ind_sad, angry: currentImpact.ind_angry },
                    ].map(g => (
                      <div key={g.label} style={{ fontSize: 10, color: C.textSecondary, textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, color: C.textPrimary }}>{g.label}</span>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ color: C.green }}>乐{g.happy.toFixed(2)}</span>
                          <span style={{ color: C.yellow }}>悲{g.sad.toFixed(2)}</span>
                          <span style={{ color: C.red }}>怒{g.angry.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {staticImpactful.map((e, i) => (
                    <Tooltip key={e.id} title={e.content.slice(0, 120) + '...'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 5, background: i === 0 ? 'rgba(201,168,76,0.06)' : 'transparent', borderLeft: i === 0 ? `2px solid ${C.gold}` : '2px solid transparent' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, width: 16 }}>#{i + 1}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: (DOMAIN_TAGS[e.domain] || { color: C.textMuted }).color, letterSpacing: 0.5 }}>{(DOMAIN_TAGS[e.domain] || { label: '其他' }).label}</span>
                        <span style={{ fontSize: 12, color: C.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{e.title}</span>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, padding: 14 }}>
              <SectionHeader title="代理详情" />
              {selectedState ? (
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: C.gold, marginBottom: 6 }}>{STATE_NAMES[selectedState] || selectedState}</div>
                  {liveAgents.filter(a => a.state_abbr === selectedState).map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: 4, padding: '3px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
                      <span style={{ color: a.party === 'republican' ? C.red : a.party === 'democrat' ? C.blue : '#a855f7', fontWeight: 600, width: 20 }}>{a.party === 'republican' ? '共' : a.party === 'democrat' ? '民' : '独'}</span>
                      <span style={{ color: C.textSecondary }}>乐{(a.emotions.happy * 100).toFixed(0)} 悲{(a.emotions.sad * 100).toFixed(0)} 怒{(a.emotions.angry * 100).toFixed(0)}</span>
                      <span style={{ marginLeft: 'auto', color: a.attitudes.positive > 0.5 ? C.green : C.red }}>{(a.attitudes.positive * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 12, color: C.textMuted }}>点击地图上的州查看代理详情</div>}
            </div>
          )}

          {/* 竞争州（蒙特卡洛） */}
          {!simMode && ensembleData?.monte_carlo?.state_probabilities && (
            <div style={{ ...cardStyle, padding: 14 }}>
              <SectionHeader title="竞争州" />
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>蒙特卡洛翻转概率</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Object.entries(ensembleData.monte_carlo.state_probabilities as Record<string, { rep_probability: number; dem_probability: number }>)
                  .filter(([, p]) => p.rep_probability > 0.1 && p.rep_probability < 0.9)
                  .sort(([, a], [, b]) => Math.abs(a.rep_probability - 0.5) - Math.abs(b.rep_probability - 0.5))
                  .slice(0, 8)
                  .map(([abbr, p]) => {
                    const ev = activePredictions[abbr]?.ev || 0;
                    const rPct = p.rep_probability * 100;
                    return (
                      <Tooltip key={abbr} title={`${STATE_NAMES[abbr] || abbr}: 共和 ${rPct.toFixed(1)}% / 民主 ${(100 - rPct).toFixed(1)}%`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px', borderRadius: 3, fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: C.gold, width: 22 }}>{abbr}</span>
                          <span style={{ width: 50, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                            <span style={{ width: `${rPct}%`, background: C.red, borderRadius: '3px 0 0 3px' }} />
                            <span style={{ width: `${100 - rPct}%`, background: C.blue, borderRadius: '0 3px 3px 0' }} />
                          </span>
                          <span style={{ color: C.textSecondary, width: 30 }}>{ev}票</span>
                          <span style={{ color: C.red, fontWeight: 600, width: 32 }}>{rPct.toFixed(0)}%</span>
                        </div>
                      </Tooltip>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 情绪波浪（静态模式） */}
      {!simMode && staticEmotionWaves.length > 0 && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          <div style={{ ...cardStyle, padding: 20 }}>
            <SectionHeader title="情绪波动" />
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16, marginTop: 2 }}>
              关键事件如何影响选民情绪 -- 由 {(staticResult as any)?.provider_name || '大模型'} 预测
            </div>
            <EmotionWavePanel waves={staticEmotionWaves} events={staticEvents as any} />
          </div>
        </div>
      )}

      {/* 添加事件弹窗 */}
      <Modal open={addEventOpen} onCancel={() => setAddEventOpen(false)} title="添加事件" onOk={async () => {
        const form = document.getElementById('add-event-form') as HTMLFormElement;
        if (form) {
          const fd = new FormData(form);
          await addEvent({ title: fd.get('title') as string, date: fd.get('date') as string, content: fd.get('content') as string, domain: fd.get('domain') as string || 'politics', country: 'US' });
          const evData = await fetchEvents(); setLiveEvents(evData.events || []);
        }
        setAddEventOpen(false);
      }} styles={{ content: { background: '#0f1a35', color: C.textPrimary } }}>
        <form id="add-event-form" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input name="title" placeholder="事件标题" style={{ background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: `1px solid ${C.cardBorder}` }} />
          <Input name="date" placeholder="YYYY-MM-DD" style={{ background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: `1px solid ${C.cardBorder}` }} />
          <Input.TextArea name="content" placeholder="事件描述" rows={4} style={{ background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: `1px solid ${C.cardBorder}` }} />
          <Select name="domain" defaultValue="politics" style={{ width: '100%' }} options={[{ value: 'politics', label: '政治' }, { value: 'economy', label: '经济' }, { value: 'security', label: '安全' }]} />
        </form>
      </Modal>

      {/* 州详情弹窗 */}
      <Modal open={!!stateModal} onCancel={() => setStateModal(null)} footer={null} width={420}
        styles={{ content: { background: '#0f1a35', border: `1px solid ${C.cardBorder}`, borderRadius: 12 } }} title={null} centered>
        {modalData && (
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{modalData.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1 }}>预测胜方</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: modalData.winner === 'rep' ? C.red : C.blue, marginTop: 4 }}>{modalData.winner === 'rep' ? '共和党' : '民主党'}</div>
              </div>
              <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1 }}>选举人票</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.gold, marginTop: 4 }}>{modalData.ev}</div>
              </div>
              <div style={{ ...cardStyle, padding: 12, textAlign: 'center', gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1, marginBottom: 8 }}>置信度</div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(modalData.confidence * 100, 4)}%`, background: modalData.confidence >= 0.15 ? C.green : modalData.confidence >= 0.07 ? C.yellow : C.red, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginTop: 6 }}>
                  {(modalData.confidence * 100).toFixed(1)}%
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{modalData.confidence >= 0.15 ? '稳固' : modalData.confidence >= 0.07 ? '倾向' : '摇摆'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

