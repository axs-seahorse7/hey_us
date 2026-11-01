import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';
import { useAuth } from '../Context/AuthContext';
import './Login.css';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  function validate() {
    if (isSignup && !name.trim()) return 'Enter both your names, or what you call yourselves.';
    if (!emailPattern.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 8) return 'Password needs at least 8 characters.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const credentials = isSignup
        ? { name: name.trim(), email: email.trim().toLowerCase(), password }
        : { email: email.trim().toLowerCase(), password };

      const { token, user } = await authApi[isSignup ? 'register' : 'login'](credentials);
      login(user, token);
      navigate('/gallery');
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError('');
  }

  return (
    <div className="login">
      <div className="login__frame">
        <div className="login__stack" aria-hidden="true">
          <div className="login__photo login__photo--one" />
          <div className="login__photo login__photo--two" />
          <div className="login__photo login__photo--three" />
        </div>
        <div className="login__frame-copy">
          <p className="login__kicker">a shared album, two of you</p>
          <h1 className="login__headline">Every photo,<br />kept together.</h1>
          <p className="login__sub">
            Every trip, every ordinary Tuesday. One place the two of you keep going back to.
          </p>
        </div>
      </div>

      <div className="login__panel">
        <div className="login__panel-inner">
          <div className="login__tabs" role="tablist" aria-label="Choose sign in or create account">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`login__tab ${mode === 'signin' ? 'is-active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={`login__tab ${isSignup ? 'is-active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Create account
            </button>
          </div>

          <h2 className="login__title">
            {isSignup ? 'Start your album' : 'Welcome back'}
          </h2>
          <p className="login__hint">
            {isSignup
              ? 'Set up your shared space in a minute or two.'
              : 'Sign in to pick up right where you left off.'}
          </p>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <label className="login__field">
                <span className="login__label">Names</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex & Sam"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="login__field">
              <span className="login__label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className="login__field">
              <span className="login__label">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>

            {error && (
              <p className="login__error" role="alert">{error}</p>
            )}

            <button type="submit" className="login__submit" disabled={loading}>
              {loading ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="login__switch">
            {isSignup ? 'Already keeping an album with us?' : 'New here?'}{' '}
            <button type="button" className="login__link" onClick={() => switchMode(isSignup ? 'signin' : 'signup')}>
              {isSignup ? 'Sign in instead' : 'Create an account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}