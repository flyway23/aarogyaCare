import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

const homeByRole = {
  patient: '/patient',
  doctor: '/doctor',
  operator: '/operator',
  admin: '/admin',
};

export default function ProtectedRoute({ roles, children }) {
  const { accessToken, user, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session" />;
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role))
    return <Navigate to={homeByRole[user.role] ?? '/login'} replace />;
  return children;
}
