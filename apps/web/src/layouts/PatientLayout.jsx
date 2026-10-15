import RoleShell from './RoleShell.jsx';

export default function PatientLayout() {
  return (
    <RoleShell
      title="Patient portal"
      links={[
        { label: 'Overview', to: '/patient', end: true },
        { label: 'My profile', to: '/patient/profile' },
        { label: 'Book a visit', to: '/patient/book' },
        { label: 'My appointments', to: '/patient/appointments' },
        { label: 'My documents', to: '/patient/documents' },
      ]}
    />
  );
}
