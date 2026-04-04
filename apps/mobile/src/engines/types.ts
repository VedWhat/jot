export type EngineName = 'webspeech' | 'whisper' | 'elevenlabs';

export interface EngineConfig {
  name: EngineName;
  label: string;
  /** Whether the engine streams live interim results while speaking */
  isLive: boolean;
  /** Whether the engine requires an API key */
  requiresApiKey: boolean;
  apiKeyStorageKey?: string;
}

export const ENGINES: EngineConfig[] = [
  {
    name: 'webspeech',
    label: 'webspeech',
    isLive: true,
    requiresApiKey: false,
  },
  {
    name: 'whisper',
    label: 'whisper',
    isLive: false,
    requiresApiKey: true,
    apiKeyStorageKey: 'openai_api_key',
  },
  {
    name: 'elevenlabs',
    label: 'elevenlabs',
    isLive: false,
    requiresApiKey: true,
    apiKeyStorageKey: 'elevenlabs_api_key',
  },
];

export function getEngineConfig(name: EngineName): EngineConfig {
  return ENGINES.find((e) => e.name === name)!;
}
