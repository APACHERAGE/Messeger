import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { confirmPasswordReset, getAuthConfig, loginAccount, registerAccount, requestPasswordReset, resendVerification, verifyEmail, type AuthConfig, type AuthUser } from './api/authApi'

type Props = { onAuthenticated: (user: AuthUser) => void }
type Mode = 'login' | 'register' | 'verify' | 'verified' | 'registered' | 'pending' | 'forgot' | 'reset' | 'reset-pending' | 'reset-complete' | 'resend' | 'resend-pending'

const defaultAuthConfig: AuthConfig = {
  inviteRequired: false,
  emailVerificationRequired: true,
  passwordResetAvailable: true,
  invitationsAvailable: false,
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export default function AuthPage({ onAuthenticated }: Props) {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('verify') ?? ''
  const resetToken = params.get('token') ?? ''
  const alreadyVerified = params.get('verified') === '1'
  const invitationCode = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('invite') ?? ''
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : token ? 'verify' : alreadyVerified ? 'verified' : invitationCode ? 'register' : 'login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState(invitationCode)
  const [authConfig, setAuthConfig] = useState<AuthConfig>(defaultAuthConfig)
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (invitationCode) window.history.replaceState(null, '', window.location.pathname + window.location.search)
    let active = true
    getAuthConfig()
      .then(config => { if (active) setAuthConfig(config) })
      .catch(() => { /* Keep email-verification defaults if the config probe fails. */ })
    return () => { active = false }
  }, [])

  function changeMode(next: Mode) {
    // Passwords must never survive a mode switch: a leftover login password in
    // the register form looks like a filled field but no longer matches.
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setError('')
    setMode(next)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    // Password managers sometimes fill the DOM value without firing React's
    // onChange handler. Read the submitted inputs so validation and the API
    // receive exactly what the user can see in the form.
    const values = new FormData(event.currentTarget)
    const submittedPassword = String(values.get('password') ?? password)
    const submittedConfirmPassword = String(values.get('confirmPassword') ?? confirmPassword)
    setPassword(submittedPassword)
    if (values.has('confirmPassword')) setConfirmPassword(submittedConfirmPassword)
    if (mode === 'register' && values.has('confirmPassword') && submittedPassword !== submittedConfirmPassword) {
      setError('Passwords do not match. Check for a trailing space, keyboard layout, or an autofilled field.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        const result = await registerAccount({ firstName, lastName, username, email, password: submittedPassword, confirmPassword: values.has('confirmPassword') ? submittedConfirmPassword : submittedPassword, inviteCode })
        setRegistrationMessage(result.message)
        if (result.verificationRequired) {
          setMode('pending')
        } else {
          setIdentifier(username.trim().toLowerCase())
          setMode('registered')
        }
      } else if (mode === 'login') {
        const session = await loginAccount(identifier, submittedPassword)
        if (!session.authenticated || !session.user) throw new Error('The server did not return account details.')
        onAuthenticated(session.user)
      } else if (mode === 'verify') {
        if (!token) throw new Error('The verification link is missing its token. Open the full link from your email.')
        await verifyEmail(token, submittedPassword)
        window.history.replaceState(null, '', `${window.location.pathname}?verified=1`)
        setMode('verified')
      } else if (mode === 'resend') {
        await resendVerification(email)
        setMode('resend-pending')
      } else if (mode === 'forgot') {
        await requestPasswordReset(identifier)
        setMode('reset-pending')
      } else if (mode === 'reset') {
        if (!resetToken) throw new Error('The password reset link is missing its token.')
        await confirmPasswordReset(resetToken, submittedPassword, submittedConfirmPassword)
        window.history.replaceState(null, '', '/')
        setMode('reset-complete')
      }
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell">
    <div className="auth-grid-backdrop" aria-hidden="true" />
    <section className="auth-scene" aria-label="Nightfall">
      <div className="auth-brand"><span className="auth-brand-mark">N<span>✦</span></span><span>NIGHTFALL<small>AFTER-HOURS NETWORK</small></span></div>
      <div className="auth-world" aria-hidden="true">
        <div className="auth-world-sun" />
        <div className="auth-world-mountain auth-world-mountain-back" />
        <div className="auth-world-mountain auth-world-mountain-front" />
        <span className="auth-world-star star-one">✦</span><span className="auth-world-star star-two">✧</span>
        <div className="auth-world-console"><span>SYS://NIGHTFALL</span><i>ONLINE</i><b>▰▰▰▱▱</b></div>
      </div>
      <div className="auth-scene-copy"><span>01 / DEVELOPER COMMUNITY</span><p>Code.<br /><em>Infrastructure.</em></p><small>DEVOPS · PROGRAMMING · PROBLEM SOLVING</small></div>
    </section>

    <section className="auth-panel">
      <div className="auth-panel-top"><span>IDENTITY GATE / 01</span><span><i /> SECURE SESSION</span></div>
      {mode === 'login' && <>
        <p className="auth-kicker">WELCOME BACK</p><h1>Sign in<span>.</span></h1><p className="auth-intro">Pick up where you left off.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>EMAIL OR USERNAME<span className="auth-input"><UserRound size={16} /><input autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="name@example.com" required /></span></label>
          <label>PASSWORD<span className="auth-input"><KeyRound size={16} /><input name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 10 characters" required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">New here? <button onClick={() => changeMode('register')}>Create an account</button>{authConfig.passwordResetAvailable && <> · <button onClick={() => changeMode('forgot')}>Forgot password?</button></>}{authConfig.emailVerificationRequired && <> · <button onClick={() => changeMode('resend')}>Resend verification</button></>}</p>
      </>}

      {mode === 'forgot' && <>
        <p className="auth-kicker">ACCOUNT RECOVERY</p><h1>Reset password<span>.</span></h1><p className="auth-intro">Enter the email or username on your account. We’ll send a time-limited reset link to your recovery email.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>EMAIL OR USERNAME<span className="auth-input"><UserRound size={16} /><input autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="name@example.com" required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Requesting…' : 'Send reset link'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch"><button onClick={() => changeMode('login')}>Back to sign in</button></p>
      </>}

      {mode === 'reset' && <>
        <p className="auth-kicker">ACCOUNT RECOVERY</p><h1>Choose a new password<span>.</span></h1><p className="auth-intro">Reset links expire after 30 minutes and can only be used once.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>NEW PASSWORD<span className="auth-input"><KeyRound size={16} /><input name="password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={10} maxLength={72} required /></span></label>
          <label>CONFIRM PASSWORD<span className="auth-input"><KeyRound size={16} /><input name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16} /></button>
        </form>
      </>}

      {mode === 'reset-pending' && <div className="auth-message-state"><span className="auth-state-icon"><Mail size={24} /></span><p className="auth-kicker">CHECK YOUR RECOVERY EMAIL</p><h1>Reset link requested<span>.</span></h1><p>If a verified account matches that email or username, a reset link has been sent. Check the recovery email associated with your Nightfall account.</p><div className="auth-note"><ShieldCheck size={17} /> Reset links expire after 30 minutes.</div><button className="auth-secondary" onClick={() => changeMode('login')}>Back to sign in <ArrowRight size={15} /></button></div>}

      {mode === 'reset-complete' && <div className="auth-message-state"><span className="auth-state-icon"><Check size={24} /></span><p className="auth-kicker">ACCOUNT RECOVERY</p><h1>Password updated<span>.</span></h1><p>Your password was changed. Sign in with your new credentials.</p><button className="auth-submit" onClick={() => changeMode('login')}>Continue to sign in <ArrowRight size={16} /></button></div>}

      {mode === 'register' && <>
        <p className="auth-kicker">SET UP YOUR PROFILE</p><h1>Join Nightfall<span>.</span></h1><p className="auth-intro">{authConfig.emailVerificationRequired ? 'Choose a username and verify your email to get started.' : 'Choose a username. This private instance activates new accounts immediately.'}</p>
        <form className="auth-form auth-register-form" onSubmit={submit}>
          <div className="auth-name-row"><label>FIRST NAME<input autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} maxLength={48} required /></label><label>LAST NAME (OPTIONAL)<input autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} maxLength={48} /></label></div>
          <label>UNIQUE USERNAME<span className="auth-input"><b>@</b><input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers, or underscores" placeholder="nightwalker" required /></span><small>3–24 letters, numbers, or underscores</small></label>
          <p className="auth-mailbox-hint">Nightfall Mailbox: <strong>{username.trim() ? `${username.trim().toLowerCase()}@nf.com` : 'username@nf.com'}</strong> — for messages inside Nightfall. Your personal email below receives verification and recovery links.</p>
          <label>YOUR EMAIL<span className="auth-input"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required /></span><small>{authConfig.emailVerificationRequired ? 'We’ll send a welcome email with your verification link here.' : 'Used to sign in and recover your account.'}</small></label>
          <div className="auth-name-row"><label>PASSWORD<input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={password} onChange={event => setPassword(event.target.value)} minLength={10} maxLength={72} required /></label>{!authConfig.emailVerificationRequired && <label>CONFIRM PASSWORD<input name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} required /></label>}</div>
          <div className="auth-show-password"><label><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /> Show passwords</label></div>
          <p className="auth-password-hint">At least 10 characters.{authConfig.emailVerificationRequired ? ' You’ll enter it again after opening the email link.' : ''} Passwords are stored as secure hashes.</p>
          {(authConfig.inviteRequired || error.toLowerCase().includes('invite')) && <label>INVITE CODE<span className="auth-input"><KeyRound size={16} /><input autoComplete="off" value={inviteCode} onChange={event => setInviteCode(event.target.value)} maxLength={128} placeholder="Ask the friend who invited you" required /></span></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">Already have an account? <button onClick={() => changeMode('login')}>Sign in</button></p>
      </>}

      {mode === 'registered' && <div className="auth-message-state"><span className="auth-state-icon"><Check size={24} /></span><p className="auth-kicker">ACCOUNT READY</p><h1>You're in<span>.</span></h1><p>Your account <strong>{identifier ? `@${identifier}` : 'is ready'}</strong> is active. Sign in with the password you just chose.</p><div className="auth-note"><ShieldCheck size={17} /> No email confirmation is required on this private instance.</div><button className="auth-submit" onClick={() => changeMode('login')}>Continue to sign in <ArrowRight size={16} /></button></div>}

      {mode === 'pending' && <div className="auth-message-state"><span className="auth-state-icon"><Mail size={24} /></span><p className="auth-kicker">NEXT STEP</p><h1>Check your email<span>.</span></h1><p>{registrationMessage} Address: <strong>{email}</strong>. The link expires in 24 hours.</p><div className="auth-note"><ShieldCheck size={17} /> When you open the link, enter the password you chose here. Then sign in.</div><button className="auth-secondary" onClick={() => changeMode('login')}>Back to sign in <ArrowRight size={15} /></button></div>}

      {mode === 'verify' && <div className="auth-message-state"><span className="auth-state-icon"><ShieldCheck size={24} /></span><p className="auth-kicker">EMAIL VERIFICATION</p><h1>One last step<span>.</span></h1><p>Confirm that this email belongs to you. Enter the password you chose when creating the account — the link and the registration must match.</p>{error && <p className="auth-error" role="alert">{error}</p>}<form className="auth-form" onSubmit={submit}><label>PASSWORD<span className="auth-input"><KeyRound size={16} /><input name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength={10} maxLength={72} required /></span></label><button className="auth-submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify email'} <Check size={16} /></button></form><p className="auth-switch">Link expired or password lost? <button onClick={() => changeMode('resend')}>Request a new link</button></p></div>}

      {mode === 'resend' && <>
        <p className="auth-kicker">EMAIL VERIFICATION</p><h1>Resend the link<span>.</span></h1><p className="auth-intro">Enter the recovery email on the unverified account. We’ll send a fresh 24-hour link.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>RECOVERY EMAIL<span className="auth-input"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Sending…' : 'Send a new link'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch"><button onClick={() => changeMode('login')}>Back to sign in</button></p>
      </>}

      {mode === 'resend-pending' && <div className="auth-message-state"><span className="auth-state-icon"><Mail size={24} /></span><p className="auth-kicker">CHECK YOUR INBOX</p><h1>New link requested<span>.</span></h1><p>If an unverified account matches <strong>{email}</strong>, a fresh verification link is on its way. It expires in 24 hours.</p><button className="auth-secondary" onClick={() => changeMode('login')}>Back to sign in <ArrowRight size={15} /></button></div>}

      {mode === 'verified' && <div className="auth-message-state"><span className="auth-state-icon"><Check size={24} /></span><p className="auth-kicker">IDENTITY VERIFIED</p><h1>You're in<span>.</span></h1><p>Email verified and registration complete. You can now sign in to Nightfall.</p><button className="auth-submit" onClick={() => changeMode('login')}>Continue to sign in <ArrowRight size={16} /></button></div>}

      <footer className="auth-panel-footer"><span>ENCRYPTED SESSION / HTTPS REQUIRED</span><span>© NIGHTFALL SYSTEMS</span></footer>
    </section>
  </main>
}
