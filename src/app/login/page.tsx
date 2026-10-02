'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { api, friendlyErrorMessage } from '../../lib/api';
import { getToken, setToken } from '../../lib/auth';
import type { LoginResult } from '../../lib/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Already signed in: skip the form. The dashboard guard re-checks the token.
  useEffect(() => {
    if (getToken()) window.location.replace('/dashboard');
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await api.post<LoginResult>('/admin/auth/login', { email, password });
      setToken(result.accessToken);
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setError(friendlyErrorMessage(err, 'Sign in failed. Check your email and password.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="card fade-in w-full max-w-md p-8 sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/30">
            R
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ZemFi Admin</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted">Support console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@zemfi.app"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordInput
            label="Password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
