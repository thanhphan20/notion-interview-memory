'use client';

import { useRef, useState } from 'react';
import Button from './ui/Button';
import { AI_PROVIDERS, getProviderInfo } from '@/lib/ai-models';
import { recommendModels, type ModelRecommendation } from '@/lib/model-recommend';
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
    fallbackStrategy?: 'failover' | 'round-robin';
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
  /** Header label shown above the fields, e.g. "Fallback 2". Required when collapsible. */
  label?: string;
  /** Renders as a collapsible accordion row (used for fallback providers) instead of always-expanded fields. */
  collapsible?: boolean;
  /** Extra class(es) on the outer card — used to show drag state (is-dragging / is-drag-over). */
  className?: string;
  /** Native HTML5 drag-and-drop wiring for reordering fallback rows. Passing onDragStart shows the drag handle. */
  onDragStart?: React.DragEventHandler<HTMLSpanElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}

type ModelFetchState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; count: number }
  | { state: 'error'; message: string };

function ProviderFields({ prefix, value, onRemove, label, collapsible, className, onDragStart, onDragOver, onDrop, onDragEnd }: ProviderFieldsProps) {
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const baseUrlInputRef = useRef<HTMLInputElement | null>(null);
  const [provider, setProvider] = useState(value.provider || 'offline');
  const [model, setModel] = useState(value.model || '');
  const providerInfo = getProviderInfo(provider);
  const isOffline = provider === 'offline';
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const [modelFetch, setModelFetch] = useState<ModelFetchState>({ state: 'idle' });
  // Fields stay mounted (see .provider-fieldset-body.is-collapsed) so form values survive
  // collapsing — only their visibility toggles. Rows with an already-configured provider
  // start collapsed to keep a long fallback list from forcing a lot of scrolling.
  const [expanded, setExpanded] = useState(() => !collapsible || !value.provider || value.provider === 'offline');
  const datalistId = `models-${prefix}`;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setProvider(next);
    const info = getProviderInfo(next);
    if (info?.defaultBaseUrl && baseUrlInputRef.current && !baseUrlInputRef.current.value) {
      baseUrlInputRef.current.value = info.defaultBaseUrl;
    }
    setModels([]);
    setRecommendations([]);
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
      setRecommendations(recommendModels(provider, fetched));
      setModelFetch({ state: 'ok', count: fetched.length });
    } catch (err: any) {
      setModels([]);
      setRecommendations([]);
      setModelFetch({ state: 'error', message: err.message || 'Failed to fetch models.' });
    }
  };

  const applyModel = (id: string) => setModel(id);

  return (
    <div
      className={`provider-fieldset${className ? ` ${className}` : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {collapsible && (
        <div className="provider-fieldset-header">
          {onDragStart && (
            <span
              className="provider-fieldset-drag-handle"
              draggable
              onDragStart={onDragStart}
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              ⠿
            </span>
          )}
          <button
            type="button"
            className="provider-fieldset-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="provider-fieldset-chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <span className="provider-fieldset-title">{label}</span>
            {!expanded && (
              <span className="provider-fieldset-meta muted">
                {providerInfo?.label || 'Offline deterministic'}{model ? ` · ${model}` : ''}
              </span>
            )}
          </button>
          {onRemove && (
            <button type="button" className="provider-fieldset-remove" onClick={onRemove} aria-label="Remove fallback">
              Remove
            </button>
          )}
        </div>
      )}
      <div className={`provider-fieldset-body${collapsible && !expanded ? ' is-collapsed' : ''}`}>
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
              value={model}
              onChange={(e) => setModel(e.target.value)}
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
          {!isOffline && recommendations.length > 0 && (
            <div className="model-recommend">
              <h5 className="model-recommend-title">
                ⭐ Recommended for you
                <small className="muted"> — best free / cheap / good-enough picks</small>
              </h5>
              <ul className="model-recommend-list">
                {recommendations.map((rec, index) => (
                  <li key={rec.id}>
                    <button type="button" className="model-recommend-item" onClick={() => applyModel(rec.id)}>
                      <span className="model-recommend-rank">#{index + 1}</span>
                      <span className="model-recommend-body">
                        <span className="model-recommend-id">{rec.label}</span>
                        <span className="model-recommend-reason">{rec.reason}</span>
                        <span className="model-recommend-badges">
                          {rec.badges.map((badge) => (
                            <span key={badge} className={`model-recommend-badge${badge === 'Free' ? ' is-free' : ''}`}>{badge}</span>
                          ))}
                        </span>
                      </span>
                      <span className="model-recommend-use">Use</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </label>
      </div>
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const addFallback = () => {
    setFallbackRows((rows) => [...rows, { id: nextFallbackId(), value: {} }]);
  };

  const removeFallback = (id: string) => {
    setFallbackRows((rows) => rows.filter((row) => row.id !== id));
  };

  const reorderFallback = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setFallbackRows((rows) => {
      const from = rows.findIndex((row) => row.id === fromId);
      const to = rows.findIndex((row) => row.id === toId);
      if (from === -1 || to === -1) return rows;
      const next = [...rows];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleDragStart = (id: string): React.DragEventHandler<HTMLSpanElement> => (e) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (id: string): React.DragEventHandler<HTMLDivElement> => (e) => {
    e.preventDefault();
    if (draggingId && draggingId !== id) setDragOverId(id);
  };

  const handleDrop = (id: string): React.DragEventHandler<HTMLDivElement> => (e) => {
    e.preventDefault();
    if (draggingId) reorderFallback(draggingId, id);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd: React.DragEventHandler<HTMLDivElement> = () => {
    setDraggingId(null);
    setDragOverId(null);
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
          <input name="topicProperty" defaultValue={settings.notion?.topicProperty || 'Technology'} />
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
        {fallbackRows.length > 0 && (
          <label className="settings-checkbox">
            <span>
              Round robin fallback
              <small className="muted"> — rotate the starting provider each call instead of always starting with the primary</small>
            </span>
            <input name="roundRobinFallback" type="checkbox" defaultChecked={settings.ai?.fallbackStrategy === 'round-robin'} />
          </label>
        )}
        {fallbackRows.map((row, index) => (
          <ProviderFields
            key={row.id}
            prefix={row.id}
            value={row.value}
            onRemove={() => removeFallback(row.id)}
            collapsible
            label={`Fallback ${index + 1}`}
            className={[
              draggingId === row.id && 'is-dragging',
              dragOverId === row.id && 'is-drag-over',
            ].filter(Boolean).join(' ')}
            onDragStart={handleDragStart(row.id)}
            onDragOver={handleDragOver(row.id)}
            onDrop={handleDrop(row.id)}
            onDragEnd={handleDragEnd}
          />
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
