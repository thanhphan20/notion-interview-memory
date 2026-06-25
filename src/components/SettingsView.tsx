'use client';

import Button from './ui/Button';

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

export default function SettingsView({ settings, onSave }: SettingsViewProps) {
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
          <select name="provider" defaultValue={settings.ai?.provider || 'offline'}>
            <option value="offline">Offline deterministic</option>
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
            name="baseUrl"
            placeholder="https://api.openai.com/v1"
            defaultValue={settings.ai?.baseUrl || ''}
          />
        </label>
        <label>
          AI model
          <input
            name="model"
            placeholder="gpt-4.1-mini"
            defaultValue={settings.ai?.model || ''}
          />
        </label>
        <Button type="submit">Save Settings</Button>
      </form>
    </section>
  );
}
