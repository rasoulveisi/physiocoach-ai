import { useEffect, useState, useRef } from 'react';
import { LoaderCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
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
  const [statusText, setStatusText] = useState('Verifying credentials with Google...');
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
      setStatusText('Setting up athlete workspace...');
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
      setStatusText('Exchanging authorization token...');
      apiClient
        .post<AuthResponse>('auth/oauth/exchange', { code, state })
        .then((response) => {
          setStatusText('Setting up athlete workspace...');
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
    <main className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-center text-white">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-md">
        {error ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Sign-in failed</h1>
            <p className="text-sm text-zinc-400">{error}</p>
            <button
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 py-3 font-semibold text-black transition-all hover:bg-lime-300 active:scale-[0.98]"
              onClick={() => navigate('/auth')}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-lime-400/20" />
              <LoaderCircle className="h-10 w-10 animate-spin text-lime-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Authenticating</h1>
              <p className="mt-1 text-sm text-zinc-400">{statusText}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <ShieldCheck className="h-4 w-4 text-zinc-400" />
              <span>Secure OAuth 2.0 handshake</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

