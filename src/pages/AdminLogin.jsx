import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      <div className="admin-login-shell">
        <aside className="admin-login-brand" aria-label="OVTech Academy administration">
          <div className="admin-login-brand-identity">
            <img src="/ovlogo2.png" alt="OVTech Academy" />
            <div>OVTech Academy<small>Academy workspace</small></div>
          </div>
          <div className="admin-login-brand-message">
            <span className="admin-login-eyebrow">People. Progress. Possibility.</span>
            <h2>Support every student’s next step.</h2>
            <p>Manage applications, student progress and the learning experience in one place.</p>
          </div>
          <p className="admin-login-brand-footer">Your academy, thoughtfully organised.</p>
        </aside>
        <form className="admin-login-card" onSubmit={handleLogin}>
          <span className="admin-login-eyebrow">Administration</span>
          <h1>Welcome back</h1>
          <p>Sign in to your academy workspace.</p>

          {error && <div className="admin-login-error" role="alert">{error}</div>}

          <label htmlFor="admin-email">
            Email address
            <input
              id="admin-email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={loginData.email}
              onChange={handleChange}
              placeholder="admin@ovtechacademy.com"
            />
          </label>

          <label htmlFor="admin-password">
            Password
            <input
              id="admin-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={loginData.password}
              onChange={handleChange}
              placeholder="Enter admin password"
            />
          </label>

          <button type="submit">Sign in <span aria-hidden="true">→</span></button>
          <Link className="admin-login-back" to="/">Back to the academy website</Link>
        </form>
      </div>
    </main>
  );
};

export default AdminLogin;
