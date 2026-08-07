// ComputerBootConfigModal.tsx
//
// Modal dialog for configuring the Cloudflare Computer container's boot/preparation.
// Accessed from the chat interface when a "grok-computer" model is selected.
//
// Tabs (using Kumo UI's value/onValueChange pattern):
//   1. GitHub Repos  — repos to clone on boot (with optional private token auth)
//   2. Dotfiles      — files written to the container's home directory
//   3. Env Vars      — environment variables injected into the container
//   4. Credentials   — GitHub tokens, SSH keys, API keys
//   5. Boot Script   — shell script run after repos/dotfiles/env are set
//   6. Advanced      — grok model, auto-approve, loop/duration limits

import { useState } from 'react'
import { Input, Textarea, Button, Switch, Tabs } from '@cloudflare/kumo'
import { Trash, Plus } from '@phosphor-icons/react'
import type { ComputerBootConfig } from '@gadgets/workshop-shared/api'

// ─── Main component ─────────────────────────────────────────────────────────

export function ComputerBootConfigModal({
  open,
  onClose,
  config,
  onSave,
}: {
  open: boolean
  onClose: () => void
  config: ComputerBootConfig
  onSave: (config: ComputerBootConfig) => Promise<void>
}) {
  // ─── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('repos')
  const [githubRepos, setGithubRepos] = useState(config.githubRepos ?? [])
  const [dotfiles, setDotfiles] = useState(config.dotfiles ?? [])
  const [envVars, setEnvVars] = useState(config.envVars ?? [])
  const [credentials, setCredentials] = useState(config.credentials ?? [])
  const [bootScript, setBootScript] = useState(config.bootScript ?? '')
  const [grokModel, setGrokModel] = useState(config.grokModel ?? 'grok-build')
  const [autoApprove, setAutoApprove] = useState(config.autoApprove ?? true)
  const [maxLoops, setMaxLoops] = useState(config.maxLoopIterations ?? 1)
  const [maxDuration, setMaxDuration] = useState(config.maxDurationSeconds ?? 86400)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  // ─── Update helpers ─────────────────────────────────────────────────────
  const updateRepo = (i: number, patch: Partial<ComputerBootConfig['githubRepos'][0]>) =>
    setGithubRepos(repos => repos.map((r, j) => j === i ? { ...r, ...patch } : r))
  const removeRepo = (i: number) =>
    setGithubRepos(repos => repos.filter((_, j) => j !== i))

  const updateDotfile = (i: number, patch: Partial<ComputerBootConfig['dotfiles'][0]>) =>
    setDotfiles(dfs => dfs.map((d, j) => j === i ? { ...d, ...patch } : d))
  const removeDotfile = (i: number) =>
    setDotfiles(dfs => dfs.filter((_, j) => j !== i))

  const updateEnvVar = (i: number, patch: Partial<ComputerBootConfig['envVars'][0]>) =>
    setEnvVars(evs => evs.map((e, j) => j === i ? { ...e, ...patch } : e))
  const removeEnvVar = (i: number) =>
    setEnvVars(evs => evs.filter((_, j) => j !== i))

  const updateCredential = (i: number, patch: Partial<ComputerBootConfig['credentials'][0]>) =>
    setCredentials(creds => creds.map((c, j) => j === i ? { ...c, ...patch } : c))
  const removeCredential = (i: number) =>
    setCredentials(creds => creds.filter((_, j) => j !== i))

  // ─── Save handler ───────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        githubRepos,
        dotfiles,
        envVars,
        credentials,
        bootScript: bootScript || undefined,
        grokModel: grokModel || undefined,
        autoApprove,
        maxLoopIterations: maxLoops,
        maxDurationSeconds: maxDuration,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-kumo-surface)',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      }}>
        <h2 className="text-lg font-semibold text-kumo-strong mb-4">
          Computer Boot Configuration
        </h2>

        <Tabs
          variant="underline"
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { value: 'repos', label: 'GitHub Repos' },
            { value: 'dotfiles', label: 'Dotfiles' },
            { value: 'envvars', label: 'Env Vars' },
            { value: 'credentials', label: 'Credentials' },
            { value: 'bootscript', label: 'Boot Script' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />

        {/* ── GitHub Repos tab ─────────────────────────────────────────── */}
        {activeTab === 'repos' && (
          <div className="mt-4">
            <p className="text-xs text-kumo-subtle mb-3">
              Repositories cloned into /workspace/repos/ on container boot.
            </p>
            {githubRepos.map((repo, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">URL</label>
                  <Input
                    placeholder="https://github.com/user/repo"
                    value={repo.url}
                    onChange={e => updateRepo(i, { url: e.target.value })}
                    style={{ width: '240px' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Branch</label>
                  <Input
                    placeholder="main"
                    value={repo.branch ?? ''}
                    onChange={e => updateRepo(i, { branch: e.target.value })}
                    style={{ width: '100px' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Path</label>
                  <Input
                    placeholder="(auto)"
                    value={repo.path ?? ''}
                    onChange={e => updateRepo(i, { path: e.target.value })}
                    style={{ width: '100px' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Private</label>
                  <Switch
                    checked={repo.private ?? false}
                    onCheckedChange={v => updateRepo(i, { private: v })}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeRepo(i)}>
                  <Trash size={16} />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() =>
              setGithubRepos([...githubRepos, { url: '', branch: '', path: '', private: false }])
            }>
              <Plus size={14} className="mr-1" /> Add Repo
            </Button>
          </div>
        )}

        {/* ── Dotfiles tab ────────────────────────────────────────────── */}
        {activeTab === 'dotfiles' && (
          <div className="mt-4">
            <p className="text-xs text-kumo-subtle mb-3">
              Files written to the container's home directory (e.g. .bashrc, .gitconfig, .grok/config.toml).
            </p>
            {dotfiles.map((df, i) => (
              <div key={i} className="mb-3 border border-kumo-line rounded-md p-2">
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder=".bashrc"
                    value={df.path}
                    onChange={e => updateDotfile(i, { path: e.target.value })}
                    className="flex-1"
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeDotfile(i)}>
                    <Trash size={16} />
                  </Button>
                </div>
                <Textarea
                  placeholder="File content"
                  value={df.content}
                  onChange={e => updateDotfile(i, { content: e.target.value })}
                  rows={6}
                  className="font-mono w-full"
                />
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() =>
              setDotfiles([...dotfiles, { path: '', content: '' }])
            }>
              <Plus size={14} className="mr-1" /> Add Dotfile
            </Button>
          </div>
        )}

        {/* ── Env Vars tab ────────────────────────────────────────────── */}
        {activeTab === 'envvars' && (
          <div className="mt-4">
            <p className="text-xs text-kumo-subtle mb-3">
              Environment variables injected into the container's process environment.
            </p>
            {envVars.map((ev, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Key</label>
                  <Input
                    placeholder="KEY"
                    value={ev.key}
                    onChange={e => updateEnvVar(i, { key: e.target.value })}
                    style={{ width: '150px' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Value</label>
                  <Input
                    placeholder="value"
                    type={ev.secret ? 'password' : 'text'}
                    value={ev.value}
                    onChange={e => updateEnvVar(i, { value: e.target.value })}
                    style={{ width: '200px' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Secret</label>
                  <Switch
                    checked={ev.secret ?? false}
                    onCheckedChange={v => updateEnvVar(i, { secret: v })}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeEnvVar(i)}>
                  <Trash size={16} />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() =>
              setEnvVars([...envVars, { key: '', value: '', secret: false }])
            }>
              <Plus size={14} className="mr-1" /> Add Env Var
            </Button>
          </div>
        )}

        {/* ── Credentials tab ────────────────────────────────────────── */}
        {activeTab === 'credentials' && (
          <div className="mt-4">
            <p className="text-xs text-kumo-subtle mb-3">
              Authentication credentials stored in the container (encrypted at rest by Cloudflare).
            </p>
            {credentials.map((cred, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Type</label>
                  <select
                    value={cred.type}
                    onChange={e => updateCredential(i, { type: e.target.value as ComputerBootConfig['credentials'][0]['type'] })}
                    className="border border-kumo-line rounded px-2 py-1 text-sm"
                    style={{ width: '140px' }}
                  >
                    <option value="github-token">GitHub Token</option>
                    <option value="ssh-key">SSH Key</option>
                    <option value="api-key">API Key</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Name</label>
                  <Input
                    placeholder="GITHUB_TOKEN"
                    value={cred.name}
                    onChange={e => updateCredential(i, { name: e.target.value })}
                    style={{ width: '150px' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-kumo-subtle mb-1">Value</label>
                  <Input
                    placeholder="secret value"
                    type="password"
                    value={cred.value}
                    onChange={e => updateCredential(i, { value: e.target.value })}
                    style={{ width: '200px' }}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeCredential(i)}>
                  <Trash size={16} />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() =>
              setCredentials([...credentials, { type: 'github-token', name: '', value: '' }])
            }>
              <Plus size={14} className="mr-1" /> Add Credential
            </Button>
          </div>
        )}

        {/* ── Boot Script tab ────────────────────────────────────────── */}
        {activeTab === 'bootscript' && (
          <div className="mt-4">
            <p className="text-xs text-kumo-subtle mb-3">
              Shell script executed after repos are cloned, dotfiles written, and env vars set.
              Runs in /workspace with a 5-minute timeout.
            </p>
            <Textarea
              placeholder={'# Example:\n# npm install\n# pip install -r requirements.txt\n# ./setup.sh'}
              value={bootScript}
              onChange={e => setBootScript(e.target.value)}
              rows={12}
              className="font-mono w-full"
            />
          </div>
        )}

        {/* ── Advanced tab ───────────────────────────────────────────── */}
        {activeTab === 'advanced' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Grok Model (inside the Computer)</label>
              <Input
                value={grokModel}
                onChange={e => setGrokModel(e.target.value)}
                placeholder="grok-build"
                style={{ width: '200px' }}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Auto-approve tools (headless mode)</label>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Max loop iterations (0 = unlimited)</label>
              <Input
                type="number"
                value={String(maxLoops)}
                onChange={e => setMaxLoops(Number(e.target.value))}
                style={{ width: '100px' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Max duration (seconds, 0 = unlimited, default 86400 = 24h)</label>
              <Input
                type="number"
                value={String(maxDuration)}
                onChange={e => setMaxDuration(Number(e.target.value))}
                style={{ width: '120px' }}
              />
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  )
}
