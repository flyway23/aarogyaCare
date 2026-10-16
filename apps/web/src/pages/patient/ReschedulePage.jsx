import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useParams, useNavigate } from 'react-router-dom';
import { getMyAppointments } from '../../api/appointments.js';
import { getDoctorSlots } from '../../api/doctors.js';
import { reschedule } from '../../api/patientFeatures.js';
import { zodResolver } from '../../lib/zodResolver.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

const schema = z.object({
  date: z.string().date(),
  slotStart: z.string().min(1, 'Choose a time slot'),
});
const defaultDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function ReschedulePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const appointments = useQuery({
    queryKey: ['my-appointments'],
    queryFn: getMyAppointments,
  });
  const appointment = appointments.data?.find((item) => item.id === id);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { date: defaultDate, slotStart: '' },
  });
  const date = form.watch('date');
  const slots = useQuery({
    queryKey: ['reschedule-slots', appointment?.doctorId, date],
    queryFn: () => getDoctorSlots(appointment.doctorId, date),
    enabled: Boolean(appointment && date),
  });
  const save = useMutation({
    mutationFn: (body) => reschedule({ id, slotStart: body.slotStart }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['my-appointments'] });
      navigate('/patient/appointments');
    },
  });
  useEffect(() => {
    form.setValue('slotStart', '');
  }, [date, form.setValue]);
  if (appointments.isPending) return <Spinner label="Loading appointment" />;
  if (appointments.isError)
    return <Toast message="Unable to load appointments." />;
  if (!appointment) return <Toast message="Appointment not found." />;
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold text-ink">Reschedule visit</h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose a new available slot. Your existing payment stays with this
        appointment.
      </p>
      <form
        onSubmit={form.handleSubmit((body) => save.mutate(body))}
        className="mt-5 grid gap-4 rounded-2xl border bg-white p-5"
      >
        <label className="grid gap-1 text-sm font-medium">
          Date
          <input
            type="date"
            min={defaultDate}
            {...form.register('date')}
            className="rounded-lg border px-3 py-2"
          />
        </label>
        {slots.isPending ? (
          <Spinner label="Loading slots" />
        ) : slots.isError ? (
          <Toast message="Unable to load slots." />
        ) : slots.data.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slots.data.map((slot) => (
              <label
                key={slot.start}
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  value={slot.start}
                  {...form.register('slotStart')}
                />
                {new Date(slot.start).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No slots are available on this date.
          </p>
        )}
        {form.formState.errors.slotStart && (
          <p className="text-sm text-red-700">
            {form.formState.errors.slotStart.message}
          </p>
        )}
        {save.isError && (
          <Toast
            message={
              save.error?.response?.data?.message || 'Could not reschedule.'
            }
          />
        )}
        <button
          disabled={save.isPending || !slots.data?.length}
          className="rounded-lg bg-forest px-4 py-3 font-semibold text-white"
        >
          {save.isPending ? 'Saving…' : 'Confirm new time'}
        </button>
      </form>
    </section>
  );
}
