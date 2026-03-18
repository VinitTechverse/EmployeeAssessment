import { useState, useEffect, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import '../manager.css'
import { APPS_SCRIPT_URL } from '../config'
import { useTheme, ThemeToggle } from '../useTheme.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const PIN_SESSION_KEY = 'rt_manager_pin_ok'

const RATING_LABELS = [
  { key: 'r1', label: '1', desc: 'Needs Improvement' },
  { key: 'r2', label: '2', desc: 'Developing' },
  { key: 'r3', label: '3', desc: 'Solid' },
  { key: 'r4', label: '4', desc: 'Strong' },
  { key: 'r5', label: '5', desc: 'Outstanding' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRow(r) {
  // Normalize wins: support both {win1,win2,win3} and {wins:[...]}
  const win1 = r.win1 || r.wins?.[0] || ''
  const win2 = r.win2 || r.wins?.[1] || ''
  const win3 = r.win3 || r.wins?.[2] || ''
  // Normalize skills: support array of {skill, usage} or joined string
  let skillsStr = r.skills || ''
  if (Array.isArray(r.skills)) {
    skillsStr = r.skills.map(s => `${s.skill}: ${s.usage}`).filter(s => s !== ': ').join(' | ')
  }
  // Normalize startupChecks: support Set, array, or string
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

// ── Login Screen ──────────────────────────────────────────────────────────────

function PinLogin({ onSuccess }) {
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [shake, setShake]   = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const correctPin = import.meta.env.VITE_MANAGER_PIN
    if (pin === correctPin) {
      sessionStorage.setItem(PIN_SESSION_KEY, '1')
      onSuccess()
    } else {
      setError('Incorrect PIN. Try again.')
      setPin('')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="mgr-login-wrap">
      <div className={`mgr-login-card ${shake ? 'shake' : ''}`}>
        <div className="mgr-login-icon">🔒</div>
        <h2 className="mgr-login-title">Manager Dashboard</h2>
        <p className="mgr-login-sub">Radiant Techverse · Year in Review 2025–26</p>
        <form onSubmit={handleSubmit} className="mgr-pin-form">
          <input
            className="mgr-pin-input"
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            autoFocus
          />
          {error && <div className="mgr-pin-error">{error}</div>}
          <button className="mgr-pin-btn" type="submit">Unlock →</button>
        </form>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const { theme, toggle } = useTheme()
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(PIN_SESSION_KEY) === '1'
  )

  // Data
  const [employees, setEmployees] = useState([])   // Team sheet rows
  const [responses, setResponses] = useState([])   // Submitted form responses
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState('')

  // UI state
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'submitted' | 'pending'
  const [selectedName, setSelectedName] = useState(null)

  // Review state
  const [reviewRating, setReviewRating]   = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState('')
  const [sending, setSending]             = useState(false)
  const [sendMsg, setSendMsg]             = useState('')

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [empRes, resRes] = await Promise.all([
        fetch(`${APPS_SCRIPT_URL}?action=getEmployees`),
        fetch(`${APPS_SCRIPT_URL}?action=getAllResponses`),
      ])
      const empJson = await empRes.json()
      const resJson = await resRes.json()
      setEmployees(empJson.employees || [])
      setResponses((resJson.rows || []).map(normalizeRow))
    } catch {
      setLoadError('Failed to load data. Check your internet connection or Apps Script deployment.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (authed) loadData() }, [authed, loadData])

  // Reset review fields when selection changes
  const submission = selectedName
    ? responses.find(r => r.name?.trim().toLowerCase() === selectedName.trim().toLowerCase())
    : null

  useEffect(() => {
    setReviewRating(submission?.rating || '')
    setReviewComment(submission?.managerComments || '')
    setSaveMsg('')
    setSendMsg('')
  }, [selectedName]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!authed) return <PinLogin onSuccess={() => setAuthed(true)} />

  // ── Derived data ───────────────────────────────────────────────────────────
  const getSubmission = (name) =>
    responses.find(r => r.name?.trim().toLowerCase() === name?.trim().toLowerCase())

  // Also surface submitted responses not in Team sheet
  const extraPeople = responses
    .filter(r => !employees.some(e => e.name?.trim().toLowerCase() === r.name?.trim().toLowerCase()))
    .map(r => ({ name: r.name, email: r.email || '', role: r.role || '', department: r.team || '' }))

  const allPeople = [...employees, ...extraPeople]

  const submittedCount = employees.filter(e => getSubmission(e.name)).length
  const pendingCount   = employees.filter(e => !getSubmission(e.name)).length

  const filteredPeople = allPeople.filter(emp => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      emp.name?.toLowerCase().includes(q) ||
      emp.role?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    const sub = getSubmission(emp.name)
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'submitted' && sub) ||
      (filterStatus === 'pending' && !sub)
    return matchSearch && matchStatus
  })

  const selectedEmployee = selectedName
    ? allPeople.find(e => e.name?.trim().toLowerCase() === selectedName.trim().toLowerCase())
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
        }),
      })
      setSaveMsg('✅ Review saved successfully!')
      // Optimistically update local cache
      setResponses(prev => prev.map(r =>
        r.name?.trim().toLowerCase() === selectedName.trim().toLowerCase()
          ? { ...r, rating: reviewRating, managerComments: reviewComment }
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
    } catch {
      setSendMsg('❌ Failed to send email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!submission) return
    const s = submission
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 18
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
      lines.forEach(line => {
        checkPage(size * 0.45)
        doc.text(line, margin, y)
        y += size * 0.45
      })
    }

    const addDivider = () => {
      checkPage(6)
      doc.setDrawColor(220, 220, 240)
      doc.line(margin, y + 2, pageW - margin, y + 2)
      y += 6
    }

    const addSectionHeader = (title) => {
      checkPage(12)
      y += 3
      doc.setFillColor(235, 235, 255)
      doc.roundedRect(margin - 2, y - 5, contentW + 4, 9, 1.5, 1.5, 'F')
      addText(title, 11, 'bold', [60, 60, 180])
      y += 2
    }

    const addField = (label, value) => {
      if (!value) return
      checkPage(12)
      addText(label, 9, 'bold', [100, 100, 130])
      y -= 1
      addText(value, 10, 'normal', [30, 30, 30])
      y += 1
    }

    // ── Header block ──
    doc.setFillColor(40, 40, 90)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Radiant Techverse — Year in Review 2025–26', margin, 13)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 180, 220)
    doc.text('Employee Self-Assessment Report', margin, 21)
    y = 36

    // ── Identity ──
    addField('Name', s.name)
    addField('Work Email', s.email)
    addField('Role', s.role)
    addField('Team', s.team)
    addField('Submitted', s.timestamp)
    addDivider()

    addSectionHeader('🎬 Highlight Reel')
    addField('Win #1', s.win1)
    addField('Win #2', s.win2)
    addField('Win #3', s.win3)
    addField('Impact', s.impact)

    addSectionHeader('🧩 Plot Twist')
    addField('Challenge', s.challenge)
    addField('How Fixed', s.fix)
    addField('Learned', s.challengeLearn)

    addSectionHeader('📈 Level Up')
    addField('Skills & Tools', s.skills)

    addSectionHeader('⚡ Startup Energy')
    addField('Initiatives', s.startupChecks)
    addField('Story', s.startupStory)

    addSectionHeader('🤝 Team Player')
    addField('Contribution', s.teamContrib)
    addField('Proud Moment', s.teamMoment)

    addSectionHeader('😎 Brag + Goals')
    addField('Brag', s.brag)
    addField('Goal #1', s.goal1)
    addField('Goal #2', s.goal2)
    addField('Explore', s.explore)

    addSectionHeader('⚡ Quick Fire')
    addField('Proud of', s.qfProud)
    addField('Get Better At', s.qfBetter)
    addField('Make Work Easier', s.qfEasier)
    addField('Year Emoji', s.yearEmoji)

    if (s.rating || s.managerComments) {
      addSectionHeader('🔒 Manager Review')
      addField('Performance Rating', s.rating)
      addField('Manager Comments', s.managerComments)
    }

    // Footer on every page
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(150, 150, 180)
      doc.text(
        `Radiant Techverse · Confidential · Page ${i} of ${totalPages}`,
        pageW / 2,
        290,
        { align: 'center' }
      )
    }

    doc.save(`${(s.name || 'Employee').replace(/\s+/g, '_')}_Review_2026.pdf`)
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!responses.length) return
    const headers = [
      'Name', 'Email', 'Role', 'Team', 'Submitted',
      'Win 1', 'Win 2', 'Win 3', 'Impact',
      'Challenge', 'How Fixed', 'Learned',
      'Skills & Tools', 'Startup Initiatives', 'Startup Story',
      'Team Contribution', 'Team Moment',
      'Brag', 'Goal 1', 'Goal 2', 'Explore',
      'QF: Proud Of', 'QF: Get Better At', 'QF: Make Work Easier', 'Year Emoji',
      'Manager Rating', 'Manager Comments',
    ]
    const rows = responses.map(r => [
      r.name, r.email, r.role, r.team, r.timestamp,
      r.win1, r.win2, r.win3, r.impact,
      r.challenge, r.fix, r.challengeLearn,
      r.skills, r.startupChecks, r.startupStory,
      r.teamContrib, r.teamMoment,
      r.brag, r.goal1, r.goal2, r.explore,
      r.qfProud, r.qfBetter, r.qfEasier, r.yearEmoji,
      r.rating, r.managerComments,
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`))

    const csv = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'RT_Reviews_2025-26.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mgr-app">
      {/* Header */}
      <header className="mgr-header">
        <div className="mgr-header-left">
          <div className="mgr-header-badge">✦ Radiant Techverse</div>
          <h1 className="mgr-header-title">Manager Dashboard</h1>
        </div>
        <div className="mgr-header-actions">
          <ThemeToggle theme={theme} onToggle={toggle} />
          <button
            className="mgr-btn-action"
            onClick={handleExportCSV}
            disabled={!responses.length}
            title="Download all responses as CSV"
          >
            ⬇ Export CSV
          </button>
          <button
            className="mgr-btn-action"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
          <button
            className="mgr-btn-logout"
            onClick={() => { sessionStorage.removeItem(PIN_SESSION_KEY); setAuthed(false) }}
          >
            🔒 Lock
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="mgr-stats-bar">
        <div className="mgr-stat">
          <div className="mgr-stat-value">{employees.length || responses.length}</div>
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
            {employees.length
              ? `${Math.round((submittedCount / employees.length) * 100)}%`
              : responses.length ? '100%' : '—'}
          </div>
          <div className="mgr-stat-label">Completion</div>
        </div>
        <div className="mgr-stat mgr-stat-accent">
          <div className="mgr-stat-value">
            {responses.filter(r => r.rating).length}
          </div>
          <div className="mgr-stat-label">Reviewed</div>
        </div>
      </div>

      {loadError && (
        <div className="mgr-load-error">⚠️ {loadError}</div>
      )}

      {/* Body: sidebar + detail */}
      <div className="mgr-body">
        {/* Sidebar — employee list */}
        <aside className="mgr-sidebar">
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
                  ? 'No matches found. Try adjusting your search.'
                  : 'No employees found. Add rows to the Team sheet in Google Sheets.'}
              </div>
            )}
            {filteredPeople.map(emp => {
              const sub = getSubmission(emp.name)
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
              <p>Click on a team member from the list to view their self-assessment and add your review.</p>
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
                  {submission.timestamp && (
                    <div className="mgr-employee-ts">Submitted {submission.timestamp}</div>
                  )}
                </div>
                <div className="mgr-employee-cta">
                  <button className="mgr-btn-pdf" onClick={handleExportPDF}>
                    📄 PDF
                  </button>
                </div>
              </div>

              {/* Review sections */}
              <RenderSection title="🎬 Highlight Reel" rows={[
                { label: 'Win #1',  value: submission.win1 },
                { label: 'Win #2',  value: submission.win2 },
                { label: 'Win #3',  value: submission.win3 },
                { label: 'Impact',  value: submission.impact },
              ]} />
              <RenderSection title="🧩 Plot Twist" rows={[
                { label: 'Challenge',  value: submission.challenge },
                { label: 'How Fixed',  value: submission.fix },
                { label: 'Learned',    value: submission.challengeLearn },
              ]} />
              <RenderSection title="📈 Level Up" rows={[
                { label: 'Skills & Tools', value: submission.skills },
              ]} />
              <RenderSection title="⚡ Startup Energy" rows={[
                { label: 'Initiatives', value: submission.startupChecks },
                { label: 'Story',       value: submission.startupStory },
              ]} />
              <RenderSection title="🤝 Team Player" rows={[
                { label: 'Contribution', value: submission.teamContrib },
                { label: 'Proud Moment', value: submission.teamMoment },
              ]} />
              <RenderSection title="😎 Brag + Goals" rows={[
                { label: 'Brag',    value: submission.brag },
                { label: 'Goal #1', value: submission.goal1 },
                { label: 'Goal #2', value: submission.goal2 },
                { label: 'Explore', value: submission.explore },
              ]} />
              <RenderSection title="⚡ Quick Fire" rows={[
                { label: 'Proud of',         value: submission.qfProud },
                { label: 'Get Better At',    value: submission.qfBetter },
                { label: 'Make Work Easier', value: submission.qfEasier },
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
                  <label className="mgr-field-label">Manager Comments</label>
                  <textarea
                    className="mgr-textarea"
                    placeholder="Strengths, areas of improvement, overall thoughts…"
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={4}
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
                    title={!reviewRating ? 'Set a rating before sending the email' : 'Send review email to employee'}
                  >
                    {sending ? <><span className="mgr-spinner-inline" /> Sending…</> : '📧 Send Email'}
                  </button>
                </div>

                {(saveMsg || sendMsg) && (
                  <div className="mgr-action-msgs">
                    {saveMsg && <div className="mgr-action-msg">{saveMsg}</div>}
                    {sendMsg && <div className="mgr-action-msg">{sendMsg}</div>}
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
    </div>
  )
}
