import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { FEATURE_NAMES, type LedgerEntry } from '../../ai/types.ts';
import { setLocal, useLocal } from '../../data/local.ts';
import { MODE_LABEL, Notice, usePageTitle } from '../../design/ui.tsx';
import type { PrivacySetting, Profile } from '../../domain/types.ts';
import { LocalSetup } from '../assist/LocalSetup.tsx';
import { AccountNav } from './AccountNav.tsx';

const SETTINGS: { id: PrivacySetting; title: string; body: string }[] = [
  { id: 'device', title: 'Device only', body: 'AI never uses the cloud. Conversations are turned off.' },
  { id: 'ask', title: 'Ask me each time', body: 'Try this device first. Before any cloud request, see what would be sent and decide.' },
  { id: 'cloud', title: 'Cloud for product questions', body: 'Questions about public product facts may use the cloud without asking. Words you write are still asked about, except in conversations you start. Personal checks stay here.' },
];

const EMPTY: Profile = { budget: '', uses: '', comfort: '', space: '' };

const FIELDS: { key: keyof Profile; label: string; hint: string }[] = [
  { key: 'budget', label: 'Budget', hint: 'Up to ₹10,000' },
  { key: 'uses', label: 'Uses', hint: 'Long flights, calls' },
  { key: 'comfort', label: 'Comfort', hint: 'Wears glasses; prefers light gear' },
  { key: 'space', label: 'Home or workspace', hint: 'Small bedroom, shared flat' },
];

export function YouPage() {
  usePageTitle('You');
  const { profile, privacy } = useLocal();
  const [draft, setDraft] = useState<Profile>(profile ?? EMPTY);
  const [saved, setSaved] = useState(false);

  const save = (event: FormEvent) => {
    event.preventDefault();
    setLocal('profile', draft);
    setSaved(true);
  };

  return (
    <div className="account">
      <AccountNav />
      <div className="stack">
        <p className="muted measure">
          Your preferences and AI activity are stored in this browser only. Orders are different: buying needs a record, so orders and their addresses are saved in the store database.
        </p>
        <details className="section" open>
          <summary><h1>My preferences</h1></summary>
          <form className="stack" onSubmit={save}>
            <div className="form-grid">
              {FIELDS.map((f) => (
                <label className="field" key={f.key}>
                  {f.label}
                  <input value={draft[f.key]} maxLength={120} placeholder={f.hint} autoComplete="off"
                    onChange={(e) => { setDraft({ ...draft, [f.key]: e.target.value }); setSaved(false); }} />
                </label>
              ))}
            </div>
            <div className="row">
              <button type="submit" className="btn">Save on this device</button>
              <button type="button" className="btn danger" disabled={!profile}
                onClick={() => { setLocal('profile', null); setDraft(EMPTY); setSaved(false); }}>
                Delete my preferences
              </button>
            </div>
            {saved && <Notice tone="good">Saved in this browser.</Notice>}
          </form>
        </details>

        <details className="section" open>
          <summary><h2>When AI may use the cloud</h2></summary>
          <div className="stack">
            <p className="small muted">Your preferences and order details never go to an AI in the cloud, whichever you choose.</p>
            <fieldset className="stack tight plain">
              <legend className="sr-only">Cloud setting</legend>
              {SETTINGS.map((option) => (
                <label className="option" key={option.id}>
                  <input type="radio" name="privacy" checked={privacy === option.id} onChange={() => setLocal('privacy', option.id)} />
                  <span>
                    <strong>{option.title}</strong>
                    <br />
                    <span className="small muted">{option.body}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        </details>

        <LocalSetup />
      </div>
    </div>
  );
}

function Made({ entry }: { entry: LedgerEntry }) {
  if (entry.madeBy === 'on_device') return <span className="tag on_device">On this device</span>;
  if (entry.madeBy === 'in_cloud') return <span className="tag in_cloud">In the cloud</span>;
  return <span className="tag not_sent">No answer</span>;
}

const OUTCOME = {
  answered: 'Answered',
  declined: 'You kept it on this device',
  unavailable: 'Not available',
  failed: 'Did not complete',
  rejected_output: 'Answer rejected by checks',
};

export function LedgerPage() {
  usePageTitle('AI activity');
  const { ledger } = useLocal();
  const time = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="account">
      <AccountNav />
      <div className="stack">
      <div className="row spread">
        <h1>AI activity</h1>
        <button type="button" className="btn secondary small" disabled={!ledger.length} onClick={() => setLocal('ledger', [])}>Clear record</button>
      </div>
      <p className="muted measure">Every AI request made from this browser. The record is kept here and nowhere else.</p>
      <dl className="stats">
        <div className="on_device"><dt>Answered on this device</dt><dd>{ledger.filter((e) => e.madeBy === 'on_device').length}</dd></div>
        <div className="in_cloud"><dt>Answered in the cloud</dt><dd>{ledger.filter((e) => e.madeBy === 'in_cloud').length}</dd></div>
        <div className="not_sent"><dt>Kept back by you</dt><dd>{ledger.filter((e) => e.outcome === 'declined').length}</dd></div>
        <div><dt>All requests</dt><dd>{ledger.length}</dd></div>
      </dl>
      {ledger.length === 0 ? (
        <div className="empty">
          <h2>No AI requests yet</h2>
          <p>Explain a spec on a product page and it will appear here.</p>
          <Link className="btn" to="/">Browse the store</Link>
        </div>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="AI requests">
          <table>
            <thead>
              <tr><th>Time</th><th>What</th><th>Asked for</th><th>Made</th><th>Result</th><th>Sent to cloud</th></tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id}>
                  <td>{time.format(e.atMs)}</td>
                  <td>{FEATURE_NAMES[e.feature]}<br /><span className="small muted">{e.subject}</span></td>
                  <td>{e.requestedMode ? MODE_LABEL[e.requestedMode] : 'Nothing'}</td>
                  <td><Made entry={e} /></td>
                  <td>{OUTCOME[e.outcome]}</td>
                  <td>{e.cloudAttempted ? e.fields.join('; ') : 'Nothing'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        “Made” is the source the AI SDK reported on the answer. “Sent to cloud” lists what HybridCart put in a request that was attempted over the network, even if it failed.
      </p>
      </div>
    </div>
  );
}
