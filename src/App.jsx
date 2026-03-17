import { useState } from 'react'
import './App.css'

// ── helpers ──────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9   // 0 = cover, 1-7 = sections, 8 = success

const CHECKBOXES = [
  'Took ownership of a feature or task',
  'Suggested a process improvement',
  'Helped teammates solve problems',
  'Took initiative beyond my role',
  'Improved product quality or UX',
  'Learned something new outside my comfort zone',
]

const YEAR_EMOJIS = ['🚀', '🔥', '⚡', '💡', '😤', '🌟', '😅', '🎯', '🧠', '💪', '🎉', '🌊']

const RATING_LABELS = [
  { key: 'r1', label: '1', desc: 'Needs Improvement' },
  { key: 'r2', label: '2', desc: 'Developing' },
  { key: 'r3', label: '3', desc: 'Solid' },
  { key: 'r4', label: '4', desc: 'Strong' },
  { key: 'r5', label: '5', desc: 'Outstanding' },
]

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const STEP_NAMES = [
    'Intro', 'Highlight Reel', 'Plot Twist', 'Level Up',
    'Startup Energy', 'Team Player', 'Brag a Little', 'Goals', 'Quick Fire',
  ]
  const pct = step === 0 ? 0 : Math.round((step / (TOTAL_STEPS - 1)) * 100)

  return (
    <div className="progress-wrap">
      <div className="progress-meta">
        <span className="progress-step-label">
          {step === 0 ? 'Get Started' : STEP_NAMES[step]}
        </span>
        <span>{step === 0 ? '' : `${pct}% complete`}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="step-dots">
        {STEP_NAMES.map((_, i) => (
          <button
            key={i}
            className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
            aria-label={STEP_NAMES[i]}
          />
        ))}
      </div>
    </div>
  )
}

function NavRow({ step, onBack, onNext, nextLabel = 'Continue →' }) {
  return (
    <div className="nav-row">
      {step > 1 ? (
        <button className="btn-back" onClick={onBack}>← Back</button>
      ) : <div />}
      <button className="btn-next" onClick={onNext}>{nextLabel}</button>
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

// ── Cover Step ────────────────────────────────────────────────────────────────

function CoverStep({ data, setData, onNext }) {
  const ok = data.name && data.role && data.team

  return (
    <div className="card">
      <div className="step-header">
        <span className="step-emoji">🚀</span>
        <h2 className="step-title">Radiant Techverse — Year in Review</h2>
        <p className="step-desc">
          Self Reflection Form · 2025–26 · Takes ~8 minutes to fill
        </p>
      </div>

      <Field label="Your Name">
        <input
          className="field-input"
          placeholder="e.g. Priya Sharma"
          value={data.name}
          onChange={e => setData({ ...data, name: e.target.value })}
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
          style={{ opacity: ok ? 1 : 0.45, pointerEvents: ok ? 'auto' : 'none' }}
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
    { key: 'qfProud', emoji: '🏆', q: 'One thing I\'m proud of this year' },
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

      <div className="divider" />

      <div className="manager-section">
        <h3>🔒 Manager Review — Internal Only</h3>
        <Field label="Overall Performance Rating">
          <div className="rating-row">
            {RATING_LABELS.map(({ key, label, desc }) => (
              <button
                key={key}
                className={`rating-btn ${key} ${data.rating === label ? 'selected' : ''}`}
                onClick={() => setData({ ...data, rating: label })}
                title={desc}
              >
                {label}
                <br />
                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{desc}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Manager Comments">
          <textarea
            className="field-textarea"
            placeholder="Strengths, areas of improvement, overall thoughts…"
            value={data.managerComments}
            onChange={e => setData({ ...data, managerComments: e.target.value })}
            rows={3}
          />
        </Field>
      </div>

      <NavRow step={7} onBack={onBack} onNext={onNext} nextLabel="Submit Review ✓" />
    </div>
  )
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({ data, onRestart }) {
  return (
    <div className="success-screen">
      <span className="success-icon">🎉</span>
      <h2>You did it, {data.name?.split(' ')[0]}!</h2>
      <p>
        Your 2025–26 review has been submitted. <br />
        The team at Radiant Techverse thanks you for taking the time to reflect.
      </p>

      <div className="success-chips">
        <div className="success-chip">✅ Self review submitted</div>
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

const initialData = {
  name: '', role: '', team: '',
  wins: ['', '', ''], impact: '',
  challenge: '', fix: '', challengeLearn: '',
  skills: [{ skill: '', usage: '' }],
  startupChecks: new Set(), startupStory: '',
  teamContrib: '', teamMoment: '',
  brag: '', goal1: '', goal2: '', explore: '',
  qfProud: '', qfBetter: '', qfEasier: '', yearEmoji: '',
  rating: '', managerComments: '',
}

export default function App() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState(initialData)

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))
  const restart = () => { setData(initialData); setStep(0) }

  const steps = [
    <CoverStep data={data} setData={setData} onNext={next} />,
    <HighlightStep data={data} setData={setData} onNext={next} onBack={back} />,
    <PlotTwistStep data={data} setData={setData} onNext={next} onBack={back} />,
    <LevelUpStep data={data} setData={setData} onNext={next} onBack={back} />,
    <StartupEnergyStep data={data} setData={setData} onNext={next} onBack={back} />,
    <TeamPlayerStep data={data} setData={setData} onNext={next} onBack={back} />,
    <BragGoalsStep data={data} setData={setData} onNext={next} onBack={back} />,
    <QuickFireStep data={data} setData={setData} onNext={next} onBack={back} />,
    <SuccessScreen data={data} onRestart={restart} />,
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="header-badge">✦ Radiant Techverse</div>
        <h1>Year in Review 2025–26</h1>
        <p>Reflect · Celebrate · Plan what's next</p>
      </header>

      {step < TOTAL_STEPS - 1 && <ProgressBar step={step} />}

      {steps[step]}
    </div>
  )
}
