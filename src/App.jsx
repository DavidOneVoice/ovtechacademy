import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Scholarship from "./pages/Scholarship";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import EnrolledStudents from "./pages/EnrolledStudents";
import PaymentSuccess from "./pages/PaymentSuccess";
import Contact from "./pages/Contact";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scholarship" element={<Scholarship />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <Admin />
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
