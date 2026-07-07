import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Scholarship from "./pages/Scholarship";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import EnrolledStudents from "./pages/EnrolledStudents";
import PaymentSuccess from "./pages/PaymentSuccess";
import Contact from "./pages/Contact";
import About from "./pages/About";
import Courses from "./pages/Courses";
import LmsDashboard from "./pages/LmsDashboard";
import AdminLms from "./pages/AdminLms";
import AdminLiveSessions from "./pages/AdminLiveSessions";
import AttendancePage from "./pages/AttendancePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scholarship" element={<Scholarship />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/lms" caseSensitive element={<LmsDashboard />} />
        <Route
          path="/LMS"
          caseSensitive
          element={<Navigate to="/lms" replace />}
        />
        <Route path="/student-lms" element={<Navigate to="/lms" replace />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/attendance/:sessionId" element={<AttendancePage />} />

        <Route path="/admin" element={<Admin />} />
        <Route
          path="/admin/lms"
          element={
            <ProtectedAdminRoute>
              <AdminLms />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/live-sessions"
          element={
            <ProtectedAdminRoute>
              <AdminLiveSessions />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/enrolled-students"
          element={
            <ProtectedAdminRoute>
              <EnrolledStudents />
            </ProtectedAdminRoute>
          }
        />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
