import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_ROLES, setStoredAdminRole } from "../auth/adminRoles";
import "./AdminLogin.css";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setLoginData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleLogin = (e) => {
    e.preventDefault();

    const accounts = [
      {
        email: "admin@ovtechacademy.com",
        password: "OVTech2026!",
        role: ADMIN_ROLES.ADMIN,
      },
      {
        email: "adminassistant@ovtechacademy.com",
        password: "ovtechadminassistant",
        role: ADMIN_ROLES.ASSISTANT,
      },
    ];
    const account = accounts.find(
      ({ email, password }) =>
        loginData.email.trim().toLowerCase() === email &&
        loginData.password === password,
    );

    if (account) {
      setStoredAdminRole(account.role);
      navigate("/admin", { replace: true });
      return;
    }

    setError("Invalid email or password.");
  };

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleLogin}>
        <span>OVTech Admin</span>
        <h1>Admin Login</h1>
        <p>Sign in to manage scholarship applications.</p>

        {error && <div className="admin-login-error">{error}</div>}

        <label>
          Email Address
          <input
            type="email"
            name="email"
            required
            value={loginData.email}
            onChange={handleChange}
            placeholder="admin@ovtechacademy.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            required
            value={loginData.password}
            onChange={handleChange}
            placeholder="Enter admin password"
          />
        </label>

        <button type="submit">Login</button>
      </form>
    </main>
  );
};

export default AdminLogin;
