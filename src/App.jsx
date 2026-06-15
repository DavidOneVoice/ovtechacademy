import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Scholarship from "./pages/Scholarship";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
