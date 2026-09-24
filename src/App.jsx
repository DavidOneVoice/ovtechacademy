import { lazy, Suspense } from "react";
import { publicPages } from "./seo/publicPages";
import SeoMetadata from "./seo/SeoMetadata";
import AnalyticsConsent from "./analytics/AnalyticsConsent";
import NotFound from "./pages/NotFound";
const Registration = lazy(() => import("./pages/Registration"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn"));
const PaymentReview = lazy(() => import("./pages/PaymentReview"));
const ScholarshipPayment = lazy(() => import("./pages/ScholarshipPayment"));
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const ProtectedAdminRoute = lazy(() => import("./components/ProtectedAdminRoute"));
const EnrolledStudents = lazy(() => import("./pages/EnrolledStudents"));
const GraduatedStudents = lazy(() => import("./pages/GraduatedStudents"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const LmsDashboard = lazy(() => import("./pages/LmsDashboard"));
const AdminLms = lazy(() => import("./pages/AdminLms"));
const AdminLiveSessions = lazy(() => import("./pages/AdminLiveSessions"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const AdminAssistant = lazy(() => import("./pages/AdminAssistant"));
const VerifySearch = lazy(() => import("./pages/VerifySearch"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate"));
import { ADMIN_ROLES, getStoredAdminRole } from "./auth/adminRoles";

const AdminDashboardRoute = () => (
  getStoredAdminRole() === ADMIN_ROLES.ASSISTANT
    ? <Navigate to="/admin/assistant" replace />
    : <Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><Admin /></Suspense>
);

import "./academy.css";

function App() {
  return (
    <BrowserRouter>
      <SeoMetadata />
      <AnalyticsConsent />
      <Suspense fallback={<p role="status" className="route-loading">Loading…</p>}>
      <Routes>
        {publicPages.map(({ path, Component }) => <Route key={path} path={path} element={<Component />} />)}
        <Route path="*" element={<NotFound />} />
        <Route path="/verify" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><VerifySearch /></Suspense>} />
        <Route path="/verify/:certificateId" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><VerifyCertificate /></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><Registration /></Suspense>} />
        <Route path="/payment-review" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><PaymentReview /></Suspense>} />
        <Route path="/registration/complete" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><PaymentReturn /></Suspense>} />
        <Route path="/scholarship-payment" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><ScholarshipPayment /></Suspense>} />
        <Route path="/lms" caseSensitive element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><LmsDashboard /></Suspense>} />
        <Route
          path="/LMS"
          caseSensitive
          element={<Navigate to="/lms" replace />}
        />
        <Route path="/student-lms" element={<Navigate to="/lms" replace />} />
        <Route path="/admin-login" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><AdminLogin /></Suspense>} />
        <Route path="/attendance/:sessionId" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><AttendancePage /></Suspense>} />

        <Route
          path="/admin"
          element={<ProtectedAdminRoute><AdminDashboardRoute /></ProtectedAdminRoute>}
        />
        <Route
          path="/admin/assistant"
          element={<ProtectedAdminRoute allowedRoles={[ADMIN_ROLES.ASSISTANT]}><Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><AdminAssistant /></Suspense></ProtectedAdminRoute>}
        />
        <Route
          path="/admin/lms"
          element={
            <ProtectedAdminRoute allowedRoles={[ADMIN_ROLES.ADMIN]}>
              <Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><AdminLms /></Suspense>
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/live-sessions"
          element={
            <ProtectedAdminRoute allowedRoles={[ADMIN_ROLES.ADMIN]}>
              <Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><AdminLiveSessions /></Suspense>
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/enrolled-students"
          element={
            <ProtectedAdminRoute allowedRoles={[ADMIN_ROLES.ADMIN]}>
              <Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><EnrolledStudents /></Suspense>
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/graduated-students"
          element={
            <ProtectedAdminRoute allowedRoles={[ADMIN_ROLES.ADMIN]}>
              <Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><GraduatedStudents /></Suspense>
            </ProtectedAdminRoute>
          }
        />
        <Route path="/payment-success" element={<Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><PaymentSuccess /></Suspense>} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
