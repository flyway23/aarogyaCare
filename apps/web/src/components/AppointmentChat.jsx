import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { getMessages, sendMessage } from '../api/patientFeatures.js';
import { zodResolver } from '../lib/zodResolver.js';
import Spinner from './Spinner.jsx';
import Toast from './Toast.jsx';

const messageSchema = z.object({ text: z.string().trim().min(1).max(2000) });

export default function AppointmentChat({ appointmentId }) {
  const client = useQueryClient();
  const messages = useQuery({
    queryKey: ['chat', appointmentId],
    queryFn: () => getMessages(appointmentId),
    refetchInterval: 5000,
  });
  const form = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: { text: '' },
  });
  const send = useMutation({
    mutationFn: (body) => sendMessage({ id: appointmentId, ...body }),
    onSuccess: () => {
      form.reset();
      client.invalidateQueries({ queryKey: ['chat', appointmentId] });
    },
  });
  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-forest">
        Chat is not for emergencies. Messages refresh every 5 seconds.
      </p>
      {messages.isPending ? (
        <Spinner label="Loading messages" />
      ) : messages.isError ? (
        <Toast message="Unable to load chat." />
      ) : (
        <div className="my-3 max-h-48 space-y-2 overflow-y-auto">
          {messages.data.length ? (
            messages.data.map((item) => (
              <p key={item.id} className="text-sm">
                <strong>{item.sender.name}:</strong> {item.text}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
        </div>
      )}
      <form
        onSubmit={form.handleSubmit((body) => send.mutate(body))}
        className="flex gap-2"
      >
        <input
          {...form.register('text')}
          aria-label="Chat message"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Write a message"
        />
        <button
          disabled={send.isPending}
          className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
        >
          Send
        </button>
      </form>
      {form.formState.errors.text && (
        <p className="mt-1 text-xs text-red-700">
          {form.formState.errors.text.message}
        </p>
      )}
      {send.isError && (
        <Toast
          message={
            send.error?.response?.data?.message || 'Could not send message.'
          }
        />
      )}
    </div>
  );
}
