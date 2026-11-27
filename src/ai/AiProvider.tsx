// React side of the AI boundary: model setup state, the consent sheet and useAiTask().
// UI code reaches runFeature through here and never imports firebase/ai.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { addLedgerEntry, getLocal } from '../data/local.ts';
import { cloudReady, invoke, localStatus, setUpLocalModel } from './models.ts';
import { runFeature } from './run.ts';
import type { LocalStatus, PromptSpec, RunResult } from './types.ts';

interface AiContext {
  status: LocalStatus | 'checking';
  progress: number | null;
  setupError: string | null;
  /** Call directly from a click handler. */
  setUp: () => void;
  run: <T>(spec: PromptSpec, onText?: (soFar: string) => void) => Promise<RunResult<T>>;
}

const Context = createContext<AiContext | null>(null);

interface Pending {
  spec: PromptSpec;
  resolve: (send: boolean) => void;
}

export function AiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiContext['status']>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const refresh = useCallback(() => localStatus().then(setStatus), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setUp = useCallback(() => {
    setSetupError(null);
    setProgress(0);
    setStatus('downloading');
    setUpLocalModel(setProgress)
      .catch((error) => {
        console.warn('On-device setup failed', error);
        setSetupError('Setup did not finish. Chrome needs about 22 GB of free disk space and an unmetered connection.');
      })
      .finally(() => {
        setProgress(null);
        void refresh();
      });
  }, [refresh]);

  const askConsent = useCallback((spec: PromptSpec) => new Promise<boolean>((resolve) => setPending({ spec, resolve })), []);

  const run = useCallback<AiContext['run']>(
    (spec, onText) =>
      runFeature(
        spec,
        { setting: getLocal().privacy, localStatus, invoke, askConsent, record: addLedgerEntry, cloudReady },
        onText,
      ),
    [askConsent],
  );

  const answer = (send: boolean) => {
    pending?.resolve(send);
    setPending(null);
  };

  return (
    <Context.Provider value={{ status, progress, setupError, setUp, run }}>
      {children}
      {pending && <ConsentSheet spec={pending.spec} onAnswer={answer} />}
    </Context.Provider>
  );
}

export function useAi(): AiContext {
  const value = useContext(Context);
  if (!value) throw new Error('AiProvider is missing');
  return value;
}

export type TaskState<T> = { phase: 'idle' } | { phase: 'running'; partial: string } | { phase: 'done'; result: RunResult<T> };

export function useAiTask<T = string>() {
  const { run } = useAi();
  const [state, setState] = useState<TaskState<T>>({ phase: 'idle' });
  const latest = useRef(0);

  const start = useCallback(
    async (spec: PromptSpec): Promise<RunResult<T>> => {
      const id = ++latest.current;
      setState({ phase: 'running', partial: '' });
      const result = await run<T>(spec, (partial) => {
        if (latest.current === id) setState({ phase: 'running', partial });
      });
      if (latest.current === id) setState({ phase: 'done', result });
      return result;
    },
    [run],
  );

  const reset = useCallback(() => {
    latest.current++;
    setState({ phase: 'idle' });
  }, []);

  return { state, start, reset };
}

/** Everything the sheet lists comes from the prompt builder, plus the exact text on request. */
function ConsentSheet({ spec, onAnswer }: { spec: PromptSpec; onAnswer: (send: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const exact = [
    spec.chat?.system,
    ...(spec.chat?.history.map((t) => `${t.role === 'user' ? 'You' : 'Gemini'}: ${t.text}`) ?? []),
    spec.prompt,
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <dialog
      ref={ref}
      className="consent"
      aria-labelledby="consent-title"
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
    >
      <div className="stack">
        <h2 id="consent-title">This needs the cloud</h2>
        <p className="muted">
          {spec.cloudOnly
            ? 'Conversations run on Gemini in the cloud, not on this device.'
            : 'The on-device model cannot answer this right now.'}{' '}
          Nothing is sent unless you choose to.
        </p>
        <div className="form-grid">
          <div>
            <strong className="small">HybridCart will send</strong>
            <ul className="bullets">
              {spec.fields.map((f) => (
                <li key={f.label}>{f.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong className="small">Stays on this device</strong>
            <ul className="bullets">
              <li>Your saved preferences</li>
              <li>Your order details</li>
              <li>Your AI activity record</li>
            </ul>
          </div>
        </div>
        <details>
          <summary>Read the exact text that will be sent</summary>
          <pre className="exact">{exact}</pre>
        </details>
        <p className="small muted">
          This list is what HybridCart puts in the request. App Check verifies the app; it does not make you anonymous.
        </p>
        <div className="row">
          <button type="button" className="btn cloud" onClick={() => onAnswer(true)}>
            Send to cloud
          </button>
          <button type="button" className="btn secondary" onClick={() => onAnswer(false)} autoFocus>
            Keep on device
          </button>
        </div>
      </div>
    </dialog>
  );
}
