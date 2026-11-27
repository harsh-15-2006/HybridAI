import { Link } from 'react-router';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { fitCheck, fitGeneral, profileLines } from '../../ai/prompts.ts';
import type { FitResult } from '../../ai/validate.ts';
import { useLocal } from '../../data/local.ts';
import type { Product } from '../../domain/types.ts';
import { cloudAiConfigured } from '../../firebase/config.ts';
import { AiResult } from '../assist/AiResult.tsx';

const VERDICTS = { fits: 'Fits you', partly: 'Partly fits you', does_not_fit: 'Not a good fit' };

function Verdict({ data, general }: { data: FitResult; general?: boolean }) {
  return (
    <>
      <p className={`verdict ${general ? '' : data.verdict}`}>{general ? 'Who it suits' : VERDICTS[data.verdict]}</p>
      <ul className="bullets">
        {data.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {data.watchOut && <p className="notice warn">Watch out: {data.watchOut}</p>}
    </>
  );
}

export function FitCheck({ product }: { product: Product }) {
  const { profile, privacy } = useLocal();
  const personal = useAiTask<FitResult>();
  const general = useAiTask<FitResult>();
  const hasProfile = profile != null && profileLines(profile).length > 0;
  const noPersonal = personal.state.phase === 'done' && personal.state.result.status === 'unavailable';

  return (
    <section className="stack tight" aria-labelledby="fit-h">
      <div className="row spread baseline">
        <h3 id="fit-h">Fit check</h3>
        <Link to="/you" className="small">{hasProfile ? 'Edit my preferences' : 'Add my preferences'}</Link>
      </div>
      {hasProfile ? (
        <>
          <p className="muted small">Checks this product against your saved preferences. Runs on this device only.</p>
          <div>
            <button type="button" className="btn" disabled={personal.state.phase === 'running'}
              onClick={() => void personal.start(fitCheck(product, profile))}>
              Check my fit
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">Save your budget, uses and comfort needs first. They stay in this browser.</p>
      )}
      <AiResult state={personal.state}>{(data) => <Verdict data={data} />}</AiResult>

      {(noPersonal || !hasProfile) && privacy !== 'device' && cloudAiConfigured && (
        <>
          <p className="small muted">You can ask for a general view that does not use your preferences.</p>
          <div>
            <button type="button" className="btn secondary small" onClick={() => void general.start(fitGeneral(product))}>
              Who does this suit?
            </button>
          </div>
        </>
      )}
      <AiResult state={general.state}>{(data) => <Verdict data={data} general />}</AiResult>
    </section>
  );
}
