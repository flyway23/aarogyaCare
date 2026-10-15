import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDocuments,
  getDocumentFile,
  uploadDocument,
} from '../../api/documents.js';
import Toast from '../../components/Toast.jsx';

const badge = {
  QUEUED: 'bg-amber-100 text-amber-900',
  PROCESSING: 'bg-sky-100 text-sky-900',
  READY: 'bg-emerald-100 text-emerald-900',
  FAILED: 'bg-rose-100 text-rose-900',
};
export default function DocumentsPage() {
  const client = useQueryClient();
  const docs = useQuery({
    queryKey: ['my-documents'],
    queryFn: getDocuments,
    refetchInterval: 3000,
  });
  const upload = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => client.invalidateQueries({ queryKey: ['my-documents'] }),
  });
  const download = async (doc) => {
    const blob = await getDocumentFile(doc.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.originalName;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Health records
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">My documents</h1>
      <p className="mt-2 text-sm text-slate-600">
        Upload a PDF, JPG, or PNG up to 10 MB. Text extraction is automated and
        must be checked against the original.
      </p>
      <form
        className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-950/10 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const file = e.currentTarget.elements.file.files[0];
          if (file) upload.mutate({ file });
        }}
      >
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          required
          className="max-w-full text-sm"
        />
        <button
          disabled={upload.isPending}
          className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading…' : 'Upload document'}
        </button>
      </form>
      <div className="mt-4">
        <Toast
          kind={upload.isSuccess ? 'success' : 'error'}
          message={
            upload.isError
              ? upload.error?.response?.data?.message || 'Upload failed.'
              : upload.isSuccess
                ? 'Upload received. Processing runs in the separate worker.'
                : ''
          }
        />
      </div>
      <div className="mt-5 grid gap-3">
        {docs.data?.map((doc) => (
          <article
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-950/10 bg-white p-4"
          >
            <div>
              <p className="font-semibold text-ink">{doc.originalName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {doc.type?.replaceAll('_', ' ') || 'Type pending'}
                {doc.failReason ? ` · ${doc.failReason}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${badge[doc.status]}`}
              >
                {doc.status[0] + doc.status.slice(1).toLowerCase()}
              </span>
              <button
                onClick={() => download(doc)}
                className="text-sm font-semibold text-forest"
              >
                Original file
              </button>
            </div>
          </article>
        ))}
        {docs.isSuccess && !docs.data.length && (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-600">
            No documents uploaded yet.
          </p>
        )}
      </div>
    </section>
  );
}
