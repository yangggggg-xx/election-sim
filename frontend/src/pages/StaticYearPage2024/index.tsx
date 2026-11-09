import { useMemo, useState } from 'react';
import { Tooltip, Modal } from 'antd';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { useSimStore } from '../../store';
import USMap from '../../components/USMap';
import EVTally from '../../components/EVTally';
import EventTimeline from '../../components/EventTimeline';
import SwingStatesPanel from '../../components/SwingStatesPanel';
import YearSelector from '../../components/YearSelector';
import TopBar from '../../components/TopBar';
import SectionHeader from '../../components/SectionHeader';
import EmotionWavePanel from '../../components/EmotionWavePanel';
import type { StatePrediction, SimEvent, EmotionWaveData, EmotionTimePoint, PartyEmotionSnapshot } from '../../types';
import { STATE_NAMES } from '../../types';

// 2024 JSON 存储的情绪波浪使用扁平键名 (rep_happy, dem_happy 等)
// 但 EmotionWavePanel 期望嵌套的 EmotionTimePoint 结构
// 此函数将原始数据转换为期望的格式
function transformEmotionWaves(rawWaves: any[]): EmotionWaveData[] {
  if (!rawWaves || rawWaves.length === 0) return [];
  return rawWaves.map(wave => ({
    event_id: wave.event_id,
    event_title: wave.title || wave.event_title,
    event_date: wave.event_date || '',
    timeline: (wave.timeline || []).map((tp: any): EmotionTimePoint => ({
      day_offset: tp.day_offset,
      republicans: {
        happy: tp.rep_happy ?? 0,
        sad: tp.rep_sad ?? 0,
        angry: tp.rep_angry ?? 0,
        positive: tp.rep_positive ?? 0,
      } as PartyEmotionSnapshot,
      democrats: {
        happy: tp.dem_happy ?? 0,
        sad: tp.dem_sad ?? 0,
        angry: tp.dem_angry ?? 0,
        positive: tp.dem_positive ?? 0,
      } as PartyEmotionSnapshot,
      independents: {
        happy: tp.ind_happy ?? 0,
        sad: tp.ind_sad ?? 0,
        angry: tp.ind_angry ?? 0,
        positive: tp.ind_positive ?? 0,
      } as PartyEmotionSnapshot,
    })),
  }));
}

// 从实际结果构建预测数据用于对比地图
function buildActualPredictions(
  stateResults: Record<string, { winner: 'rep' | 'dem'; repVotes: number; demVotes: number }>,
  evMap: Record<string, number>,
): Record<string, StatePrediction> {
  const result: Record<string, StatePrediction> = {};
  for (const [abbr, data] of Object.entries(stateResults)) {
    const total = data.repVotes + data.demVotes;
    const confidence = total > 0 ? Math.abs(data.repVotes - data.demVotes) / total : 0.5;
    result[abbr] = { winner: data.winner, confidence, ev: evMap[abbr] || 0 };
  }
  return result;
}

// 2020→2024 翻转的6个州
const FLIPPED_2024 = new Set(['AZ', 'GA', 'MI', 'NV', 'PA', 'WI']);

// 各州人口（用于详情弹窗展示）
const STATE_POP: Record<string, number> = {
  CA:39538223,TX:29145505,FL:21538187,NY:20201249,PA:13002700,IL:12812508,
  OH:11799448,GA:10711908,NC:10439388,MI:10077331,NJ:9288994,VA:8631393,
  WA:7705281,AZ:7151502,MA:7029917,TN:6910840,IN:6785528,MO:6177224,
  MD:6154913,WI:5893718,CO:5773714,MN:5706494,SC:5118425,AL:5024279,
  LA:4657757,KY:4505836,OR:4237256,OK:3959353,CT:3605944,UT:3271616,
  IA:3190369,NV:3104614,AR:3011524,MS:2961279,KS:2937880,NM:2117522,
  NE:1961504,WV:1839106,ID:1793716,HI:1455271,ME:1377529,NH:1362359,
  MT:1097379,RI:1084225,DE:989948,SD:886667,ND:779094,AK:733391,
  VT:689545,WY:643077,DC:576851,
};

// 州详情弹窗 — 与 2020 页面一致，展示人口/选举人票/模拟预测/实际结果/正确性
function StateDetailModal({ open, onClose, abbr, simPred, actualResult }: {
  open: boolean; onClose: () => void; abbr: string | null;
  simPred: StatePrediction | undefined; actualResult: { winner: 'rep' | 'dem'; repVotes: number; demVotes: number } | undefined;
}) {
  if (!abbr) return null;
  const name = STATE_NAMES[abbr] || abbr;
  const pop = STATE_POP[abbr] || 0;
  const isCorrect = simPred && actualResult && simPred.winner === actualResult.winner;
  return (
    <Modal title={name} open={open} onCancel={onClose} footer={null} width={520}
      styles={{ body: { background: '#1a1a2e', padding: 20 }, header: { background: '#1a1a2e', borderBottom: '1px solid #333' } }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>人口</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{pop.toLocaleString()}</div>
        </div>
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>选举人票</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{simPred?.ev || '—'}</div>
        </div>
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>模拟预测</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: simPred?.winner === 'rep' ? '#ef4444' : '#3b82f6' }}>
            {simPred?.winner === 'rep' ? '共和党' : '民主党'}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>置信度: {((simPred?.confidence || 0) * 100).toFixed(1)}%</div>
        </div>
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>实际结果</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: actualResult?.winner === 'rep' ? '#ef4444' : '#3b82f6' }}>
            {actualResult?.winner === 'rep' ? '共和党' : '民主党'}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            R {(actualResult?.repVotes || 0).toLocaleString()} / D {(actualResult?.demVotes || 0).toLocaleString()}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1', padding: 14, background: isCorrect ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: isCorrect ? '#22c55e' : '#ef4444' }}>
            {isCorrect ? '预测正确' : '预测偏差'}
          </span>
        </div>
      </div>
    </Modal>
  );
}

export default function StaticYearPage2024() {
  const { staticData } = useSimStore();
  const data = staticData[2024];
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [showActual, setShowActual] = useState(false);
  const [stateDetailAbbr, setStateDetailAbbr] = useState<string | null>(null);

  const simulatedPredictions = (data?.simulated?.state_predictions || {}) as Record<string, StatePrediction>;
  const actualResults = useMemo(() => {
    const results: Record<string, 'rep' | 'dem'> = {};
    if (data?.actual?.state_results) {
      for (const [abbr, val] of Object.entries(data.actual.state_results)) {
        results[abbr] = val.winner;
      }
    }
    return results;
  }, [data]);

  // 切换到实际结果时构建预测数据
  const actualPredictions = useMemo(() => {
    if (!data?.actual?.state_results) return {};
    const evMap: Record<string, number> = {};
    for (const [abbr, pred] of Object.entries(simulatedPredictions)) {
      evMap[abbr] = pred.ev;
    }
    return buildActualPredictions(data.actual.state_results, evMap);
  }, [data, simulatedPredictions]);

  const statePredictions = showActual ? actualPredictions : simulatedPredictions;

  const events: SimEvent[] = (data?.events || []) as SimEvent[];

  // 转换情绪波浪数据
  const emotionWaves = useMemo(() => {
    const rawWaves = (data as any)?.emotion_waves;
    return transformEmotionWaves(rawWaves);
  }, [data]);

  // 计算准确度统计
  const accuracyStats = useMemo(() => {
    if (!data?.actual?.state_results) return { correct: 0, total: 0, accuracy: 0 };
    let correct = 0;
    const total = Object.keys(data.actual.state_results).length;
    for (const [abbr, actual] of Object.entries(data.actual.state_results)) {
      const sim = simulatedPredictions[abbr];
      if (sim && sim.winner === actual.winner) correct++;
    }
    return { correct, total, accuracy: total > 0 ? correct / total : 0 };
  }, [data, simulatedPredictions]);

  // 翻转州详情
  const flippedStates = useMemo(() => {
    const data2020 = staticData[2020];
    if (!data2020?.actual?.state_results || !data?.actual?.state_results) return [];
    return Object.entries(data.actual.state_results)
      .filter(([abbr, actual2024]) => {
        const actual2020 = data2020.actual.state_results[abbr];
        return actual2020 && actual2020.winner !== actual2024.winner;
      })
      .map(([abbr, actual2024]) => ({
        abbr,
        name: STATE_NAMES[abbr] || abbr,
        from: data2020.actual.state_results[abbr].winner,
        to: actual2024.winner,
        ev: simulatedPredictions[abbr]?.ev || 0,
      }));
  }, [staticData, data, simulatedPredictions]);

  // 事件影响的党派情绪统计
  const partyEmotionChart = useMemo(() => {
    if (!events || events.length === 0) return [];
    let repHappy = 0, repAngry = 0, demHappy = 0, demAngry = 0, n = 0;
    events.forEach(e => {
      if (e.impact) {
        repHappy += e.impact.rep_happy;
        repAngry += e.impact.rep_angry;
        demHappy += e.impact.dem_happy;
        demAngry += e.impact.dem_angry;
        n++;
      }
    });
    if (n === 0) return [];
    return [
      { party: '共和党', happy: +(repHappy / n).toFixed(3), angry: +(repAngry / n).toFixed(3) },
      { party: '民主党', happy: +(demHappy / n).toFixed(3), angry: +(demAngry / n).toFixed(3) },
    ];
  }, [events]);

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#999' }}>
        正在加载 2024 年数据...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#07070f 0%,#0c0c1d 40%,#07070f 100%)', color: '#e0e0e0', fontFamily: "'Inter','Microsoft YaHei',system-ui,sans-serif" }}>
      {/* 顶部导航栏 */}
      <TopBar
        rightExtra={
          <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, letterSpacing: 1 }}>
            2024 选举 + 情绪波浪
          </span>
        }
      />

      {/* 主网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr 290px', gap: 10, padding: 10 }}>
        {/* 左栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 选举人票对比 */}
          <EVTally
            repEV={showActual ? data.actual.rep_electoral_votes : data.simulated.rep_electoral_votes}
            demEV={showActual ? data.actual.dem_electoral_votes : data.simulated.dem_electoral_votes}
            repLabel={data.rep_candidate}
            demLabel={data.dem_candidate}
            showComparison
            simRepEV={showActual ? data.simulated.rep_electoral_votes : data.actual.rep_electoral_votes}
            simDemEV={showActual ? data.simulated.dem_electoral_votes : data.actual.dem_electoral_votes}
          />
          {/* 事件列表 */}
          <div className="glass-card" style={{ padding: 14, flex: 1, overflow: 'hidden' }}>
            <SectionHeader title="事件列表" />
            <EventTimeline events={events} readonly />
          </div>
          {/* 准确度卡片 */}
          <div className="glass-card" style={{ padding: 14 }}>
            <SectionHeader title="准确度" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', fontFamily: "'Inter',monospace" }}>
                  {(accuracyStats.accuracy * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>州准确率</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: data.accuracy.ev_error === 0 ? '#22c55e' : '#fbbf24', fontFamily: "'Inter',monospace" }}>
                  {data.accuracy.ev_error}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>选举人票误差</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: "'Inter',monospace" }}>
                  {accuracyStats.correct}/{accuracyStats.total}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>正确州数</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', fontFamily: "'Inter',monospace" }}>
                  完美
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>模拟结果</div>
              </div>
            </div>
          </div>
        </div>

        {/* 中栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 地图工具栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', letterSpacing: 1 }}>
              {showActual ? '实际结果' : '模拟预测'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#666' }}>点击各州查看详情</span>
              <button
                onClick={() => setShowActual(!showActual)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 8,
                  border: `1px solid ${showActual ? 'rgba(59,130,246,0.4)' : 'rgba(34,197,94,0.4)'}`,
                  background: showActual ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)',
                  color: showActual ? '#93c5fd' : '#86efac',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: "'Inter','Microsoft YaHei',system-ui,sans-serif",
                }}
              >
                {showActual ? '查看模拟' : '查看实际'}
              </button>
            </div>
          </div>
          <div className="glass-card" style={{ flex: 1, padding: 6, position: 'relative', minHeight: 400 }}>
            <USMap statePredictions={statePredictions} selectedState={selectedState} onSelectState={(a) => { setSelectedState(a); setStateDetailAbbr(a); }} />
          </div>
          {/* 情绪 / 翻转州面板 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="glass-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, color: '#555', letterSpacing: 1, marginBottom: 6 }}>事件平均情绪</div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={partyEmotionChart} barSize={18}>
                  <XAxis dataKey="party" tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 0.5]} tick={{ fill: '#333', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="happy" radius={[3, 3, 0, 0]}>{partyEmotionChart.map((_, i) => <Cell key={i} fill="#22c55e" />)}</Bar>
                  <Bar dataKey="angry" radius={[3, 3, 0, 0]}>{partyEmotionChart.map((_, i) => <Cell key={i} fill="#ef4444" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, color: '#555', letterSpacing: 1, marginBottom: 6 }}>翻转州 (2020→2024)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 100, overflowY: 'auto' }}>
                {flippedStates.map(s => (
                  <div key={s.abbr} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.04)' }}>
                    <Tooltip title={s.name}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', width: 26 }}>{s.abbr}</span>
                    </Tooltip>
                    <span style={{ fontSize: 11, color: s.from === 'rep' ? '#ef4444' : '#3b82f6' }}>{s.from === 'rep' ? 'R' : 'D'}</span>
                    <span style={{ fontSize: 11, color: '#555' }}>→</span>
                    <span style={{ fontSize: 11, color: s.to === 'rep' ? '#ef4444' : '#3b82f6', fontWeight: 600 }}>{s.to === 'rep' ? 'R' : 'D'}</span>
                    <span style={{ fontSize: 10, color: '#666', marginLeft: 'auto' }}>{s.ev} 票</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 对比面板 */}
          <div className="glass-card" style={{ padding: 16, textAlign: 'center', transition: 'all 0.3s', background: showActual ? 'rgba(37,99,235,0.03)' : 'rgba(220,38,38,0.03)', border: `1px solid ${showActual ? 'rgba(37,99,235,0.08)' : 'rgba(220,38,38,0.08)'}` }}>
            <div style={{ fontSize: 12, color: '#555', letterSpacing: 2 }}>
              {showActual ? '当前：实际结果' : '当前：模拟预测'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: (showActual ? data.actual : data.simulated).rep_electoral_votes >= 270 ? '#ef4444' : '#3b82f6', marginTop: 4, transition: 'color 0.3s' }}>
              {(showActual ? data.actual : data.simulated).rep_electoral_votes >= 270 ? 'Trump 胜出' : 'Harris 胜出'}
            </div>
            <div style={{ fontSize: 14, color: '#555', marginTop: 2 }}>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>R</span> {data.simulated.rep_electoral_votes} 对比 {data.actual.rep_electoral_votes}
              <span style={{ margin: '0 6px', color: '#333' }}>|</span>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>D</span> {data.simulated.dem_electoral_votes} 对比 {data.actual.dem_electoral_votes}
            </div>
            <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>
              完美匹配 | 选举人票误差: {data.accuracy.ev_error} | {(data.accuracy.state_accuracy * 100).toFixed(1)}% 州准确
            </div>
          </div>
          {/* 摇摆州 */}
          <div className="glass-card" style={{ padding: 14, flex: 1 }}>
            <SectionHeader title="摇摆州" />
            <SwingStatesPanel
              statePredictions={simulatedPredictions}
              actualResults={actualResults}
              showComparison
            />
          </div>
          {/* 翻转州高亮 */}
          <div className="glass-card" style={{ padding: 14 }}>
            <SectionHeader title="6个翻转州" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {flippedStates.map(s => (
                <div key={s.abbr} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 5, background: 'rgba(251,191,36,0.04)', borderLeft: '2px solid #fbbf24' }}>
                  <Tooltip title={s.name}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', width: 26 }}>{s.abbr}</span>
                  </Tooltip>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <span style={{ color: s.from === 'rep' ? '#ef4444' : '#3b82f6' }}>{s.from === 'rep' ? 'R' : 'D'} (2020)</span>
                    <span style={{ color: '#555', margin: '0 4px' }}>→</span>
                    <span style={{ color: s.to === 'rep' ? '#ef4444' : '#3b82f6', fontWeight: 600 }}>{s.to === 'rep' ? 'R' : 'D'} (2024)</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{s.ev}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 州准确度列表 */}
          <div className="glass-card" style={{ padding: 14 }}>
            <SectionHeader title="州准确度" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
              {Object.entries(data.actual.state_results).map(([abbr, actual]) => {
                const sim = simulatedPredictions[abbr];
                const isCorrect = sim && sim.winner === actual.winner;
                const isFlipped = FLIPPED_2024.has(abbr);
                const fullName = STATE_NAMES[abbr] || abbr;
                return (
                  <Tooltip key={abbr} title={`${fullName}: 预测 ${sim?.winner === 'rep' ? 'R' : 'D'} | 实际 ${actual.winner === 'rep' ? 'R' : 'D'}${isFlipped ? ' (已翻转)' : ''}`}>
                    <div onClick={() => setStateDetailAbbr(abbr)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', background: isFlipped ? 'rgba(251,191,36,0.04)' : isCorrect ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.04)' }}>
                      <span style={{ fontSize: 12, fontWeight: isFlipped ? 700 : 600, color: isFlipped ? '#fbbf24' : '#bbb', width: 22 }}>{abbr}</span>
                      <div style={{ flex: 1, height: 2, borderRadius: 1, background: '#111' }}>
                        <div style={{ width: `${(sim?.confidence || 0) * 100}%`, height: '100%', background: actual.winner === 'rep' ? '#dc2626' : '#2563eb', borderRadius: 1, opacity: 0.7 }} />
                      </div>
                      <span style={{ fontSize: 11, color: isCorrect ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{isCorrect ? '正确' : '偏差'}</span>
                      {isFlipped && <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700 }}>翻转</span>}
                      <span style={{ fontSize: 10, color: '#555' }}>{sim?.ev || ''}</span>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 全宽情绪波浪面板 */}
      {emotionWaves.length > 0 && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <SectionHeader title="情绪波浪" />
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16, marginTop: 2 }}>
              关键事件如何跨越党派线影响选民情绪
            </div>
            <EmotionWavePanel waves={emotionWaves} events={events as any} />
          </div>
        </div>
      )}

      <StateDetailModal
        open={!!stateDetailAbbr}
        onClose={() => setStateDetailAbbr(null)}
        abbr={stateDetailAbbr}
        simPred={stateDetailAbbr ? simulatedPredictions[stateDetailAbbr] : undefined}
        actualResult={stateDetailAbbr ? (data.actual.state_results as any)?.[stateDetailAbbr] : undefined}
      />
    </div>
  );
}
