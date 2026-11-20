import { browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, setPersistence } from 'firebase/auth';
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Layers, Lock, Mail, ShieldCheck, Users, Video } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { BRAND } from '../components/Layout';
import { firebaseAuth } from '../lib/firebase';

const YEAR = new Date().getFullYear();

const FEATURES = [
  { icon: Users, label: 'Manage Students' },
  { icon: Layers, label: 'Track Courses' },
  { icon: Video, label: 'Review Recordings' },
];

export function LoginPage() {
  const { signIn, signOut, status, user, error: accessError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      // Remember me = stay signed in after closing the browser; otherwise only for this tab session.
      await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signIn(email, password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') ? 'Incorrect email or password.' : err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };
  const forgot = async () => {
    setError(null); setInfo(null);
    if (!email.trim()) { setError('Type your admin email first, then press Forgot password.'); return; }
    try { await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase()); setInfo(`If ${email.trim()} has an account, a password reset link is on its way.`); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not send the reset email.'); }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden><GraduationCap size={26} /></span>
          <strong>{BRAND}</strong>
          <span className="auth-badge">Admin Portal</span>
        </div>
        <h1>Welcome Back,<br /><span>Admin</span></h1>
        <p>Manage your learning platform from one place.</p>
        <div className="auth-art" aria-hidden>
          <span className="blob" />
          <BookOpen size={84} className="art-book" />
          <GraduationCap size={110} className="art-cap" />
          <div className="art-screen"><span /><span /><i /><i /><i /><i /></div>
        </div>
        <ul className="auth-features">
          {FEATURES.map(({ icon: Icon, label }) => <li key={label}><span aria-hidden><Icon size={22} /></span>{label}</li>)}
        </ul>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-card-brand"><span className="auth-logo" aria-hidden><GraduationCap size={22} /></span><strong>{BRAND}</strong></div>
          <h2>Admin Sign In</h2>
          <p className="auth-lead">Enter your credentials to access the admin portal.</p>

          {status === 'denied' && (
            <div className="alert" role="alert">
              <p style={{ margin: '0 0 8px' }}>{accessError}</p>
              {user && <div style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 8px' }}>Signed in as <strong>{user.email}</strong> (user ID <code>{user.uid}</code>).</div>}
              <button type="button" className="link" onClick={() => signOut()}>Use a different account</button>
            </div>
          )}
          {status !== 'denied' && accessError && <div className="alert" role="alert">{accessError}</div>}
          {error && <div className="alert" role="alert">{error}</div>}
          {info && <div className="notice" role="status">{info}</div>}

          <label className="field">
            <span>Email address</span>
            <div className="input-icon"><Mail size={17} aria-hidden /><input className="input" type="email" autoComplete="email" placeholder="Enter admin email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </label>
          <label className="field">
            <span>Password</span>
            <div className="input-icon">
              <Lock size={17} aria-hidden />
              <input className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="input-action" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </label>
          <div className="auth-row">
            <label className="checkbox"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button type="button" className="link" onClick={() => void forgot()}>Forgot password?</button>
          </div>
          <button className="btn auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : <>Sign In <ArrowRight size={17} /></>}</button>
          <div className="auth-secure"><ShieldCheck size={16} aria-hidden /> Secure administrator access</div>
        </form>
        <footer className="auth-foot">© {YEAR} {BRAND}. All rights reserved.</footer>
      </section>
    </div>
  );
}
