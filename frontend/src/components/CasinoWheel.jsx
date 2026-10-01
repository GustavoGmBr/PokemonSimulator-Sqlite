const point = (radius, angle) => [200 + radius * Math.sin(angle * Math.PI / 180), 200 - radius * Math.cos(angle * Math.PI / 180)];
export function segmentAngles(segments) {
  const total = segments.reduce((sum,s) => sum + s.weight,0); let cursor=0;
  return segments.map(segment => { const start=cursor; cursor += segment.weight / total * 360; return { ...segment, start, end:cursor, center:(start + cursor) / 2 }; });
}
export function winningRotation(previous, center) { return previous + 360 * 5 + ((360 - center - previous % 360 + 360) % 360); }
export function CasinoWheel({ segments, rotation, fortune=false, busy=false }) {
  const slices=segmentAngles(segments);
  return <div className={`casino-wheel-wrap ${fortune ? 'fortune-wheel-wrap' : ''} ${busy ? 'wheel-moving' : ''}`}><svg viewBox="0 0 400 400" className="casino-wheel" role="img" aria-label={fortune ? 'Roda da fortuna com setores proporcionais às chances' : 'Roleta europeia circular com 37 casas'}>
    <defs><radialGradient id={fortune ? 'fortune-rim' : 'roulette-rim'}><stop stopColor="#ddbf78" /><stop offset=".8" stopColor="#806038" /><stop offset="1" stopColor="#d4b879" /></radialGradient></defs>
    <circle cx="200" cy="200" r="195" fill={`url(#${fortune ? 'fortune-rim' : 'roulette-rim'})`} /><circle cx="200" cy="200" r="187" fill="#161c1b" />
    <g className="wheel-disk" style={{ transform:`rotate(${rotation}deg)` }}>{slices.map((slice,index) => {
      const a=point(182,slice.start),b=point(182,slice.end);
      return <g key={index} data-pocket={slice.label}><path d={`M 200 200 L ${a.join(' ')} A 182 182 0 ${slice.end-slice.start > 180 ? 1 : 0} 1 ${b.join(' ')} Z`} fill={slice.color} stroke="#e7dbaa" strokeWidth={fortune ? 1.3 : .8} /><text x="200" y={fortune ? 45 : 42} textAnchor="middle" transform={`rotate(${slice.center} 200 200)`} fill="white" fontSize={fortune && slice.weight <= 6 ? 11 : 15} fontWeight="800">{slice.label}</text></g>;
    })}<circle cx="200" cy="200" r={fortune ? 68 : 118} fill="#203b2d" stroke="#d4b879" strokeWidth="5" />{!fortune && <circle cx="200" cy="200" r="100" fill="none" stroke="#846e40" strokeWidth="1" />}</g>
    <circle cx="200" cy="200" r={fortune ? 48 : 48} fill="#1b2922" stroke="#d4b879" strokeWidth="3" /><text x="200" y="196" textAnchor="middle" fill="#eadca9" fontSize="11" fontWeight="700">{fortune ? 'FORTUNE' : 'POKÉCASSINO'}</text><text x="200" y="217" textAnchor="middle" fill="#e6d397" fontSize="17">✦</text>
    <path d="M 187 6 L 213 6 L 200 32 Z" fill="#f4e5a8" stroke="#4b3827" strokeWidth="2" />
  </svg>{fortune && <div className="fortune-stand" />}</div>;
}
