import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  getRecords,
  exportRecords,
  sendFeedback,
} from '../../api/patientFeatures.js';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';
import FormField from '../../components/FormField.jsx';
import { zodResolver } from '../../lib/zodResolver.js';
import AppointmentChat from '../../components/AppointmentChat.jsx';

const feedbackSchema = z.object({ text: z.string().trim().min(5).max(2000) });

export default function PatientRecordsPage() {
  const client = useQueryClient();
  const records = useQuery({
    queryKey: ['patient-records'],
    queryFn: getRecords,
  });
  const [openChat, setOpenChat] = useState('');
  const [feedbackId, setFeedbackId] = useState('');
  const feedbackForm = useForm({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { text: '' },
  });
  const feedback = useMutation({
    mutationFn: (body) => sendFeedback({ ...body, appointmentId: feedbackId }),
    onSuccess: () => {
      setFeedbackId('');
      feedbackForm.reset();
      client.invalidateQueries({ queryKey: ['patient-records'] });
    },
  });
  const downloadExport = async () => {
    const blob = await exportRecords();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'aarogyacare-records.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const downloadDocument = async (id, name) => {
    const response = await api.get(`/documents/${id}/file`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  if (records.isPending) return <Spinner label="Loading your records" />;
  if (records.isError) return <Toast message="Unable to load your records." />;
  return (
    <section className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Your health information
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Records</h1>
        </div>
        <button
          onClick={() => downloadExport().catch(() => {})}
          className="rounded-lg border px-4 py-2 text-sm font-semibold"
        >
          Export my data
        </button>
      </div>
      <h2 className="mt-7 text-xl font-semibold">Documents</h2>
      <div className="mt-3 grid gap-3">
        {records.data.documents.length ? (
          records.data.documents.map((doc) => (
            <article key={doc.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{doc.originalName}</p>
                  <p className="text-sm text-slate-600">
                    {doc.type || 'Processing'} · {doc.status}
                  </p>
                </div>
                <button
                  onClick={() =>
                    downloadDocument(doc.id, doc.originalName).catch(() => {})
                  }
                  className="text-sm font-semibold text-forest"
                >
                  Download
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            No uploaded records yet.
          </p>
        )}
      </div>
      <h2 className="mt-8 text-xl font-semibold">Completed visits</h2>
      <div className="mt-3 grid gap-4">
        {records.data.appointments.length ? (
          records.data.appointments.map((visit) => (
            <article key={visit.id} className="rounded-2xl border bg-white p-5">
              <p className="font-semibold">
                {new Date(visit.slotStart).toLocaleDateString()} ·{' '}
                {visit.doctor.user.name}
              </p>
              {visit.visitSummary && (
                <div className="mt-3 rounded-xl bg-mint/60 p-3">
                  <p className="text-xs font-semibold text-forest">
                    Machine-generated — verify with original documents
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
                    {visit.visitSummary.content}
                  </pre>
                </div>
              )}
              {visit.consultationReport && (
                <div className="mt-3 text-sm">
                  <p>
                    <strong>Diagnosis:</strong>{' '}
                    {visit.consultationReport.diagnosis}
                  </p>
                  <p>{visit.consultationReport.notes}</p>
                  <ul className="mt-2 list-disc pl-5">
                    {visit.consultationReport.medicines.map((rx) => (
                      <li key={rx.id}>
                        {rx.medicine} · {rx.dosage} · {rx.frequency} ·{' '}
                        {rx.duration}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() =>
                  setOpenChat(openChat === visit.id ? '' : visit.id)
                }
                className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold"
              >
                {openChat === visit.id ? 'Close chat' : 'Open doctor chat'}
              </button>
              {openChat === visit.id && (
                <AppointmentChat appointmentId={visit.id} />
              )}
              {!visit.feedback && feedbackId !== visit.id && (
                <button
                  onClick={() => setFeedbackId(visit.id)}
                  className="ml-2 mt-4 rounded-lg border px-3 py-2 text-sm font-semibold"
                >
                  Leave feedback
                </button>
              )}
              {feedbackId === visit.id && (
                <form
                  onSubmit={feedbackForm.handleSubmit((body) =>
                    feedback.mutate(body),
                  )}
                  className="mt-4"
                >
                  <FormField
                    label="Feedback"
                    error={feedbackForm.formState.errors.text?.message}
                  >
                    <textarea
                      {...feedbackForm.register('text')}
                      className="min-h-20 w-full rounded-lg border px-3 py-2"
                    />
                  </FormField>
                  <button
                    disabled={feedback.isPending}
                    className="mt-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
                  >
                    Submit
                  </button>
                  {feedback.isError && (
                    <Toast
                      message={
                        feedback.error?.response?.data?.message ||
                        'Could not submit feedback.'
                      }
                    />
                  )}
                </form>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            Completed visit records will appear here.
          </p>
        )}
      </div>
    </section>
  );
}
