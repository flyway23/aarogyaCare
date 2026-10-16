import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAccessHistory,
  getConsents,
  setConsent,
} from '../../api/patientFeatures.js';
import { getDoctors } from '../../api/doctors.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

export default function PatientAccessPage() {
  const client = useQueryClient();
  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: () => getDoctors(),
  });
  const consents = useQuery({ queryKey: ['consents'], queryFn: getConsents });
  const history = useQuery({
    queryKey: ['access-history'],
    queryFn: getAccessHistory,
  });
  const update = useMutation({
    mutationFn: setConsent,
    onSuccess: () => client.invalidateQueries({ queryKey: ['consents'] }),
  });
  if (doctors.isPending || consents.isPending || history.isPending)
    return <Spinner label="Loading record access" />;
  if (doctors.isError || consents.isError || history.isError)
    return <Toast message="Unable to load record access settings." />;
  const granted = new Map(
    consents.data.map((item) => [item.doctorId, !item.revokedAt]),
  );
  return (
    <section className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Privacy controls
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Record access</h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose which doctors may read your records. Doctors still need an
        appointment relationship.
      </p>
      <div className="mt-5 grid gap-3">
        {doctors.data.map((doctor) => (
          <article
            key={doctor.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
          >
            <div>
              <p className="font-semibold">{doctor.user.name}</p>
              <p className="text-sm text-slate-600">{doctor.specialty.name}</p>
            </div>
            <button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  doctorId: doctor.user.id,
                  granted: !granted.get(doctor.user.id),
                })
              }
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              {granted.get(doctor.user.id) ? 'Revoke access' : 'Grant access'}
            </button>
          </article>
        ))}
      </div>
      {update.isError && (
        <Toast
          message={
            update.error?.response?.data?.message || 'Could not update access.'
          }
        />
      )}
      <h2 className="mt-8 text-xl font-semibold">Record access history</h2>
      <div className="mt-3 grid gap-2">
        {history.data.length ? (
          history.data.map((row) => (
            <article key={row.id} className="rounded-xl bg-white p-4 text-sm">
              <p className="font-semibold">
                {row.user?.name || 'System'} ·{' '}
                {row.action.replaceAll('_', ' ').toLowerCase()}
              </p>
              <p className="text-slate-500">
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            No record access has been logged.
          </p>
        )}
      </div>
    </section>
  );
}
