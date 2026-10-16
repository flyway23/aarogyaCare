import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFailedDocuments, retryFailedDocument } from '../../api/admin.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

export default function AdminFailedDocumentsPage() {
  const client = useQueryClient();
  const jobs = useQuery({
    queryKey: ['failed-documents'],
    queryFn: getFailedDocuments,
  });
  const retry = useMutation({
    mutationFn: retryFailedDocument,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['failed-documents'] }),
  });
  if (jobs.isPending) return <Spinner label="Loading failed document jobs" />;
  if (jobs.isError)
    return <Toast message="Unable to load failed document jobs." />;
  return (
    <section className="max-w-5xl">
      <h1 className="text-3xl font-semibold text-ink">Failed document jobs</h1>
      <p className="mt-2 text-sm text-slate-600">
        Retry requeues processing. Check the original file if extraction
        repeatedly fails.
      </p>
      <div className="mt-5 grid gap-3">
        {jobs.data.length ? (
          jobs.data.map((job) => (
            <article
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
            >
              <div>
                <p className="font-semibold">{job.originalName}</p>
                <p className="text-sm text-slate-600">
                  {job.failReason || 'No failure details'}
                </p>
                <p className="font-mono text-xs text-slate-400">{job.id}</p>
              </div>
              <button
                disabled={retry.isPending}
                onClick={() => retry.mutate(job.id)}
                className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            No failed jobs.
          </p>
        )}
      </div>
      {retry.isError && (
        <Toast
          message={retry.error?.response?.data?.message || 'Retry failed.'}
        />
      )}
    </section>
  );
}
