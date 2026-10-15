export default function FormField({
  label,
  name,
  register,
  error,
  type = 'text',
  ...props
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-ink">
      <span>{label}</span>
      <input
        {...register(name)}
        {...props}
        type={type}
        aria-invalid={Boolean(error)}
        className="w-full rounded-xl border border-emerald-950/10 bg-white px-3.5 py-3 text-ink outline-none transition placeholder:text-slate-400 focus:border-forest focus:ring-4 focus:ring-forest/10"
      />
      {error && (
        <span className="block text-xs font-normal text-rose-700">
          {error.message}
        </span>
      )}
    </label>
  );
}
