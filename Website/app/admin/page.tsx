'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
export default function AdminLoginPage() { const { login } = useAuth(); const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const submit = async (event: FormEvent) => { event.preventDefault(); try { setError(''); await login(email, password); router.push('/dashboard'); } catch { setError('Incorrect email or password.'); } }; return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Link className="brand" href="/">RB Rayat Bahra University</Link><h1>Admin login</h1>{error && <div className="alert">{error}</div>}<label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label><label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></label><button className="button">Sign in</button><Link href="/">Back to website</Link></form></main>; }
