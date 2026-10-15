import { useEffect } from 'react';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { getMyProfile, updateMyProfile } from '../../api/patients.js';
import FormField from '../../components/FormField.jsx';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';
import { zodResolver } from '../../lib/zodResolver.js';

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const profileSchema = z.object({
  dob: z
    .union([z.string().date(), z.literal('')])
    .transform((value) => value || null),
  gender: optionalText(40),
  bloodGroup: optionalText(8),
  allergies: optionalText(5000),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalText(30),
});

const emptyProfile = {
  dob: '',
  gender: '',
  bloodGroup: '',
  allergies: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const formValues = (profile) => ({
  ...emptyProfile,
  ...profile,
  dob: profile?.dob ? new Date(profile.dob).toISOString().slice(0, 10) : '',
  gender: profile?.gender ?? '',
  bloodGroup: profile?.bloodGroup ?? '',
  allergies: profile?.allergies ?? '',
  emergencyContactName: profile?.emergencyContactName ?? '',
  emergencyContactPhone: profile?.emergencyContactPhone ?? '',
});

export default function PatientProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['patient-profile'],
    queryFn: getMyProfile,
  });
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
  });
  const saveMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(['patient-profile'], profile);
    },
  });

  useEffect(() => {
    if (profileQuery.data) form.reset(formValues(profileQuery.data));
  }, [profileQuery.data, form.reset]);

  if (profileQuery.isPending) return <Spinner label="Loading your profile" />;
  if (profileQuery.isError) {
    return (
      <Toast
        message={
          profileQuery.error.response?.data?.message ??
          'Unable to load your profile.'
        }
      />
    );
  }

  const errorMessage =
    saveMutation.error?.response?.data?.message ??
    (saveMutation.error ? 'Unable to save your profile.' : '');

  return (
    <section className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Patient details
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        My profile
      </h1>
      {profileQuery.data === null && (
        <p className="mt-3 text-sm text-slate-600">
          Your profile is empty. Add the details you want your care team to
          have.
        </p>
      )}
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Only you can update this information in this portal.
      </p>
      <div className="mt-7 rounded-3xl border border-emerald-950/5 bg-white p-6 shadow-card sm:p-8">
        {saveMutation.isSuccess && (
          <Toast kind="success" message="Your profile has been saved." />
        )}
        {errorMessage && (
          <div className="mb-5">
            <Toast message={errorMessage} />
          </div>
        )}
        <form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FormField
            label="Date of birth"
            name="dob"
            register={form.register}
            error={form.formState.errors.dob}
            type="date"
          />
          <FormField
            label="Gender"
            name="gender"
            register={form.register}
            error={form.formState.errors.gender}
            placeholder="Optional"
          />
          <FormField
            label="Blood group"
            name="bloodGroup"
            register={form.register}
            error={form.formState.errors.bloodGroup}
            placeholder="Optional"
          />
          <FormField
            label="Emergency contact name"
            name="emergencyContactName"
            register={form.register}
            error={form.formState.errors.emergencyContactName}
            placeholder="Optional"
          />
          <FormField
            label="Emergency contact phone"
            name="emergencyContactPhone"
            register={form.register}
            error={form.formState.errors.emergencyContactPhone}
            type="tel"
            placeholder="Optional"
          />
          <label className="block space-y-1.5 text-sm font-medium text-ink sm:col-span-2">
            <span>Allergies</span>
            <textarea
              {...form.register('allergies')}
              rows={4}
              className="w-full resize-y rounded-xl border border-emerald-950/10 bg-white px-3.5 py-3 text-ink outline-none transition placeholder:text-slate-400 focus:border-forest focus:ring-4 focus:ring-forest/10"
              placeholder="Add known allergies, or leave blank"
            />
            {form.formState.errors.allergies && (
              <span className="block text-xs font-normal text-rose-700">
                {form.formState.errors.allergies.message}
              </span>
            )}
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-wait disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
