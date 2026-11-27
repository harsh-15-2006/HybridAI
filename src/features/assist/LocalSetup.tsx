import { useAi } from '../../ai/AiProvider.tsx';
import { Notice } from '../../design/ui.tsx';

const TEXT = {
  checking: 'Checking this browser…',
  available: 'The on-device model is ready. Fit checks and anything using your preferences run here, even offline.',
  downloadable: 'This browser can run private AI after a one-time download. Chrome needs about 22 GB free and an unmetered connection.',
  downloading: 'Chrome is downloading the on-device model. This can take several minutes.',
  unavailable: 'Chrome reports that this computer cannot run the on-device model. The store works as usual.',
  unsupported: 'This browser has no on-device model. Private AI needs Chrome on a desktop computer; the store works as usual.',
};

export function LocalSetup() {
  const { status, progress, setupError, setUp } = useAi();
  return (
    <section className="panel stack tight" aria-labelledby="private-ai">
      <h2 id="private-ai">Private AI on this device</h2>
      <p className="muted measure">{TEXT[status]}</p>
      {status === 'downloading' && <progress max={1} value={progress ?? undefined} aria-label="Model download" />}
      {status === 'downloading' && progress != null && <p className="small">{Math.round(progress * 100)}%</p>}
      {status === 'downloadable' && (
        <div>
          <button type="button" className="btn" onClick={setUp}>Set up private AI</button>
        </div>
      )}
      {setupError && <Notice tone="error">{setupError}</Notice>}
    </section>
  );
}
