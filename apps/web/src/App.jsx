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
const PatientProfilePage = lazy(
  () => import('./pages/patient/PatientProfilePage.jsx'),
);
const BookingPage = lazy(() => import('./pages/patient/BookingPage.jsx'));
const AppointmentsPage = lazy(
  () => import('./pages/patient/AppointmentsPage.jsx'),
);
const DocumentsPage = lazy(() => import('./pages/patient/DocumentsPage.jsx'));
const PatientRecordsPage = lazy(
  () => import('./pages/patient/PatientRecordsPage.jsx'),
);
const PatientAccessPage = lazy(
  () => import('./pages/patient/PatientAccessPage.jsx'),
);
const PatientNotificationsPage = lazy(
  () => import('./pages/patient/PatientNotificationsPage.jsx'),
);
const ReschedulePage = lazy(() => import('./pages/patient/ReschedulePage.jsx'));
const DoctorHome = lazy(() => import('./pages/doctor/DoctorHome.jsx'));
const DoctorPatientsPage = lazy(
  () => import('./pages/doctor/DoctorPatientsPage.jsx'),
);
const DoctorPatientPage = lazy(
  () => import('./pages/doctor/DoctorPatientPage.jsx'),
);
const OperatorHome = lazy(() => import('./pages/operator/OperatorHome.jsx'));
const AdminHome = lazy(() => import('./pages/admin/AdminHome.jsx'));
const AdminResourcesPage = lazy(
  () => import('./pages/admin/AdminResourcesPage.jsx'),
);
const AdminFailedDocumentsPage = lazy(
  () => import('./pages/admin/AdminFailedDocumentsPage.jsx'),
);

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
          element={
            <ProtectedRoute roles={['patient']}>
              <PatientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PatientHome />} />
          <Route path="profile" element={<PatientProfilePage />} />
          <Route path="book" element={<BookingPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="records" element={<PatientRecordsPage />} />
          <Route path="access" element={<PatientAccessPage />} />
          <Route path="notifications" element={<PatientNotificationsPage />} />
          <Route path="reschedule/:id" element={<ReschedulePage />} />
        </Route>
        <Route
          path="/doctor"
          element={
            <ProtectedRoute roles={['doctor']}>
              <DoctorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DoctorHome />} />
          <Route path="patients" element={<DoctorPatientsPage />} />
          <Route path="patients/:id" element={<DoctorPatientPage />} />
        </Route>
        <Route
          path="/operator"
          element={
            <ProtectedRoute roles={['operator']}>
              <OperatorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OperatorHome />} />
        </Route>
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="resources" element={<AdminResourcesPage />} />
          <Route
            path="failed-documents"
            element={<AdminFailedDocumentsPage />}
          />
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
