import { useEffect, useState, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, type User } from '../context/AuthContext';
import { apiClient } from '../services/api-client';

interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState('');
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;

    const errorParam = params.get('error') || params.get('error_description');
    if (errorParam) {
      setError(errorParam);
      return;
    }

    const token = params.get('access_token') || params.get('token');
    const refreshToken = params.get('refresh_token') || undefined;

    if (token) {
      exchangedRef.current = true;
      let user: User = {
        id: params.get('user_id') || 'oauth-user',
        email: params.get('email') || '',
        displayName: params.get('name'),
      };
      const encoded = params.get('user');
      if (encoded) {
        try {
          user = JSON.parse(decodeURIComponent(encoded)) as User;
        } catch {
          /* Use query fields. */
        }
      }
      setSession({ accessToken: token, refreshToken, user });
      navigate('/dashboard', { replace: true });
      return;
    }

    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      exchangedRef.current = true;
      apiClient
        .post<AuthResponse>('auth/oauth/exchange', { code, state })
        .then((response) => {
          setSession({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: response.user,
          });
          navigate('/dashboard', { replace: true });
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : 'Failed to complete sign-in with Google.');
        });
      return;
    }

    setError('Missing OAuth code or token in callback URL.');
  }, [navigate, params, setSession]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white">
      <div>
        {error ? (
          <>
            <h1 className="text-2xl font-black">Sign-in failed</h1>
            <p className="mt-3 text-red-400">{error}</p>
            <button className="mt-6 font-bold text-lime-400 hover:underline" onClick={() => navigate('/auth')}>
              Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-lime-400" />
            <h1 className="mt-5 text-2xl font-black">Finishing your sign-in…</h1>
          </>
        )}
      </div>
    </main>
  );
}

