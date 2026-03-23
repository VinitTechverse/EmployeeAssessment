import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { APPS_SCRIPT_URL, REVIEW_CYCLE } from './config'
import { useTheme, ThemeToggle } from './useTheme.jsx'
const DRAFT_KEY      = 'rt_review_2026_draft'
const SUBMITTED_KEY  = 'rt_review_2026_submitted'
const TOTAL_STEPS = 10  // 0=cover, 1-7=sections, 8=review, 9=success

const CHECKBOXES = [
  'Took ownership of a feature or task',
  'Suggested a process improvement',
  'Helped teammates solve problems',
  'Took initiative beyond my role',
  'Improved product quality or UX',
  'Learned something new outside my comfort zone',
]

const YEAR_EMOJIS = ['🚀', '🔥', '⚡', '💡', '😤', '🌟', '😅', '🎯', '🧠', '💪', '🎉', '🌊']


const initialData = {
  name: '', email: '', role: '', team: '',
  wins: ['', '', ''], impact: '',
  challenge: '', fix: '', challengeLearn: '',
  skills: [{ skill: '', usage: '' }],
  startupChecks: new Set(), startupStory: '',
  teamContrib: '', teamMoment: '',
  brag: '', goal1: '', goal2: '', explore: '',
  qfProud: '', qfBetter: '', qfEasier: '', yearEmoji: '',
}

// ── localStorage helpers ───────────────────────────────────────────────────────

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    parsed.startupChecks = new Set(parsed.startupChecks || [])
    return parsed
  } catch {
    return null
  }
}

function saveDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...data,
      startupChecks: [...data.startupChecks],
    }))
  } catch { /* storage full or unavailable */ }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

// ── submitted-names helpers ────────────────────────────────────────────────────

function loadSubmittedNames() {
  try {
    const raw = localStorage.getItem(SUBMITTED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function addSubmittedName(name) {
  try {
    const names = loadSubmittedNames()
    const normalized = name.trim().toLowerCase()
    if (!names.some(n => n.trim().toLowerCase() === normalized)) {
      names.push(name.trim())
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify(names))
    }
  } catch { /* storage unavailable */ }
}

function isNameSubmitted(name) {
  if (!name || name.trim().length < 2) return false
  return loadSubmittedNames().some(
    n => n.trim().toLowerCase() === name.trim().toLowerCase()
  )
}

// ── shared sub-components ─────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const STEP_NAMES = [
    'Intro', 'Highlight Reel', 'Plot Twist', 'Level Up',
    'Startup Energy', 'Team Player', 'Brag a Little', 'Quick Fire',
  ]
  // progress bar covers steps 0-7 only (8 dots)
  const clampedStep = Math.min(step, 7)
  const pct = clampedStep === 0 ? 0 : Math.round((clampedStep / 7) * 100)

  return (
    <div className="progress-wrap">
      <div className="progress-meta">
        <span className="progress-step-label">
          {clampedStep === 0 ? 'Get Started' : STEP_NAMES[clampedStep]}
        </span>
        <span>{clampedStep === 0 ? '' : `${pct}% complete`}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="step-dots">
        {STEP_NAMES.map((_, i) => (
          <button
            key={i}
            className={`step-dot ${i === clampedStep ? 'active' : i < clampedStep ? 'done' : ''}`}
            aria-label={STEP_NAMES[i]}
          />
        ))}
      </div>
    </div>
  )
}

function NavRow({ step, onBack, onNext, nextLabel = 'Continue →', nextDisabled = false }) {
  return (
    <div className="nav-row">
      {step > 0
        ? <button className="btn-back" onClick={onBack}>← Back</button>
        : <div />
      }
      <button
        className="btn-next"
        onClick={onNext}
        disabled={nextDisabled}
        style={{ opacity: nextDisabled ? 0.5 : 1 }}
      >
        {nextLabel}
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {children}
    </div>
  )
}

// ── Deadline Banner (live from Config sheet) ──────────────────────────────────

function DeadlineBanner({ deadline }) {
  if (!deadline) return null
  const dl = new Date(deadline)
  if (isNaN(dl.getTime())) return null   // guard against malformed date strings
  const now     = new Date()
  const msLeft  = dl.setHours(23, 59, 59, 999) - now
  const daysLeft= Math.ceil(msLeft / 86400000)
  if (daysLeft < 0) return null  // form is already showing ClosedScreen when past deadline

  const urgency  = daysLeft <= 2 ? 'urgent' : daysLeft <= 7 ? 'soon' : 'ok'
  const daysText = daysLeft === 0 ? 'Last day to submit!'
    : daysLeft === 1 ? '1 day left'
    : `${daysLeft} days left`
  const dateStr  = new Date(deadline).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className={`deadline-banner deadline-${urgency}`}>
      <span className="dl-icon">{daysLeft <= 2 ? '🚨' : '⏰'}</span>
      <div className="dl-body">
        <span className="dl-text">Deadline: <strong>{dateStr}</strong></span>
        <span className="dl-pill">{daysText}</span>
      </div>
    </div>
  )
}

// ── Closed Screen (form locked or deadline passed) ────────────────────────────

function ClosedScreen({ deadline, onExtensionGranted }) {
  const [name, setName]       = useState('')
  const [checking, setChecking] = useState(false)
  const [extError, setExtError] = useState('')

  const dateStr = deadline
    ? new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const handleCheck = useCallback(async () => {
    if (!name.trim()) return
    setChecking(true)
    setExtError('')
    try {
      const res  = await fetch(`${APPS_SCRIPT_URL}?action=getExtension&name=${encodeURIComponent(name.trim())}`)
      const json = await res.json()
      if (json.ok && json.extensionDate) {
        const extDate = new Date(json.extensionDate)
        const today   = new Date(); today.setHours(0, 0, 0, 0)
        if (extDate >= today) {
          onExtensionGranted(name.trim())
        } else {
          setExtError(`Your extension (${json.extensionDate}) has also passed.`)
        }
      } else {
        setExtError('No active extension found for this name. Contact your manager.')
      }
    } catch {
      setExtError('Could not check. Please try again.')
    } finally {
      setChecking(false)
    }
  }, [name, onExtensionGranted])

  return (
    <div className="card closed-screen">
      <div className="step-header">
        <span className="step-emoji">🔒</span>
        <h2 className="step-title">Submissions Closed</h2>
        <p className="step-desc">
          The review window for this cycle has ended
          {dateStr ? ` on ${dateStr}` : ''}.
          <br />Reach out to your manager if you need an extension.
        </p>
      </div>
      <div className="closed-ext-box">
        <p className="closed-ext-label">Have an extension? Enter your name to check:</p>
        <div className="closed-ext-row">
          <input
            className="field-input"
            placeholder="Your full name…"
            value={name}
            onChange={e => { setName(e.target.value); setExtError('') }}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
          />
          <button
            className="btn-next"
            onClick={handleCheck}
            disabled={checking || !name.trim()}
            style={{ opacity: name.trim() ? 1 : 0.5 }}
          >
            {checking ? 'Checking…' : 'Check →'}
          </button>
        </div>
        {extError && <div className="closed-ext-error">{extError}</div>}
      </div>
    </div>
  )
}

// ── Cover Step ────────────────────────────────────────────────────────────────

function CoverStep({ data, setData, onNext, hasDraft, onResumeDraft, onStartFresh, allowResubmit, onAllowResubmit, deadline }) {
  const ok             = data.name && data.email && data.role && data.team
  const alreadySubmitted = !allowResubmit && isNameSubmitted(data.name)

  return (
    <div className="card">
      <div className="step-header">
        <span className="step-emoji">🚀</span>
        <h2 className="step-title">Radiant Techverse — Year in Review</h2>
        <p className="step-desc">
          Self Reflection Form · 2025–26 · Takes ~8 minutes to fill
        </p>
      </div>

      <DeadlineBanner deadline={deadline} />

      {/* Already-submitted banner — shown when typed name matches a submitted name */}
      {alreadySubmitted && (
        <div className="draft-banner submitted-banner">
          <div className="draft-banner-left">
            <span className="draft-icon">✅</span>
            <div>
              <div className="draft-banner-title">Review already submitted</div>
              <div className="draft-banner-sub">
                Submitted as <strong>{data.name}</strong> · you're all set!
              </div>
            </div>
          </div>
          <div className="draft-banner-actions">
            <button className="btn-fresh" onClick={onAllowResubmit}>
              Update My Answers
            </button>
          </div>
        </div>
      )}

      {/* Draft resume banner — only show if not blocked by already-submitted */}
      {hasDraft && !alreadySubmitted && (
        <div className="draft-banner">
          <div className="draft-banner-left">
            <span className="draft-icon">💾</span>
            <div>
              <div className="draft-banner-title">You have a saved draft</div>
              <div className="draft-banner-sub">Pick up right where you left off</div>
            </div>
          </div>
          <div className="draft-banner-actions">
            <button className="btn-resume" onClick={onResumeDraft}>Resume →</button>
            <button className="btn-fresh" onClick={onStartFresh}>Start Fresh</button>
          </div>
        </div>
      )}

      <Field label="Your Name">
        <input
          className="field-input"
          placeholder="e.g. Priya Sharma"
          value={data.name}
          onChange={e => setData({ ...data, name: e.target.value })}
        />
      </Field>
      <Field label="Work Email">
        <input
          className="field-input"
          type="email"
          placeholder="e.g. priya@radianttechverse.com"
          value={data.email}
          onChange={e => setData({ ...data, email: e.target.value })}
        />
      </Field>
      <Field label="Role">
        <input
          className="field-input"
          placeholder="e.g. Frontend Developer"
          value={data.role}
          onChange={e => setData({ ...data, role: e.target.value })}
        />
      </Field>
      <Field label="Team">
        <input
          className="field-input"
          placeholder="e.g. Product · Design · Engineering"
          value={data.team}
          onChange={e => setData({ ...data, team: e.target.value })}
        />
      </Field>

      <div className="nav-row">
        <div />
        <button
          className="btn-next"
          onClick={onNext}
          disabled={alreadySubmitted}
          style={{
            opacity: (ok && !alreadySubmitted) ? 1 : 0.45,
            pointerEvents: (ok && !alreadySubmitted) ? 'auto' : 'none',
          }}
        >
          Let's Go 🎬
        </button>
      </div>
    </div>
  )
}

// ── Step 1: Highlight Reel ────────────────────────────────────────────────────

function HighlightStep({ data, setData, onNext, onBack }) {
  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 1 of 7</div>
        <span className="step-emoji">🎬</span>
        <h2 className="step-title">Your Highlight Reel</h2>
        <p className="step-desc">Think of this as your yearly highlight reel. What were your top moments?</p>
      </div>

      <Field label="Your Top 3 Wins This Year">
        <div className="wins-list">
          {[0, 1, 2].map(i => (
            <div className="win-row" key={i}>
              <div className="win-number">{i + 1}</div>
              <input
                className="field-input"
                placeholder={`Win #${i + 1}…`}
                value={data.wins[i] || ''}
                onChange={e => {
                  const w = [...data.wins]
                  w[i] = e.target.value
                  setData({ ...data, wins: w })
                }}
              />
            </div>
          ))}
        </div>
      </Field>

      <Field label="What impact did these create?">
        <textarea
          className="field-textarea"
          placeholder="e.g. improved the onboarding flow, cut API response time by 40%, got a shoutout from the client…"
          value={data.impact}
          onChange={e => setData({ ...data, impact: e.target.value })}
          rows={4}
        />
      </Field>

      <NavRow step={1} onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ── Step 2: Plot Twist ────────────────────────────────────────────────────────

function PlotTwistStep({ data, setData, onNext, onBack }) {
  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 2 of 7</div>
        <span className="step-emoji">🧩</span>
        <h2 className="step-title">The Plot Twist</h2>
        <p className="step-desc">Every year has that one moment where things didn't go as planned. What was yours?</p>
      </div>

      <Field label="Describe the challenge or unexpected moment">
        <textarea
          className="field-textarea"
          placeholder="What happened? Set the scene…"
          value={data.challenge}
          onChange={e => setData({ ...data, challenge: e.target.value })}
          rows={3}
        />
      </Field>

      <Field label="What did you do to fix it?">
        <textarea
          className="field-textarea"
          placeholder="Walk us through your problem-solving…"
          value={data.fix}
          onChange={e => setData({ ...data, fix: e.target.value })}
          rows={3}
        />
      </Field>

      <Field label="What did you learn from it?">
        <textarea
          className="field-textarea"
          placeholder="The key takeaway…"
          value={data.challengeLearn}
          onChange={e => setData({ ...data, challengeLearn: e.target.value })}
          rows={2}
        />
      </Field>

      <NavRow step={2} onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ── Step 3: Level Up ──────────────────────────────────────────────────────────

function LevelUpStep({ data, setData, onNext, onBack }) {
  const addSkill = () => setData({ ...data, skills: [...data.skills, { skill: '', usage: '' }] })
  const removeSkill = i => setData({ ...data, skills: data.skills.filter((_, idx) => idx !== i) })
  const updateSkill = (i, field, val) => {
    const s = [...data.skills]
    s[i] = { ...s[i], [field]: val }
    setData({ ...data, skills: s })
  }

  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 3 of 7</div>
        <span className="step-emoji">📈</span>
        <h2 className="step-title">Level Up</h2>
        <p className="step-desc">What skills or tools did you level up this year? Add as many as you like.</p>
      </div>

      <Field>
        <div className="skills-table">
          <div className="skill-row-header">
            <span>Skill / Tool</span>
            <span>How you used it</span>
          </div>
          {data.skills.map((row, i) => (
            <div className="skill-row-with-remove" key={i}>
              <input
                className="field-input"
                placeholder="e.g. React Query"
                value={row.skill}
                onChange={e => updateSkill(i, 'skill', e.target.value)}
              />
              <input
                className="field-input"
                placeholder="e.g. data fetching in dashboard"
                value={row.usage}
                onChange={e => updateSkill(i, 'usage', e.target.value)}
              />
              {data.skills.length > 1 && (
                <button className="btn-remove-skill" onClick={() => removeSkill(i)}>×</button>
              )}
            </div>
          ))}
          <button className="btn-add-skill" onClick={addSkill}>
            + Add another skill
          </button>
        </div>
      </Field>

      <NavRow step={3} onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ── Step 4: Startup Energy ────────────────────────────────────────────────────

function StartupEnergyStep({ data, setData, onNext, onBack }) {
  const toggle = label => {
    const set = new Set(data.startupChecks)
    set.has(label) ? set.delete(label) : set.add(label)
    setData({ ...data, startupChecks: set })
  }

  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 4 of 7</div>
        <span className="step-emoji">⚡</span>
        <h2 className="step-title">Startup Energy</h2>
        <p className="step-desc">Startups grow because people take initiative. Check what applies to you this year.</p>
      </div>

      <Field>
        <div className="checkbox-grid">
          {CHECKBOXES.map(label => {
            const checked = data.startupChecks.has(label)
            return (
              <div
                key={label}
                className={`checkbox-item ${checked ? 'checked' : ''}`}
                onClick={() => toggle(label)}
              >
                <div className="checkbox-box">
                  {checked && <span className="checkbox-check">✓</span>}
                </div>
                <span className="checkbox-label">{label}</span>
              </div>
            )
          })}
        </div>
      </Field>

      <Field label="Drop a quick example or story">
        <textarea
          className="field-textarea"
          placeholder="Tell us about one specific moment when you showed initiative…"
          value={data.startupStory}
          onChange={e => setData({ ...data, startupStory: e.target.value })}
          rows={3}
        />
      </Field>

      <NavRow step={4} onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ── Step 5: Team Player ───────────────────────────────────────────────────────

function TeamPlayerStep({ data, setData, onNext, onBack }) {
  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 5 of 7</div>
        <span className="step-emoji">🤝</span>
        <h2 className="step-title">Team Player Mode</h2>
        <p className="step-desc">How did you contribute to making the team better this year?</p>
      </div>

      <Field label="How did you make the team better?">
        <textarea
          className="field-textarea"
          placeholder="e.g. helped unblock a teammate on a gnarly bug, shared a design system pattern that saved everyone time, reviewed 20+ PRs this quarter…"
          value={data.teamContrib}
          onChange={e => setData({ ...data, teamContrib: e.target.value })}
          rows={4}
        />
      </Field>

      <Field label="One specific moment you're proud of (team-wise)">
        <textarea
          className="field-textarea"
          placeholder="Short story works great here…"
          value={data.teamMoment}
          onChange={e => setData({ ...data, teamMoment: e.target.value })}
          rows={3}
        />
      </Field>

      <NavRow step={5} onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ── Step 6: Brag + Goals ──────────────────────────────────────────────────────

function BragGoalsStep({ data, setData, onNext, onBack }) {
  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 6 of 7</div>
        <span className="step-emoji">😎</span>
        <h2 className="step-title">Brag a Little + Next Level Goals</h2>
        <p className="step-desc">You earned it. Own it. Then plan what's next.</p>
      </div>

      <Field label="What's one thing you did this year that deserves more recognition?">
        <textarea
          className="field-textarea"
          placeholder="Don't be shy — what was genuinely impressive that maybe went unnoticed?"
          value={data.brag}
          onChange={e => setData({ ...data, brag: e.target.value })}
          rows={3}
        />
      </Field>

      <div className="divider" />

      <span className="step-emoji" style={{ fontSize: 22, marginBottom: 8, display: 'block' }}>🎯</span>
      <p className="step-desc" style={{ marginBottom: 20 }}>What are 2 things you want to improve or achieve next year?</p>

      <Field label="Goal #1">
        <input
          className="field-input"
          placeholder="e.g. Ship my first full feature end-to-end…"
          value={data.goal1}
          onChange={e => setData({ ...data, goal1: e.target.value })}
        />
      </Field>
      <Field label="Goal #2">
        <input
          className="field-input"
          placeholder="e.g. Get better at system design…"
          value={data.goal2}
          onChange={e => setData({ ...data, goal2: e.target.value })}
        />
      </Field>
      <Field label="Anything you want to learn or explore?">
        <textarea
          className="field-textarea"
          placeholder="New tech, side project, domain area, soft skill…"
          value={data.explore}
          onChange={e => setData({ ...data, explore: e.target.value })}
          rows={2}
        />
      </Field>

      <NavRow step={6} onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ── Step 7: Quick Fire + Manager ──────────────────────────────────────────────

function QuickFireStep({ data, setData, onNext, onBack }) {
  const quickFields = [
    { key: 'qfProud',  emoji: '🏆', q: "One thing I'm proud of this year" },
    { key: 'qfBetter', emoji: '📚', q: 'One thing I want to get better at' },
    { key: 'qfEasier', emoji: '🛠️', q: 'One thing that would make my work easier' },
  ]

  return (
    <div className="card">
      <div className="step-header">
        <div className="step-tag">Section 7 of 7</div>
        <span className="step-emoji">⚡</span>
        <h2 className="step-title">Quick Fire Round</h2>
        <p className="step-desc">One line answers — trust your gut!</p>
      </div>

      <div className="quickfire-list">
        {quickFields.map(({ key, emoji, q }) => (
          <div className="quickfire-item" key={key}>
            <div className="quickfire-q">
              <span className="q-emoji">{emoji}</span>
              {q}
            </div>
            <input
              className="field-input"
              placeholder="Answer in one line…"
              value={data[key]}
              onChange={e => setData({ ...data, [key]: e.target.value })}
            />
          </div>
        ))}

        <div className="quickfire-item">
          <div className="quickfire-q">
            <span className="q-emoji">✨</span>
            My year at Radiant Techverse in one emoji
          </div>
          <div className="emoji-picker">
            {YEAR_EMOJIS.map(em => (
              <div
                key={em}
                className={`emoji-option ${data.yearEmoji === em ? 'selected' : ''}`}
                onClick={() => setData({ ...data, yearEmoji: em })}
                role="button"
                aria-label={em}
              >
                {em}
              </div>
            ))}
          </div>
        </div>
      </div>

      <NavRow step={7} onBack={onBack} onNext={onNext} nextLabel="Review & Submit →" />
    </div>
  )
}

// ── Step 8: Review ────────────────────────────────────────────────────────────

function ReviewStep({ data, onEdit, onBack, onSubmit, submitting, submitError }) {
  const sections = [
    {
      step: 1, emoji: '🎬', title: 'Highlight Reel',
      rows: [
        { label: 'Win #1', value: data.wins?.[0] },
        { label: 'Win #2', value: data.wins?.[1] },
        { label: 'Win #3', value: data.wins?.[2] },
        { label: 'Impact', value: data.impact },
      ],
    },
    {
      step: 2, emoji: '🧩', title: 'Plot Twist',
      rows: [
        { label: 'Challenge', value: data.challenge },
        { label: 'How fixed', value: data.fix },
        { label: 'Learned', value: data.challengeLearn },
      ],
    },
    {
      step: 3, emoji: '📈', title: 'Level Up',
      rows: (data.skills || [])
        .filter(s => s.skill || s.usage)
        .map(s => ({ label: s.skill, value: s.usage })),
    },
    {
      step: 4, emoji: '⚡', title: 'Startup Energy',
      rows: [
        { label: 'Actions', value: [...(data.startupChecks || [])].join(' · ') },
        { label: 'Story', value: data.startupStory },
      ],
    },
    {
      step: 5, emoji: '🤝', title: 'Team Player',
      rows: [
        { label: 'Contribution', value: data.teamContrib },
        { label: 'Proud moment', value: data.teamMoment },
      ],
    },
    {
      step: 6, emoji: '😎', title: 'Brag + Goals',
      rows: [
        { label: 'Brag', value: data.brag },
        { label: 'Goal #1', value: data.goal1 },
        { label: 'Goal #2', value: data.goal2 },
        { label: 'Explore', value: data.explore },
      ],
    },
    {
      step: 7, emoji: '⚡', title: 'Quick Fire',
      rows: [
        { label: 'Proud of', value: data.qfProud },
        { label: 'Get better at', value: data.qfBetter },
        { label: 'Make work easier', value: data.qfEasier },
        { label: 'Year emoji', value: data.yearEmoji },
      ],
    },
  ]

  return (
    <div className="card">
      <div className="step-header">
        <span className="step-emoji">📋</span>
        <h2 className="step-title">Review Your Answers</h2>
        <p className="step-desc">
          Everything look good? Hit <strong style={{ color: '#fff' }}>Edit</strong> on any section to make changes, then submit when ready.
        </p>
      </div>

      {/* Identity row */}
      <div className="review-identity">
        <div className="review-identity-item">
          <span className="review-identity-label">Name</span>
          <span className="review-identity-value">{data.name}</span>
        </div>
        <div className="review-identity-item">
          <span className="review-identity-label">Email</span>
          <span className="review-identity-value">{data.email}</span>
        </div>
        <div className="review-identity-item">
          <span className="review-identity-label">Role</span>
          <span className="review-identity-value">{data.role}</span>
        </div>
        <div className="review-identity-item">
          <span className="review-identity-label">Team</span>
          <span className="review-identity-value">{data.team}</span>
        </div>
      </div>

      {/* Sections */}
      {sections.map(section => {
        const filledRows = section.rows.filter(r => r.value)
        return (
          <div className="review-section" key={section.step}>
            <div className="review-section-header">
              <span className="review-section-title">
                {section.emoji} {section.title}
              </span>
              <button className="btn-edit" onClick={() => onEdit(section.step)}>
                ✏️ Edit
              </button>
            </div>
            {filledRows.length > 0 ? (
              <div className="review-rows">
                {filledRows.map((row, i) => (
                  <div className="review-row" key={i}>
                    <span className="review-label">{row.label}</span>
                    <span className="review-value">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="review-empty">Nothing filled in yet — tap Edit to add.</p>
            )}
          </div>
        )
      })}

      {submitError && (
        <div className="submit-error">
          ⚠️ {submitError}
        </div>
      )}

      <div className="nav-row" style={{ marginTop: 32 }}>
        <button className="btn-back" onClick={onBack}>← Back</button>
        <button
          className="btn-next btn-submit"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <><span className="spinner" /> Submitting…</>
          ) : (
            '✓ Submit Review'
          )}
        </button>
      </div>
    </div>
  )
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({ data, onRestart }) {
  return (
    <div className="success-screen">
      <span className="success-icon">🎉</span>
      <h2>You did it, {data.name?.split(' ')[0] || 'you'}!</h2>
      <p>
        Your 2025–26 review has been submitted successfully. <br />
        The team at Radiant Techverse thanks you for taking the time to reflect.
      </p>

      <div className="success-chips">
        <div className="success-chip">✅ Self review submitted</div>
        <div className="success-chip">📊 Saved to Google Sheets</div>
        <div className="success-chip">📋 7 sections completed</div>
        {data.yearEmoji && <div className="success-chip">Your year: {data.yearEmoji}</div>}
        {data.startupChecks?.size > 0 && (
          <div className="success-chip">⚡ {data.startupChecks.size} startup actions</div>
        )}
      </div>

      <button className="btn-restart" onClick={onRestart}>
        ↩ Start a new review
      </button>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const { theme, toggle } = useTheme()
  const savedDraft = loadDraft()

  // ── Site config (fetched live from Config sheet) ───────────────────────────
  const [siteConfig, setSiteConfig]     = useState({ deadline: '', form_locked: 'false', current_cycle: REVIEW_CYCLE })
  const [configLoaded, setConfigLoaded] = useState(false)
  const [extensionName, setExtensionName] = useState(null) // name that has been granted extension

  useEffect(() => {
    fetch(`${APPS_SCRIPT_URL}?action=getConfig`)
      .then(r => r.json())
      .then(json => { if (json.ok) setSiteConfig(prev => ({ ...prev, ...json.config })) })
      .catch(() => {}) // silent fail — use defaults
      .finally(() => setConfigLoaded(true))
  }, [])

  // ── Form state ─────────────────────────────────────────────────────────────
  const [step, setStep]           = useState(0)
  const [data, setData]           = useState(savedDraft || initialData)
  const [hasDraft]                = useState(!!savedDraft)
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [submitError, setSubmitError]       = useState('')
  const [allowResubmit, setAllowResubmit]   = useState(false)

  // ── Derived lock state ─────────────────────────────────────────────────────
  const isLocked = siteConfig.form_locked === 'true'
  const isDeadlinePassed = (() => {
    if (!siteConfig.deadline) return false
    const d = new Date(siteConfig.deadline)
    if (isNaN(d.getTime())) return false
    return new Date() > d.setHours(23, 59, 59, 999)
  })()
  // Show closed screen when locked OR deadline passed (unless extension granted)
  const showClosed = configLoaded && (isLocked || isDeadlinePassed) && !extensionName

  const updateData = (newData) => { saveDraft(newData); setData(newData) }

  const next = () => {
    if (returnToReview) { setReturnToReview(false); setStep(8) }
    else { setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)) }
  }

  const back        = () => setStep(s => Math.max(s - 1, 0))
  const editSection = (targetStep) => { setReturnToReview(true); setStep(targetStep) }
  const handleResumeDraft = () => setStep(1)
  const handleStartFresh  = () => { clearDraft(); setData(initialData); setStep(1) }

  const submitForm = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method : 'POST',
        mode   : 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          ...data,
          startupChecks: [...data.startupChecks],
          cycle: siteConfig.current_cycle || REVIEW_CYCLE,
        }),
      })
      clearDraft()
      addSubmittedName(data.name)
      setAllowResubmit(false)
      setStep(9)
    } catch {
      setSubmitError('Connection error. Please check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => { clearDraft(); setData(initialData); setAllowResubmit(false); setStep(0) }

  const nextLabel = returnToReview ? 'Save & Return to Review →' : 'Continue →'

  const steps = [
    <CoverStep
      data={data} setData={updateData} onNext={next}
      hasDraft={hasDraft}
      onResumeDraft={handleResumeDraft}
      onStartFresh={handleStartFresh}
      allowResubmit={allowResubmit}
      onAllowResubmit={() => setAllowResubmit(true)}
      deadline={siteConfig.deadline}
    />,
    <HighlightStep    data={data} setData={updateData} onNext={next} onBack={back} nextLabel={nextLabel} />,
    <PlotTwistStep    data={data} setData={updateData} onNext={next} onBack={back} nextLabel={nextLabel} />,
    <LevelUpStep      data={data} setData={updateData} onNext={next} onBack={back} nextLabel={nextLabel} />,
    <StartupEnergyStep data={data} setData={updateData} onNext={next} onBack={back} nextLabel={nextLabel} />,
    <TeamPlayerStep   data={data} setData={updateData} onNext={next} onBack={back} nextLabel={nextLabel} />,
    <BragGoalsStep    data={data} setData={updateData} onNext={next} onBack={back} nextLabel={nextLabel} />,
    <QuickFireStep    data={data} setData={updateData} onNext={next} onBack={back} />,
    <ReviewStep
      data={data} onEdit={editSection} onBack={back}
      onSubmit={submitForm} submitting={submitting} submitError={submitError}
    />,
    <SuccessScreen data={data} onRestart={restart} />,
  ]

  const showProgress = step < 8

  return (
    <div className="app">
      <header className="header">
        <ThemeToggle theme={theme} onToggle={toggle} className="header-theme-toggle" />
        <div className="header-badge">✦ Radiant Techverse</div>
        <h1>Year in Review 2025–26</h1>
        <p>Reflect · Celebrate · Plan what's next</p>
      </header>

      {/* Show loading pulse while config fetches */}
      {!configLoaded && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.6 }}>
          <div className="mgr-spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
        </div>
      )}

      {/* Closed screen overrides the entire form */}
      {configLoaded && showClosed && (
        <ClosedScreen
          deadline={siteConfig.deadline}
          onExtensionGranted={(name) => { setExtensionName(name); setData(d => ({ ...d, name })) }}
        />
      )}

      {/* Normal form flow */}
      {configLoaded && !showClosed && (
        <>
          {showProgress && <ProgressBar step={step} />}
          {steps[step]}
        </>
      )}
    </div>
  )
}
