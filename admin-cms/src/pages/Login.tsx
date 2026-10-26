import { useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthProvider';

export function LoginPage() {
  const { signIn, signOut, status, user, error: accessError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-art" aria-hidden>
        <div className="caption">
          <h2>Rayat-Bahra University</h2>
          <p>Lecture recording management</p>
        </div>
      </div>
      <div className="login-form">
        <form onSubmit={submit} noValidate>
          <img src="/logo.png" alt="Rayat-Bahra University logo" />
          <div>
            <h1>LMS Admin</h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>Sign in with an administrator account</p>
          </div>
          {status === 'denied' && (
            <div className="alert" role="alert">
              <p style={{ margin: '0 0 8px' }}>{accessError}</p>
              {user && (
                <div style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 8px' }}>
                  Signed in as <strong>{user.email}</strong> (user ID <code>{user.uid}</code>).
                </div>
              )}
              <button type="button" className="link" onClick={() => signOut()}>
                Use a different account
              </button>
            </div>
          )}
          {status !== 'denied' && accessError && <div className="alert" role="alert">{accessError}</div>}
          {error && <div className="alert" role="alert">{error}</div>}
          <label className="field">
            <span>Email address</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
