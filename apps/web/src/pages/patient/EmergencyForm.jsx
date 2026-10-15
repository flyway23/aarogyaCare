import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { raiseEmergency } from '../../api/emergency.js';
import FormField from '../../components/FormField.jsx';
import Toast from '../../components/Toast.jsx';
import { zodResolver } from '../../lib/zodResolver.js';

const emergencySchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  complaint: z.string().trim().min(3).max(1000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  location: z.string().trim().min(2).max(200),
});

export default function EmergencyForm() {
  const form = useForm({
    resolver: zodResolver(emergencySchema),
    defaultValues: {
      name: '',
      phone: '',
      complaint: '',
      severity: 'HIGH',
      location: '',
    },
  });
  const create = useMutation({
    mutationFn: raiseEmergency,
    onSuccess: () =>
      form.reset({
        name: '',
        phone: '',
        complaint: '',
        severity: 'HIGH',
        location: '',
      }),
  });
  return (
    <section className="mt-12 max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-800">
        Emergency help
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">
        Request urgent assistance
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        For life-threatening situations, call local emergency services too. This
        form alerts the hospital staff; it does not arrange an ambulance.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
      >
        <FormField
          label="Name"
          name="name"
          register={form.register}
          error={form.formState.errors.name}
        />
        <FormField
          label="Phone"
          name="phone"
          type="tel"
          register={form.register}
          error={form.formState.errors.phone}
        />
        <label className="space-y-1.5 text-sm font-medium text-ink">
          <span>Severity</span>
          <select
            {...form.register('severity')}
            className="w-full rounded-xl border border-rose-200 bg-white px-3 py-3"
          >
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>
        <FormField
          label="Location"
          name="location"
          register={form.register}
          error={form.formState.errors.location}
          placeholder="Hospital, building, or room"
        />
        <div className="sm:col-span-2">
          <FormField
            label="What is happening?"
            name="complaint"
            register={form.register}
            error={form.formState.errors.complaint}
          />
        </div>
        {create.isSuccess && (
          <div className="sm:col-span-2">
            <Toast
              kind="success"
              message="Your alert has been sent to hospital staff."
            />
          </div>
        )}
        {create.isError && (
          <div className="sm:col-span-2">
            <Toast
              message={
                create.error?.response?.data?.message ??
                'Emergency alert could not be sent.'
              }
            />
          </div>
        )}
        <button
          disabled={create.isPending}
          className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-900 disabled:opacity-50 sm:col-span-2"
        >
          {create.isPending ? 'Sending alert…' : 'Send emergency alert'}
        </button>
      </form>
    </section>
  );
}
