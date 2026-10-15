import { useQuery } from '@tanstack/react-query';

export default function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health');
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Health check failed');
      return body.data.status;
    },
  });

  return (
    <main>
      <h1>AarogyaCare</h1>
      <p>Hospital care, connected.</p>
      <p aria-live="polite">
        {health.isPending && 'Checking API, database, and Redis…'}
        {health.isSuccess && `Services: ${health.data}`}
        {health.isError && `Services unavailable: ${health.error.message}`}
      </p>
    </main>
  );
}
