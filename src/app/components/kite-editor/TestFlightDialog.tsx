import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Calculator, Plane, Ruler, Weight, Wind } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import {
  calculateTestFlight, EMPTY_FLIGHT_SETTINGS, isFlightRunStale, prepareFlightOptions,
  TEST_FLIGHT_SCORE_POLICY, type FlightSettings, type TestFlightRun,
} from './flightSettings';
import type { useEditorState } from './useEditorState';

type Context = Pick<ReturnType<typeof useEditorState>, 'snapshotFlight' | 'historyTick' | 'kiteType'>;

function Field({ id, label, unit, value, placeholder, error, onChange }: {
  id: keyof FlightSettings; label: string; unit: string; value: string; placeholder?: string; error?: string;
  onChange: (key: keyof FlightSettings, value: string) => void;
}) {
  return <label className="flight-field" htmlFor={`flight-${id}`}>
    <span>{label}</span>
    <div className="flight-input-wrap">
      <Input id={`flight-${id}`} inputMode="decimal" value={value} placeholder={placeholder}
        aria-invalid={!!error} aria-describedby={error ? `flight-${id}-error` : undefined}
        onChange={event => onChange(id, event.target.value)} />
      <span>{unit}</span>
    </div>
    {error && <small id={`flight-${id}-error`} className="flight-error">{error}</small>}
  </label>;
}

const format = (value: number, digits = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Math.abs(value) < 1e-9 ? 0 : value);

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="flight-metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

export function TestFlightDialog({ context }: { context: Context }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<FlightSettings>(EMPTY_FLIGHT_SETTINGS);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [run, setRun] = useState<TestFlightRun | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prepared = useMemo(() => prepareFlightOptions(settings), [settings]);
  const stale = isFlightRunStale(run, context.historyTick, settingsVersion);

  const update = (key: keyof FlightSettings, next: string | boolean) => {
    setSettings(current => ({ ...current, [key]: next }));
    setSettingsVersion(version => version + 1);
    setRun(null);
  };

  const calculate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCalculating(true);
    setRun(null);
    const designVersion = context.historyTick;
    const currentSettingsVersion = settingsVersion;
    timerRef.current = setTimeout(() => {
      setRun(calculateTestFlight(context.snapshotFlight, settings, designVersion, currentSettingsVersion));
      setCalculating(false);
    }, 0);
  }, [context.historyTick, context.snapshotFlight, settings, settingsVersion]);

  useEffect(() => {
    if (open) calculate();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open]);

  useEffect(() => {
    if (open && run && run.designVersion !== context.historyTick) setRun(null);
  }, [context.historyTick, open, run]);

  const analysis = !stale ? run?.analysis : null;
  const snapshot = !stale ? run?.snapshot : null;
  const trim = analysis?.trims.find(item => item.equilibrium && item.pitchStability === 'restoring') ??
    analysis?.trims.find(item => item.equilibrium) ?? analysis?.trims[0];
  const errors = run?.phase === 'invalid' ? run.errors : prepared.errors;
  const hasErrors = Object.keys(prepared.errors).length > 0;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button className="kite-flight-trigger" aria-label="Open Test Flight settings">
        <Plane size={18} /><span>Test Flight</span>
      </button>
    </DialogTrigger>
    <DialogContent className="kite-flight-dialog">
      <DialogHeader className="flight-dialog-header">
        <DialogTitle>Test Flight</DialogTitle>
        <DialogDescription>
          Estimate the current {context.kiteType} design from its latest geometry. This is a provisional static model, not a flight guarantee.
        </DialogDescription>
      </DialogHeader>

      <div className="flight-dialog-body">
        <section className="flight-settings" aria-labelledby="flight-settings-heading">
          <div className="flight-section-heading"><Ruler size={18} /><h3 id="flight-settings-heading">Design and materials</h3></div>
          <p className="flight-help">Blank values remain unknown. Placeholder examples are assumptions, not saved values.</p>
          <div className="flight-form-grid">
            <Field id="scaleMmPerUnit" label="Editor scale" unit="mm / unit" value={settings.scaleMmPerUnit} placeholder="100" error={errors.scaleMmPerUnit} onChange={update} />
            <Field id="paperGsm" label="Paper grammage" unit="g/m²" value={settings.paperGsm} placeholder="80" error={errors.paperGsm} onChange={update} />
            <Field id="spineMassG" label="Spine mass" unit="g" value={settings.spineMassG} placeholder="Weigh stick" error={errors.spineMassG} onChange={update} />
            <Field id="crossMassG" label="Cross-stick mass" unit="g" value={settings.crossMassG} placeholder="Weigh stick" error={errors.crossMassG} onChange={update} />
          </div>
          <label className="flight-check">
            <Checkbox checked={settings.scaleConfirmed} onCheckedChange={checked => update('scaleConfirmed', checked === true)} aria-describedby="flight-scale-note" />
            <span><strong>Use this scale for the current design</strong><small id="flight-scale-note">Confirm it from your design or print specification. The nominal 100 mm/unit is not verified manufacturing evidence.</small></span>
          </label>
          {errors.scaleConfirmed && <p className="flight-error">{errors.scaleConfirmed}</p>}

          <div className="flight-section-heading"><Weight size={18} /><h3>Bridle position</h3></div>
          <p className="flight-help">Body coordinates: x right, y toward the nose, z normal to the sail.</p>
          <div className="flight-form-grid flight-three">
            <Field id="bridleXcm" label="X" unit="cm" value={settings.bridleXcm} error={errors.bridle} onChange={update} />
            <Field id="bridleYcm" label="Y" unit="cm" value={settings.bridleYcm} error={errors.bridle} onChange={update} />
            <Field id="bridleZcm" label="Z" unit="cm" value={settings.bridleZcm} error={errors.bridle} onChange={update} />
          </div>

          <div className="flight-section-heading"><Wind size={18} /><h3>Conditions and line</h3></div>
          <div className="flight-form-grid">
            <Field id="windSpeedMps" label="Wind speed" unit="m/s" value={settings.windSpeedMps} placeholder="5" error={errors.wind} onChange={update} />
            <Field id="airDensityKgM3" label="Air density" unit="kg/m³" value={settings.airDensityKgM3} placeholder="1.225" error={errors.wind} onChange={update} />
            <Field id="lineElevationDeg" label="Line elevation (optional)" unit="°" value={settings.lineElevationDeg} error={errors.lineElevationDeg} onChange={update} />
            <Field id="lineBreakingLoadN" label="Breaking load (optional)" unit="N" value={settings.lineBreakingLoadN} error={errors.lineBreakingLoadN} onChange={update} />
          </div>
          <label className="flight-check">
            <Checkbox checked={settings.masslessLineConsent} onCheckedChange={checked => update('masslessLineConsent', checked === true)} />
            <span><strong>Use a massless, perfectly straight line approximation</strong><small>Line weight, sag and drag are excluded. Breaking load is demand comparison only, never a safety rating.</small></span>
          </label>
          {errors.masslessLineConsent && <p className="flight-error">{errors.masslessLineConsent}</p>}
        </section>

        <section className="flight-results" aria-labelledby="flight-results-heading" aria-live="polite" aria-busy={calculating}>
          <div className="flight-results-top">
            <div className="flight-section-heading"><Calculator size={18} /><h3 id="flight-results-heading">Current design results</h3></div>
            <Button type="button" onClick={calculate} disabled={calculating || hasErrors}>
              <Calculator />{calculating ? 'Calculating…' : 'Run again'}
            </Button>
          </div>

          {calculating && <div className="flight-state"><Calculator size={22} /><strong>Calculating latest design…</strong></div>}
          {!calculating && !run && <div className="flight-state"><Ruler size={22} /><strong>{hasErrors ? 'Fix the highlighted settings to calculate.' : 'Results are out of date. Run the latest design.'}</strong></div>}
          {!calculating && run?.phase === 'invalid' && <div className="flight-state flight-state-error"><AlertTriangle size={22} /><strong>Some settings are invalid.</strong><span>Fix the highlighted fields, then run the current design again.</span></div>}
          {!calculating && run?.phase === 'error' && <div className="flight-state flight-state-error"><AlertTriangle size={22} /><strong>Calculation error</strong><span>{run.errorMessage}</span></div>}

          {!calculating && run && run.phase !== 'invalid' && <>
            <div className="flight-metrics">
              <Metric label="Width" value={run.dimensions ? `${format(run.dimensions.widthM * 100)} cm` : 'Unavailable'} />
              <Metric label="Height" value={run.dimensions ? `${format(run.dimensions.heightM * 100)} cm` : 'Unavailable'} />
              <Metric label="Exposed area" value={snapshot?.exposedAreaM2 != null ? `${format(snapshot.exposedAreaM2, 4)} m²` : 'Unavailable'} />
              <Metric label="Total mass" value={analysis?.mass ? `${format(analysis.mass.totalKg * 1000)} g` : 'Unavailable'} />
              <Metric label="Center of gravity" value={analysis?.mass ? `(${format(analysis.mass.centerM.x * 100)}, ${format(analysis.mass.centerM.y * 100)}, ${format(analysis.mass.centerM.z * 100)}) cm` : 'Unavailable'} />
              <Metric label="Flight score" value={run.score?.overall != null ? `${format(run.score.overall, 0)} / 100` : 'Unavailable'} note={TEST_FLIGHT_SCORE_POLICY.name} />
            </div>

            <h4>Force and pitch estimate</h4>
            <div className="flight-metrics flight-force-metrics">
              <Metric label="Lift" value={trim ? `${format(trim.liftN)} N` : 'Unavailable'} />
              <Metric label="Drag" value={trim ? `${format(trim.dragN)} N` : 'Unavailable'} />
              <Metric label="Line tension" value={trim ? `${format(trim.tensionN)} N` : 'Unavailable'} />
              <Metric label="Pitch" value={trim ? `${format(trim.angleRad * 180 / Math.PI)}° · ${trim.pitchStability}` : 'Unavailable'} />
            </div>

            {!!run.missing.length && <div className="flight-issues">
              <h4><AlertTriangle size={16} />Missing or unsupported</h4>
              <ul>{run.missing.map((issue, index) => <li key={`${issue.code}-${issue.path}-${index}`}>{issue.message}</li>)}</ul>
            </div>}

            <div className="flight-notice">
              <strong>Why these results are provisional</strong>
              <p>Aerodynamic coefficients and pressure centers must be measured for this geometry before lift, drag, tension, pitch, or a score can be available. User settings alone do not calibrate aerodynamics.</p>
              <p>Structural safety, gusts, line sag, frame bending, joints and paper tearing are not calculated. Never treat this estimate as guaranteed flight or a safe working load.</p>
            </div>
          </>}
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
