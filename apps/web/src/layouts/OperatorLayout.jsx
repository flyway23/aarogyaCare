import RoleShell from './RoleShell.jsx';

export default function OperatorLayout() {
  return (
    <RoleShell
      title="Operator portal"
      links={[
        { label: 'Overview', to: '/operator', end: true },
        { label: 'Walk-in booking', to: '/operator#walk-in' },
        { label: 'Queue', to: '/operator#queue' },
      ]}
    />
  );
}
