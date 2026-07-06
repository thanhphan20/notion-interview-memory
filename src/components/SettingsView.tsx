'use client';

import { useRef, useState } from 'react';
import Button from './ui/Button';
import { AI_PROVIDERS, getProviderInfo } from '@/lib/ai-models';
import { getApiClient } from '@/lib/api-client';
import type { AiModelOption, AiPingResult } from '@/lib/api-client';

interface AiProviderConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface Settings {
  notion?: {
    token?: string;
    databaseId?: string;
    titleProperty?: string;
    topicProperty?: string;
    topics?: string[];
  };
  ai?: AiProviderConfig & {
    compressInput?: boolean;
    maxInputTokens?: number;
    fallbacks?: AiProviderConfig[];
  };
}

interface SettingsViewProps {
  settings: Settings;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  onPingProviders: (form: HTMLFormElement) => void;
  providerCheckResults?: AiPingResult[] | null;
  providerCheckPending?: boolean;
}

/** Field-name prefix for a provider block: 'ai' for the primary, 'fallback-<id>' for each fallback row. */
function fieldName(prefix: string, field: string): string {
  return `${prefix}.${field}`;
}

interface ProviderFieldsProps {
  prefix: string;
  value: AiProviderConfig;
  onRemove?: () => void;
}

type ModelFetchState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; count: number }
  | { state: 'error'; message: string };

function ProviderFields({ prefix, value, onRemove }: ProviderFieldsProps) {
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const baseUrlInputRef = useRef<HTMLInputElement | null>(null);
  const [provider, setProvider] = useState(value.provider || 'offline');
  const providerInfo = getProviderInfo(provider);
  const isOffline = provider === 'offline';
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelFetch, setModelFetch] = useState<ModelFetchState>({ state: 'idle' });
  const datalistId = `models-${prefix}`;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setProvider(next);
    const info = getProviderInfo(next);
    if (info?.defaultBaseUrl && baseUrlInputRef.current && !baseUrlInputRef.current.value) {
      baseUrlInputRef.current.value = info.defaultBaseUrl;
    }
    setModels([]);
    setModelFetch({ state: 'idle' });
  };

  const handleFetchModels = async () => {
    setModelFetch({ state: 'loading' });
    try {
      const fetched = await getApiClient().listAiModels({
        provider,
        apiKey: apiKeyInputRef.current?.value.trim(),
        baseUrl: baseUrlInputRef.current?.value.trim(),
      });
      setModels(fetched);
      setModelFetch({ state: 'ok', count: fetched.length });
    } catch (err: any) {
      setModelFetch({ state: 'error', message: err.message || 'Failed to fetch models.' });
    }
  };

  return (
    <div className="provider-fieldset">
      {onRemove && (
        <button type="button" className="provider-fieldset-remove" onClick={onRemove} aria-label="Remove fallback">
          Remove
        </button>
      )}
      <label>
        Provider
        <select name={fieldName(prefix, 'provider')} value={provider} onChange={handleProviderChange}>
          {AI_PROVIDERS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        API key
        <input ref={apiKeyInputRef} name={fieldName(prefix, 'apiKey')} type="password" defaultValue={value.apiKey || ''} />
      </label>
      <label>
        Base URL
        <input
          ref={baseUrlInputRef}
          name={fieldName(prefix, 'baseUrl')}
          placeholder={providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1'}
          defaultValue={value.baseUrl || ''}
        />
      </label>
      <label>
        Model
        <div className="model-field-row">
          <input
            name={fieldName(prefix, 'model')}
            list={isOffline ? undefined : datalistId}
            placeholder={isOffline ? 'n/a' : (providerInfo?.defaultModel || 'e.g. llama-3.3-70b-versatile')}
            defaultValue={value.model || ''}
            disabled={isOffline}
          />
          {!isOffline && (
            <Button type="button" variant="secondary" onClick={handleFetchModels} disabled={modelFetch.state === 'loading'}>
              {modelFetch.state === 'loading' ? 'Fetching…' : 'Fetch models'}
            </Button>
          )}
        </div>
        {!isOffline && (
          <datalist id={datalistId}>
            {models.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </datalist>
        )}
        {modelFetch.state === 'ok' && (
          <small className="muted">Found {modelFetch.count} model(s) — pick one from the list or keep typing.</small>
        )}
        {modelFetch.state === 'error' && (
          <small className="field-error">{modelFetch.message}</small>
        )}
      </label>
    </div>
  );
}

let fallbackIdCounter = 0;
function nextFallbackId(): string {
  fallbackIdCounter += 1;
  return `fallback-${fallbackIdCounter}`;
}

function ProviderCheckList({ results, pending }: { results?: AiPingResult[] | null; pending?: boolean }) {
  if (!pending && (!results || results.length === 0)) return null;
  return (
    <div className="provider-check-list">
      <h4>Connection check</h4>
      {pending ? (
        <p className="muted">Pinging configured providers…</p>
      ) : (
        <ul>
          {results!.map((result, index) => (
            <li key={index} className={result.ok ? 'provider-check-ok' : 'provider-check-fail'}>
              <strong>{result.ok ? '✓' : '✗'} {result.label}</strong> ({result.provider}) — {result.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SettingsView({ settings, onSave, onPingProviders, providerCheckResults, providerCheckPending }: SettingsViewProps) {
  const [fallbackRows, setFallbackRows] = useState(() =>
    (settings.ai?.fallbacks || []).map((fb) => ({ id: nextFallbackId(), value: fb }))
  );

  const addFallback = () => {
    setFallbackRows((rows) => [...rows, { id: nextFallbackId(), value: {} }]);
  };

  const removeFallback = (id: string) => {
    setFallbackRows((rows) => rows.filter((row) => row.id !== id));
  };

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Settings</h2>
          <p className="muted">Local-only configuration for Notion and AI providers.</p>
        </div>
      </div>
      <form onSubmit={onSave} className="settings-grid">
        <label>
          Notion token
          <input name="token" type="password" defaultValue={settings.notion?.token || ''} />
        </label>
        <label>
          Notion database ID
          <input name="databaseId" defaultValue={settings.notion?.databaseId || ''} />
        </label>
        <label>
          Title property
          <input name="titleProperty" defaultValue={settings.notion?.titleProperty || 'Name'} />
        </label>
        <label>
          Topic property
          <input name="topicProperty" defaultValue={settings.notion?.topicProperty || 'Topic'} />
        </label>
        <label>
          Topic filters
          <input
            name="topics"
            placeholder="System Design,JavaScript"
            defaultValue={Array.isArray(settings.notion?.topics) ? settings.notion.topics.join(',') : ''}
          />
        </label>

        <h3 className="settings-subheading">Primary AI provider</h3>
        <ProviderFields prefix="ai" value={settings.ai || {}} />

        <label className="settings-checkbox">
          <span>
            Compress input
            <small className="muted"> — strip redundant whitespace/duplicates to save tokens</small>
          </span>
          <input name="compressInput" type="checkbox" defaultChecked={settings.ai?.compressInput !== false} />
        </label>
        <label>
          Max input tokens
          <input
            name="maxInputTokens"
            type="number"
            min={0}
            placeholder="2000"
            defaultValue={settings.ai?.maxInputTokens ?? ''}
          />
        </label>

        <h3 className="settings-subheading">
          Fallback providers
          <small className="muted"> — tried in order if the primary (or an earlier fallback) fails</small>
        </h3>
        {fallbackRows.map((row) => (
          <ProviderFields key={row.id} prefix={row.id} value={row.value} onRemove={() => removeFallback(row.id)} />
        ))}
        <input type="hidden" name="fallbackIds" value={fallbackRows.map((row) => row.id).join(',')} />
        <Button type="button" variant="secondary" onClick={addFallback}>+ Add fallback provider</Button>

        <div className="actions">
          <Button type="submit">Save Settings</Button>
          <Button
            type="button"
            variant="secondary"
            disabled={providerCheckPending}
            onClick={(e) => onPingProviders(e.currentTarget.form!)}
          >
            {providerCheckPending ? 'Testing…' : 'Test AI providers'}
          </Button>
        </div>

        <ProviderCheckList results={providerCheckResults} pending={providerCheckPending} />
      </form>
    </section>
  );
}
