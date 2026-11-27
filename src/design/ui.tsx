import { useEffect, type ReactNode } from 'react';
import type { MadeBy, Receipt } from '../ai/types.ts';
import type { Product } from '../domain/types.ts';
import { imageAlt, imageFor } from './photos.ts';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · HybridCart AI`;
  }, [title]);
}

export function Notice({ tone, children }: { tone?: 'warn' | 'good' | 'error'; children: ReactNode }) {
  return (
    <div className={`notice ${tone ?? ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export const Loading = ({ label = 'Loading' }: { label?: string }) => (
  <p className="muted" role="status">
    {label}…
  </p>
);

const LaptopIcon = () => (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19h20" />
  </svg>
);
const CloudIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.5A3.5 3.5 0 007 18z" />
  </svg>
);

export const MADE_LABEL: Record<MadeBy, string> = {
  on_device: 'Made on this device',
  in_cloud: 'Made by Gemini in the cloud',
};

export const MODE_LABEL = {
  only_on_device: 'Device only',
  prefer_on_device: 'Device first, cloud if needed',
  only_in_cloud: 'Cloud only',
} as const;

/** The processing stamp. Filled from the SDK's reported source, never from the requested mode. */
export function Stamp({ receipt }: { receipt: Receipt }) {
  const local = receipt.madeBy === 'on_device';
  return (
    <details className={`stamp settle ${receipt.madeBy}`}>
      <summary>
        {local ? <LaptopIcon /> : <CloudIcon />}
        {MADE_LABEL[receipt.madeBy]}
      </summary>
      <dl>
        <dt>Asked for</dt>
        <dd>{MODE_LABEL[receipt.requestedMode]}</dd>
        <dt>Reported source</dt>
        <dd>{local ? 'ON_DEVICE' : 'IN_CLOUD'}</dd>
        <dt>{local ? 'Used here' : 'Sent'}</dt>
        <dd>{receipt.sent.join('; ')}</dd>
        {local && (
          <>
            <dt>Sent to cloud</dt>
            <dd>Nothing</dd>
          </>
        )}
      </dl>
    </details>
  );
}

export function ProductImage({ product, className }: { product: Product; className?: string }) {
  return <img className={className} src={imageFor(product)} alt={imageAlt(product)} width="800" height="600" />;
}

export function Stock({ stock }: { stock: number }) {
  if (stock === 0) return <span className="small stock-out">Out of stock</span>;
  return <span className="small stock-ok">{stock <= 4 ? `Only ${stock} left` : 'In stock'}</span>;
}
