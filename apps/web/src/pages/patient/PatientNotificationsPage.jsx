import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markNotificationRead,
} from '../../api/patientFeatures.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

export default function PatientNotificationsPage() {
  const client = useQueryClient();
  const items = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  if (items.isPending) return <Spinner label="Loading notifications" />;
  if (items.isError) return <Toast message="Unable to load notifications." />;
  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-semibold text-ink">Notifications</h1>
      <div className="mt-5 grid gap-3">
        {items.data.length ? (
          items.data.map((item) => (
            <article key={item.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                {!item.readAt && (
                  <button
                    onClick={() => markRead.mutate(item.id)}
                    className="text-sm font-semibold text-forest"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            No notifications.
          </p>
        )}
      </div>
    </section>
  );
}
