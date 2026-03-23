import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { jsPDF } from 'jspdf'
import '../manager.css'
import { APPS_SCRIPT_URL, REVIEW_CYCLE } from '../config'
import { useTheme, ThemeToggle } from '../useTheme.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const PIN_SESSION_KEY = 'rt_manager_pin_ok'
const MGR_SESSION_KEY = 'rt_manager_info' // stores JSON {name, email, department, accessLevel}
// Use localStorage so session survives page refresh / address-bar navigation
const storage = window.localStorage

const RATING_LABELS = [
  { key: 'r1', label: '1', desc: 'Needs Improvement' },
  { key: 'r2', label: '2', desc: 'Developing' },
  { key: 'r3', label: '3', desc: 'Solid' },
  { key: 'r4', label: '4', desc: 'Strong' },
  { key: 'r5', label: '5', desc: 'Outstanding' },
]

const RATING_META = {
  '1': { label: 'Needs Improvement', color: '#ef4444' },
  '2': { label: 'Developing',        color: '#f59e0b' },
  '3': { label: 'Solid',             color: '#818cf8' },
  '4': { label: 'Strong',            color: '#10b981' },
  '5': { label: 'Outstanding',       color: '#c084fc' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRow(r) {
  const win1 = r.win1 || r.wins?.[0] || ''
  const win2 = r.win2 || r.wins?.[1] || ''
  const win3 = r.win3 || r.wins?.[2] || ''
  let skillsStr = r.skills || ''
  if (Array.isArray(r.skills)) {
    skillsStr = r.skills.map(s => `${s.skill}: ${s.usage}`).filter(s => s !== ': ').join(' | ')
  }
  let checksStr = r.startupChecks || ''
  if (r.startupChecks instanceof Set) checksStr = [...r.startupChecks].join(', ')
  else if (Array.isArray(r.startupChecks)) checksStr = r.startupChecks.join(', ')
  return { ...r, win1, win2, win3, skills: skillsStr, startupChecks: checksStr }
}

function RenderSection({ title, rows }) {
  const filled = rows.filter(r => r.value)
  return (
    <div className="mgr-section">
      <div className="mgr-section-title">{title}</div>
      {filled.length > 0 ? (
        <div className="mgr-section-rows">
          {filled.map((row, i) => (
            <div key={i} className="mgr-section-row">
              <span className="mgr-row-label">{row.label}</span>
              <span className="mgr-row-value">{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mgr-section-empty">Nothing filled in yet.</div>
      )}
    </div>
  )
}

// ── Analytics View ────────────────────────────────────────────────────────────

function AnalyticsView({ employees, responses, managerInfo }) {
  const hasTeam   = employees.length > 0
  const total     = hasTeam ? employees.length : responses.length
  const submitted = hasTeam
    ? responses.filter(r => employees.some(e => e.name?.trim().toLowerCase() === r.name?.trim().toLowerCase()))
    : responses
  const pending   = hasTeam
    ? employees.filter(e => !responses.some(r => r.name?.trim().toLowerCase() === e.name?.trim().toLowerCase()))
    : []

  const rated   = responses.filter(r => r.rating)
  const emailed = responses.filter(r => r.emailSent)

  const completionPct = total ? Math.round((submitted.length / total) * 100) : 0
  const reviewedPct   = responses.length ? Math.round((rated.length / responses.length) * 100) : 0

  const avgRating = rated.length
    ? (rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length).toFixed(1)
    : '—'

  const ratingCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  rated.forEach(r => { if (ratingCounts[r.rating] !== undefined) ratingCounts[r.rating]++ })
  const maxCount = Math.max(...Object.values(ratingCounts), 1)

  return (
    <div className="mgr-analytics">

      {/* Stat cards */}
      <div className="mgr-an-cards">
        <div className="mgr-an-card">
          <div className="mgr-an-card-val" style={{ color: '#818cf8' }}>{completionPct}%</div>
          <div className="mgr-an-card-label">Submission Rate</div>
          <div className="mgr-an-mini-bar">
            <div className="mgr-an-mini-fill" style={{ width: `${completionPct}%`, background: '#6366f1' }} />
          </div>
        </div>
        <div className="mgr-an-card">
          <div className="mgr-an-card-val" style={{ color: '#c084fc' }}>{avgRating}</div>
          <div className="mgr-an-card-label">Average Rating</div>
          <div className="mgr-an-card-sub">out of 5</div>
        </div>
        <div className="mgr-an-card">
          <div className="mgr-an-card-val" style={{ color: '#10b981' }}>{rated.length}</div>
          <div className="mgr-an-card-label">Reviews Done</div>
          <div className="mgr-an-mini-bar">
            <div className="mgr-an-mini-fill" style={{ width: `${reviewedPct}%`, background: '#10b981' }} />
          </div>
        </div>
        <div className="mgr-an-card">
          <div className="mgr-an-card-val" style={{ color: '#f59e0b' }}>{emailed.length}</div>
          <div className="mgr-an-card-label">Emails Sent</div>
        </div>
      </div>

      <div className="mgr-an-row">

        {/* Rating distribution */}
        <div className="mgr-an-panel">
          <div className="mgr-an-panel-title">Rating Distribution</div>
          {rated.length === 0 ? (
            <div className="mgr-an-empty">No ratings saved yet.</div>
          ) : (
            <div className="mgr-rating-chart">
              {['5', '4', '3', '2', '1'].map(r => {
                const count = ratingCounts[r]
                const pct   = Math.round((count / maxCount) * 100)
                const meta  = RATING_META[r]
                return (
                  <div key={r} className="mgr-rc-row">
                    <div className="mgr-rc-label-wrap">
                      <span className="mgr-rc-num">{r}</span>
                      <span className="mgr-rc-desc">{meta.label}</span>
                    </div>
                    <div className="mgr-rc-bar-wrap">
                      <div
                        className="mgr-rc-bar-fill"
                        style={{
                          width: pct ? `${pct}%` : '3px',
                          background: meta.color,
                          opacity: pct ? 1 : 0.2,
                        }}
                      />
                    </div>
                    <span className="mgr-rc-count">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending employees */}
        <div className="mgr-an-panel">
          <div className="mgr-an-panel-title">
            Pending Submissions
            <span className="mgr-an-count-badge">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <div className="mgr-an-all-done">
              <span style={{ fontSize: '28px' }}>🎉</span>
              <span>Everyone has submitted!</span>
            </div>
          ) : (
            <div className="mgr-an-pending-list">
              {pending.map(emp => (
                <div key={emp.name} className="mgr-an-p-row">
                  <div className="mgr-an-p-avatar">{emp.name?.charAt(0)?.toUpperCase()}</div>
                  <div className="mgr-an-p-info">
                    <div className="mgr-an-p-name">{emp.name}</div>
                    <div className="mgr-an-p-meta">
                      {[emp.role, emp.department].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Submission timeline */}
      {responses.length > 0 && (
        <div className="mgr-an-panel mgr-an-full">
          <div className="mgr-an-panel-title">Submission Timeline</div>
          <div className="mgr-an-tl-list">
            {[...responses]
              .sort((a, b) => new Date(b.firstSubmitted || b.timestamp) - new Date(a.firstSubmitted || a.timestamp))
              .map(r => (
                <div key={r.name} className="mgr-an-tl-row">
                  <div className="mgr-an-tl-avatar">{r.name?.charAt(0)?.toUpperCase()}</div>
                  <div className="mgr-an-tl-info">
                    <div className="mgr-an-tl-name">{r.name}</div>
                    <div className="mgr-an-tl-ts">{r.firstSubmitted || r.timestamp || '—'}</div>
                  </div>
                  <div className="mgr-an-tl-badges">
                    {r.rating && (
                      <span className="mgr-an-tl-rating" style={{ color: RATING_META[r.rating]?.color }}>
                        ★ {r.rating}
                      </span>
                    )}
                    {r.emailSent && (
                      <span className="mgr-an-tl-emailed" title="Review email sent">✉ Emailed</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calibration View ──────────────────────────────────────────────────────────

function CalibrationView({ responses, onRatingChange }) {
  const [sortKey, setSortKey]         = useState('name')
  const [editingName, setEditingName] = useState(null)

  const reviewed   = responses.filter(r => r.rating)
  const unreviewed = responses.filter(r => !r.rating)

  const allRatings = reviewed.map(r => r.rating)
  const allSame    = allRatings.length > 1 && allRatings.every(r => r === allRatings[0])

  const sorted = [...reviewed].sort((a, b) => {
    if (sortKey === 'name')       return (a.name || '').localeCompare(b.name || '')
    if (sortKey === 'rating-hi')  return Number(b.rating) - Number(a.rating)
    if (sortKey === 'rating-lo')  return Number(a.rating) - Number(b.rating)
    if (sortKey === 'department') return (a.team || a.department || '').localeCompare(b.team || b.department || '')
    return 0
  })

  const handleRatingSelect = (name, rating) => {
    onRatingChange(name, rating)
    setEditingName(null)
  }

  return (
    <div className="mgr-calib">
      <div className="mgr-calib-toolbar">
        <label htmlFor="calib-sort" style={{ fontSize: '13px', opacity: 0.7 }}>Sort by:</label>
        <select
          id="calib-sort"
          className="mgr-calib-sort"
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
        >
          <option value="name">Name A→Z</option>
          <option value="rating-hi">Rating High→Low</option>
          <option value="rating-lo">Rating Low→High</option>
          <option value="department">Department</option>
        </select>
      </div>

      {allSame && (
        <div className="mgr-calib-warning">
          ⚠️ All reviewed employees have the same rating ({allRatings[0]}). This may indicate rating inflation — consider calibrating.
        </div>
      )}

      {sorted.length > 0 && (
        <table className="mgr-calib-table">
          <thead className="mgr-calib-thead">
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Rating</th>
              <th>Manager Comments</th>
            </tr>
          </thead>
          <tbody className="mgr-calib-tbody">
            {sorted.map(r => (
              <tr key={r.name} className="mgr-calib-tr">
                <td className="mgr-calib-td mgr-calib-name-cell">
                  <div className="mgr-calib-avatar">{r.name?.charAt(0)?.toUpperCase()}</div>
                  <div>
                    <div className="mgr-calib-emp-name">{r.name}</div>
                    <div className="mgr-calib-emp-role">{r.role || '—'}</div>
                  </div>
                </td>
                <td className="mgr-calib-td">{r.team || r.department || '—'}</td>
                <td className="mgr-calib-td mgr-calib-rating-cell">
                  {editingName === r.name ? (
                    <div className="mgr-calib-rating-editor">
                      {RATING_LABELS.map(({ label, desc }) => (
                        <button
                          key={label}
                          className="mgr-calib-r-btn"
                          style={{ borderColor: RATING_META[label]?.color, color: RATING_META[label]?.color }}
                          title={desc}
                          onClick={() => handleRatingSelect(r.name, label)}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        className="mgr-calib-r-btn"
                        style={{ opacity: 0.5 }}
                        onClick={() => setEditingName(null)}
                        title="Cancel"
                      >✕</button>
                    </div>
                  ) : (
                    <span
                      className="mgr-calib-rating-pill"
                      style={{
                        background: RATING_META[r.rating]?.color + '22',
                        color: RATING_META[r.rating]?.color,
                        cursor: 'pointer',
                      }}
                      onClick={() => setEditingName(r.name)}
                      title="Click to edit rating"
                    >
                      ★ {r.rating} – {RATING_META[r.rating]?.label}
                    </span>
                  )}
                </td>
                <td className="mgr-calib-td mgr-calib-comment">
                  {r.managerComments
                    ? r.managerComments.length > 60
                      ? r.managerComments.slice(0, 60) + '…'
                      : r.managerComments
                    : <span style={{ opacity: 0.4 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unreviewed.length > 0 && (
        <>
          <div className="mgr-calib-unreviewed-title">Unreviewed ({unreviewed.length})</div>
          {unreviewed.map(r => (
            <div key={r.name} className="mgr-calib-unreviewed-row">
              <div className="mgr-calib-avatar">{r.name?.charAt(0)?.toUpperCase()}</div>
              <div>
                <div className="mgr-calib-emp-name">{r.name}</div>
                <div className="mgr-calib-emp-role">{r.role || '—'}</div>
              </div>
              <div style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '12px' }}>No rating yet</div>
            </div>
          ))}
        </>
      )}

      {responses.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>
          No submitted responses to calibrate.
        </div>
      )}
    </div>
  )
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ siteConfig, onClose, onSaved, managerName, archives }) {
  const [deadline, setDeadline]         = useState(siteConfig.deadline || '')
  const [formLocked, setFormLocked]     = useState(siteConfig.form_locked === 'true')
  const [archiveName, setArchiveName]   = useState(siteConfig.current_cycle || '')
  const [newCycleName, setNewCycleName] = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [msg, setMsg]                   = useState({ text: '', ok: true })

  const postConfig = async (body) => {
    setSaving(true)
    setMsg({ text: '', ok: true })
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, actor: managerName }),
      })
      setMsg({ text: '✅ Saved!', ok: true })
      onSaved && onSaved()
    } catch {
      setMsg({ text: '❌ Failed to save. Please try again.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDeadline = () => {
    if (!deadline) return
    postConfig({ type: 'update_config', key: 'deadline', value: deadline })
  }

  const handleToggleLock = () => {
    const newVal = !formLocked
    setFormLocked(newVal)
    postConfig({ type: 'update_config', key: 'form_locked', value: String(newVal) })
  }

  const handleArchive = () => {
    if (!archiveName || !newCycleName) return
    postConfig({ type: 'archive_cycle', cycleName: archiveName, newCycle: newCycleName })
    setArchiveConfirm(false)
  }

  return (
    <div className="mgr-settings-overlay" onClick={onClose}>
      <div className="mgr-settings-drawer" onClick={e => e.stopPropagation()}>
        <div className="mgr-settings-header">
          <div className="mgr-settings-title">⚙️ Settings</div>
          <button className="mgr-settings-close" onClick={onClose}>✕</button>
        </div>

        {/* Deadline */}
        <div className="mgr-settings-section">
          <div className="mgr-settings-section-title">Deadline</div>
          <div className="mgr-settings-row">
            <label className="mgr-settings-label">Submission Deadline</label>
            <div className="mgr-settings-hint">Employees will see this date on the form.</div>
            <input
              type="date"
              className="mgr-date-input"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
            <button
              className="mgr-settings-save-btn"
              onClick={handleSaveDeadline}
              disabled={saving || !deadline}
            >
              {saving ? '…' : 'Save Deadline'}
            </button>
          </div>
        </div>

        {/* Form Lock */}
        <div className="mgr-settings-section">
          <div className="mgr-settings-section-title">Form Lock</div>
          <div className="mgr-settings-row">
            <label className="mgr-settings-label">Lock submissions</label>
            <div className="mgr-settings-hint">Locked form prevents new submissions.</div>
            <button
              className={`mgr-lock-toggle ${formLocked ? 'mgr-lock-toggle-locked' : 'mgr-lock-toggle-unlocked'}`}
              onClick={handleToggleLock}
              disabled={saving}
            >
              {formLocked ? '🔴 🔒 Locked' : '🟢 🔓 Unlocked'}
            </button>
          </div>
        </div>

        {/* Current Cycle */}
        <div className="mgr-settings-section">
          <div className="mgr-settings-section-title">Current Cycle</div>
          <div className="mgr-settings-row">
            <label className="mgr-settings-label">Active review cycle</label>
            <div className="mgr-settings-hint" style={{ fontSize: '14px', fontWeight: '500' }}>
              {siteConfig.current_cycle || REVIEW_CYCLE || '—'}
            </div>
          </div>
        </div>

        {/* Archive & New Cycle */}
        <div className="mgr-settings-section">
          <div className="mgr-settings-section-title">Archive &amp; New Cycle</div>
          <div className="mgr-settings-row">
            <label className="mgr-settings-label">Archive current data and start fresh</label>
            <div className="mgr-settings-hint">This moves all current responses to an archive sheet and resets the active cycle.</div>
            <div className="mgr-archive-inputs">
              <input
                className="mgr-archive-input"
                placeholder="Archive as (e.g. Annual 2025-26)"
                value={archiveName}
                onChange={e => setArchiveName(e.target.value)}
              />
              <input
                className="mgr-archive-input"
                placeholder="New cycle name (e.g. Q1 2026)"
                value={newCycleName}
                onChange={e => setNewCycleName(e.target.value)}
              />
            </div>
            {!archiveConfirm ? (
              <button
                className="mgr-settings-save-btn"
                onClick={() => setArchiveConfirm(true)}
                disabled={saving || !archiveName || !newCycleName}
                style={{ background: '#ef4444' }}
              >
                Archive &amp; Start Fresh
              </button>
            ) : (
              <div className="mgr-archive-confirm-zone">
                <div className="mgr-archive-confirm-text">
                  Are you sure? This archives current data and starts fresh.
                </div>
                <button className="mgr-settings-save-btn" onClick={handleArchive} disabled={saving} style={{ background: '#ef4444' }}>
                  {saving ? '…' : 'Confirm'}
                </button>
                <button className="mgr-settings-save-btn" onClick={() => setArchiveConfirm(false)} style={{ background: '#6b7280' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Past Archives */}
        {archives && archives.length > 0 && (
          <div className="mgr-settings-section">
            <div className="mgr-settings-section-title">Past Archives</div>
            <div className="mgr-archives-list">
              {archives.map(a => (
                <div key={a} className="mgr-archive-item">📦 {a}</div>
              ))}
            </div>
          </div>
        )}

        {msg.text && (
          <div className={`mgr-settings-msg ${msg.ok ? 'mgr-settings-msg-ok' : 'mgr-settings-msg-err'}`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bulk Confirm Modal ────────────────────────────────────────────────────────

function BulkConfirmModal({ people, onConfirm, onCancel, sending, msg }) {
  return (
    <div className="mgr-modal-overlay" onClick={!sending ? onCancel : undefined}>
      <div className="mgr-modal-card" onClick={e => e.stopPropagation()}>
        <div className="mgr-modal-icon">📧</div>
        <h3 className="mgr-modal-title">Send All Review Emails?</h3>
        <p className="mgr-modal-desc">
          Ready to email <strong>{people.length}</strong> employee{people.length !== 1 ? 's' : ''} who
          have been reviewed but not yet notified:
        </p>
        <div className="mgr-modal-list">
          {people.map(p => (
            <div key={p.name} className="mgr-modal-person">
              <span className="mgr-modal-avatar">{p.name?.charAt(0)?.toUpperCase()}</span>
              <span className="mgr-modal-person-name">{p.name}</span>
              <span className="mgr-modal-person-email">{p.email || '—'}</span>
            </div>
          ))}
        </div>
        {msg && <div className="mgr-modal-msg">{msg}</div>}
        <div className="mgr-modal-actions">
          <button className="mgr-modal-cancel" onClick={onCancel} disabled={sending}>Cancel</button>
          <button className="mgr-modal-confirm" onClick={onConfirm} disabled={sending}>
            {sending
              ? <><span className="mgr-spinner-inline" /> Sending…</>
              : `📧 Send ${people.length} Email${people.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PIN Login ─────────────────────────────────────────────────────────────────

function PinLogin({ onSuccess }) {
  const [email, setEmail]   = useState('')
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [shake, setShake]   = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your work email.'); return }
    if (!pin.trim())   { setError('Please enter your PIN.'); return }

    setLoading(true)
    try {
      // Try multi-manager API (email + PIN)
      const res  = await fetch(
        `${APPS_SCRIPT_URL}?action=getManagerByPin&pin=${encodeURIComponent(pin)}&email=${encodeURIComponent(email.trim().toLowerCase())}`
      )
      const json = await res.json()
      if (json.ok && json.manager) {
        const info = {
          name:        json.manager.name || 'Manager',
          email:       email.trim().toLowerCase(),
          department:  json.manager.department || '',
          accessLevel: json.manager.accessLevel || 'manager',
        }
        storage.setItem(PIN_SESSION_KEY, '1')
        storage.setItem(MGR_SESSION_KEY, JSON.stringify(info))
        onSuccess(info)
        return   // setLoading intentionally NOT reset — component is about to unmount
      }
    } catch {
      // API unavailable — fall through to env PIN check
    }

    // Admin fallback: env PIN only (no email check)
    const correctPin = import.meta.env.VITE_MANAGER_PIN
    if (correctPin && pin === correctPin) {
      const info = { name: 'Admin', email: email.trim().toLowerCase(), department: '', accessLevel: 'admin' }
      storage.setItem(PIN_SESSION_KEY, '1')
      storage.setItem(MGR_SESSION_KEY, JSON.stringify(info))
      onSuccess(info)
      return   // setLoading intentionally NOT reset — component is about to unmount
    }

    setLoading(false)
    setError('Invalid email or PIN. Please check and try again.')
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  return (
    <div className="mgr-login-wrap">
      <div className={`mgr-login-card ${shake ? 'shake' : ''}`}>
        <div className="mgr-login-icon">🔒</div>
        <h2 className="mgr-login-title">Manager Dashboard</h2>
        <p className="mgr-login-sub">Radiant Techverse · Year in Review 2025–26</p>
        <form onSubmit={handleSubmit} className="mgr-pin-form">
          <input
            className="mgr-text-input"
            type="email"
            placeholder="Work email address"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            disabled={loading}
            autoFocus
          />
          <input
            className="mgr-pin-input"
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            disabled={loading}
          />
          {error && <div className="mgr-pin-error">{error}</div>}
          <button className="mgr-pin-btn" type="submit" disabled={loading}>
            {loading ? <span className="mgr-login-spinner" /> : 'Unlock →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const { theme, toggle } = useTheme()

  // Auth
  const [authed, setAuthed] = useState(
    () => storage.getItem(PIN_SESSION_KEY) === '1'
  )
  const [managerInfo, setManagerInfo] = useState(() => {
    try {
      const raw = storage.getItem(MGR_SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  // Data
  const [employees, setEmployees] = useState([])
  const [responses, setResponses] = useState([])
  const [siteConfig, setSiteConfig] = useState({ deadline: '', current_cycle: '', form_locked: 'false' })
  const [archives, setArchives]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [loadError, setLoadError]   = useState('')

  // UI state
  const [view, setView]               = useState('team')
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedName, setSelectedName] = useState(null)
  const [cycleFilter, setCycleFilter]   = useState(REVIEW_CYCLE)
  const [showSettings, setShowSettings] = useState(false)

  // Review state
  const [reviewRating, setReviewRating]             = useState('')
  const [reviewComment, setReviewComment]           = useState('')
  const [reviewPrivateNotes, setReviewPrivateNotes] = useState('')
  const [saving, setSaving]                         = useState(false)
  const [saveMsg, setSaveMsg]                       = useState('')
  const [sending, setSending]                       = useState(false)
  const [sendMsg, setSendMsg]                       = useState('')
  const [certSending, setCertSending]               = useState(false)
  const [certMsg, setCertMsg]                       = useState('')

  // Bulk email
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkSending, setBulkSending]         = useState(false)
  const [bulkMsg, setBulkMsg]                 = useState('')

  // Grant extension
  const [extensionName, setExtensionName]   = useState('')
  const [extensionDate, setExtensionDate]   = useState('')
  const [extensionSaving, setExtensionSaving] = useState(false)
  const [extensionMsg, setExtensionMsg]     = useState('')

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [empRes, resRes, cfgRes, archRes] = await Promise.all([
        fetch(`${APPS_SCRIPT_URL}?action=getEmployees`),
        fetch(`${APPS_SCRIPT_URL}?action=getAllResponses`),
        fetch(`${APPS_SCRIPT_URL}?action=getConfig`).catch(() => null),
        fetch(`${APPS_SCRIPT_URL}?action=getArchives`).catch(() => null),
      ])
      const empJson = await empRes.json()
      const resJson = await resRes.json()
      setEmployees(empJson.employees || [])
      setResponses((resJson.rows || []).map(normalizeRow))

      if (cfgRes) {
        try {
          const cfgJson = await cfgRes.json()
          if (cfgJson.config) setSiteConfig(cfgJson.config)
        } catch { /* config fetch failed gracefully */ }
      }
      if (archRes) {
        try {
          const archJson = await archRes.json()
          if (Array.isArray(archJson.archives)) setArchives(archJson.archives)
        } catch { /* archives fetch failed gracefully */ }
      }
    } catch {
      setLoadError('Failed to load data. Check your internet connection or Apps Script deployment.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (authed) loadData() }, [authed, loadData])

  // ── Derived: submission for selected employee ──────────────────────────────
  const submission = useMemo(() =>
    selectedName
      ? responses.find(r => r.name?.trim().toLowerCase() === selectedName.trim().toLowerCase())
      : null
  , [selectedName, responses])

  // Reset review fields when selection changes
  useEffect(() => {
    setReviewRating(submission?.rating || '')
    setReviewComment(submission?.managerComments || '')
    setReviewPrivateNotes(submission?.privateNotes || '')
    setSaveMsg('')
    setSendMsg('')
    setCertMsg('')
    setExtensionMsg('')
    setExtensionDate('')
  }, [selectedName]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!authed) {
    return (
      <PinLogin
        onSuccess={(info) => {
          setManagerInfo(info)
          setAuthed(true)
        }}
      />
    )
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const getSubmission = (name) =>
    responses.find(r => r.name?.trim().toLowerCase() === name?.trim().toLowerCase())

  const extraPeople = responses
    .filter(r => !employees.some(e => e.name?.trim().toLowerCase() === r.name?.trim().toLowerCase()))
    .map(r => ({ name: r.name, email: r.email || '', role: r.role || '', department: r.team || '' }))

  const allPeople = [...employees, ...extraPeople]

  // Manager-scoped visibility:
  // Primary: match employees whose Team sheet "Manager" col equals this manager's name
  // Fallback: match by department (for employees without a manager col set)
  const visiblePeople = useMemo(() => {
    if (!managerInfo || managerInfo.accessLevel === 'admin') return allPeople
    const mgrName = managerInfo.name?.trim().toLowerCase()
    const mgrDept = managerInfo.department?.trim().toLowerCase()
    return allPeople.filter(emp => {
      const empManager = emp.manager?.trim().toLowerCase()
      if (empManager) return empManager === mgrName
      // fallback: department match if manager col is blank
      return mgrDept && emp.department?.trim().toLowerCase() === mgrDept
    })
  }, [allPeople, managerInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleResponses = useMemo(() =>
    responses.filter(r =>
      visiblePeople.some(p => p.name?.trim().toLowerCase() === r.name?.trim().toLowerCase())
    )
  , [responses, visiblePeople])

  const submittedCount = visiblePeople.filter(e => getSubmission(e.name)).length
  const pendingCount   = visiblePeople.filter(e => !getSubmission(e.name)).length

  // Unique cycles
  const uniqueCycles = useMemo(() =>
    [...new Set(visibleResponses.map(r => r.cycle).filter(Boolean))]
  , [visibleResponses])

  // Bulk eligible: reviewed but not emailed
  const bulkEligible = useMemo(() =>
    visiblePeople.filter(emp => {
      const sub = getSubmission(emp.name)
      return sub && sub.rating && !sub.emailSent
    })
  , [visiblePeople, responses]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPeople = visiblePeople.filter(emp => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      emp.name?.toLowerCase().includes(q) ||
      emp.role?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    const sub = getSubmission(emp.name)
    const matchCycle = !cycleFilter || !sub?.cycle || sub.cycle === cycleFilter
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'submitted' && sub) ||
      (filterStatus === 'pending' && !sub)
    return matchSearch && matchStatus && matchCycle
  })

  const selectedEmployee = selectedName
    ? visiblePeople.find(e => e.name?.trim().toLowerCase() === selectedName.trim().toLowerCase())
    : null

  // ── Save review ────────────────────────────────────────────────────────────
  const handleSaveReview = async () => {
    if (!selectedName) return
    setSaving(true)
    setSaveMsg('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manager_review',
          name: selectedName,
          rating: reviewRating,
          managerComments: reviewComment,
          privateNotes: reviewPrivateNotes,
          actor: managerInfo?.name || 'Manager',
        }),
      })
      setSaveMsg('✅ Review saved successfully!')
      setResponses(prev => prev.map(r =>
        r.name?.trim().toLowerCase() === selectedName.trim().toLowerCase()
          ? { ...r, rating: reviewRating, managerComments: reviewComment, privateNotes: reviewPrivateNotes }
          : r
      ))
    } catch {
      setSaveMsg('❌ Save failed. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Send email ─────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!selectedName || !reviewRating) return
    setSending(true)
    setSendMsg('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'send_email',
          name: selectedName,
          rating: reviewRating,
          managerComments: reviewComment,
        }),
      })
      setSendMsg('✅ Email sent to employee!')
      setResponses(prev => prev.map(r =>
        r.name?.trim().toLowerCase() === selectedName.trim().toLowerCase()
          ? { ...r, emailSent: 'Yes' }
          : r
      ))
    } catch {
      setSendMsg('❌ Failed to send email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ── Send certificate ───────────────────────────────────────────────────────
  const handleSendCertificate = async () => {
    if (!selectedName || !submission?.emailSent) return
    setCertSending(true)
    setCertMsg('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'send_certificate',
          name: selectedName,
        }),
      })
      setCertMsg('✅ Certificate sent!')
    } catch {
      setCertMsg('❌ Failed to send certificate.')
    } finally {
      setCertSending(false)
    }
  }

  // ── Bulk email ─────────────────────────────────────────────────────────────
  const handleBulkEmail = async () => {
    setBulkSending(true)
    setBulkMsg('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bulk_send_emails',
          cycle: cycleFilter,
        }),
      })
      setBulkMsg(`✅ Sent ${bulkEligible.length} review email${bulkEligible.length !== 1 ? 's' : ''}!`)
      const names = new Set(bulkEligible.map(e => e.name?.trim().toLowerCase()))
      setResponses(prev => prev.map(r =>
        names.has(r.name?.trim().toLowerCase()) ? { ...r, emailSent: 'Yes' } : r
      ))
    } catch {
      setBulkMsg('❌ Failed to send. Please try again.')
    } finally {
      setBulkSending(false)
    }
  }

  // ── Calibration rating change ──────────────────────────────────────────────
  const handleCalibrationRatingChange = async (name, rating) => {
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manager_review',
          name,
          rating,
          managerComments: '',
          privateNotes: '',
          actor: managerInfo?.name || 'Manager',
        }),
      })
      setResponses(prev => prev.map(r =>
        r.name?.trim().toLowerCase() === name.trim().toLowerCase()
          ? { ...r, rating }
          : r
      ))
    } catch {
      // Silently fail — calibration is best-effort
    }
  }

  // ── Grant extension ────────────────────────────────────────────────────────
  const handleGrantExtension = async () => {
    const targetName = selectedName
    if (!targetName || !extensionDate) return
    setExtensionSaving(true)
    setExtensionMsg('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'grant_extension',
          name: targetName,
          extensionDate,
          actor: managerInfo?.name || 'Manager',
        }),
      })
      setExtensionMsg(`✅ Extension granted until ${extensionDate}`)
      setEmployees(prev => prev.map(e =>
        e.name?.trim().toLowerCase() === targetName.trim().toLowerCase()
          ? { ...e, extensionDate }
          : e
      ))
    } catch {
      setExtensionMsg('❌ Failed to grant extension. Please try again.')
    } finally {
      setExtensionSaving(false)
    }
  }

  // ── Export single PDF ──────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!submission) return
    const s   = submission
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW    = doc.internal.pageSize.getWidth()
    const margin   = 18
    const contentW = pageW - margin * 2
    let y = 20

    const checkPage = (needed = 10) => {
      if (y + needed > 278) { doc.addPage(); y = 18 }
    }
    const addText = (text, size = 10, style = 'normal', color = [30, 30, 30]) => {
      doc.setFontSize(size)
      doc.setFont('helvetica', style)
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(String(text || '—'), contentW)
      lines.forEach(line => { checkPage(size * 0.45); doc.text(line, margin, y); y += size * 0.45 })
    }
    const addDivider = () => {
      checkPage(6)
      doc.setDrawColor(220, 220, 240)
      doc.line(margin, y + 2, pageW - margin, y + 2)
      y += 6
    }
    const addSectionHeader = (title) => {
      checkPage(12); y += 3
      doc.setFillColor(235, 235, 255)
      doc.roundedRect(margin - 2, y - 5, contentW + 4, 9, 1.5, 1.5, 'F')
      addText(title, 11, 'bold', [60, 60, 180]); y += 2
    }
    const addField = (label, value) => {
      if (!value) return
      checkPage(12)
      addText(label, 9, 'bold', [100, 100, 130]); y -= 1
      addText(value, 10, 'normal', [30, 30, 30]); y += 1
    }

    doc.setFillColor(40, 40, 90)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('Radiant Techverse — Year in Review 2025–26', margin, 13)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 220)
    doc.text('Employee Self-Assessment Report', margin, 21)
    y = 36

    addField('Name', s.name)
    addField('Work Email', s.email)
    addField('Role', s.role)
    addField('Team', s.team)
    addField('Submitted', s.timestamp)
    addDivider()

    addSectionHeader('🎬 Highlight Reel')
    addField('Win #1', s.win1); addField('Win #2', s.win2); addField('Win #3', s.win3)
    addField('Impact', s.impact)

    addSectionHeader('🧩 Plot Twist')
    addField('Challenge', s.challenge); addField('How Fixed', s.fix)
    addField('Learned', s.challengeLearn)

    addSectionHeader('📈 Level Up')
    addField('Skills & Tools', s.skills)

    addSectionHeader('⚡ Startup Energy')
    addField('Initiatives', s.startupChecks); addField('Story', s.startupStory)

    addSectionHeader('🤝 Team Player')
    addField('Contribution', s.teamContrib); addField('Proud Moment', s.teamMoment)

    addSectionHeader('😎 Brag + Goals')
    addField('Brag', s.brag); addField('Goal #1', s.goal1)
    addField('Goal #2', s.goal2); addField('Explore', s.explore)

    addSectionHeader('⚡ Quick Fire')
    addField('Proud of', s.qfProud); addField('Get Better At', s.qfBetter)
    addField('Make Work Easier', s.qfEasier); addField('Year Emoji', s.yearEmoji)

    if (s.rating || s.managerComments) {
      addSectionHeader('🔒 Manager Review')
      addField('Performance Rating', s.rating)
      addField('Manager Comments', s.managerComments)
      // NOTE: privateNotes intentionally excluded from PDF
    }

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 180)
      doc.text(`Radiant Techverse · Confidential · Page ${i} of ${totalPages}`, pageW / 2, 290, { align: 'center' })
    }
    doc.save(`${(s.name || 'Employee').replace(/\s+/g, '_')}_Review_2026.pdf`)
  }

  // ── Export full org report PDF ─────────────────────────────────────────────
  const handleExportFullReport = () => {
    if (!visibleResponses.length) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW    = doc.internal.pageSize.getWidth()
    const pageH    = doc.internal.pageSize.getHeight()
    const margin   = 18
    const contentW = pageW - margin * 2
    let y = 20
    let pageNum = 1

    const addFooter = () => {
      // Footer added in final pass below
    }

    const checkPage = (needed = 12) => {
      if (y + needed > pageH - 16) {
        doc.addPage()
        pageNum++
        y = 20
      }
    }

    const addText = (text, size = 10, style = 'normal', color = [30, 30, 30], align = 'left') => {
      doc.setFontSize(size)
      doc.setFont('helvetica', style)
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(String(text || ''), contentW)
      lines.forEach(line => {
        checkPage(size * 0.45)
        const x = align === 'center' ? pageW / 2 : margin
        doc.text(line, x, y, { align })
        y += size * 0.45
      })
    }

    const cycle       = siteConfig.current_cycle || REVIEW_CYCLE || 'Annual 2025-26'
    const today       = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    const totalTeam   = visiblePeople.length
    const totalSubmit = visibleResponses.length
    const rated       = visibleResponses.filter(r => r.rating)
    const avgR        = rated.length
      ? (rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length).toFixed(1)
      : '—'

    // ── Cover page ──
    doc.setFillColor(28, 28, 70)
    doc.rect(0, 0, pageW, pageH, 'F')

    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('Radiant Techverse', pageW / 2, 70, { align: 'center' })

    doc.setFontSize(15); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 230)
    doc.text('Annual Review Report 2025-26', pageW / 2, 84, { align: 'center' })

    doc.setFontSize(10); doc.setTextColor(130, 130, 180)
    doc.text(today, pageW / 2, 96, { align: 'center' })
    doc.text(`Cycle: ${cycle}`, pageW / 2, 104, { align: 'center' })

    // Stats box
    doc.setFillColor(40, 40, 100)
    doc.roundedRect(margin, 118, contentW, 44, 4, 4, 'F')

    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 200, 255)
    const colW = contentW / 3
    doc.text(`${totalTeam}`, margin + colW * 0 + colW / 2, 134, { align: 'center' })
    doc.text(`${totalSubmit}`, margin + colW * 1 + colW / 2, 134, { align: 'center' })
    doc.text(`${avgR}`, margin + colW * 2 + colW / 2, 134, { align: 'center' })

    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 200)
    doc.text('Total Team', margin + colW * 0 + colW / 2, 143, { align: 'center' })
    doc.text('Submitted', margin + colW * 1 + colW / 2, 143, { align: 'center' })
    doc.text('Avg Rating', margin + colW * 2 + colW / 2, 143, { align: 'center' })

    doc.setFontSize(8); doc.setTextColor(80, 80, 130)
    doc.text('Radiant Techverse · Confidential · Page 1', pageW / 2, pageH - 10, { align: 'center' })

    // ── Summary table page ──
    doc.addPage()
    pageNum++
    y = 20

    doc.setFillColor(40, 40, 90)
    doc.rect(0, 0, pageW, 18, 'F')
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('Team Summary', margin, 12)
    y = 26

    // Table header
    doc.setFillColor(235, 235, 255)
    doc.rect(margin - 2, y - 5, contentW + 4, 8, 'F')
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 180)
    doc.text('Name', margin, y)
    doc.text('Role', margin + 55, y)
    doc.text('Rating', margin + 110, y)
    doc.text('Emailed', margin + 130, y)
    y += 6

    visibleResponses.forEach((r, idx) => {
      checkPage(9)
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 255)
        doc.rect(margin - 2, y - 5, contentW + 4, 7, 'F')
      }
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
      doc.text(String(r.name || '').slice(0, 28), margin, y)
      doc.text(String(r.role || '—').slice(0, 24), margin + 55, y)

      const meta = r.rating ? RATING_META[r.rating] : null
      if (meta) {
        const hex = meta.color
        const ri  = parseInt(hex.slice(1, 3), 16)
        const gi  = parseInt(hex.slice(3, 5), 16)
        const bi  = parseInt(hex.slice(5, 7), 16)
        doc.setTextColor(ri, gi, bi)
        doc.text(`★ ${r.rating}`, margin + 110, y)
        doc.setTextColor(30, 30, 30)
      } else {
        doc.setTextColor(150, 150, 150)
        doc.text('—', margin + 110, y)
        doc.setTextColor(30, 30, 30)
      }
      doc.text(r.emailSent ? '✓' : '—', margin + 133, y)
      y += 7
    })

    // ── Per-employee detail pages ──
    visibleResponses.forEach(r => {
      doc.addPage()
      pageNum++
      y = 20

      doc.setFillColor(40, 40, 90)
      doc.rect(0, 0, pageW, 18, 'F')
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
      doc.text(r.name || 'Employee', margin, 12)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 220)
      if (r.role) doc.text(r.role, margin + doc.getTextWidth(r.name || '') + 6, 12)
      y = 26

      const df = (label, value) => {
        if (!value) return
        checkPage(12)
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 150)
        doc.text(label, margin, y); y += 4
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
        const lines = doc.splitTextToSize(String(value), contentW)
        lines.forEach(line => { checkPage(5); doc.text(line, margin, y); y += 4.5 })
        y += 1
      }

      const sh = (title) => {
        checkPage(14); y += 2
        doc.setFillColor(235, 235, 255)
        doc.roundedRect(margin - 2, y - 5, contentW + 4, 9, 1.5, 1.5, 'F')
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 180)
        doc.text(title, margin, y); y += 5
      }

      sh('Highlight Reel')
      df('Win #1', r.win1); df('Win #2', r.win2); df('Win #3', r.win3); df('Impact', r.impact)

      sh('Plot Twist')
      df('Challenge', r.challenge); df('How Fixed', r.fix); df('Learned', r.challengeLearn)

      sh('Level Up')
      df('Skills & Tools', r.skills)

      sh('Startup Energy')
      df('Initiatives', r.startupChecks); df('Story', r.startupStory)

      sh('Team Player')
      df('Contribution', r.teamContrib); df('Proud Moment', r.teamMoment)

      sh('Brag + Goals')
      df('Brag', r.brag); df('Goal #1', r.goal1); df('Goal #2', r.goal2); df('Explore', r.explore)

      sh('Quick Fire')
      df('Proud of', r.qfProud); df('Get Better At', r.qfBetter)
      df('Make Work Easier', r.qfEasier); df('Year Emoji', r.yearEmoji)

      if (r.rating || r.managerComments) {
        sh('Manager Review')
        if (r.rating) {
          const meta = RATING_META[r.rating]
          checkPage(10)
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 150)
          doc.text('Performance Rating', margin, y); y += 4
          if (meta) {
            const ri = parseInt(meta.color.slice(1, 3), 16)
            const gi = parseInt(meta.color.slice(3, 5), 16)
            const bi = parseInt(meta.color.slice(5, 7), 16)
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(ri, gi, bi)
            doc.text(`★ ${r.rating} – ${meta.label}`, margin, y); y += 5
            doc.setTextColor(30, 30, 30)
          }
        }
        df('Manager Comments', r.managerComments)
        // NOTE: privateNotes intentionally excluded
      }
    })

    // ── Add footers to all pages ──
    const total = doc.getNumberOfPages()
    for (let i = 2; i <= total; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 180)
      doc.text(
        `Radiant Techverse · Confidential · Page ${i} of ${total}`,
        pageW / 2, pageH - 8,
        { align: 'center' }
      )
    }
    // Fix cover page footer now that we know total
    doc.setPage(1)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 130)
    doc.text(`Radiant Techverse · Confidential · Page 1 of ${total}`, pageW / 2, pageH - 10, { align: 'center' })

    const safeCycle = cycle.replace(/[^a-zA-Z0-9_\-]/g, '_')
    doc.save(`RT_TeamReport_${safeCycle}.pdf`)
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!visibleResponses.length) return
    const headers = [
      'Name', 'Email', 'Role', 'Team', 'Cycle', 'Submitted',
      'Win 1', 'Win 2', 'Win 3', 'Impact',
      'Challenge', 'How Fixed', 'Learned',
      'Skills & Tools', 'Startup Initiatives', 'Startup Story',
      'Team Contribution', 'Team Moment',
      'Brag', 'Goal 1', 'Goal 2', 'Explore',
      'QF: Proud Of', 'QF: Get Better At', 'QF: Make Work Easier', 'Year Emoji',
      'Manager Rating', 'Manager Comments', 'Email Sent',
    ]
    const rows = visibleResponses.map(r => [
      r.name, r.email, r.role, r.team, r.cycle, r.timestamp,
      r.win1, r.win2, r.win3, r.impact,
      r.challenge, r.fix, r.challengeLearn,
      r.skills, r.startupChecks, r.startupStory,
      r.teamContrib, r.teamMoment,
      r.brag, r.goal1, r.goal2, r.explore,
      r.qfProud, r.qfBetter, r.qfEasier, r.yearEmoji,
      r.rating, r.managerComments, r.emailSent,
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`))

    const csv  = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'RT_Reviews_2025-26.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mgr-app">

      {showSettings && (
        <SettingsPanel
          siteConfig={siteConfig}
          onClose={() => setShowSettings(false)}
          onSaved={loadData}
          managerName={managerInfo?.name || 'Manager'}
          archives={archives}
        />
      )}

      {showBulkConfirm && (
        <BulkConfirmModal
          people={bulkEligible}
          onConfirm={async () => {
            await handleBulkEmail()
            setTimeout(() => { setShowBulkConfirm(false); setBulkMsg('') }, 2500)
          }}
          onCancel={() => { if (!bulkSending) { setShowBulkConfirm(false); setBulkMsg('') } }}
          sending={bulkSending}
          msg={bulkMsg}
        />
      )}

      {/* Header */}
      <header className="mgr-header">
        <div className="mgr-header-left">
          <div className="mgr-header-badge">✦ Radiant Techverse</div>
          <h1 className="mgr-header-title">Manager Dashboard</h1>
          {REVIEW_CYCLE && (
            <div className="mgr-cycle-badge">{siteConfig.current_cycle || REVIEW_CYCLE}</div>
          )}
          {managerInfo?.name && (
            <div className="mgr-manager-tag">👤 {managerInfo.name}</div>
          )}
        </div>
        <div className="mgr-header-actions">
          <div className="mgr-view-tabs">
            <button
              className={`mgr-view-tab ${view === 'team' ? 'active' : ''}`}
              onClick={() => setView('team')}
            >📋 Team</button>
            <button
              className={`mgr-view-tab ${view === 'analytics' ? 'active' : ''}`}
              onClick={() => setView('analytics')}
            >📊 Analytics</button>
            <button
              className={`mgr-view-tab ${view === 'calibrate' ? 'active' : ''}`}
              onClick={() => setView('calibrate')}
            >⚖️ Calibrate</button>
          </div>

          <ThemeToggle theme={theme} onToggle={toggle} />

          {bulkEligible.length > 0 && (
            <button
              className="mgr-btn-bulk"
              onClick={() => { setBulkMsg(''); setShowBulkConfirm(true) }}
              title={`Send review emails to ${bulkEligible.length} reviewed employees`}
            >
              📧 Send All ({bulkEligible.length})
            </button>
          )}

          <button
            className="mgr-btn-action"
            onClick={handleExportFullReport}
            disabled={!visibleResponses.length}
            title="Download full team PDF report"
          >📊 Full Report</button>

          <button
            className="mgr-btn-action"
            onClick={handleExportCSV}
            disabled={!visibleResponses.length}
            title="Download all responses as CSV"
          >⬇ Export CSV</button>

          <button
            className="mgr-btn-action"
            onClick={loadData}
            disabled={loading}
          >{loading ? '↻ Loading…' : '↻ Refresh'}</button>

          <button
            className="mgr-btn-settings"
            onClick={() => setShowSettings(true)}
          >⚙️ Settings</button>

          <button
            className="mgr-btn-logout"
            onClick={() => {
              storage.removeItem(PIN_SESSION_KEY)
              storage.removeItem(MGR_SESSION_KEY)
              setAuthed(false)
              setManagerInfo(null)
            }}
          >🔒 Lock</button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="mgr-stats-bar">
        <div className="mgr-stat">
          <div className="mgr-stat-value">{visiblePeople.length || visibleResponses.length}</div>
          <div className="mgr-stat-label">Total Team</div>
        </div>
        <div className="mgr-stat mgr-stat-green">
          <div className="mgr-stat-value">{submittedCount}</div>
          <div className="mgr-stat-label">Submitted</div>
        </div>
        <div className="mgr-stat mgr-stat-yellow">
          <div className="mgr-stat-value">{pendingCount}</div>
          <div className="mgr-stat-label">Pending</div>
        </div>
        <div className="mgr-stat">
          <div className="mgr-stat-value">
            {visiblePeople.length
              ? `${Math.round((submittedCount / visiblePeople.length) * 100)}%`
              : visibleResponses.length ? '100%' : '—'}
          </div>
          <div className="mgr-stat-label">Completion</div>
        </div>
        <div className="mgr-stat mgr-stat-accent">
          <div className="mgr-stat-value">{visibleResponses.filter(r => r.rating).length}</div>
          <div className="mgr-stat-label">Reviewed</div>
        </div>
      </div>

      {loadError && <div className="mgr-load-error">⚠️ {loadError}</div>}

      {view === 'analytics' && (
        <AnalyticsView
          employees={visiblePeople}
          responses={visibleResponses}
          managerInfo={managerInfo}
        />
      )}

      {view === 'calibrate' && (
        <CalibrationView
          responses={visibleResponses.filter(r => r.name)}
          onRatingChange={handleCalibrationRatingChange}
        />
      )}

      {view === 'team' && (
        <div className="mgr-body">

          {/* Sidebar */}
          <aside className="mgr-sidebar">

            {uniqueCycles.length > 1 && (
              <div className="mgr-cycle-filter">
                <label className="mgr-cycle-filter-label">Review Cycle</label>
                <select
                  className="mgr-cycle-select"
                  value={cycleFilter}
                  onChange={e => setCycleFilter(e.target.value)}
                >
                  <option value="">All cycles</option>
                  {uniqueCycles.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div className="mgr-sidebar-top">
              <input
                className="mgr-search"
                placeholder="🔍  Search name, role, team…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="mgr-filter-tabs">
                {['all', 'submitted', 'pending'].map(f => (
                  <button
                    key={f}
                    className={`mgr-filter-tab ${filterStatus === f ? 'active' : ''}`}
                    onClick={() => setFilterStatus(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mgr-list">
              {loading && !filteredPeople.length && (
                <div className="mgr-list-loading">
                  <div className="mgr-spinner" /> Loading team data…
                </div>
              )}
              {!loading && filteredPeople.length === 0 && (
                <div className="mgr-list-empty">
                  {search || filterStatus !== 'all'
                    ? 'No matches found.'
                    : 'No employees found. Add rows to the Team sheet.'}
                </div>
              )}
              {filteredPeople.map(emp => {
                const sub      = getSubmission(emp.name)
                const isActive = selectedName?.trim().toLowerCase() === emp.name?.trim().toLowerCase()
                const hasReview = sub && (sub.rating || sub.managerComments)
                return (
                  <button
                    key={emp.name}
                    className={`mgr-list-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedName(emp.name)}
                  >
                    <div className={`mgr-list-avatar ${sub ? 'submitted' : 'pending'}`}>
                      {emp.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="mgr-list-info">
                      <div className="mgr-list-name">{emp.name}</div>
                      <div className="mgr-list-meta">
                        {[emp.role, emp.department].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <div className="mgr-list-status">
                      <span className={`mgr-badge ${sub ? 'mgr-badge-green' : 'mgr-badge-yellow'}`}>
                        {sub ? '✓' : '…'}
                      </span>
                      {hasReview && (
                        <span className="mgr-badge mgr-badge-accent" title="Manager review saved">★</span>
                      )}
                      {sub?.emailSent && (
                        <span className="mgr-badge mgr-badge-emailed" title="Review email sent">✉</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Detail panel */}
          <main className="mgr-detail">
            {!selectedName ? (
              <div className="mgr-detail-placeholder">
                <div className="mgr-placeholder-icon">📋</div>
                <h3>Select an employee</h3>
                <p>Click on a team member to view their self-assessment and add your review.</p>
              </div>
            ) : !submission ? (
              <div className="mgr-detail-placeholder">
                <div className="mgr-placeholder-icon">⏳</div>
                <h3>{selectedEmployee?.name || selectedName}</h3>
                <p>This employee hasn't submitted their review yet.</p>
                {selectedEmployee?.email && (
                  <div className="mgr-pending-email">{selectedEmployee.email}</div>
                )}
                {selectedEmployee?.role && (
                  <div className="mgr-pending-meta">
                    {[selectedEmployee.role, selectedEmployee.department].filter(Boolean).join(' · ')}
                  </div>
                )}

                {/* Grant Extension */}
                <div className="mgr-extension-box">
                  <h4 className="mgr-extension-title">⏰ Grant Submission Extension</h4>
                  <p className="mgr-extension-hint">Allow this employee to submit after the deadline.</p>
                  <div className="mgr-extension-row">
                    <input
                      type="date"
                      className="mgr-date-input"
                      value={extensionDate}
                      onChange={e => setExtensionDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <button
                      className="mgr-btn-save"
                      onClick={handleGrantExtension}
                      disabled={!extensionDate || extensionSaving}
                    >
                      {extensionSaving ? 'Saving…' : '⏰ Grant Extension'}
                    </button>
                  </div>
                  {extensionMsg && <div className="mgr-action-msg">{extensionMsg}</div>}
                </div>
              </div>
            ) : (
              <div className="mgr-detail-content">

                {/* Employee header */}
                <div className="mgr-employee-header">
                  <div className="mgr-employee-avatar">
                    {submission.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="mgr-employee-info">
                    <h2 className="mgr-employee-name">{submission.name}</h2>
                    <div className="mgr-employee-meta">
                      {[submission.role, submission.team].filter(Boolean).join(' · ')}
                      {submission.email && <span> · {submission.email}</span>}
                    </div>
                    <div className="mgr-employee-ts-row">
                      {submission.timestamp && (
                        <span className="mgr-employee-ts">Submitted {submission.timestamp}</span>
                      )}
                      {submission.emailSent && (
                        <span className="mgr-emailed-tag">✉ Review Emailed</span>
                      )}
                    </div>
                  </div>
                  <div className="mgr-employee-cta">
                    <button className="mgr-btn-pdf" onClick={handleExportPDF}>📄 PDF</button>
                  </div>
                </div>

                {/* Self-assessment sections */}
                <RenderSection title="🎬 Highlight Reel" rows={[
                  { label: 'Win #1',  value: submission.win1   },
                  { label: 'Win #2',  value: submission.win2   },
                  { label: 'Win #3',  value: submission.win3   },
                  { label: 'Impact',  value: submission.impact  },
                ]} />
                <RenderSection title="🧩 Plot Twist" rows={[
                  { label: 'Challenge', value: submission.challenge      },
                  { label: 'How Fixed', value: submission.fix            },
                  { label: 'Learned',   value: submission.challengeLearn },
                ]} />
                <RenderSection title="📈 Level Up" rows={[
                  { label: 'Skills & Tools', value: submission.skills },
                ]} />
                <RenderSection title="⚡ Startup Energy" rows={[
                  { label: 'Initiatives', value: submission.startupChecks },
                  { label: 'Story',       value: submission.startupStory  },
                ]} />
                <RenderSection title="🤝 Team Player" rows={[
                  { label: 'Contribution', value: submission.teamContrib },
                  { label: 'Proud Moment', value: submission.teamMoment  },
                ]} />
                <RenderSection title="😎 Brag + Goals" rows={[
                  { label: 'Brag',    value: submission.brag    },
                  { label: 'Goal #1', value: submission.goal1   },
                  { label: 'Goal #2', value: submission.goal2   },
                  { label: 'Explore', value: submission.explore },
                ]} />
                <RenderSection title="⚡ Quick Fire" rows={[
                  { label: 'Proud of',         value: submission.qfProud   },
                  { label: 'Get Better At',    value: submission.qfBetter  },
                  { label: 'Make Work Easier', value: submission.qfEasier  },
                  { label: 'Year Emoji',       value: submission.yearEmoji },
                ]} />

                {/* Manager review form */}
                <div className="mgr-review-box">
                  <h3 className="mgr-review-box-title">🔒 Manager Review</h3>

                  <div className="mgr-field">
                    <label className="mgr-field-label">Performance Rating</label>
                    <div className="mgr-rating-row">
                      {RATING_LABELS.map(({ key, label, desc }) => (
                        <button
                          key={key}
                          className={`mgr-rating-btn ${key} ${reviewRating === label ? 'selected' : ''}`}
                          onClick={() => setReviewRating(label)}
                          title={desc}
                        >
                          {label}
                          <span className="mgr-rating-desc">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mgr-field">
                    <label className="mgr-field-label">
                      Manager Comments
                      <span className="mgr-label-hint">(sent to employee)</span>
                    </label>
                    <textarea
                      className="mgr-textarea"
                      placeholder="Strengths, areas of improvement, overall thoughts…"
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="mgr-field">
                    <label className="mgr-field-label">
                      🔒 Private Notes
                      <span className="mgr-label-hint">(not sent to employee or included in PDF)</span>
                    </label>
                    <textarea
                      className="mgr-textarea mgr-textarea-private"
                      placeholder="Compensation notes, promotion flags, internal observations…"
                      value={reviewPrivateNotes}
                      onChange={e => setReviewPrivateNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="mgr-review-actions">
                    <button
                      className="mgr-btn-save"
                      onClick={handleSaveReview}
                      disabled={saving}
                    >
                      {saving ? <><span className="mgr-spinner-inline" /> Saving…</> : '💾 Save Review'}
                    </button>
                    <button
                      className={`mgr-btn-email ${!reviewRating ? 'disabled' : ''}`}
                      onClick={handleSendEmail}
                      disabled={sending || !reviewRating}
                      title={!reviewRating ? 'Set a rating before sending' : 'Send review email to employee'}
                    >
                      {sending ? <><span className="mgr-spinner-inline" /> Sending…</> : '📧 Send Email'}
                    </button>
                    <button
                      className={`mgr-btn-cert ${!submission?.emailSent ? 'disabled' : ''}`}
                      onClick={handleSendCertificate}
                      disabled={certSending || !submission?.emailSent}
                      title={!submission?.emailSent ? 'Send the review email first' : 'Send completion certificate'}
                    >
                      {certSending ? <><span className="mgr-spinner-inline" /> Sending…</> : '🏆 Certificate'}
                    </button>
                  </div>

                  {(saveMsg || sendMsg || certMsg) && (
                    <div className="mgr-action-msgs">
                      {saveMsg && <div className="mgr-action-msg">{saveMsg}</div>}
                      {sendMsg && <div className="mgr-action-msg">{sendMsg}</div>}
                      {certMsg && <div className="mgr-action-msg">{certMsg}</div>}
                    </div>
                  )}
                  {!reviewRating && (
                    <p className="mgr-email-hint">💡 Set a rating to enable sending the review email.</p>
                  )}
                </div>

              </div>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
