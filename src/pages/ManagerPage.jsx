import { useState, useEffect, useCallback, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import '../manager.css'
import { APPS_SCRIPT_URL, REVIEW_CYCLE } from '../config'
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

// ── Feature 1: Analytics View ─────────────────────────────────────────────────

function AnalyticsView({ employees, responses }) {
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
          <div className="mgr-an-card-label">Avg Rating</div>
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

// ── Feature 4: Bulk Email Confirm Modal ───────────────────────────────────────

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
  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

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
  const [employees, setEmployees] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState('')

  // UI state
  const [view, setView]               = useState('team')    // 'team' | 'analytics'
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedName, setSelectedName] = useState(null)
  const [cycleFilter, setCycleFilter]   = useState(REVIEW_CYCLE)

  // Review state (Feature 2: privateNotes added)
  const [reviewRating, setReviewRating]               = useState('')
  const [reviewComment, setReviewComment]             = useState('')
  const [reviewPrivateNotes, setReviewPrivateNotes]   = useState('')
  const [saving, setSaving]                           = useState(false)
  const [saveMsg, setSaveMsg]                         = useState('')
  const [sending, setSending]                         = useState(false)
  const [sendMsg, setSendMsg]                         = useState('')

  // Feature 4: Bulk email state
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkSending, setBulkSending]         = useState(false)
  const [bulkMsg, setBulkMsg]                 = useState('')

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
    setReviewPrivateNotes(submission?.privateNotes || '')
    setSaveMsg('')
    setSendMsg('')
  }, [selectedName]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!authed) return <PinLogin onSuccess={() => setAuthed(true)} />

  // ── Derived data ───────────────────────────────────────────────────────────
  const getSubmission = (name) =>
    responses.find(r => r.name?.trim().toLowerCase() === name?.trim().toLowerCase())

  const extraPeople = responses
    .filter(r => !employees.some(e => e.name?.trim().toLowerCase() === r.name?.trim().toLowerCase()))
    .map(r => ({ name: r.name, email: r.email || '', role: r.role || '', department: r.team || '' }))

  const allPeople = [...employees, ...extraPeople]

  const submittedCount = employees.filter(e => getSubmission(e.name)).length
  const pendingCount   = employees.filter(e => !getSubmission(e.name)).length

  // Feature 3: unique cycles for the cycle selector dropdown
  const uniqueCycles = useMemo(() =>
    [...new Set(responses.map(r => r.cycle).filter(Boolean))]
  , [responses])

  // Feature 4: employees who have a rating saved but haven't been emailed yet
  const bulkEligible = useMemo(() =>
    allPeople.filter(emp => {
      const sub = getSubmission(emp.name)
      return sub && sub.rating && !sub.emailSent
    })
  , [allPeople, responses]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPeople = allPeople.filter(emp => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      emp.name?.toLowerCase().includes(q) ||
      emp.role?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    const sub = getSubmission(emp.name)
    // Feature 3: filter by cycle if a cycleFilter is active
    const matchCycle = !cycleFilter || !sub?.cycle || sub.cycle === cycleFilter
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'submitted' && sub) ||
      (filterStatus === 'pending' && !sub)
    return matchSearch && matchStatus && matchCycle
  })

  const selectedEmployee = selectedName
    ? allPeople.find(e => e.name?.trim().toLowerCase() === selectedName.trim().toLowerCase())
    : null

  // ── Save review (Feature 2: includes privateNotes) ─────────────────────────
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

  // ── Feature 4: Bulk email ──────────────────────────────────────────────────
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

  // ── Export PDF ─────────────────────────────────────────────────────────────
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

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!responses.length) return
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
    const rows = responses.map(r => [
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

      {/* Feature 4: Bulk confirm modal */}
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
          {/* Feature 3: cycle badge */}
          {REVIEW_CYCLE && (
            <div className="mgr-cycle-badge">{REVIEW_CYCLE}</div>
          )}
        </div>
        <div className="mgr-header-actions">
          {/* Feature 1: view switcher */}
          <div className="mgr-view-tabs">
            <button
              className={`mgr-view-tab ${view === 'team' ? 'active' : ''}`}
              onClick={() => setView('team')}
            >📋 Team</button>
            <button
              className={`mgr-view-tab ${view === 'analytics' ? 'active' : ''}`}
              onClick={() => setView('analytics')}
            >📊 Analytics</button>
          </div>

          <ThemeToggle theme={theme} onToggle={toggle} />

          {/* Feature 4: bulk email button */}
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
            onClick={handleExportCSV}
            disabled={!responses.length}
            title="Download all responses as CSV"
          >⬇ Export CSV</button>

          <button
            className="mgr-btn-action"
            onClick={loadData}
            disabled={loading}
          >{loading ? '↻ Loading…' : '↻ Refresh'}</button>

          <button
            className="mgr-btn-logout"
            onClick={() => { sessionStorage.removeItem(PIN_SESSION_KEY); setAuthed(false) }}
          >🔒 Lock</button>
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
          <div className="mgr-stat-value">{responses.filter(r => r.rating).length}</div>
          <div className="mgr-stat-label">Reviewed</div>
        </div>
      </div>

      {loadError && <div className="mgr-load-error">⚠️ {loadError}</div>}

      {/* Feature 1: Analytics view */}
      {view === 'analytics' && (
        <AnalyticsView employees={employees} responses={responses} />
      )}

      {/* Team view */}
      {view === 'team' && (
        <div className="mgr-body">

          {/* Sidebar */}
          <aside className="mgr-sidebar">

            {/* Feature 3: cycle filter (visible only when >1 cycle exists) */}
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
                      {/* Feature 4: email sent indicator */}
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
                      {/* Feature 4: email sent badge in detail header */}
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
                  { label: 'Challenge', value: submission.challenge     },
                  { label: 'How Fixed', value: submission.fix           },
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
                    <label className="mgr-field-label">Manager Comments <span className="mgr-label-hint">(sent to employee)</span></label>
                    <textarea
                      className="mgr-textarea"
                      placeholder="Strengths, areas of improvement, overall thoughts…"
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      rows={4}
                    />
                  </div>

                  {/* Feature 2: private notes */}
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
      )}
    </div>
  )
}
