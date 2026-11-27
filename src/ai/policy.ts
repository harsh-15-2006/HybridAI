// Routing policy. Pure functions: Firebase does not choose by task or sensitivity, the app does.
import type { PrivacySetting } from '../domain/types.ts';
import type { DataClass, PromptSpec, RequestedMode, SentField } from './types.ts';

export interface Route {
  /** Mode to try first, or null when there is no path before asking for consent. */
  first: RequestedMode | null;
  /** What may happen if the first path cannot run. */
  cloud: 'never' | 'consent' | 'included';
  /** Why nothing can run, when first is null and cloud is never. */
  blockedReason?: string;
}

const CONTACT_PATTERN = /[^\s@]+@[^\s@]+\.[a-z]{2,}|(?:\+?\d[\d\s-]{7,}\d)/i;

/** Rough screen for contact details or long numbers typed into free text. */
export function looksLikeContactDetails(text: string): boolean {
  return CONTACT_PATTERN.test(text);
}

export function strictestClass(fields: SentField[]): DataClass {
  if (fields.some((f) => f.cls === 'personal')) return 'personal';
  if (fields.some((f) => f.cls === 'user_text')) return 'user_text';
  return 'public';
}

export function route(spec: Pick<PromptSpec, 'dataClass' | 'fields' | 'cloudOnly' | 'prompt'>, setting: PrivacySetting): Route {
  const cls = spec.dataClass === 'personal' || strictestClass(spec.fields) === 'personal' ? 'personal' : spec.dataClass;

  if (cls === 'personal') return { first: 'only_on_device', cloud: 'never' };

  if (spec.cloudOnly) {
    if (setting === 'device') {
      return { first: null, cloud: 'never', blockedReason: 'Conversations need the cloud, and your setting is Device only.' };
    }
    // "Cloud for product questions" skips the sheet, unless the text looks like it holds contact details.
    if (setting === 'cloud' && !looksLikeContactDetails(spec.prompt)) return { first: 'only_in_cloud', cloud: 'included' };
    return { first: null, cloud: 'consent' };
  }

  if (setting === 'device') return { first: 'only_on_device', cloud: 'never' };

  // Words written by a person are never sent automatically.
  if (setting === 'ask' || cls === 'user_text') return { first: 'only_on_device', cloud: 'consent' };

  return { first: 'prefer_on_device', cloud: 'included' };
}

export class PrivacyViolation extends Error {}

/** Last line of defence, checked immediately before any model call. */
export function assertMayRun(spec: Pick<PromptSpec, 'dataClass' | 'fields'>, mode: RequestedMode): void {
  const personal = spec.dataClass === 'personal' || spec.fields.some((f) => f.cls === 'personal');
  if (personal && mode !== 'only_on_device') {
    throw new PrivacyViolation(`Refused: personal data may only run on this device, not with ${mode}.`);
  }
}
