// Remote Config with safe built-in defaults. Only fetched against a real project.
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { app } from '../firebase/app.ts';
import { backendMode } from '../firebase/config.ts';
import type { PrivacySetting } from '../domain/types.ts';

export interface Flags {
  cloudModel: string;
  askAnythingEnabled: boolean;
  maxReviewsDigest: number;
  maxCompareItems: number;
  defaultPrivacySetting: PrivacySetting;
}

export const flags: Flags = {
  cloudModel: 'gemini-3.5-flash-lite',
  askAnythingEnabled: true,
  maxReviewsDigest: 6,
  maxCompareItems: 3,
  defaultPrivacySetting: 'ask',
};

export async function loadRemoteFlags(): Promise<void> {
  if (backendMode !== 'live') return;
  try {
    const rc = getRemoteConfig(app);
    rc.defaultConfig = {
      cloud_model: flags.cloudModel,
      feature_f7_enabled: flags.askAnythingEnabled,
      max_reviews_digest: flags.maxReviewsDigest,
      max_compare_items: flags.maxCompareItems,
      default_privacy_setting: flags.defaultPrivacySetting,
    };
    await fetchAndActivate(rc);
    flags.cloudModel = getValue(rc, 'cloud_model').asString() || flags.cloudModel;
    flags.askAnythingEnabled = getValue(rc, 'feature_f7_enabled').asBoolean();
    flags.maxReviewsDigest = Math.min(12, Math.max(1, getValue(rc, 'max_reviews_digest').asNumber()));
    flags.maxCompareItems = Math.min(3, Math.max(2, getValue(rc, 'max_compare_items').asNumber()));
    const s = getValue(rc, 'default_privacy_setting').asString();
    // A remote default may only ever be as strict as, or stricter than, "ask".
    flags.defaultPrivacySetting = s === 'device' ? 'device' : 'ask';
  } catch (error) {
    console.warn('Remote Config unavailable, using built-in defaults.', error);
  }
}
