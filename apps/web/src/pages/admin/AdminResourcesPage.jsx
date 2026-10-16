import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  createAdminItem,
  deleteAdminItem,
  exportAdminCsv,
  getAdminMeta,
  getAdminResource,
  restoreAdminItem,
  updateAdminItem,
} from '../../api/admin.js';
import DataTable from '../../components/DataTable.jsx';
import ResourceForm from '../../components/ResourceForm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

export default function AdminResourcesPage() {
  const client = useQueryClient();
  const meta = useQuery({ queryKey: ['admin-meta'], queryFn: getAdminMeta });
  const [resource, setResource] = useState('specialties');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editing, setEditing] = useState(null);
  const config = meta.data?.[resource];
  const list = useQuery({
    queryKey: ['admin-resource', resource, page, search, includeDeleted],
    queryFn: () =>
      getAdminResource(resource, {
        page,
        pageSize: 15,
        search,
        includeDeleted,
      }),
    enabled: Boolean(config),
  });
  const refresh = () => {
    setEditing(null);
    client.invalidateQueries({ queryKey: ['admin-resource', resource] });
  };
  const create = useMutation({
    mutationFn: createAdminItem,
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: updateAdminItem,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: deleteAdminItem,
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: restoreAdminItem,
    onSuccess: refresh,
  });
  const downloadCsv = async () => {
    const blob = await exportAdminCsv(resource);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${resource}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  if (meta.isPending) return <Spinner label="Loading admin resources" />;
  if (meta.isError)
    return <Toast message="Unable to load admin resource settings." />;
  if (!config) return <Toast message="Unknown admin resource." />;
  return (
    <section className="max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-ink">
            Resource management
          </h1>
          <Link
            to="/admin"
            className="mt-2 inline-block text-sm font-semibold text-forest"
          >
            ← Overview
          </Link>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCsv().catch(() => {})}
            className="rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            Export CSV
          </button>
          {config.supportsRestore && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  setIncludeDeleted(event.target.checked);
                  setPage(1);
                }}
              />
              Show deleted
            </label>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <select
          value={resource}
          onChange={(event) => {
            setResource(event.target.value);
            setPage(1);
            setEditing(null);
            setIncludeDeleted(false);
          }}
          className="rounded-lg border bg-white px-3 py-2"
        >
          {Object.entries(meta.data).map(([key, value]) => (
            <option key={key} value={key}>
              {value.title}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search"
          className="rounded-lg border bg-white px-3 py-2"
        />
      </div>
      {list.isPending ? (
        <Spinner label="Loading resource rows" />
      ) : list.isError ? (
        <Toast
          message={
            list.error?.response?.data?.message ||
            'Unable to load resource rows.'
          }
        />
      ) : (
        <DataTable
          config={config}
          data={list.data}
          page={page}
          onPage={setPage}
          onEdit={setEditing}
          onDelete={(id) => remove.mutate({ resource, id })}
          onRestore={(id) => restore.mutate({ resource, id })}
        />
      )}
      {!config.readOnly && !includeDeleted && (
        <ResourceForm
          config={config}
          editing={editing}
          onCancel={() => setEditing(null)}
          onSubmit={(body) =>
            editing
              ? update.mutate({ resource, id: editing.id, body })
              : create.mutate({ resource, body })
          }
          pending={create.isPending || update.isPending}
          error={
            create.error?.response?.data?.message ||
            update.error?.response?.data?.message ||
            remove.error?.response?.data?.message ||
            restore.error?.response?.data?.message
          }
        />
      )}
    </section>
  );
}
