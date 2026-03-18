import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../portal.css'
import { APPS_SCRIPT_URL } from '../config'
import { useTheme, ThemeToggle } from '../useTheme.jsx'

// ── Section renderer ──────────────────────────────────────────────────────────

function PortalSection({ emoji, title, rows }) {
  const filled = rows.filter(([, v]) => v)
  if (!filled.length) return null
  return (
    <div className="portal-section">
      <div className="portal-section-title">{emoji}&nbsp;&nbsp;{title}</div>
      {filled.map(([label, value], i) => (
        <div key={i} className="portal-field">
          <div className="portal-field-label">{label}</div>
          <div className="portal-field-value">{String(value)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Magic link login screen ───────────────────────────────────────────────────

function LoginScreen({ onTokenSent }) {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')

  const handleSend = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method : 'POST',
        mode   : 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ type: 'send_magic_link', email: email.trim() }),
      })
      // no-cors means we can't read the response; assume optimistic success
      setSent(true)
      onTokenSent(email.trim())
    } catch {
      setError('Could not send login link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="portal-card portal-sent">
        <div className="portal-sent-icon">📬</div>
        <h2 className="portal-sent-title">Check your inbox!</h2>
        <p className="portal-sent-desc">
          We sent a login link to <strong>{email}</strong>.<br />
          Click it to access your review. The link expires in 30 minutes.
        </p>
        <p className="portal-sent-note">
          Don't see it? Check your Spam or Promotions folder.
        </p>
      </div>
    )
  }

  return (
    <div className="portal-card">
      <div className="portal-login-icon">🔐</div>
      <h2 className="portal-login-title">Your Review Portal</h2>
      <p className="portal-login-sub">
        Enter your work email to receive a secure login link.
      </p>
      <div className="portal-login-form">
        <input
          className="portal-input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          autoFocus
        />
        {error && <div className="portal-error">{error}</div>}
        <button
          className="portal-btn"
          onClick={handleSend}
          disabled={loading || !email.trim()}
          style={{ opacity: email.trim() ? 1 : 0.5 }}
        >
          {loading ? 'Sending…' : 'Send Login Link →'}
        </button>
      </div>
      <p className="portal-login-note">
        The link is valid for 30 minutes and is sent instantly via Google Apps Script —
        no third-party service, no cost.
      </p>
    </div>
  )
}

// ── Review view (authenticated) ───────────────────────────────────────────────

function ReviewView({ row }) {
  const ratingMeta = {
    '1': { label: 'Needs Improvement', color: '#ef4444' },
    '2': { label: 'Developing',        color: '#f59e0b' },
    '3': { label: 'Solid',             color: '#818cf8' },
    '4': { label: 'Strong',            color: '#10b981' },
    '5': { label: 'Outstanding',       color: '#c084fc' },
  }

  return (
    <div className="portal-review">

      {/* Identity */}
      <div className="portal-identity">
        <div className="portal-avatar">{row.name?.charAt(0)?.toUpperCase()}</div>
        <div className="portal-identity-info">
          <div className="portal-name">{row.name}</div>
          <div className="portal-meta">
            {[row.role, row.team].filter(Boolean).join(' · ')}
          </div>
          <div className="portal-submitted">
            {row.firstSubmitted ? `Submitted ${row.firstSubmitted}` : ''}
          </div>
        </div>
      </div>

      {/* Self-assessment */}
      <div className="portal-sections">
        <PortalSection emoji="🎬" title="Highlight Reel" rows={[
          ['Win #1', row.win1], ['Win #2', row.win2], ['Win #3', row.win3],
          ['Biggest Impact', row.impact],
        ]} />
        <PortalSection emoji="🧩" title="Plot Twist" rows={[
          ['Challenge', row.challenge], ['How You Fixed It', row.fix],
          ['What You Learned', row.challengeLearn],
        ]} />
        <PortalSection emoji="📈" title="Level Up" rows={[
          ['Skills & Tools', row.skills],
        ]} />
        <PortalSection emoji="⚡" title="Startup Energy" rows={[
          ['Initiatives', row.startupChecks], ['Your Story', row.startupStory],
        ]} />
        <PortalSection emoji="🤝" title="Team Player" rows={[
          ['Your Contribution', row.teamContrib], ['Proud Moment', row.teamMoment],
        ]} />
        <PortalSection emoji="😎" title="Brag + Goals" rows={[
          ['Your Biggest Brag', row.brag], ['Goal #1', row.goal1],
          ['Goal #2', row.goal2], ['Something to Explore', row.explore],
        ]} />
        <PortalSection emoji="⚡" title="Quick Fire" rows={[
          ['Proud Of', row.qfProud], ['Get Better At', row.qfBetter],
          ['Make Work Easier', row.qfEasier], ['Year in One Emoji', row.yearEmoji],
        ]} />
      </div>

      {/* Manager review — only shown after email sent */}
      {row.emailSent === 'Yes' && row.rating && (
        <div className="portal-manager-review">
          <div className="portal-manager-review-title">🔒 Manager Review</div>
          <div className="portal-rating-display">
            <span
              className="portal-rating-num"
              style={{ color: ratingMeta[row.rating]?.color || '#818cf8' }}
            >
              {row.rating}
            </span>
            <span
              className="portal-rating-label"
              style={{ color: ratingMeta[row.rating]?.color || '#818cf8' }}
            >
              {ratingMeta[row.rating]?.label || ''}
            </span>
          </div>
          {row.managerComments && (
            <div className="portal-manager-comments">{row.managerComments}</div>
          )}
        </div>
      )}

      {/* Review not yet shared */}
      {(!row.emailSent || row.emailSent !== 'Yes') && (
        <div className="portal-review-pending">
          <span className="portal-review-pending-icon">⏳</span>
          <span>Your manager's review will appear here once it has been shared with you.</span>
        </div>
      )}
    </div>
  )
}

// ── Main Portal page ──────────────────────────────────────────────────────────

export default function EmployeePortal() {
  const { theme, toggle }     = useTheme()
  const [searchParams]        = useSearchParams()
  const token                 = searchParams.get('token')

  const [status, setStatus]   = useState('idle')    // idle | loading | auth | error | no-submission
  const [row, setRow]         = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [tokenEmail, setTokenEmail] = useState('')  // set after login screen send

  // If a token is in the URL, validate it immediately
  useEffect(() => {
    if (!token) return
    setStatus('loading')
    fetch(`${APPS_SCRIPT_URL}?action=validateToken&token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          if (json.row) {
            setRow(json.row)
            setStatus('auth')
          } else {
            setStatus('no-submission')
          }
        } else {
          setErrorMsg(json.error || 'Invalid or expired link. Please request a new one.')
          setStatus('error')
        }
      })
      .catch(() => {
        setErrorMsg('Could not verify your link. Please try again.')
        setStatus('error')
      })
  }, [token])

  return (
    <div className="portal-app">
      <header className="portal-header">
        <ThemeToggle theme={theme} onToggle={toggle} className="portal-theme-toggle" />
        <div className="portal-header-badge">✦ Radiant Techverse</div>
        <h1 className="portal-header-title">My Review Portal</h1>
        <p className="portal-header-sub">Your personal assessment & feedback</p>
      </header>

      <div className="portal-content">

        {/* Loading spinner while validating token */}
        {status === 'loading' && (
          <div className="portal-card portal-loading">
            <div className="portal-spinner" />
            <p>Verifying your login…</p>
          </div>
        )}

        {/* Token error */}
        {status === 'error' && (
          <div className="portal-card portal-error-card">
            <div className="portal-error-icon">⚠️</div>
            <h3>Login Link Expired</h3>
            <p>{errorMsg}</p>
            <button className="portal-btn" onClick={() => window.location.href = '/my-review'}>
              Request a New Link
            </button>
          </div>
        )}

        {/* No submission found */}
        {status === 'no-submission' && (
          <div className="portal-card portal-empty-card">
            <div className="portal-empty-icon">📭</div>
            <h3>No Submission Found</h3>
            <p>
              We couldn't find a submitted review for your email address.
              If you've already submitted, contact your manager.
            </p>
            <a className="portal-btn portal-btn-outline" href="/">
              Go to Review Form
            </a>
          </div>
        )}

        {/* Authenticated — show review */}
        {status === 'auth' && row && <ReviewView row={row} />}

        {/* Idle — show login screen (no token in URL) */}
        {status === 'idle' && !token && (
          <LoginScreen onTokenSent={(email) => setTokenEmail(email)} />
        )}
      </div>
    </div>
  )
}
