import { IV_STATS, normalizeIvs, ivQuality } from '../lib/ivs';

export function IvStars({ ivs, showPerfectMarker = false, emphasizeZero = false, hideZero = false }) {
  const quality = ivQuality(ivs);
  if (hideZero && quality.stars === 0) return null;
  return <span className={`iv-stars ${quality.stars === 4 ? 'iv-perfect' : ''} ${emphasizeZero && quality.stars === 0 ? 'iv-zero-emphasis' : ''}`} aria-label={`Qualidade IV: ${quality.stars} estrelas`}>{quality.stars === 0 ? '0☆' : '⭐'.repeat(quality.stars)}{showPerfectMarker && quality.stars === 4 ? ' 🔴' : ''}</span>;
}

export function IvSummary({ ivs }) {
  const values = normalizeIvs(ivs);
  const quality = ivQuality(ivs);
  return <div className="iv-summary">
    <strong>IVs individuais</strong>
    <div className="iv-grid">{Object.entries(IV_STATS).map(([stat, label]) => <span key={stat}>{label}: <b>{values[stat]} | 31</b></span>)}</div>
    <div className="iv-total"><span>Total: <b>{quality.total} | 186</b></span><b>{quality.percentage.toFixed(1).replace('.', ',')}%</b><IvStars ivs={ivs} showPerfectMarker /></div>
    <small>{quality.label} · {quality.stars === 4 ? '31 em todos os atributos' : 'Cada atributo pode chegar a 31 IVs'}</small>
    {quality.valueMultiplier > 1 && <small className="iv-value-bonus">Valor do Pokémon: +{(quality.valueMultiplier - 1) * 100}%</small>}
  </div>;
}
