import { useState } from 'react';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { explainSpec } from '../../ai/prompts.ts';
import { GLOSSARY } from '../../data/seed/catalogue.ts';
import type { Product, Spec } from '../../domain/types.ts';
import { AiResult } from '../assist/AiResult.tsx';

export function SpecList({ product }: { product: Product }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="stack tight" aria-labelledby="specs-h">
      <h2 id="specs-h">Specifications</h2>
      <p className="small muted">Choose “Explain” to have a spec put in plain words.</p>
      <dl className="specs">
        {product.specs.map((s) => (
          <div className="spec" key={s.key}>
            <div className="spec-line">
              <dt>{s.label}</dt>
              <dd>
                <span>{s.value}</span>
                <button type="button" className="link small" aria-expanded={open === s.key}
                  aria-label={`${open === s.key ? 'Close explanation of' : 'Explain'} ${s.label}`}
                  onClick={() => setOpen(open === s.key ? null : s.key)}>
                  {open === s.key ? 'Close' : 'Explain'}
                </button>
              </dd>
            </div>
            {open === s.key && <Explanation product={product} spec={s} />}
          </div>
        ))}
      </dl>
    </section>
  );
}

function Explanation({ product, spec }: { product: Product; spec: Spec }) {
  const ai = useAiTask();
  const entry = spec.glossaryKey ? GLOSSARY[spec.glossaryKey] : undefined;
  const glossary = entry && (
    <p className="small measure"><strong>Store glossary: {entry.term}.</strong> {entry.meaning}</p>
  );
  return (
    <div className="answer stack tight">
      {ai.state.phase === 'idle' && (
        <>
          {glossary}
          <div>
            <button type="button" className="btn secondary small" onClick={() => void ai.start(explainSpec(product, spec))}>
              Explain this value with AI
            </button>
          </div>
        </>
      )}
      <AiResult state={ai.state} fallback={glossary}>
        {(text) => <p className="streaming">{text}</p>}
      </AiResult>
    </div>
  );
}
