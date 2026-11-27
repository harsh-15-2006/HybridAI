import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { askChat, MAX_USER_TEXT } from '../../ai/prompts.ts';
import type { ChatTurn, Receipt } from '../../ai/types.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { useLocal } from '../../data/local.ts';
import { Empty, Loading, Notice, ProductImage, Stamp, usePageTitle } from '../../design/ui.tsx';
import { formatPrice } from '../../domain/store.ts';
import type { Product } from '../../domain/types.ts';
import { cloudAiConfigured } from '../../firebase/config.ts';
import { AiResult } from '../assist/AiResult.tsx';

export default function AskPage() {
  const { productId } = useParams();
  const { products, loading } = useCatalogue();
  const product = products.find((p) => p.id === productId);
  usePageTitle(product ? `Ask about ${product.name}` : 'Ask');
  if (loading) return <Loading />;
  if (!product) return <Empty title="We don't sell that product"><Link to="/">Back to the store</Link></Empty>;
  return <Conversation key={product.id} product={product} />;
}

interface Exchange {
  question: string;
  answer: string;
  receipt: Receipt;
}

function Conversation({ product }: { product: Product }) {
  const { products } = useCatalogue();
  const { privacy, compare } = useLocal();
  // Public specs of products the shopper is comparing join the conversation.
  const others = compare.filter((id) => id !== product.id).slice(0, 2)
    .map((id) => products.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  const inScope = [product, ...others];
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const ai = useAiTask();

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const q = question.trim();
    if (!q) return;
    setAsked(q);
    const history: ChatTurn[] = exchanges.flatMap((e) => [
      { role: 'user' as const, text: e.question },
      { role: 'model' as const, text: e.answer },
    ]);
    const result = await ai.start(askChat(inScope, history, q));
    if (result.status === 'ok') {
      setExchanges((list) => [...list, { question: q, answer: result.data, receipt: result.receipt }]);
      setQuestion('');
      ai.reset();
    }
  };

  return (
    <div className="split">
      <section className="main-col stack" aria-label="Conversation">
        <p className="small"><Link to={`/p/${product.id}`}>Back to {product.name}</Link></p>
        <h1>Ask about {product.name}</h1>
        {privacy === 'device' && (
          <Notice tone="warn">
            Your setting is Device only, and conversations need the cloud. <Link to="/you">Change the setting</Link> to use this.
          </Notice>
        )}
        {!cloudAiConfigured && <Notice tone="warn">Conversations need a Firebase project with AI Logic, which is not configured here.</Notice>}
        {exchanges.map((e, i) => (
          <div className="stack tight" key={i}>
            <p className="bubble user">{e.question}</p>
            <div className="bubble model">{e.answer}</div>
            <Stamp receipt={e.receipt} />
          </div>
        ))}
        {ai.state.phase !== 'idle' && <p className="bubble user">{asked}</p>}
        <AiResult state={ai.state}>{() => null}</AiResult>
        <form className="searchbar" onSubmit={send}>
          <label htmlFor="ask" className="sr-only">Your question</label>
          <input id="ask" maxLength={MAX_USER_TEXT} value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder={exchanges.length ? 'Ask a follow-up' : 'How would this cope with a 14-hour flight?'} />
          <button type="submit" className="btn"
            disabled={privacy === 'device' || !cloudAiConfigured || ai.state.phase === 'running' || !question.trim()}>
            Ask
          </button>
        </form>
        <p className="small muted">
          Sends: your question, public specs of {inScope.map((p) => p.name).join(' and ')}
          {exchanges.length > 0 && ', and earlier messages here'}. Do not type personal details.
        </p>
      </section>
      <aside className="side-col stack" aria-label="Products in this conversation">
        <h3>Products in this conversation</h3>
        {inScope.map((p) => (
          <div className="line" key={p.id}>
            <ProductImage product={p} />
            <div className="grow">
              <p><strong>{p.name}</strong></p>
              <p className="price">{formatPrice(p.priceCents)}</p>
            </div>
          </div>
        ))}
        <p className="small muted">Prices and specs come from the catalogue. The conversation explains them; it cannot change them.</p>
      </aside>
    </div>
  );
}
