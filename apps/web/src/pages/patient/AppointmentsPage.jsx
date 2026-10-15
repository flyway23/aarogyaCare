import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelAppointment,
  getMyAppointments,
} from '../../api/appointments.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

const dateTime = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));

export default function AppointmentsPage() {
  const client = useQueryClient();
  const appointments = useQuery({
    queryKey: ['my-appointments'],
    queryFn: getMyAppointments,
  });
  const cancel = useMutation({
    mutationFn: cancelAppointment,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['my-appointments'] }),
  });
  return (
    <section className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Patient portal
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        My appointments
      </h1>
      {appointments.isLoading && (
        <div className="mt-6">
          <Spinner label="Loading your appointments" />
        </div>
      )}
      {appointments.isError && (
        <div className="mt-6">
          <Toast message="Your appointments could not be loaded. Please try again." />
        </div>
      )}
      {appointments.data?.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white p-6 text-sm text-slate-600">
          No appointments yet. Choose a doctor and time to book your first
          visit.
        </p>
      )}
      <div className="mt-6 grid gap-4">
        {appointments.data?.map((appointment) => (
          <article
            key={appointment.id}
            className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {appointment.doctor.user.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {appointment.doctor.specialty.name} ·{' '}
                  {dateTime(appointment.slotStart)}
                </p>
              </div>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold capitalize text-forest">
                {appointment.status.toLowerCase().replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Reason: {appointment.reason}
            </p>
            {appointment.status === 'HELD' && (
              <p className="mt-3 text-sm text-amber-800">
                This slot is held for five minutes. Payment confirmation will be
                available in the next phase.
              </p>
            )}
            {['HELD', 'CONFIRMED'].includes(appointment.status) && (
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(appointment.id)}
                className="mt-4 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Cancel appointment
              </button>
            )}
          </article>
        ))}
      </div>
      {cancel.isError && (
        <div className="mt-4">
          <Toast
            message={
              cancel.error?.response?.data?.message ??
              'Appointment could not be cancelled.'
            }
          />
        </div>
      )}
    </section>
  );
}
