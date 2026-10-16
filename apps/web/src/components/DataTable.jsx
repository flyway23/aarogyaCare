export default function DataTable({
  config,
  data,
  page,
  onPage,
  onEdit,
  onDelete,
  onRestore,
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-3">ID</th>
            {config.columns.map((column) => (
              <th key={column} className="px-3 py-3 font-semibold capitalize">
                {column.replaceAll(/([A-Z])/g, ' $1')}
              </th>
            ))}
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="max-w-48 break-all px-3 py-3 font-mono text-xs">
                {row.id}
              </td>
              {config.columns.map((column) => (
                <td key={column} className="max-w-64 px-3 py-3">
                  {String(row[column] ?? '—')}
                </td>
              ))}
              <td className="whitespace-nowrap px-3 py-3">
                {!config.readOnly &&
                  (row.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => onRestore(row.id)}
                      className="font-semibold text-forest"
                    >
                      Restore
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="mr-3 font-semibold text-forest"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="font-semibold text-rose-700"
                      >
                        Delete
                      </button>
                    </>
                  ))}
              </td>
            </tr>
          ))}
          {!data.items.length && (
            <tr>
              <td
                colSpan={config.columns.length + 2}
                className="px-4 py-8 text-center text-slate-500"
              >
                No matching records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t p-3 text-sm">
        <span>
          {data.total} records · page {data.page} of {data.pages || 1}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => onPage(page + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
