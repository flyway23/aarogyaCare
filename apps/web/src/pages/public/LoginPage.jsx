import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import FormField from '../../components/FormField.jsx';
import Toast from '../../components/Toast.jsx';
import AuthFrame from './AuthFrame.jsx';
import { zodResolver } from '../../lib/zodResolver.js';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, acceptSession } = useAuth();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      acceptSession(session);
      navigate(`/${session.user.role}`, { replace: true });
    },
  });

  if (user) return <Navigate to={`/${user.role}`} replace />;
  const serverMessage =
    mutation.error?.response?.data?.message ??
    (mutation.error ? 'Unable to sign in. Try again.' : '');

  return (
    <AuthFrame
      title="Sign in"
      subtitle="Use your AarogyaCare account to continue."
      footer="New to AarogyaCare?"
      footerLink="/register"
      footerText="Create an account"
    >
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Toast message={serverMessage} />
        <FormField
          label="Email address"
          name="email"
          register={form.register}
          error={form.formState.errors.email}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FormField
          label="Password"
          name="password"
          register={form.register}
          error={form.formState.errors.password}
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-xl bg-forest px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink disabled:cursor-wait disabled:opacity-60"
        >
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthFrame>
  );
}
