import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  endConsultation,
  getDoctorToday,
  setDoctorStatus,
  startConsultation,
} from '../../api/doctorPortal.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

const timeLabel = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
const statusLabel = (value) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DoctorHome() {
  const { user } = useAuth();
  const client = useQueryClient();
  const today = useQuery({
    queryKey: ['doctor-today'],
    queryFn: getDoctorToday,
    refetchInterval: 15000,
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['doctor-today'] });
  const status = useMutation({
    mutationFn: setDoctorStatus,
    onSuccess: refresh,
  });
  const start = useMutation({
    mutationFn: startConsultation,
    onSuccess: refresh,
  });
  const end = useMutation({ mutationFn: endConsultation, onSuccess: refresh });
  if (today.isPending) return <Spinner label="Loading your clinic queue" />;
  if (today.isError)
    return (
      <Toast
        message={
          today.error?.response?.data?.message ||
          'Unable to load today’s queue.'
        }
      />
    );
  return (
    <section className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Doctor portal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Welcome, {user?.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Clinic queue · {today.data.date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Availability</span>
          {['AVAILABLE', 'BUSY', 'AWAY'].map((value) => (
            <button
              key={value}
              disabled={status.isPending || value === today.data.status}
              onClick={() => status.mutate(value)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${value === today.data.status ? 'bg-forest text-white' : 'border border-emerald-950/10 bg-white text-ink'}`}
            >
              {statusLabel(value)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <Toast
          message={
            status.error?.response?.data?.message ||
            start.error?.response?.data?.message ||
            end.error?.response?.data?.message ||
            ''
          }
        />
      </div>
      <h2 className="mt-7 text-xl font-semibold text-rose-900">
        Emergency cases · {today.data.emergencies.length}
      </h2>
      <div className="mt-3 grid gap-3">
        {today.data.emergencies.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold text-rose-950">
                {item.severity} · {item.name}
              </p>
              <span className="text-xs text-rose-800">
                {statusLabel(item.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-rose-900">
              {item.complaint} · {item.location}
            </p>
            <p className="mt-1 text-xs text-rose-700">
              {item.patient?.phone || item.phone} ·{' '}
              {new Date(item.createdAt).toLocaleString()}
            </p>
            {item.patient && (
              <Link
                className="mt-2 inline-block text-sm font-semibold text-forest"
                to={`/doctor/patients/${item.patient.id}`}
              >
                Open patient record
              </Link>
            )}
          </article>
        ))}
        {!today.data.emergencies.length && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            No active emergency cases for your patients.
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink">
          Today’s appointments · {today.data.appointments.length}
        </h2>
        <Link
          to="/doctor/patients"
          className="text-sm font-semibold text-forest"
        >
          View my patients →
        </Link>
      </div>
      <div className="mt-3 grid gap-3">
        {today.data.appointments.map((appointment) => (
          <article
            key={appointment.id}
            className="rounded-2xl border border-emerald-950/10 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">
                  {timeLabel(appointment.slotStart)} ·{' '}
                  {appointment.patient.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {appointment.reason}
                  {appointment.patient.patientProfile?.allergies
                    ? ` · Allergies: ${appointment.patient.patientProfile.allergies}`
                    : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {appointment.queueEntry
                    ? `Queue #${appointment.queueEntry.position}`
                    : 'Not checked in'}{' '}
                  · {statusLabel(appointment.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/doctor/patients/${appointment.patient.id}`}
                  className="rounded-lg border border-emerald-950/15 px-3 py-2 text-xs font-semibold text-forest"
                >
                  Patient records
                </Link>
                {appointment.status === 'CHECKED_IN' && (
                  <button
                    disabled={start.isPending}
                    onClick={() => start.mutate(appointment.id)}
                    className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white"
                  >
                    Start consultation
                  </button>
                )}
                {appointment.status === 'IN_CONSULTATION' && (
                  <button
                    disabled={end.isPending}
                    onClick={() => end.mutate(appointment.id)}
                    className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white"
                  >
                    Complete consultation
                  </button>
                )}
                {appointment.status === 'COMPLETED' && (
                  <Link
                    to={`/doctor/patients/${appointment.patient.id}`}
                    className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-forest"
                  >
                    {appointment.consultationReport
                      ? 'View report'
                      : 'Write report'}
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
        {!today.data.appointments.length && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            No appointments for today.
          </p>
        )}
      </div>
    </section>
  );
}
