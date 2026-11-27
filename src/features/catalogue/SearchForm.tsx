import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../design/icons.tsx';

export function SearchForm({ initial = '', compact }: { initial?: string; compact?: boolean }) {
  const [query, setQuery] = useState(initial);
  const navigate = useNavigate();
  const id = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };
  return (
    <form className={`searchbar ${compact ? 'compact' : ''}`} role="search" onSubmit={submit}>
      <Icon name="spark" size={18} />
      <label htmlFor={id} className="sr-only">Describe what you need</label>
      <input id={id} value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)}
        placeholder={compact ? 'I need quiet headphones under ₹10,000' : 'quiet headphones for long flights under ₹10,000'} />
      <button type="submit" className="search-go" aria-label="Search">
        <Icon name="search" size={18} />
      </button>
    </form>
  );
}
