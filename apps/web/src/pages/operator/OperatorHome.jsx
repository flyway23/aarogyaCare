import { useAuth } from '../../auth/AuthContext.jsx';

export default function OperatorHome() {
  const { user } = useAuth();
  return (
    <section className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Operator portal
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Welcome, {user?.name}
      </h1>
      <p className="mt-3 text-base leading-7 text-slate-600">
        You are signed in with operator access.
      </p>
    </section>
  );
}
