import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function PatientHome() {
  const { user } = useAuth();
  return (
    <section className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Patient portal
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Welcome, {user?.name}
      </h1>
      <p className="mt-3 text-base leading-7 text-slate-600">
        Your account is ready. Keep your contact and health profile details up
        to date.
      </p>
      <Link
        to="/patient/profile"
        className="mt-8 inline-flex items-center rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
      >
        Review my profile
      </Link>
      <Link
        to="/patient/book"
        className="ml-3 mt-8 inline-flex items-center rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
      >
        Book an appointment
      </Link>
      <Link
        to="/patient/appointments"
        className="mt-4 inline-flex items-center rounded-xl border border-emerald-950/15 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mint sm:ml-3"
      >
        View my appointments
      </Link>
    </section>
  );
}
