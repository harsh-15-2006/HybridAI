// Badges are plain facts computed from the products being shown, never marketing claims.
import type { Product } from '../../domain/types.ts';

export function factBadges(products: Product[]): Map<string, string> {
  const badges = new Map<string, string>();
  if (products.length < 2) return badges;

  const award = (label: string, value: (p: Product) => number | undefined, better: 'low' | 'high', group: Product[]) => {
    const rated = group.flatMap((p) => {
      const v = value(p);
      return v == null ? [] : [{ p, v }];
    });
    if (rated.length < 2) return;
    const target = better === 'low' ? Math.min(...rated.map((r) => r.v)) : Math.max(...rated.map((r) => r.v));
    const winners = rated.filter((r) => r.v === target);
    if (winners.length === 1 && !badges.has(winners[0]!.p.id)) badges.set(winners[0]!.p.id, label);
  };
  const spec = (key: string) => (p: Product) => p.specs.find((s) => s.key === key)?.num;

  award('Lowest price here', (p) => p.priceCents, 'low', products);
  // Specs are only compared between products of the same type.
  for (const type of new Set(products.map((p) => p.type))) {
    const group = products.filter((p) => p.type === type);
    award('Longest battery', spec('battery'), 'high', group);
    award('Lightest', spec('weight'), 'low', group);
    award('Strongest noise cancelling', spec('anc'), 'high', group);
  }
  return badges;
}
