import RoleShell from './RoleShell.jsx';

export default function DoctorLayout() {
  return (
    <RoleShell
      title="Doctor portal"
      links={[
        { label: 'Today’s queue', to: '/doctor', end: true },
        { label: 'My patients', to: '/doctor/patients' },
      ]}
    />
  );
}
