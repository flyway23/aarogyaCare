import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { register as registerAccount } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import FormField from '../../components/FormField.jsx';
import Toast from '../../components/Toast.jsx';
import AuthFrame from './AuthFrame.jsx';
import { zodResolver } from '../../lib/zodResolver.js';

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().max(30, 'Phone number is too long'),
    password: z.string().min(8, 'Use at least 8 characters').max(72),
    confirmPassword: z.string().min(8, 'Confirm your password').max(72),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, acceptSession } = useAuth();
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });
  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _confirmPassword, ...values }) =>
      registerAccount({ ...values, phone: values.phone || null }),
    onSuccess: (session) => {
      acceptSession(session);
      navigate('/patient', { replace: true });
    },
  });

  if (user) return <Navigate to={`/${user.role}`} replace />;
  const serverMessage =
    mutation.error?.response?.data?.message ??
    (mutation.error ? 'Unable to create your account. Try again.' : '');

  return (
    <AuthFrame
      title="Create your account"
      subtitle="Patient accounts are free. Your details stay in your profile."
      footer="Already have an account?"
      footerLink="/login"
      footerText="Sign in"
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Toast message={serverMessage} />
        <FormField
          label="Full name"
          name="name"
          register={form.register}
          error={form.formState.errors.name}
          autoComplete="name"
          placeholder="Your name"
        />
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
          label="Phone (optional)"
          name="phone"
          register={form.register}
          error={form.formState.errors.phone}
          type="tel"
          autoComplete="tel"
          placeholder="Your phone number"
        />
        <FormField
          label="Password"
          name="password"
          register={form.register}
          error={form.formState.errors.password}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <FormField
          label="Confirm password"
          name="confirmPassword"
          register={form.register}
          error={form.formState.errors.confirmPassword}
          type="password"
          autoComplete="new-password"
          placeholder="Enter it again"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-xl bg-forest px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink disabled:cursor-wait disabled:opacity-60"
        >
          {mutation.isPending ? 'Creating account…' : 'Create patient account'}
        </button>
      </form>
    </AuthFrame>
  );
}
