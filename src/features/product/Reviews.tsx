import { useEffect, useState, type FormEvent } from 'react';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { reviewDigest } from '../../ai/prompts.ts';
import type { DigestResult } from '../../ai/validate.ts';
import { flags } from '../../config/remote.ts';
import { SAMPLE_REVIEWS } from '../../data/seed/catalogue.ts';
import { Notice } from '../../design/ui.tsx';
import { formatDate } from '../../domain/store.ts';
import type { Product, Review } from '../../domain/types.ts';
import { db } from '../../firebase/app.ts';
import { storeBackendConfigured } from '../../firebase/config.ts';
import { useSession } from '../../store/auth.ts';
import { listOrders, publishedReviews, submitReview } from '../../store/orders.ts';
import { AiResult } from '../assist/AiResult.tsx';

const samplesFor = (productId: string) => SAMPLE_REVIEWS.filter((r) => r.productId === productId);

export function Reviews({ product }: { product: Product }) {
  const [reviews, setReviews] = useState<Review[]>(() => (storeBackendConfigured ? [] : samplesFor(product.id)));
  const digest = useAiTask<DigestResult>();

  useEffect(() => {
    if (!storeBackendConfigured) return;
    publishedReviews(db, product.id).then(setReviews).catch(() => setReviews(samplesFor(product.id)));
  }, [product.id]);

  const used = reviews.slice(0, flags.maxReviewsDigest);

  return (
    <section className="stack" aria-labelledby="reviews-h">
      <h2 id="reviews-h">Reviews</h2>
      {reviews.length === 0 ? (
        <p className="muted">No reviews yet.</p>
      ) : (
        <>
          <p className="small muted">
            Average {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} of 5 from {reviews.length} reviews.
            {reviews.some((r) => r.sample) && ' Reviews marked “Sample” were written for this demonstration and are not from customers.'}
          </p>
          <div className="stack tight">
            <div>
              <button type="button" className="btn secondary small" disabled={digest.state.phase === 'running'}
                onClick={() => void digest.start(reviewDigest(product, used.map((r) => r.text)))}>
                Summarise {used.length} reviews
              </button>
            </div>
            <AiResult state={digest.state}>
              {(d) => (
                <div className="measure">
                  <p><strong>Liked:</strong> {d.liked.join('; ') || 'nothing in particular'}</p>
                  <p><strong>Disliked:</strong> {d.disliked.join('; ') || 'nothing in particular'}</p>
                </div>
              )}
            </AiResult>
          </div>
          <div className="stack tight">
            {reviews.map((r) => (
              <article className="panel stack tight" key={r.id}>
                <p className="small">
                  <strong>{r.rating} of 5</strong> · {formatDate(r.createdAtMs)}{' '}
                  <span className="tag">{r.sample ? 'Sample' : 'From a delivered demo order'}</span>
                </p>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
        </>
      )}
      {storeBackendConfigured && <WriteReview product={product} />}
    </section>
  );
}

/** Offered only to a shopper with a delivered order containing the product. Rules enforce the same. */
function WriteReview({ product }: { product: Product }) {
  const { user } = useSession();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ tone: 'good' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    listOrders(db, user.uid)
      .then((orders) => setOrderId(orders.find((o) => o.status === 'delivered' && product.id in o.quantities)?.id ?? null))
      .catch(() => setOrderId(null));
  }, [user, product.id]);

  if (!orderId || !user) return <p className="small muted">You can write a review after an order containing this product is delivered.</p>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await submitReview(db, user.uid, product.id, orderId, rating, text);
      setText('');
      setMessage({ tone: 'good', text: 'Thank you. Your review is waiting for a moderator.' });
    } catch {
      setMessage({ tone: 'error', text: 'The review could not be saved. You can review each product once.' });
    }
  };

  return (
    <form className="panel stack" onSubmit={submit}>
      <h3>Write a review</h3>
      <label className="field">
        Rating
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} of 5</option>)}
        </select>
      </label>
      <label className="field">
        Your review (do not include personal details)
        <textarea required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div><button type="submit" className="btn" disabled={!text.trim()}>Send for moderation</button></div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </form>
  );
}
