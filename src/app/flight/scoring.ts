import type { FlightAnalysis, FlightScore, ScoreMetric, ScoringPolicy } from './types';

const METRICS: ScoreMetric[] = ['lateralBalance', 'pitchRestoring', 'equilibrium', 'structural'];

/** An explained product-policy score, never a flight probability or safety rating. */
export function scoreFlight(result: FlightAnalysis, policy: ScoringPolicy): FlightScore {
  if (!policy || typeof policy.name !== 'string' || !policy.name.trim() || !policy.weights) throw new Error('Supply a named scoring policy.');
  const entries = Object.entries(policy.weights);
  if (!entries.length || entries.some(([key, weight]) => !METRICS.includes(key as ScoreMetric) || !Number.isFinite(weight) || weight! <= 0)) {
    throw new Error('Specify positive finite weights for known metrics; omit unused categories.');
  }
  const totalWeight = entries.reduce((n, [, w]) => n + w!, 0);
  if (!Number.isFinite(totalWeight)) throw new Error('Scoring weights overflow.');
  const usable = result.status !== 'invalid' && result.status !== 'unsupported';
  // All flight categories refer to the same candidate, never different favorable roots.
  const trim = result.trims.find(t => t.equilibrium && t.pitchStability === 'restoring') ??
    result.trims.find(t => t.equilibrium) ?? result.trims[0];
  const values: Record<ScoreMetric, { score: number | null; explanation: string }> = {
    lateralBalance: {
      score: usable && result.mass && result.geometry ? 100 * Math.max(0, 1 - Math.abs(result.mass.centerM.x) / (result.geometry.spanM / 2)) : null,
      explanation: 'Linear policy: 100 at the body x=0 centerline, 0 at half-span offset. Mass balance only, not geometric symmetry or roll stability.',
    },
    pitchRestoring: {
      score: result.status === 'estimated' ? (trim?.pitchStability === 'restoring' ? 100 : 0) : null,
      explanation: trim ? `Selected pitch trim is ${trim.pitchStability}; policy awards 100 only for a restoring slope.` : 'No interior pitch trim found in the sampled range; not proof that none exists outside it.',
    },
    equilibrium: {
      score: result.status === 'estimated' ? (trim?.equilibrium ? 100 : 0) : null,
      explanation: 'Binary policy: force and all moment residuals within tolerance, above the anchor, and below any supplied breaking load. Not a safety factor.',
    },
    structural: { score: null, explanation: result.structural.reason },
  };
  const categories = entries.map(([metric]) => ({ metric: metric as ScoreMetric, ...values[metric as ScoreMetric] }));
  const available = result.status === 'estimated' && categories.every(c => c.score !== null);
  return {
    status: available ? 'provisional' : 'unavailable', policy: policy.name, categories,
    overall: available ? categories.reduce((n, c) => n + c.score! * (policy.weights[c.metric]! / totalWeight), 0) : null,
    explanation: available
      ? 'Provisional score for only the named metrics and assumptions. Weights and thresholds are uncalibrated product policy, not probability of flight or structural safety.'
      : 'Overall score withheld: input or a requested category is unavailable. Missing categories are never silently removed.',
  };
}
