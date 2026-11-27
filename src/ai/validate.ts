// Model output is untrusted. Nothing is shown or used unless it passes these checks.
import { z } from 'zod';
import type { SchemaName } from './types.ts';

const line = z.string().trim().min(1).max(320);

export const schemas = {
  fit: z.object({
    verdict: z.enum(['fits', 'partly', 'does_not_fit']),
    reasons: z.array(line).min(1).max(4),
    watchOut: z.string().trim().max(320),
  }),
  compare: z.object({ summary: z.string().trim().min(1).max(700), tradeoffs: z.array(line).min(1).max(5) }),
  digest: z.object({ liked: z.array(line).max(4), disliked: z.array(line).max(4) }),
  search: z.object({
    category: z.enum(['audio', 'computers', 'air', 'phones', 'wearables', 'accessories', 'any']),
    maxPrice: z.number().min(0).max(10_000_000),
    keywords: z.array(z.string().trim().min(1).max(30)).max(6),
  }),
  screen: z.object({ suggestion: z.enum(['publish_ok', 'needs_look']), reason: z.string().trim().max(240) }),
} satisfies Record<SchemaName, z.ZodType>;

export type FitResult = z.infer<typeof schemas.fit>;
export type CompareResult = z.infer<typeof schemas.compare>;
export type DigestResult = z.infer<typeof schemas.digest>;
export type SearchResult = z.infer<typeof schemas.search>;
export type ScreenResult = z.infer<typeof schemas.screen>;

/** Plain JSON schemas: passed to the on-device model and converted for the cloud model. */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number';
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
}

const str: JsonSchema = { type: 'string' };
const strings: JsonSchema = { type: 'array', items: str };
const oneOf = (...values: string[]): JsonSchema => ({ type: 'string', enum: values });
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const jsonSchemas: Record<SchemaName, JsonSchema> = {
  fit: obj({ verdict: oneOf('fits', 'partly', 'does_not_fit'), reasons: strings, watchOut: str }),
  compare: obj({ summary: str, tradeoffs: strings }),
  digest: obj({ liked: strings, disliked: strings }),
  search: obj({ category: oneOf('audio', 'computers', 'air', 'phones', 'wearables', 'accessories', 'any'), maxPrice: { type: 'number' }, keywords: strings }),
  screen: obj({ suggestion: oneOf('publish_ok', 'needs_look'), reason: str }),
};

// A rupee amount written as "₹1,999", "Rs. 1999", "INR 1999" or "1999 rupees".
const MONEY = /(?:₹|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:rupees\b|inr\b)/gi;
const amounts = (text: string) => [...text.matchAll(MONEY)].map((m) => Number((m[1] ?? m[2])!.replace(/,/g, '')));

/** Rejects answers quoting a rupee amount that was not in the prompt, or any dollar amount. */
export function inventsAPrice(output: string, prompt: string): boolean {
  if (/\$\s?\d/.test(output)) return true; // the store sells only in rupees
  const known = new Set(amounts(prompt));
  return amounts(output).some((n) => !known.has(n));
}

export class InvalidOutput extends Error {}

export function parseOutput(raw: string, schema: SchemaName | undefined, grounding: string): unknown {
  const text = raw.trim();
  if (!text) throw new InvalidOutput('Empty answer');
  // Search turns the shopper's own words into filters, so amounts need not match the prompt.
  if (schema !== 'search' && inventsAPrice(text, grounding)) throw new InvalidOutput('Quoted a price that is not in the facts');
  if (!schema) {
    if (text.length > 4000) throw new InvalidOutput('Answer too long');
    return text;
  }
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new InvalidOutput('Not valid JSON');
  }
  const parsed = schemas[schema].safeParse(value);
  if (!parsed.success) throw new InvalidOutput('Unexpected shape');
  return parsed.data;
}
