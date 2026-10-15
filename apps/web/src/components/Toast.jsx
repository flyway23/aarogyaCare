export default function Toast({ message, kind = 'error' }) {
  if (!message) return null;
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-rose-200 bg-rose-50 text-rose-800';
  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      {message}
    </div>
  );
}
