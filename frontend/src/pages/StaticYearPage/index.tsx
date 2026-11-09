import { useMemo, useState } from 'react';
import { Tooltip, Modal, Progress } from 'antd';
import { ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useSimStore } from '../../store';
import USMap from '../../components/USMap';
import EVTally from '../../components/EVTally';
import EventTimeline from '../../components/EventTimeline';
import YearSelector from '../../components/YearSelector';
import TopBar from '../../components/TopBar';
import SectionHeader from '../../components/SectionHeader';
import type { StatePrediction, SimEvent } from '../../types';
import { STATE_NAMES } from '../../types';

const PARTY_REGISTRATION = [
  { name: '民主党', value: 45690825, pct: 40.60, color: '#2563eb' },
  { name: '共和党', value: 33052332, pct: 29.37, color: '#dc2626' },
  { name: '独立选民', value: 31200104, pct: 27.72, color: '#7c3aed' },
  { name: '自由党', value: 497535, pct: 0.44, color: '#fbbf24' },
  { name: '绿党', value: 256560, pct: 0.23, color: '#22c55e' },
  { name: '其他', value: 1755329, pct: 1.58, color: '#666' },
];

const RACE_DATA = [
  { name: '白人', value: 53, color: '#e0e0e0' },
  { name: '拉丁裔', value: 18, color: '#f59e0b' },
  { name: '非裔', value: 13, color: '#8b5cf6' },
  { name: '混血/其他', value: 10, color: '#6b7280' },
  { name: '亚裔', value: 5, color: '#ec4899' },
  { name: '原住民', value: 1, color: '#14b8a6' },
];

const OCCUPATION_DATA = [
  { name: '学生', value: 229320000, pct: 22 },
  { name: '自由职业', value: 184548000, pct: 18 },
  { name: '工人', value: 181272000, pct: 18 },
  { name: '其他', value: 161616000, pct: 16 },
  { name: '企业职员', value: 120120000, pct: 12 },
  { name: '农业', value: 87360000, pct: 9 },
  { name: '服务业', value: 68796000, pct: 7 },
  { name: '失业/政府', value: 58968000, pct: 6 },
];

const METHODOLOGY_STEPS = [
  { icon: '👥', title: '群代理生成', desc: '基于真实人口普查数据，为51个州各生成3组群代理（共和党/民主党/独立选民），共153个代理。每个代理携带人口、党派归属和群体性格特征（易感型/普通型/冷静型）。' },
  { icon: '📰', title: '事件驱动模拟', desc: '将2020年关键事件（新冠疫情、乔治·弗洛伊德抗议、总统辩论）按时间顺序输入所有代理。每个事件携带对各党派群体的情绪冲击参数（喜悦/悲伤/愤怒/积极）。' },
  { icon: '🧠', title: '情绪-态度更新', desc: '代理根据事件冲击更新情绪状态，情绪变化驱动态度偏移。应用四项精细调节因子：人口权重、情绪衰减、遗忘概率和性格特征开关。' },
  { icon: '🗳️', title: '选举预测', desc: '以2020年实际结果为基线，将模拟态度偏移叠加至各州，预测每个州的胜方。支持逐州对比模拟与实际结果，量化模型准确度。' },
];

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

function MethodologyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="模拟方法论" open={open} onCancel={onClose} footer={null} width={720}
      styles={{ body: { background: '#1a1a2e', padding: 24 }, header: { background: '#1a1a2e', borderBottom: '1px solid #333' } }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {METHODOLOGY_STEPS.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 28, width: 44, textAlign: 'center', flexShrink: 0 }}>{step.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                <span style={{ color: '#3b82f6', marginRight: 8 }}>步骤 {i + 1}</span>{step.title}
              </div>
              <div style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: 16, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>可复现性</div>
          <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
            所有模拟结果基于公开的人口普查数据（美国人口普查局）和官方选举结果（联邦选举委员会）。数据来源可追溯，模拟参数可调节，确保结果可复现。
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DemographicsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="社会人口数据" open={open} onCancel={onClose} footer={null} width={780}
      styles={{ body: { background: '#1a1a2e', padding: 24 }, header: { background: '#1a1a2e', borderBottom: '1px solid #333' } }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>党派选民注册</div>
          {PARTY_REGISTRATION.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#ccc', width: 80 }}>{p.name}</span>
              <div style={{ flex: 1, height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${p.pct * 2.4}%`, height: '100%', background: p.color, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, color: '#999', width: 60, textAlign: 'right' }}>{(p.value / 1e6).toFixed(1)}M</span>
              <span style={{ fontSize: 12, color: '#666', width: 45, textAlign: 'right' }}>{p.pct}%</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>种族分布</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={RACE_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}
                stroke="none">
                {RACE_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>职业分布（3.31亿社交媒体用户）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {OCCUPATION_DATA.map(o => (
              <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                <span style={{ fontSize: 13, color: '#ccc', width: 90 }}>{o.name}</span>
                <Progress percent={o.pct} size="small" strokeColor="#3b82f6" showInfo={false} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#888', width: 60, textAlign: 'right' }}>{(o.value / 1e6).toFixed(0)}M</span>
                <span style={{ fontSize: 12, color: '#555', width: 30, textAlign: 'right' }}>{o.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

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

export default function StaticYearPage() {
  const { staticData } = useSimStore();
  const data = staticData[2020];
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [showActual, setShowActual] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [demographicsOpen, setDemographicsOpen] = useState(false);
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

  const mismatchedStates = useMemo(() => {
    if (!data?.actual?.state_results) return [];
    const mm: { abbr: string; predicted: string; actual: string; ev: number }[] = [];
    for (const [abbr, actual] of Object.entries(data.actual.state_results)) {
      const sim = simulatedPredictions[abbr];
      if (sim && sim.winner !== actual.winner) {
        mm.push({ abbr, predicted: sim.winner, actual: actual.winner, ev: sim.ev });
      }
    }
    return mm;
  }, [data, simulatedPredictions]);

  if (!data) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#999' }}>正在加载 2020 年数据...</div>;
  }

  const currentData = showActual ? data.actual : data.simulated;
  const currentWinner = currentData.dem_electoral_votes >= 270 ? 'Biden' : 'Trump';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#07070f 0%,#0c0c1d 40%,#07070f 100%)', color: '#e0e0e0', fontFamily: "'Inter','Microsoft YaHei',system-ui,sans-serif" }}>
      {/* 顶部导航栏 */}
      <TopBar
        subtitle={<span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, letterSpacing: 1 }}>已验证</span>}
      />

      {/* 主网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr 290px', gap: 10, padding: 10, minHeight: 'calc(100vh - 50px)' }}>
        {/* 左栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EVTally
            repEV={showActual ? data.actual.rep_electoral_votes : data.simulated.rep_electoral_votes}
            demEV={showActual ? data.actual.dem_electoral_votes : data.simulated.dem_electoral_votes}
            repLabel={data.rep_candidate}
            demLabel={data.dem_candidate}
            showComparison
            simRepEV={showActual ? data.simulated.rep_electoral_votes : data.actual.rep_electoral_votes}
            simDemEV={showActual ? data.simulated.dem_electoral_votes : data.actual.dem_electoral_votes}
          />
          <div className="glass-card" style={{ padding: 12, flex: 1, overflow: 'hidden' }}>
            <SectionHeader title="关键事件" />
            <EventTimeline events={events} readonly />
          </div>
          <div className="glass-card" style={{ padding: 12 }}>
            <SectionHeader title="准确度" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ textAlign: 'center', padding: 8, background: 'rgba(34,197,94,0.05)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{(accuracyStats.accuracy * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: '#888' }}>州准确率</div>
              </div>
              <div style={{ textAlign: 'center', padding: 8, background: data.accuracy.ev_error === 0 ? 'rgba(34,197,94,0.05)' : 'rgba(251,191,36,0.05)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: data.accuracy.ev_error === 0 ? '#22c55e' : '#fbbf24' }}>{data.accuracy.ev_error}</div>
                <div style={{ fontSize: 11, color: '#888' }}>选举人票误差</div>
              </div>
              <div style={{ textAlign: 'center', padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{accuracyStats.correct}<span style={{ fontSize: 13, color: '#666' }}>/{accuracyStats.total}</span></div>
                <div style={{ fontSize: 11, color: '#888' }}>正确州数</div>
              </div>
              <div style={{ textAlign: 'center', padding: 8, background: mismatchedStates.length === 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: mismatchedStates.length === 0 ? '#22c55e' : '#ef4444' }}>{mismatchedStates.length}</div>
                <div style={{ fontSize: 11, color: '#888' }}>偏差州数</div>
              </div>
            </div>
          </div>
          <div className="glass-card" style={{ padding: 12 }}>
            <SectionHeader title="验证" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setMethodologyOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, color: '#93c5fd', fontSize: 13, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                模拟方法论
              </button>
              <button onClick={() => setDemographicsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 6, color: '#c4b5fd', fontSize: 13, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                社会人口数据
              </button>
            </div>
          </div>
        </div>

        {/* 中栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <div className="glass-card" style={{ flex: 1, padding: 6, position: 'relative', minHeight: 420 }}>
            <USMap
              statePredictions={statePredictions}
              selectedState={selectedState}
              onSelectState={(a) => { setSelectedState(a); setStateDetailAbbr(a); }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="glass-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 6, fontWeight: 600 }}>预测偏差</div>
              {mismatchedStates.length > 0 ? mismatchedStates.map(s => (
                <div key={s.abbr} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.04)', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ccc', width: 70 }}>{STATE_NAMES[s.abbr] || s.abbr}</span>
                  <span style={{ fontSize: 12, color: s.predicted === 'rep' ? '#ef4444' : '#3b82f6' }}>预测: {s.predicted === 'rep' ? 'R' : 'D'}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>→</span>
                  <span style={{ fontSize: 12, color: s.actual === 'rep' ? '#ef4444' : '#3b82f6' }}>实际: {s.actual === 'rep' ? 'R' : 'D'}</span>
                  <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{s.ev} 票</span>
                </div>
              )) : (
                <div style={{ color: '#22c55e', fontSize: 13, textAlign: 'center', padding: 12 }}>全部51州预测正确</div>
              )}
            </div>
            <div className="glass-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 6, fontWeight: 600 }}>人口前10大州</div>
              {Object.entries(STATE_POP).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([abbr, pop]) => {
                const actual = actualResults[abbr];
                return (
                  <div key={abbr} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#bbb', width: 70 }}>{STATE_NAMES[abbr] || abbr}</span>
                    <div style={{ flex: 1, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(pop / 40000000) * 100}%`, height: '100%', background: actual === 'rep' ? '#dc2626' : '#2563eb', borderRadius: 2, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#666' }}>{(pop / 1e6).toFixed(1)}M</span>
                    <span style={{ fontSize: 10, color: actual === 'rep' ? '#ef4444' : '#3b82f6' }}>{actual === 'rep' ? 'R' : 'D'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="glass-card" style={{ padding: 14, textAlign: 'center', transition: 'all 0.3s', background: currentWinner === 'Biden' ? 'rgba(37,99,235,0.03)' : 'rgba(220,38,38,0.03)', border: `1px solid ${currentWinner === 'Biden' ? 'rgba(37,99,235,0.08)' : 'rgba(220,38,38,0.08)'}` }}>
            <div style={{ fontSize: 12, color: '#888', letterSpacing: 2 }}>
              {showActual ? '当前：实际结果' : '当前：模拟预测'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: currentWinner === 'Biden' ? '#3b82f6' : '#ef4444', marginTop: 4, transition: 'color 0.3s' }}>
              {currentWinner} 胜出
            </div>
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 6 }}>
              模拟 <span style={{ color: '#dc2626', fontWeight: 600 }}>R {data.simulated.rep_electoral_votes}</span> vs <span style={{ color: '#2563eb', fontWeight: 600 }}>D {data.simulated.dem_electoral_votes}</span>
            </div>
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>
              实际 <span style={{ color: '#dc2626', fontWeight: 600 }}>R {data.actual.rep_electoral_votes}</span> vs <span style={{ color: '#2563eb', fontWeight: 600 }}>D {data.actual.dem_electoral_votes}</span>
            </div>
            <div style={{ fontSize: 12, color: '#22c55e', marginTop: 6, fontWeight: 600 }}>
              选举人票误差: {data.accuracy.ev_error} 票
            </div>
          </div>

          {/* 摇摆州 */}
          <div className="glass-card" style={{ padding: 12, flex: 1 }}>
            <SectionHeader title="摇摆州" />
            <SwingStatesPanelInline predictions={simulatedPredictions} actualResults={actualResults} />
          </div>

          {/* 逐州对照 */}
          <div className="glass-card" style={{ padding: 12 }}>
            <SectionHeader title="逐州对照" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
              {Object.entries(data.actual.state_results).map(([abbr, actual]) => {
                const sim = simulatedPredictions[abbr];
                const isCorrect = sim && sim.winner === actual.winner;
                return (
                  <Tooltip key={abbr} title={`${STATE_NAMES[abbr] || abbr}: 模拟 ${sim?.winner === 'rep' ? 'R' : 'D'} | 实际 ${actual.winner === 'rep' ? 'R' : 'D'}`}>
                    <div onClick={() => setStateDetailAbbr(abbr)}
                      style={{ padding: '4px 2px', borderRadius: 4, background: isCorrect ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.12)'}`, textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ccc' }}>{abbr}</div>
                      <div style={{ fontSize: 9, color: actual.winner === 'rep' ? '#ef4444' : '#3b82f6' }}>{actual.winner === 'rep' ? 'R' : 'D'}</div>
                      <div style={{ fontSize: 8, color: isCorrect ? '#22c55e' : '#ef4444' }}>{isCorrect ? '✓' : '✗'}</div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* 数据来源 */}
          <div className="glass-card" style={{ padding: 12 }}>
            <SectionHeader title="数据来源" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#888' }}>
              <div>美国人口普查局（3.31亿人口）</div>
              <div>联邦选举委员会（2020选举结果）</div>
              <div>选民注册: 民主 40.6% / 共和 29.4% / 独立 27.7%</div>
              <div>社交媒体用户: 3.31亿</div>
            </div>
          </div>
        </div>
      </div>

      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
      <DemographicsModal open={demographicsOpen} onClose={() => setDemographicsOpen(false)} />
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

/** 内联摇摆州面板 — 放宽阈值至 0.15 */
function SwingStatesPanelInline({ predictions, actualResults }: { predictions: Record<string, StatePrediction>; actualResults: Record<string, 'rep' | 'dem'> }) {
  const swingStates = useMemo(() =>
    Object.entries(predictions)
      .filter(([, p]) => p.confidence < 0.7)
      .map(([abbr, p]) => ({ abbr, name: STATE_NAMES[abbr] || abbr, ...p }))
      .sort((a, b) => Math.abs(a.confidence - 0.5) - Math.abs(b.confidence - 0.5)),
    [predictions]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
      {swingStates.length > 0 ? swingStates.map(s => {
        const actual = actualResults[s.abbr];
        const isCorrect = actual ? s.winner === actual : undefined;
        return (
          <div key={s.abbr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#bbb', width: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            <div style={{ flex: 1, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(1 - s.confidence) * 100}%`, height: '100%', background: s.winner === 'rep' ? '#dc2626' : '#2563eb', borderRadius: 2, opacity: 0.7 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.winner === 'rep' ? '#ef4444' : '#3b82f6' }}>{s.winner === 'rep' ? 'R' : 'D'}</span>
            {isCorrect !== undefined && (
              <span style={{ fontSize: 11, fontWeight: 600, color: isCorrect ? '#22c55e' : '#ef4444' }}>{isCorrect ? '✓' : '✗'}</span>
            )}
            <span style={{ fontSize: 10, color: '#555' }}>{s.ev}</span>
          </div>
        );
      }) : <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>未检测到摇摆州</div>}
    </div>
  );
}
