import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getDoctorPatients } from '../../api/doctorPortal.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

export default function DoctorPatientsPage() {
  const patients = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: getDoctorPatients,
  });
  if (patients.isPending) return <Spinner label="Loading your patients" />;
  if (patients.isError)
    return <Toast message="Unable to load your patient list." />;
  return (
    <section className="max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Doctor portal
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">My patients</h1>
      <p className="mt-2 text-sm text-slate-600">
        Patients you have seen in a consultation.
      </p>
      <div className="mt-6 grid gap-3">
        {patients.data.map((patient) => (
          <Link
            key={patient.id}
            to={`/doctor/patients/${patient.id}`}
            className="rounded-2xl border border-emerald-950/10 bg-white p-5 hover:border-forest/30"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{patient.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {patient.email} {patient.phone ? `· ${patient.phone}` : ''}
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Last visit{' '}
                {patient.appointmentsAsPatient[0]
                  ? new Date(
                      patient.appointmentsAsPatient[0].slotStart,
                    ).toLocaleString()
                  : '—'}
              </span>
            </div>
            <p className="mt-3 text-sm text-forest">Open patient record →</p>
          </Link>
        ))}
        {!patients.data.length && (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-600">
            No completed consultations yet.
          </p>
        )}
      </div>
    </section>
  );
}
