// Orchestration for one AI request: policy → availability → consent → call → validate → ledger.
// The model call and the UI hooks are injected, so every privacy path can be tested.
import type { PrivacySetting } from '../domain/types.ts';
import { assertMayRun, route } from './policy.ts';
import type { LedgerEntry, LedgerOutcome, LocalStatus, MadeBy, PromptSpec, RequestedMode, RunResult } from './types.ts';
import { InvalidOutput, parseOutput } from './validate.ts';

export interface ModelReply {
  text: string;
  /** As reported by the SDK. */
  source: MadeBy | undefined;
}

export interface RunDeps {
  setting: PrivacySetting;
  localStatus: () => Promise<LocalStatus>;
  invoke: (mode: RequestedMode, spec: PromptSpec, onText?: (soFar: string) => void) => Promise<ModelReply>;
  /** Shows the consent sheet built from spec.fields. Resolves false when declined. */
  askConsent: (spec: PromptSpec) => Promise<boolean>;
  record: (entry: LedgerEntry) => void;
  cloudReady: () => { ok: true } | { ok: false; reason: string };
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const LOCAL_REASONS: Record<Exclude<LocalStatus, 'available'>, string> = {
  unsupported: 'This browser has no on-device model. On-device AI needs Chrome on a desktop computer.',
  unavailable: 'Chrome reports that the on-device model cannot run on this computer.',
  downloadable: 'The on-device model is not downloaded yet. Set up private AI first.',
  downloading: 'The on-device model is still downloading.',
};

const isOverloaded = (message: string) => /\b503\b|overloaded|unavailable/i.test(message);

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && error.name === 'QuotaExceededError') return 'That was too much text for the on-device model.';
  if (/\b429\b|quota|rate limit/i.test(message)) return 'Gemini is at its usage limit. Try again in a few minutes.';
  if (isOverloaded(message)) return 'Gemini is busy. Try again in a moment.';
  if (/app ?check|\b401\b|\b403\b/i.test(message)) return 'The request was refused. Check App Check and AI Logic setup.';
  return 'The AI request did not complete.';
}

export async function runFeature<T = string>(spec: PromptSpec, deps: RunDeps, onText?: (soFar: string) => void): Promise<RunResult<T>> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));

  const log = (outcome: LedgerOutcome, requestedMode: RequestedMode | null, madeBy: MadeBy | null, cloudAttempted: boolean) =>
    deps.record({
      id: `${now()}-${Math.random().toString(36).slice(2, 8)}`,
      atMs: now(),
      feature: spec.feature,
      subject: spec.subject,
      requestedMode,
      madeBy,
      outcome,
      cloudAttempted,
      fields: spec.fields.map((f) => f.label),
    });

  const unavailable = (reason: string, mode: RequestedMode | null): RunResult<T> => {
    log('unavailable', mode, null, false);
    return { status: 'unavailable', reason };
  };

  const plan = route(spec, deps.setting);
  let mode: RequestedMode;

  let status: LocalStatus | null = null;
  if (plan.first === 'only_on_device' || plan.first === 'prefer_on_device') status = await deps.localStatus();

  if (plan.first === 'only_on_device' && status !== 'available') {
    const localReason = LOCAL_REASONS[status as Exclude<LocalStatus, 'available'>];
    if (plan.cloud !== 'consent') return unavailable(localReason, 'only_on_device');
    const cloud = deps.cloudReady();
    if (!cloud.ok) return unavailable(`${localReason} ${cloud.reason}`, 'only_on_device');
    if (!(await deps.askConsent(spec))) {
      log('declined', 'only_in_cloud', null, false);
      return { status: 'declined' };
    }
    mode = 'only_in_cloud';
  } else if (plan.first === null) {
    if (plan.cloud !== 'consent') return unavailable(plan.blockedReason ?? 'This is not available with your setting.', null);
    const cloud = deps.cloudReady();
    if (!cloud.ok) return unavailable(cloud.reason, 'only_in_cloud');
    if (!(await deps.askConsent(spec))) {
      log('declined', 'only_in_cloud', null, false);
      return { status: 'declined' };
    }
    mode = 'only_in_cloud';
  } else {
    mode = plan.first;
    // prefer_on_device falls back to the cloud inside the SDK, so the cloud must be usable.
    if (mode !== 'only_on_device' && status !== 'available') {
      const cloud = deps.cloudReady();
      if (!cloud.ok) return unavailable(`${status ? LOCAL_REASONS[status as Exclude<LocalStatus, 'available'>] : ''} ${cloud.reason}`.trim(), mode);
    }
  }

  assertMayRun(spec, mode);
  // Whether this attempt can reach the network. Used only when no response reports a source.
  const mayReachCloud = mode === 'only_in_cloud' || (mode === 'prefer_on_device' && status !== 'available');

  let invalidRetries = 1;
  let busyRetries = 1;
  for (;;) {
    try {
      const reply = await deps.invoke(mode, spec, onText);
      const madeBy = reply.source;
      if (!madeBy) throw new Error('The SDK did not report where the answer was made.');
      const grounding = `${spec.prompt}\n${spec.chat?.system ?? ''}`;
      try {
        const data = parseOutput(reply.text, spec.schema, grounding) as T;
        log('answered', mode, madeBy, madeBy === 'in_cloud');
        return { status: 'ok', data, receipt: { madeBy, requestedMode: mode, sent: spec.fields.map((f) => f.label) } };
      } catch (error) {
        if (!(error instanceof InvalidOutput)) throw error;
        log('rejected_output', mode, madeBy, madeBy === 'in_cloud');
        if (invalidRetries-- > 0) continue;
        return { status: 'invalid' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (mayReachCloud && isOverloaded(message) && busyRetries-- > 0) {
        await sleep(1500);
        continue;
      }
      console.warn(`AI ${spec.feature} failed`, error);
      log('failed', mode, null, mayReachCloud);
      return { status: 'failed', message: friendlyError(error) };
    }
  }
}
