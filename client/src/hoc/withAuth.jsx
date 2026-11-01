import React, { useEffect, useState } from 'react';
import { authApi } from '../../../clients/src/services/authApi.js';

// A protected UI is rendered only after the API validates the stored JWT.
export function withAuth(Component) {
  return function AuthenticatedComponent({ onUnauthorized, ...props }) {
    const [status, setStatus] = useState('checking');
    const [user, setUser] = useState(null);

    useEffect(() => {
      let active = true;
      const token = localStorage.getItem('dear-us-token');

      if (!token) {
        onUnauthorized();
        return undefined;
      }

      authApi.getCurrentUser(token)
        .then(({ user: currentUser }) => {
          if (!active) return;
          localStorage.setItem('dear-us-user', JSON.stringify(currentUser));
          setUser(currentUser);
          setStatus('authorized');
        })
        .catch(() => {
          if (!active) return;
          localStorage.removeItem('dear-us-token');
          localStorage.removeItem('dear-us-user');
          onUnauthorized();
        });

      return () => {
        active = false;
      };
    }, [onUnauthorized]);

    if (status === 'checking') {
      return (
        <main>
          <p className="eyebrow">DEAR US</p>
          <p className="intro">Checking your secure session...</p>
        </main>
      );
    }

    return <Component {...props} user={user} />;
  };
}
