// The only module that talks to Firebase AI Logic. Verified against firebase 13.4.0 type
// declarations and the adapter source (see docs/TECHNICAL_RESEARCH.md).
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  Schema,
  type GenerativeModel,
  type HybridParams,
} from 'firebase/ai';
import { flags } from '../config/remote.ts';
import { app } from '../firebase/app.ts';
import { cloudAiConfigured } from '../firebase/config.ts';
import type { ModelReply } from './run.ts';
import type { LocalStatus, MadeBy, PromptSpec, RequestedMode, SchemaName } from './types.ts';
import { jsonSchemas, type JsonSchema } from './validate.ts';

const ON_DEVICE_OPTIONS = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

const MODES = {
  only_on_device: InferenceMode.ONLY_ON_DEVICE,
  prefer_on_device: InferenceMode.PREFER_ON_DEVICE,
  only_in_cloud: InferenceMode.ONLY_IN_CLOUD,
};

let ai: ReturnType<typeof getAI> | null = null;
const service = () => (ai ??= getAI(app, { backend: new GoogleAIBackend() }));

function toCloudSchema(s: JsonSchema): Schema {
  if (s.type === 'object') {
    return Schema.object({ properties: Object.fromEntries(Object.entries(s.properties!).map(([k, v]) => [k, toCloudSchema(v)])) });
  }
  if (s.type === 'array') return Schema.array({ items: toCloudSchema(s.items!) });
  if (s.type === 'number') return Schema.number();
  return s.enum ? Schema.enumString({ enum: s.enum }) : Schema.string();
}

function params(mode: RequestedMode, schema?: SchemaName, system?: string): HybridParams {
  const json = schema ? jsonSchemas[schema] : undefined;
  return {
    mode: MODES[mode],
    // The SDK may mutate these, so each instance gets its own copy.
    onDeviceParams: {
      createOptions: structuredClone(ON_DEVICE_OPTIONS),
      ...(json && { promptOptions: { responseConstraint: json } }),
    },
    inCloudParams: {
      model: flags.cloudModel,
      ...(system && { systemInstruction: system }),
      ...(json && { generationConfig: { responseMimeType: 'application/json', responseSchema: toCloudSchema(json) } }),
    },
  };
}

const cache = new Map<string, GenerativeModel>();

/** Configuration is fixed per instance, so there is one instance per mode and output shape. */
function model(mode: RequestedMode, schema?: SchemaName): GenerativeModel {
  const key = `${mode}:${schema ?? 'text'}:${flags.cloudModel}`;
  let m = cache.get(key);
  if (!m) cache.set(key, (m = getGenerativeModel(service(), params(mode, schema))));
  return m;
}

const toMadeBy = (source: string | undefined): MadeBy | undefined =>
  source === InferenceSource.ON_DEVICE ? 'on_device' : source === InferenceSource.IN_CLOUD ? 'in_cloud' : undefined;

// The SDK destroys the previous on-device session when it creates a new one,
// so calls that may run locally are queued one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

async function call(mode: RequestedMode, spec: PromptSpec, onText?: (soFar: string) => void): Promise<ModelReply> {
  if (spec.chat) {
    const chatModel = getGenerativeModel(service(), params(mode, undefined, spec.chat.system));
    const chat = chatModel.startChat({ history: spec.chat.history.map((t) => ({ role: t.role, parts: [{ type: 'text' as const, text: t.text }] })) });
    return collect(await chat.sendMessageStream(spec.prompt), onText);
  }
  const m = model(mode, spec.schema);
  if (onText && !spec.schema) return collect(await m.generateContentStream(spec.prompt), onText);
  const { response } = await m.generateContent(spec.prompt);
  return { text: response.text(), source: toMadeBy(response.inferenceSource) };
}

async function collect(
  result: Awaited<ReturnType<GenerativeModel['generateContentStream']>>,
  onText?: (soFar: string) => void,
): Promise<ModelReply> {
  let text = '';
  for await (const chunk of result.stream) {
    text += chunk.text();
    onText?.(text);
  }
  const response = await result.response;
  return { text, source: toMadeBy(response.inferenceSource) };
}

export function invoke(mode: RequestedMode, spec: PromptSpec, onText?: (soFar: string) => void): Promise<ModelReply> {
  return mode === 'only_in_cloud' ? call(mode, spec, onText) : serial(() => call(mode, spec, onText));
}

// ---- On-device availability and setup ----------------------------------

interface PromptApi {
  availability: (options: unknown) => Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
}

export async function localStatus(): Promise<LocalStatus> {
  const api = (globalThis as unknown as { LanguageModel?: PromptApi }).LanguageModel;
  if (!api) return 'unsupported';
  try {
    return await api.availability(structuredClone(ON_DEVICE_OPTIONS));
  } catch {
    return 'unavailable';
  }
}

/** Must be called straight from a click: Chrome requires user activation to download. */
export function setUpLocalModel(onProgress: (fraction: number) => void): Promise<void> {
  return model('only_on_device').initializeDeviceModel(onProgress);
}

export function cloudReady(): { ok: true } | { ok: false; reason: string } {
  if (!cloudAiConfigured) return { ok: false, reason: 'Cloud AI needs a Firebase project, which is not configured here.' };
  if (!navigator.onLine) return { ok: false, reason: 'You are offline, so the cloud cannot be reached.' };
  return { ok: true };
}
