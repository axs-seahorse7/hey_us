import React, { useState } from 'react';
import { authApi } from '../../../clients/src/services/authApi.js';

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRegistering = mode === 'register';

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const session = isRegistering ? await authApi.register(form) : await authApi.login(form);

      localStorage.setItem('dear-us-token', session.token);
      localStorage.setItem('dear-us-user', JSON.stringify(session.user));
      onAuthenticated();
    } catch (error) {
      setMessage(error.message || 'Unable to continue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <p className="eyebrow">DEAR US</p>

      <h1>Your story, kept together.</h1>

      <p className="intro">
        A private home for the moments you share - photos, videos, voice notes,
        and the little things worth remembering.
      </p>

      <section className="auth-card">
        <div className="mode">
          <button
            type="button"
            className={isRegistering ? '' : 'secondary'}
            onClick={() => changeMode('register')}
          >
            Create account
          </button>

          <button
            type="button"
            className={isRegistering ? 'secondary' : ''}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={submit}>
          {isRegistering && (
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </label>
          )}

          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              minLength="8"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
            />
          </label>

          {message && <p className="message" role="alert">{message}</p>}

          <button disabled={submitting}>
            {submitting ? 'Please wait...' : isRegistering ? 'Create my account' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
