import { z } from 'zod';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createAppointment } from '../../api/appointments.js';
import {
  getDoctorSlots,
  getDoctors,
  getQueueInfo,
  getSpecialties,
} from '../../api/doctors.js';
import FormField from '../../components/FormField.jsx';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';
import { zodResolver } from '../../lib/zodResolver.js';
import { uploadDocument } from '../../api/documents.js';

const bookingSchema = z.object({
  specialtyId: z.string().uuid('Choose a specialty'),
  doctorId: z.string().uuid('Choose a doctor'),
  date: z.string().date('Choose a date'),
  slotStart: z
    .string()
    .datetime({ offset: true })
    .or(z.literal(''))
    .refine(Boolean, 'Choose an available time'),
  reason: z
    .string()
    .trim()
    .min(3, 'Add a short reason for your visit')
    .max(1000),
});
const todayInKolkata = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  );
const labelTime = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export default function BookingPage() {
  const [documentFile, setDocumentFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      specialtyId: '',
      doctorId: '',
      date: todayInKolkata(),
      slotStart: '',
      reason: '',
    },
  });
  const specialtyId = form.watch('specialtyId');
  const doctorId = form.watch('doctorId');
  const date = form.watch('date');
  const slotStart = form.watch('slotStart');
  const dateField = form.register('date');
  const specialties = useQuery({
    queryKey: ['specialties'],
    queryFn: getSpecialties,
  });
  const doctors = useQuery({
    queryKey: ['doctors', specialtyId],
    queryFn: () => getDoctors(specialtyId),
    enabled: Boolean(specialtyId),
  });
  const slots = useQuery({
    queryKey: ['doctor-slots', doctorId, date],
    queryFn: () => getDoctorSlots(doctorId, date),
    enabled: Boolean(doctorId && date),
  });
  const queueInfo = useQuery({
    queryKey: ['queue-info', doctorId, date, slotStart],
    queryFn: () => getQueueInfo(doctorId, date, slotStart),
    enabled: Boolean(doctorId && date && slotStart),
  });
  const booking = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      queryClient.invalidateQueries({
        queryKey: ['doctor-slots', doctorId, date],
      });
      form.setValue('slotStart', '');
      form.setValue('reason', '');
    },
  });
  const uploadAfterBooking = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      setDocumentFile(null);
      setUploadMessage('Document attached to this appointment for processing.');
    },
    onError: (error) =>
      setUploadMessage(
        error?.response?.data?.message || 'Document upload failed.',
      ),
  });

  return (
    <section className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Appointments
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        Book a doctor visit
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Choose an available slot. It is held for five minutes while the demo
        payment step is prepared.
      </p>
      <form
        className="mt-7 grid gap-5 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:grid-cols-2 sm:p-7"
        onSubmit={form.handleSubmit((values) =>
          booking.mutate({
            doctorId: values.doctorId,
            slotStart: values.slotStart,
            reason: values.reason,
          }),
        )}
      >
        <label className="block space-y-1.5 text-sm font-medium text-ink">
          <span>Specialty</span>
          <select
            {...form.register('specialtyId', {
              onChange: () => {
                form.setValue('doctorId', '');
                form.setValue('slotStart', '');
              },
            })}
            className="w-full rounded-xl border border-emerald-950/10 bg-white px-3.5 py-3"
          >
            <option value="">Choose a specialty</option>
            {specialties.data?.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </select>
          {form.formState.errors.specialtyId && (
            <span className="text-xs text-rose-700">
              {form.formState.errors.specialtyId.message}
            </span>
          )}
          {specialties.isLoading && (
            <span className="block text-xs text-slate-500">
              Loading specialties…
            </span>
          )}
          {specialties.isError && (
            <span className="block text-xs text-rose-700">
              Could not load specialties.
            </span>
          )}
          {specialties.data?.length === 0 && (
            <span className="block text-xs text-slate-500">
              No specialties are available.
            </span>
          )}
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-ink">
          <span>Doctor</span>
          <select
            {...form.register('doctorId', {
              onChange: () => form.setValue('slotStart', ''),
            })}
            disabled={!specialtyId || doctors.isLoading}
            className="w-full rounded-xl border border-emerald-950/10 bg-white px-3.5 py-3 disabled:bg-slate-50"
          >
            <option value="">Choose a doctor</option>
            {doctors.data?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.user.name} · ₹{doctor.feeInr} ·{' '}
                {doctor.status.toLowerCase()}
              </option>
            ))}
          </select>
          {form.formState.errors.doctorId && (
            <span className="text-xs text-rose-700">
              {form.formState.errors.doctorId.message}
            </span>
          )}
          {doctors.isError && (
            <span className="block text-xs text-rose-700">
              Could not load doctors.
            </span>
          )}
          {doctors.data?.length === 0 && (
            <span className="block text-xs text-slate-500">
              No doctors found for this specialty.
            </span>
          )}
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-ink">
          <span>Visit date</span>
          <input
            {...dateField}
            type="date"
            min={todayInKolkata()}
            onChange={(event) => {
              dateField.onChange(event);
              form.setValue('slotStart', '');
            }}
            aria-invalid={Boolean(form.formState.errors.date)}
            className="w-full rounded-xl border border-emerald-950/10 bg-white px-3.5 py-3"
          />
          {form.formState.errors.date && (
            <span className="text-xs text-rose-700">
              {form.formState.errors.date.message}
            </span>
          )}
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-ink">
          <span>Available time</span>
          <select
            {...form.register('slotStart')}
            disabled={!doctorId || slots.isLoading}
            className="w-full rounded-xl border border-emerald-950/10 bg-white px-3.5 py-3 disabled:bg-slate-50"
          >
            <option value="">Choose a time</option>
            {slots.data?.map((slot) => (
              <option key={slot.start} value={slot.start}>
                {labelTime(slot.start)}
              </option>
            ))}
          </select>
          {form.formState.errors.slotStart && (
            <span className="text-xs text-rose-700">
              {form.formState.errors.slotStart.message}
            </span>
          )}
          {slots.isLoading && (
            <span className="block text-xs text-slate-500">
              Loading available times…
            </span>
          )}
          {slots.isError && (
            <span className="block text-xs text-rose-700">
              Could not load available times.
            </span>
          )}
          {slots.data?.length === 0 && (
            <span className="block text-xs text-slate-500">
              No open times on this date.
            </span>
          )}
        </label>
        <div className="sm:col-span-2">
          <FormField
            label="Reason for visit"
            name="reason"
            register={form.register}
            error={form.formState.errors.reason}
            placeholder="For example, recurring headaches"
          />
        </div>
        <div className="sm:col-span-2 rounded-xl border border-emerald-950/10 p-4">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor="booking-document"
          >
            Attach a report (optional)
          </label>
          <input
            id="booking-document"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) =>
              setDocumentFile(event.target.files?.[0] || null)
            }
            className="mt-2 text-sm"
          />
          {booking.data?.id && documentFile && (
            <button
              type="button"
              disabled={uploadAfterBooking.isPending}
              onClick={() =>
                uploadAfterBooking.mutate({
                  file: documentFile,
                  appointmentId: booking.data.id,
                })
              }
              className="ml-3 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {uploadAfterBooking.isPending
                ? 'Uploading…'
                : 'Attach to this appointment'}
            </button>
          )}
          {uploadMessage && (
            <p className="mt-2 text-xs text-slate-600">{uploadMessage}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            PDF, JPG, or PNG; maximum 10 MB. You can also upload later from My
            documents.
          </p>
        </div>
        {slotStart && (
          <div className="rounded-xl bg-mint/60 p-4 text-sm text-forest sm:col-span-2">
            {queueInfo.isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner label="Calculating wait estimate" />
              </span>
            ) : queueInfo.isError ? (
              <span>Wait estimate is unavailable.</span>
            ) : (
              <span>
                Estimated patients ahead:{' '}
                <strong>{queueInfo.data.patientsAhead}</strong>. Approximate
                wait:{' '}
                <strong>
                  {queueInfo.data.estimatedWaitMinRange[0]}–
                  {queueInfo.data.estimatedWaitMinRange[1]} minutes
                </strong>
                .
              </span>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <Toast
            message={
              booking.error?.response?.data?.message ??
              (booking.isError
                ? 'The booking could not be completed. Please try another slot.'
                : '')
            }
          />
          {booking.isSuccess && (
            <Toast
              kind="success"
              message="Appointment held for five minutes. Continue to the appointment list for the next demo step."
            />
          )}
        </div>
        <button
          type="submit"
          disabled={
            booking.isPending ||
            !slots.data?.some((slot) => slot.start === slotStart)
          }
          className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
        >
          {booking.isPending ? 'Holding your slot…' : 'Book this appointment'}
        </button>
      </form>
    </section>
  );
}
