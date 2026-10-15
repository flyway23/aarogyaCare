import RoleShell from './RoleShell.jsx';

export default function OperatorLayout() {
  return (
    <RoleShell
      title="Operator portal"
      links={[{ label: 'Overview', to: '/operator', end: true }]}
    />
  );
}
