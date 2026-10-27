import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, RequireAuth } from './components/Layout';

const DemoBadge = lazy(() => import('./demo/DemoBadge'));

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Booking = lazy(() => import('./pages/Booking'));
const TripTracking = lazy(() => import('./pages/TripTracking'));
const MyTrips = lazy(() => import('./pages/MyTrips'));
const Account = lazy(() => import('./pages/Account'));
const Support = lazy(() => import('./pages/Support'));
const ShareTrip = lazy(() => import('./pages/ShareTrip'));
const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard'));
const DriverEarnings = lazy(() => import('./pages/driver/DriverEarnings'));
const DriverProfile = lazy(() => import('./pages/driver/DriverProfile'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminTrips = lazy(() => import('./pages/admin/AdminTrips'));
const AdminLiveMap = lazy(() => import('./pages/admin/AdminLiveMap'));
const AdminDrivers = lazy(() => import('./pages/admin/AdminDrivers'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminVehicles = lazy(() => import('./pages/admin/AdminVehicles'));
const AdminPricing = lazy(() => import('./pages/admin/AdminPricing'));
const AdminPromos = lazy(() => import('./pages/admin/AdminPromos'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminTickets = lazy(() => import('./pages/admin/AdminTickets'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Fallback() {
  return (
    <div className="page center" style={{ minHeight: '50vh' }}>
      <span className="spinner" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <AppLayout>
              <Home />
            </AppLayout>
          }
        />
        <Route path="/dang-nhap" element={<Login />} />
        <Route path="/dang-ky" element={<Register />} />
        <Route path="/chia-se/:token" element={<ShareTrip />} />

        <Route
          path="/dat-xe"
          element={
            <AppLayout>
              <RequireAuth roles={['customer']}>
                <Booking />
              </RequireAuth>
            </AppLayout>
          }
        />
        <Route
          path="/chuyen/:id"
          element={
            <AppLayout>
              <RequireAuth>
                <TripTracking />
              </RequireAuth>
            </AppLayout>
          }
        />
        <Route
          path="/chuyen-cua-toi"
          element={
            <AppLayout>
              <RequireAuth roles={['customer']}>
                <MyTrips />
              </RequireAuth>
            </AppLayout>
          }
        />
        <Route
          path="/tai-khoan"
          element={
            <AppLayout>
              <RequireAuth>
                <Account />
              </RequireAuth>
            </AppLayout>
          }
        />
        <Route
          path="/ho-tro"
          element={
            <AppLayout>
              <RequireAuth>
                <Support />
              </RequireAuth>
            </AppLayout>
          }
        />

        <Route
          path="/tai-xe"
          element={
            <AppLayout>
              <RequireAuth roles={['driver']}>
                <DriverDashboard />
              </RequireAuth>
            </AppLayout>
          }
        />
        <Route
          path="/tai-xe/thu-nhap"
          element={
            <AppLayout>
              <RequireAuth roles={['driver']}>
                <DriverEarnings />
              </RequireAuth>
            </AppLayout>
          }
        />
        <Route
          path="/tai-xe/ho-so"
          element={
            <AppLayout>
              <RequireAuth roles={['driver']}>
                <DriverProfile />
              </RequireAuth>
            </AppLayout>
          }
        />

        <Route
          path="/quan-tri"
          element={
            <RequireAuth roles={['admin', 'operator']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="chuyen" element={<AdminTrips />} />
          <Route path="chuyen/:id" element={<AdminTrips />} />
          <Route path="ban-do" element={<AdminLiveMap />} />
          <Route path="tai-xe" element={<AdminDrivers />} />
          <Route path="khach-hang" element={<AdminCustomers />} />
          <Route path="phuong-tien" element={<AdminVehicles />} />
          <Route path="bang-gia" element={<AdminPricing />} />
          <Route path="khuyen-mai" element={<AdminPromos />} />
          <Route path="thanh-toan" element={<AdminPayments />} />
          <Route path="ho-tro" element={<AdminTickets />} />
          <Route path="bao-cao" element={<AdminReports />} />
          <Route path="cai-dat" element={<AdminSettings />} />
        </Route>

        <Route path="/trang-chu" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {DEMO_MODE && <DemoBadge />}
    </Suspense>
  );
}
