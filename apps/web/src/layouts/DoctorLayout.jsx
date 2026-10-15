import RoleShell from './RoleShell.jsx';

export default function DoctorLayout() {
  return (
    <RoleShell
      title="Doctor portal"
      links={[{ label: 'Overview', to: '/doctor', end: true }]}
    />
  );
}
