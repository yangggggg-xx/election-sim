import topology from './us-map.json';
import { geoAlbersUsa, geoPath, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import { Tooltip } from 'antd';
import type { StatePrediction } from '../../types';
import { STATE_NAMES } from '../../types';

const FIPS_TO_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY',
};

const geoData = feature(topology as any, topology.objects.states as any) as unknown as { features: any[] };

interface USMapProps {
  statePredictions: Record<string, StatePrediction>;
  selectedState: string | null;
  onSelectState: (abbr: string) => void;
}

export default function USMap({ statePredictions, selectedState, onSelectState }: USMapProps) {

  const projection = geoAlbersUsa().scale(1100).translate([480, 280]);
  const pathGen = geoPath().projection(projection);

  const getColor = (fips: string) => {
    const abbr = FIPS_TO_ABBR[fips]; if (!abbr) return '#1a1a2e';
    const pred = statePredictions[abbr]; if (!pred) return '#1e1e30';
    if (pred.confidence < 0.03) return '#7c3aed';
    const a = 0.4 + Math.min(pred.confidence * 4, 0.6);
    return pred.winner === 'rep' ? `rgba(220,38,38,${a})` : `rgba(37,99,235,${a})`;
  };


  const labels = geoData.features.map((f: any) => {
    const fips = String(f.id).padStart(2, '0'); const abbr = FIPS_TO_ABBR[fips]; if (!abbr) return null;
    const c = geoCentroid(f); const p = projection(c); if (!p) return null;
    return { abbr, x: p[0], y: p[1] };
  }).filter(Boolean);
  const smallStates = new Set(['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']);

  return (
    <svg viewBox="0 0 960 600" style={{ width: '100%', height: '100%' }}>
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#070710" /><stop offset="100%" stopColor="#0c0c1d" /></linearGradient>
      </defs>
      <rect width="960" height="600" fill="url(#bgG)" rx="12" />
      {geoData.features.map((f: any) => {
        const fips = String(f.id).padStart(2, '0'); const abbr = FIPS_TO_ABBR[fips];
        const isSel = selectedState === abbr; const d = pathGen(f); if (!d) return null;
        const pred = statePredictions[abbr];
        const fullName = abbr ? STATE_NAMES[abbr] : '';
        const tipText = fullName ? `${fullName}: ${pred?.winner === 'rep' ? '共和党' : '民主党'} (${pred?.ev || '?'}票)` : '';
        return (
          <Tooltip key={fips} title={tipText}>
            <path d={d} fill={getColor(fips)} stroke={isSel ? '#fbbf24' : '#1a1a2e'} strokeWidth={isSel ? 2.5 : 0.6}
              filter={isSel ? 'url(#glow)' : undefined} onClick={() => abbr && onSelectState(abbr)}
              style={{ cursor: 'pointer', transition: 'all 0.3s' }}
              onMouseEnter={e => { (e.target as SVGPathElement).style.filter = 'brightness(1.3)' }}
              onMouseLeave={e => { (e.target as SVGPathElement).style.filter = isSel ? 'url(#glow)' : '' }} />
          </Tooltip>
        );
      })}
      {labels.map((l: any) => !smallStates.has(l.abbr) && (
        <text key={l.abbr} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.7)" fontSize={['CA', 'TX', 'FL', 'NY'].includes(l.abbr) ? 11 : 8}
          fontWeight={600} fontFamily="Inter,system-ui,sans-serif" style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{l.abbr}</text>
      ))}
      {/* Small states legend — bottom-right */}
      <rect x="788" y="488" width="164" height="108" rx="8" fill="rgba(10,10,20,0.92)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <text x="798" y="505" fill="#666" fontSize="11" fontFamily="Inter" fontWeight="600">东北部</text>
      {['ME', 'VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'].map((abbr, i) => {
        const pred = statePredictions[abbr];
        return <g key={abbr}><circle cx="808" cy={518 + i * 10} r="3" fill={pred?.winner === 'rep' ? 'rgba(220,38,38,0.8)' : 'rgba(37,99,235,0.8)'} />
          <text x="816" y={518 + i * 10} dominantBaseline="central" fill="#bbb" fontSize="11" fontFamily="Inter">{abbr}</text>
          <text x="944" y={518 + i * 10} dominantBaseline="central" fill="#555" fontSize="11" textAnchor="end" fontFamily="Inter">{pred?.ev || ''}</text></g>;
      })}
    </svg>
  );
}
