import { NavLink } from 'react-router';
import { Icon, type IconName } from '../../design/icons.tsx';

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/you', label: 'My preferences and privacy', icon: 'sliders' },
  { to: '/orders', label: 'My orders', icon: 'box' },
  { to: '/ledger', label: 'AI activity', icon: 'list' },
  { to: '/about-ai', label: 'How AI works here', icon: 'spark' },
  { to: '/help', label: 'Delivery and returns', icon: 'help' },
];

export function AccountNav() {
  return (
    <aside className="account-nav" aria-label="Your account">
      <div className="account-card">
        <span className="avatar"><Icon name="user" size={22} /></span>
        <div>
          <strong>Guest shopper</strong>
          <p className="small muted">Saved in this browser</p>
        </div>
      </div>
      <nav>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end>
            <Icon name={l.icon} size={18} />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
