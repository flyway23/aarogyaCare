import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Spinner from './components/Spinner.jsx';

const LoginPage = lazy(() => import('./pages/public/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage.jsx'));
const PatientLayout = lazy(() => import('./layouts/PatientLayout.jsx'));
const DoctorLayout = lazy(() => import('./layouts/DoctorLayout.jsx'));
const OperatorLayout = lazy(() => import('./layouts/OperatorLayout.jsx'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'));
const PatientHome = lazy(() => import('./pages/patient/PatientHome.jsx'));
const PatientProfilePage = lazy(() => import('./pages/patient/PatientProfilePage.jsx'));
const DoctorHome = lazy(() => import('./pages/doctor/DoctorHome.jsx'));
const OperatorHome = lazy(() => import('./pages/operator/OperatorHome.jsx'));
const AdminHome = lazy(() => import('./pages/admin/AdminHome.jsx'));

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session" />;
  return <Navigate to={user ? `/${user.role}` : '/login'} replace />;
};

export default function App() {
  return (
    <Suspense fallback={<Spinner label="Loading AarogyaCare" />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/patient"
          element={<ProtectedRoute roles={['patient']}><PatientLayout /></ProtectedRoute>}
        >
          <Route index element={<PatientHome />} />
          <Route path="profile" element={<PatientProfilePage />} />
        </Route>
        <Route
          path="/doctor"
          element={<ProtectedRoute roles={['doctor']}><DoctorLayout /></ProtectedRoute>}
        >
          <Route index element={<DoctorHome />} />
        </Route>
        <Route
          path="/operator"
          element={<ProtectedRoute roles={['operator']}><OperatorLayout /></ProtectedRoute>}
        >
          <Route index element={<OperatorHome />} />
        </Route>
        <Route
          path="/admin/*"
          element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}
        >
          <Route index element={<AdminHome />} />
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
