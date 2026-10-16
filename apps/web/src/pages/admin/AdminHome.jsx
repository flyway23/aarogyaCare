import { useQuery } from '@tanstack/react-query';
import { getAdminOverview } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

const number = (value) => new Intl.NumberFormat().format(value ?? 0);

export default function AdminHome() {
  const { user } = useAuth();
  const overview = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
  });
  if (overview.isPending) return <Spinner label="Loading hospital overview" />;
  if (overview.isError)
    return (
      <Toast
        message={
          overview.error?.response?.data?.message ||
          'Unable to load the hospital overview.'
        }
      />
    );

  const stats = [
    ['Doctors', overview.data.doctors],
    ['Appointments', overview.data.appointments],
    ['Available beds', overview.data.beds.available],
    ['Open emergencies', overview.data.openEmergencies],
    ['Documents needing review', overview.data.failedDocuments],
  ];
  return (
    <section className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Administration
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        Hospital overview
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Welcome, {user?.name}. Live read-only counts for the demo environment.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <article
            key={label}
            className="rounded-2xl border border-emerald-950/10 bg-white p-5"
          >
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {number(value)}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Demo data is fictional. This overview does not expose patient clinical
        records.
      </p>
    </section>
  );
}
