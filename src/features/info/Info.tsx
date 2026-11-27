import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { POLICIES } from '../../data/seed/catalogue.ts';
import { Icon } from '../../design/icons.tsx';
import { Empty, usePageTitle } from '../../design/ui.tsx';
import { LocalSetup } from '../assist/LocalSetup.tsx';

export function HelpPage() {
  usePageTitle('Help');
  return (
    <div className="stack measure">
      <h1>Delivery, returns and payment</h1>
      <h2>Delivery</h2>
      <p>{POLICIES.delivery}</p>
      <h2>Returns and refunds</h2>
      <p>{POLICIES.returns}</p>
      <h2>Payment</h2>
      <p>{POLICIES.payment}</p>
      <h2>Privacy</h2>
      <p>
        Preferences, cart and AI activity stay in this browser. Orders, addresses, returns, reviews and support messages are saved in the store database, where you and store operators can read them. This is a demonstration, so use made-up details.
      </p>
    </div>
  );
}

const ROWS = [
  ['Explain a spec', 'Public spec', 'This device first. Cloud only if your setting or your permission allows it.'],
  ['Fit check', 'Your preferences', 'This device only.'],
  ['Compare', 'Public specs, plus preferences if you tick the box', 'With preferences: this device only.'],
  ['Review summary', 'Written reviews', 'This device first; cloud only with your permission.'],
  ['Search wording', 'Your words', 'This device first; cloud only with your permission.'],
  ['Conversation', 'Your question and public specs', 'Cloud only. Off when your setting is Device only.'],
  ['Order help', 'Your order', 'This device only.'],
  ['Review screening (operators)', 'A review’s text', 'This device first; cloud only with permission.'],
];

const SECTIONS = [
  ['01', 'what', 'What it does'],
  ['02', 'where', 'Device and cloud'],
  ['03', 'control', 'Your controls'],
  ['04', 'how', 'Architecture'],
] as const;

function Chapter({ index, caption, title, children }: { index: number; caption: string; title: string; children: ReactNode }) {
  const [number, id] = SECTIONS[index]!;
  return (
    <section id={id} className="chapter">
      <div className="chapter-side">
        <span className="chapter-number" aria-hidden="true">{number}</span>
        <p>{caption}</p>
      </div>
      <div className="chapter-body stack">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function AboutAiPage() {
  usePageTitle('How HybridCart uses AI');
  return (
    <div className="about">
      <nav className="rail" aria-label="Sections">
        {SECTIONS.map(([number, id, label]) => (
          <a key={id} href={`#${id}`}><span>{label}</span> {number}</a>
        ))}
      </nav>

      <Chapter index={0} caption="Advice without giving yourself away" title="HybridCart AI: private product advice">
        <p className="lede">
          It explains specifications, checks fit against your own needs, compares products and answers questions about your orders.
        </p>
        <p>Every request goes through Firebase AI Logic. The app, not the SDK, decides which model is allowed to see what.</p>
        <p><Link className="btn pill" to="/">Start shopping</Link></p>
      </Chapter>

      <Chapter index={1} caption="Two places an answer can be made" title="On your device, or in the cloud">
        <div className="duo">
          <div className="duo-card on_device">
            <Icon name="laptop" size={32} />
            <h3>This device</h3>
            <p>Chrome’s built-in model. Fit checks and order help always run here, and keep working offline once set up.</p>
          </div>
          <div className="duo-card in_cloud">
            <Icon name="cloud" size={32} />
            <h3>Gemini in the cloud</h3>
            <p>Used for conversations and, if you allow it, public product questions. Requests are checked by App Check.</p>
          </div>
        </div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="AI features">
          <table>
            <thead><tr><th>Feature</th><th>Uses</th><th>Where it may run</th></tr></thead>
            <tbody>
              {ROWS.map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Chapter>

      <Chapter index={2} caption="You decide, and you can check" title="Privacy you can see">
        <p>Choose <strong>Device only</strong>, <strong>Ask me each time</strong> or <strong>Cloud for product questions</strong> on <Link to="/you">your page</Link>.</p>
        <p>A solid green stamp means the answer was made on this device. A dashed blue stamp means Gemini made it in the cloud. It is filled from the source the SDK reports, and <Link to="/ledger">AI activity</Link> keeps the record.</p>
        <p>AI never sets a price, stock level, delivery date or order status, and it cannot buy, refund or change anything.</p>
      </Chapter>

      <Chapter index={3} caption="How one request travels" title="A simple architecture">
        <figure className="flow" aria-labelledby="flow-caption">
          <div className="flow-box"><strong>1. You ask</strong><span>A button on a product or order</span></div>
          <div className="flow-box"><strong>2. HybridCart decides</strong><span>What data is involved, and your privacy setting</span></div>
          <div className="flow-box"><strong>3. Firebase AI Logic runs it</strong><span>The only route to any model</span></div>
          <div className="flow-paths">
            <div className="flow-box on_device"><strong>This device</strong><span>Preferences and orders stay here</span></div>
            <div className="flow-box in_cloud"><strong>Gemini in the cloud</strong><span>Public facts and questions you allow</span></div>
          </div>
          <div className="flow-box"><strong>4. Checked and stamped</strong><span>Validated, labelled and recorded on this device</span></div>
          <figcaption id="flow-caption" className="small muted">How one AI request travels.</figcaption>
        </figure>
        <p>On-device AI needs Chrome on a desktop computer with the Prompt API, about 22 GB of free disk space and a capable graphics card or processor. Phones are not supported. The store works without it.</p>
        <LocalSetup />
      </Chapter>
    </div>
  );
}

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <Empty title="That page does not exist">
      <Link className="btn" to="/">Back to the store</Link>
    </Empty>
  );
}
