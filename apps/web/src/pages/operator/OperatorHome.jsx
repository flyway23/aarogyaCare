import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  checkInAppointment,
  createAppointment,
  getDoctorAppointments,
  getQueue,
  updateQueue,
} from '../../api/appointments.js';
import { recordOfflinePayment } from '../../api/payments.js';
import {
  getDoctorSlots,
  getDoctors,
  getSpecialties,
} from '../../api/doctors.js';
import FormField from '../../components/FormField.jsx';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';
import { zodResolver } from '../../lib/zodResolver.js';

const todayInKolkata = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  );
const dateTime = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
const walkInSchema = z.object({
  specialtyId: z.string().uuid('Choose a specialty'),
  doctorId: z.string().uuid('Choose a doctor'),
  date: z.string().date(),
  slotStart: z
    .string()
    .datetime({ offset: true })
    .or(z.literal(''))
    .refine(Boolean, 'Choose a slot'),
  reason: z.string().trim().min(3).max(1000),
  patientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.string().email().or(z.literal('')).optional(),
});
const reorderSchema = z.object({
  queueId: z.string().uuid('Choose a queue entry'),
  position: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(300),
});

export default function OperatorHome() {
  const client = useQueryClient();
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const form = useForm({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      specialtyId: '',
      doctorId: '',
      date: todayInKolkata(),
      slotStart: '',
      reason: '',
      patientName: '',
      phone: '',
      email: '',
    },
  });
  const queueForm = useForm({
    resolver: zodResolver(reorderSchema),
    defaultValues: { queueId: '', position: 1, reason: '' },
  });
  const specialtyId = form.watch('specialtyId');
  const doctorId = form.watch('doctorId');
  const date = form.watch('date');
  const slotStart = form.watch('slotStart');
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
  const appointments = useQuery({
    queryKey: ['operator-appointments', doctorId, date],
    queryFn: () => getDoctorAppointments(doctorId, date),
    enabled: Boolean(doctorId && date),
  });
  const queue = useQuery({
    queryKey: ['operator-queue', doctorId, date],
    queryFn: () => getQueue(doctorId, date),
    enabled: Boolean(doctorId && date),
  });
  useEffect(() => {
    if (!form.getValues('doctorId') && doctors.data?.length)
      form.setValue('doctorId', doctors.data[0].id);
  }, [doctors.data, form]);
  const invalidate = () => {
    client.invalidateQueries({
      queryKey: ['operator-appointments', doctorId, date],
    });
    client.invalidateQueries({ queryKey: ['operator-queue', doctorId, date] });
    client.invalidateQueries({ queryKey: ['doctor-slots', doctorId, date] });
  };
  const booking = useMutation({
    mutationFn: createAppointment,
    onSuccess: (appointment) => {
      form.reset({ ...form.getValues(), slotStart: '', reason: '' });
      setCreatedAppointment(appointment);
      invalidate();
    },
  });
  const confirm = useMutation({
    mutationFn: (appointmentId) =>
      recordOfflinePayment(appointmentId, paymentMethod),
    onSuccess: (_appointment, id) => {
      if (createdAppointment?.id === id) setCreatedAppointment(null);
      invalidate();
    },
  });
  const checkIn = useMutation({
    mutationFn: checkInAppointment,
    onSuccess: invalidate,
  });
  const queueAction = useMutation({
    mutationFn: ({ id, action }) => updateQueue(id, action),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: ({ queueId, position, reason }) =>
      updateQueue(queueId, 'reorder', { position, reason }),
    onSuccess: () => {
      invalidate();
      queueForm.reset({ queueId: '', position: 1, reason: '' });
    },
  });
  const mutationError =
    booking.error ??
    confirm.error ??
    checkIn.error ??
    queueAction.error ??
    reorder.error;

  return (
    <section className="space-y-12">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
          Operator portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Walk-in booking and queue
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Create bookings for walk-in patients, record offline payments, and
          manage today’s checked-in queue.
        </p>
      </div>

      <section id="walk-in" className="max-w-4xl scroll-mt-8">
        <h2 className="text-xl font-semibold text-ink">Walk-in booking</h2>
        <form
          className="mt-4 grid gap-4 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:grid-cols-2 sm:p-7"
          onSubmit={form.handleSubmit((values) =>
            booking.mutate({
              doctorId: values.doctorId,
              slotStart: values.slotStart,
              reason: values.reason,
              patient: {
                name: values.patientName,
                phone: values.phone,
                ...(values.email ? { email: values.email } : {}),
              },
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
              {specialties.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
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
              {doctors.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.user.name} · ₹{item.feeInr}
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
          </label>
          <FormField
            label="Visit date"
            name="date"
            type="date"
            register={form.register}
            error={form.formState.errors.date}
            min={todayInKolkata()}
          />
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
                  {dateTime(slot.start)}
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
                Loading slots…
              </span>
            )}
            {slots.isError && (
              <span className="block text-xs text-rose-700">
                Could not load slots.
              </span>
            )}
            {slots.data?.length === 0 && (
              <span className="block text-xs text-slate-500">
                No open times on this date.
              </span>
            )}
          </label>
          <FormField
            label="Patient name"
            name="patientName"
            register={form.register}
            error={form.formState.errors.patientName}
          />
          <FormField
            label="Patient phone"
            name="phone"
            type="tel"
            register={form.register}
            error={form.formState.errors.phone}
          />
          <FormField
            label="Patient email (optional)"
            name="email"
            type="email"
            register={form.register}
            error={form.formState.errors.email}
          />
          <div className="sm:col-span-2">
            <FormField
              label="Reason for visit"
              name="reason"
              register={form.register}
              error={form.formState.errors.reason}
              placeholder="Brief reason for the visit"
            />
          </div>
          <div className="sm:col-span-2">
            <Toast
              message={
                booking.error?.response?.data?.message ??
                (booking.isError
                  ? 'Walk-in booking failed. Check the details and try another slot.'
                  : '')
              }
            />
            {createdAppointment && (
              <div className="space-y-3">
                <Toast
                  kind="success"
                  message={`Walk-in appointment held for ${createdAppointment.patient.name}.`}
                />
                <button
                  type="button"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(createdAppointment.id)}
                  className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink disabled:opacity-50"
                >
                  {confirm.isPending
                    ? 'Recording…'
                    : `Record ${paymentMethod.toLowerCase()} payment`}
                </button>
              </div>
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
            {booking.isPending ? 'Creating booking…' : 'Create walk-in booking'}
          </button>
        </form>
        <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink">
          Offline payment method
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="rounded-xl border border-emerald-950/10 bg-white px-3 py-2"
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
        </label>
      </section>

      <section id="queue" className="max-w-5xl scroll-mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              Appointments and queue
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Select a specialty and doctor above to view their appointments for
              this date.
            </p>
          </div>
          <div className="flex gap-3">
            <label className="text-xs font-medium text-slate-600">
              Date
              <input
                type="date"
                value={date}
                min={todayInKolkata()}
                onChange={(event) => form.setValue('date', event.target.value)}
                className="mt-1 block rounded-xl border border-emerald-950/10 bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>
        </div>
        {mutationError && (
          <div className="mt-4">
            <Toast
              message={
                mutationError?.response?.data?.message ??
                'That action could not be completed.'
              }
            />
          </div>
        )}
        {!doctorId && (
          <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-slate-600">
            Choose a specialty and doctor to load today’s schedule.
          </p>
        )}
        {appointments.isLoading && doctorId && (
          <div className="mt-5">
            <Spinner label="Loading appointments" />
          </div>
        )}
        {appointments.isError && (
          <div className="mt-5">
            <Toast message="Appointments could not be loaded." />
          </div>
        )}
        {appointments.data?.length === 0 && (
          <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-slate-600">
            No bookings for this doctor and date.
          </p>
        )}
        <div className="mt-5 grid gap-3">
          {appointments.data?.map((appointment) => (
            <article
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-950/10 bg-white p-4"
            >
              <div>
                <h3 className="font-semibold text-ink">
                  {appointment.patient.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {dateTime(appointment.slotStart)} ·{' '}
                  {appointment.patient.phone}
                </p>
                <span className="mt-2 inline-block rounded-full bg-mint px-3 py-1 text-xs font-semibold capitalize text-forest">
                  {appointment.status.toLowerCase().replaceAll('_', ' ')}
                </span>
              </div>
              <div className="flex gap-2">
                {appointment.status === 'HELD' && (
                  <button
                    type="button"
                    onClick={() => confirm.mutate(appointment.id)}
                    className="rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white"
                  >
                    Record offline payment
                  </button>
                )}
                {appointment.status === 'CONFIRMED' && (
                  <button
                    type="button"
                    onClick={() => checkIn.mutate(appointment.id)}
                    className="rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white"
                  >
                    Check in
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <h3 className="mt-10 text-lg font-semibold text-ink">
          Checked-in queue
        </h3>
        {queue.isLoading && doctorId && (
          <div className="mt-4">
            <Spinner label="Loading queue" />
          </div>
        )}
        {queue.isError && (
          <div className="mt-4">
            <Toast message="The queue could not be loaded." />
          </div>
        )}
        {queue.data?.length === 0 && (
          <p className="mt-3 rounded-2xl bg-white p-5 text-sm text-slate-600">
            No checked-in patients in this queue.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {queue.data?.map((entry) => (
            <article
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-950/10 bg-white p-4"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-mint font-semibold text-forest">
                  {entry.position}
                </span>
                <div>
                  <h4 className="font-semibold text-ink">
                    {entry.appointment.patient.name}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {dateTime(entry.appointment.slotStart)} ·{' '}
                    {entry.status.toLowerCase()}
                  </p>
                  {entry.reorderReason && (
                    <p className="text-xs text-slate-500">
                      Reordered: {entry.reorderReason}
                    </p>
                  )}
                </div>
              </div>
              {entry.status === 'WAITING' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      queueAction.mutate({ id: entry.id, action: 'skip' })
                    }
                    className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      queueAction.mutate({ id: entry.id, action: 'no-show' })
                    }
                    className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    No-show
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>

        {(queue.data?.filter((entry) => entry.status === 'WAITING').length ??
          0) > 1 && (
          <form
            className="mt-6 grid gap-3 rounded-2xl bg-white p-5 sm:grid-cols-3"
            onSubmit={queueForm.handleSubmit((values) =>
              reorder.mutate(values),
            )}
          >
            <label className="block space-y-1 text-sm font-medium text-ink">
              <span>Patient to move</span>
              <select
                {...queueForm.register('queueId')}
                className="w-full rounded-xl border border-emerald-950/10 px-3 py-2"
              >
                <option value="">Choose an entry</option>
                {queue.data
                  .filter((entry) => entry.status === 'WAITING')
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      #{entry.position} · {entry.appointment.patient.name}
                    </option>
                  ))}
              </select>
              {queueForm.formState.errors.queueId && (
                <span className="text-xs text-rose-700">
                  {queueForm.formState.errors.queueId.message}
                </span>
              )}
            </label>
            <FormField
              label="New position"
              name="position"
              type="number"
              min="1"
              max={
                queue.data.filter((entry) => entry.status === 'WAITING').length
              }
              register={queueForm.register}
              error={queueForm.formState.errors.position}
            />
            <FormField
              label="Reason for reorder"
              name="reason"
              register={queueForm.register}
              error={queueForm.formState.errors.reason}
            />
            <button
              type="submit"
              disabled={reorder.isPending}
              className="rounded-xl border border-forest px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50 sm:col-span-3"
            >
              {reorder.isPending ? 'Saving…' : 'Reorder queue'}
            </button>
          </form>
        )}
      </section>
    </section>
  );
}
