export default function Spinner({ label = 'Loading' }) {
  return (
    <div
      className="flex min-h-36 items-center justify-center gap-3 text-sm text-slate-600"
      role="status"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-forest/20 border-t-forest" />
      <span>{label}</span>
    </div>
  );
}
