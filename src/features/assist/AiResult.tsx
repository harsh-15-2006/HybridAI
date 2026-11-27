// Shared rendering of every AI request state, so unavailable and failed states always have a next step.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAi, type TaskState } from '../../ai/AiProvider.tsx';
import { Notice, Stamp } from '../../design/ui.tsx';

export function AiResult<T>({ state, children, fallback }: {
  state: TaskState<T>;
  children: (data: T) => ReactNode;
  /** Non-AI help shown whenever there is no answer. */
  fallback?: ReactNode;
}) {
  const { status, setUp } = useAi();

  if (state.phase === 'idle') return null;
  if (state.phase === 'running') {
    return (
      <div className="stack tight" aria-live="polite">
        {state.partial ? <p className="streaming">{state.partial}</p> : <p className="muted" role="status">Thinking…</p>}
      </div>
    );
  }

  const { result } = state;
  if (result.status === 'ok') {
    return (
      <div className="stack tight" aria-live="polite">
        {children(result.data)}
        <Stamp receipt={result.receipt} />
      </div>
    );
  }

  return (
    <div className="stack tight" aria-live="polite">
      {result.status === 'declined' && (
        <div className="stamp not_sent">
          <span>Nothing was sent</span>
        </div>
      )}
      {result.status === 'unavailable' && (
        <Notice tone="warn">
          {result.reason}{' '}
          {status === 'downloadable' && (
            <button type="button" className="link" onClick={setUp}>Set up private AI</button>
          )}{' '}
          <Link to="/about-ai">Why?</Link>
        </Notice>
      )}
      {result.status === 'failed' && <Notice tone="error">{result.message}</Notice>}
      {result.status === 'invalid' && (
        <Notice tone="warn">The answer did not pass our checks, so it is not shown. The store facts are unaffected.</Notice>
      )}
      {fallback}
    </div>
  );
}
