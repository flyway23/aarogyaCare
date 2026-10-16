import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  createConsultationReport,
  getDoctorPatientRecords,
} from '../../api/doctorPortal.js';
import { getDocumentFile } from '../../api/documents.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';
import AppointmentChat from '../../components/AppointmentChat.jsx';

const dateLabel = (value) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
const blankMedicine = () => ({
  medicine: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
});

export default function DoctorPatientPage() {
  const { id } = useParams();
  const client = useQueryClient();
  const records = useQuery({
    queryKey: ['doctor-patient-records', id],
    queryFn: () => getDoctorPatientRecords(id),
  });
  const [appointmentId, setAppointmentId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [chatAppointmentId, setChatAppointmentId] = useState('');
  const report = useMutation({
    mutationFn: createConsultationReport,
    onSuccess: () => {
      setAppointmentId('');
      setDiagnosis('');
      setNotes('');
      setFollowUpDate('');
      setMedicines([]);
      client.invalidateQueries({ queryKey: ['doctor-patient-records', id] });
      client.invalidateQueries({ queryKey: ['doctor-today'] });
    },
  });
  const openOriginal = async (doc) => {
    const blob = await getDocumentFile(doc.id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  if (records.isPending) return <Spinner label="Loading patient records" />;
  if (records.isError)
    return (
      <Toast
        message={
          records.error?.response?.data?.message ||
          'Unable to load this patient record.'
        }
      />
    );
  const record = records.data;
  const eligibleAppointments = record.appointments.filter(
    (item) => !item.consultationReport,
  );
  const setMedicine = (index, key, value) =>
    setMedicines((items) =>
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  return (
    <section className="max-w-6xl">
      <Link to="/doctor/patients" className="text-sm font-semibold text-forest">
        ← My patients
      </Link>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Patient record
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">
        {record.patient.name}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {record.patient.email}{' '}
        {record.patient.phone ? `· ${record.patient.phone}` : ''}
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-950/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Visit summary</h2>
          {record.latestSummary ? (
            <>
              <p className="mt-2 text-xs text-slate-500">
                Visit {dateLabel(record.latestSummary.appointment.slotStart)}
              </p>
              <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-mint/40 p-4 font-sans text-sm leading-6 text-ink">
                {record.latestSummary.content}
              </pre>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No generated summary is available for your appointments with this
              patient.
            </p>
          )}
          <div className="mt-4 grid gap-2 text-sm">
            <p>
              <strong>Allergies:</strong>{' '}
              {record.patient.patientProfile?.allergies || 'None recorded'}
            </p>
            <p>
              <strong>Blood group:</strong>{' '}
              {record.patient.patientProfile?.bloodGroup || 'Not recorded'}
            </p>
          </div>
        </article>
        <article className="rounded-2xl border border-emerald-950/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">
            Original documents and extracted snippets
          </h2>
          <div className="mt-3 grid gap-3">
            {record.documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-emerald-950/10 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-ink">
                      {doc.originalName}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {doc.type?.replaceAll('_', ' ') || doc.status}
                    </p>
                  </div>
                  <button
                    onClick={() => openOriginal(doc)}
                    className="text-sm font-semibold text-forest"
                  >
                    Open original
                  </button>
                </div>
                {doc.extractions.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {doc.extractions.map((item) => (
                      <li
                        key={item.id}
                        className={`rounded-lg p-3 text-sm ${item.isAbnormal ? 'bg-rose-50 text-rose-900' : 'bg-slate-50 text-slate-700'}`}
                      >
                        <p>
                          <strong>
                            {item.kind}
                            {item.isAbnormal ? ' · outside printed range' : ''}:
                          </strong>{' '}
                          {item.value}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Source: “{item.sourceSnippet}”
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {!record.documents.length && (
              <p className="text-sm text-slate-500">No uploaded documents.</p>
            )}
          </div>
        </article>
      </div>
      <article className="mt-5 rounded-2xl border border-emerald-950/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">
          Consultation reports and prescriptions
        </h2>
        <div className="mt-3 grid gap-3">
          {record.reports.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">{item.diagnosis}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {item.notes || 'No additional notes.'}
              </p>
              {item.medicines.map((medicine) => (
                <p key={medicine.id} className="mt-2 text-sm text-forest">
                  {medicine.medicine} · {medicine.dosage} · {medicine.frequency}{' '}
                  · {medicine.duration}
                </p>
              ))}
            </div>
          ))}
        </div>
        <form
          className="mt-5 grid gap-4 border-t border-emerald-950/10 pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            report.mutate({
              id: appointmentId,
              diagnosis,
              notes,
              followUpDate: followUpDate || null,
              medicines: medicines.filter((item) => item.medicine.trim()),
            });
          }}
        >
          <h3 className="font-semibold text-ink">
            Create a report for a completed visit
          </h3>
          <select
            required
            value={appointmentId}
            onChange={(event) => setAppointmentId(event.target.value)}
            className="rounded-xl border border-emerald-950/10 px-3 py-3"
          >
            <option value="">Choose completed appointment</option>
            {eligibleAppointments.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.slotStart).toLocaleString()}
              </option>
            ))}
          </select>
          <input
            required
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            placeholder="Diagnosis"
            className="rounded-xl border border-emerald-950/10 px-3 py-3"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Consultation notes"
            rows={4}
            className="rounded-xl border border-emerald-950/10 px-3 py-3"
          />
          <label className="grid gap-1 text-sm text-slate-600">
            Follow-up date
            <input
              type="date"
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
              className="rounded-xl border border-emerald-950/10 px-3 py-3 text-ink"
            />
          </label>
          {medicines.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-emerald-950/10 p-3 sm:grid-cols-2"
            >
              {[
                ['medicine', 'Medicine'],
                ['dosage', 'Dosage'],
                ['frequency', 'Frequency'],
                ['duration', 'Duration'],
                ['instructions', 'Instructions'],
              ].map(([key, label]) => (
                <input
                  key={key}
                  value={item[key]}
                  onChange={(event) =>
                    setMedicine(index, key, event.target.value)
                  }
                  placeholder={label}
                  required={key !== 'instructions'}
                  className="rounded-lg border border-emerald-950/10 px-3 py-2 text-sm"
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setMedicines((items) => items.filter((_, i) => i !== index))
                }
                className="text-left text-xs font-semibold text-rose-700"
              >
                Remove medicine
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMedicines((items) => [...items, blankMedicine()])}
            className="justify-self-start rounded-lg border border-emerald-950/20 px-3 py-2 text-sm font-semibold text-forest"
          >
            Add medicine
          </button>
          <Toast
            message={
              report.error?.response?.data?.message ||
              (report.isError ? 'Report could not be saved.' : '')
            }
          />
          <button
            disabled={report.isPending || !eligibleAppointments.length}
            className="rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {report.isPending
              ? 'Saving report…'
              : 'Save report (cannot be edited)'}
          </button>
        </form>
      </article>
      <article className="mt-5 rounded-2xl border border-emerald-950/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">
          Completed visit chats
        </h2>
        <div className="mt-3 grid gap-3">
          {record.appointments.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {dateLabel(item.slotStart)}
                </p>
                <button
                  onClick={() =>
                    setChatAppointmentId(
                      chatAppointmentId === item.id ? '' : item.id,
                    )
                  }
                  className="text-sm font-semibold text-forest"
                >
                  {chatAppointmentId === item.id ? 'Close chat' : 'Open chat'}
                </button>
              </div>
              {chatAppointmentId === item.id && (
                <AppointmentChat appointmentId={item.id} />
              )}
            </div>
          ))}
          {!record.appointments.length && (
            <p className="text-sm text-slate-500">No completed visits yet.</p>
          )}
        </div>
      </article>
      <article className="mt-5 rounded-2xl border border-emerald-950/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Patient timeline</h2>
        <ol className="mt-3 grid gap-3">
          {record.timeline.map((event) => (
            <li key={event.id} className="border-l-2 border-forest/30 pl-3">
              <p className="text-xs text-slate-500">
                {dateLabel(event.eventDate)}
              </p>
              <p className="text-sm text-ink">{event.description}</p>
            </li>
          ))}
          {!record.timeline.length && (
            <p className="text-sm text-slate-500">
              No dated record events yet.
            </p>
          )}
        </ol>
      </article>
    </section>
  );
}
