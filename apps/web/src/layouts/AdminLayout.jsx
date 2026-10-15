import RoleShell from './RoleShell.jsx';

export default function AdminLayout() {
  return (
    <RoleShell
      title="Admin portal"
      links={[{ label: 'Overview', to: '/admin', end: true }]}
    />
  );
}
