'use client';

import { useRef, useState } from 'react';
import Button from './ui/Button';
import { GROQ_MODELS } from '@/lib/ai-models';

interface Settings {
  notion?: {
    token?: string;
    databaseId?: string;
    titleProperty?: string;
    topicProperty?: string;
    topics?: string[];
  };
  ai?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

interface SettingsViewProps {
  settings: Settings;
  onSave: (e: React.FormEvent) => void;
}

const CUSTOM_MODEL_VALUE = '__custom__';

export default function SettingsView({ settings, onSave }: SettingsViewProps) {
  const baseUrlInputRef = useRef<HTMLInputElement | null>(null);
  const [provider, setProvider] = useState(settings.ai?.provider === 'groq' ? 'groq' : settings.ai?.provider || 'offline');
  const [groqModelChoice, setGroqModelChoice] = useState(() => {
    const model = settings.ai?.model;
    if (model && GROQ_MODELS.some((option) => option.id === model)) return model;
    return model ? CUSTOM_MODEL_VALUE : GROQ_MODELS[0].id;
  });
  const [customGroqModel, setCustomGroqModel] = useState(
    settings.ai?.model && !GROQ_MODELS.some((option) => option.id === settings.ai?.model) ? settings.ai.model : ''
  );

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setProvider(value);
    if (value === 'groq' && baseUrlInputRef.current && !baseUrlInputRef.current.value) {
      baseUrlInputRef.current.value = 'https://api.groq.com/openai/v1';
    }
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
        <label>
          AI provider
          <select name="provider" value={provider} onChange={handleProviderChange}>
            <option value="offline">Offline deterministic</option>
            <option value="groq">Groq (free)</option>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
        </label>
        <label>
          AI API key
          <input name="apiKey" type="password" defaultValue={settings.ai?.apiKey || ''} />
        </label>
        <label>
          AI base URL
          <input
            ref={baseUrlInputRef}
            name="baseUrl"
            placeholder="https://api.openai.com/v1"
            defaultValue={settings.ai?.baseUrl || ''}
          />
        </label>
        {provider === 'groq' ? (
          <label>
            AI model
            <select
              name={groqModelChoice === CUSTOM_MODEL_VALUE ? undefined : 'model'}
              value={groqModelChoice}
              onChange={(e) => setGroqModelChoice(e.target.value)}
            >
              {GROQ_MODELS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
              <option value={CUSTOM_MODEL_VALUE}>Custom model ID...</option>
            </select>
            {groqModelChoice === CUSTOM_MODEL_VALUE && (
              <input
                name="model"
                placeholder="e.g. llama-3.1-70b-versatile"
                value={customGroqModel}
                onChange={(e) => setCustomGroqModel(e.target.value)}
              />
            )}
          </label>
        ) : (
          <label>
            AI model
            <input
              name="model"
              placeholder="gpt-4.1-mini"
              defaultValue={settings.ai?.model || ''}
            />
          </label>
        )}
        <Button type="submit">Save Settings</Button>
      </form>
    </section>
  );
}
