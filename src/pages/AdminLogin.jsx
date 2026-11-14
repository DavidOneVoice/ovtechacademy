import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ADMIN_ROLES, setStoredAdminRole } from "../auth/adminRoles";
import { assessmentAdminRequest } from "../lms/assessmentAdminClient";
import "./AdminLogin.css";

const ownerLogin = "admin@ovtechacademy.com";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [setupToken, setSetupToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get("setup") || "");
  const [confirmation, setConfirmation] = useState("");
  const [loginData, setLoginData] = useState({ email: ownerLogin, password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (setupToken && location.hash) navigate(location.pathname + location.search, { replace: true, state: location.state });
  }, [setupToken, location.hash, location.pathname, location.search, location.state, navigate]);

  const handleChange = (e) => {
    setLoginData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (setupToken && loginData.password !== confirmation) {
      setError("Enter the same password in both fields.");
      return;
    }
    const email = loginData.email.trim().toLowerCase();
    if (!setupToken && email === "adminassistant@ovtechacademy.com") {
      if (loginData.password !== "ovtechadminassistant") {
        setError("Invalid email or password.");
        return;
      }
      setBusy(true);
      await assessmentAdminRequest("logout", {}, AbortSignal.timeout(2500)).catch(() => {});
      setStoredAdminRole(ADMIN_ROLES.ASSISTANT);
      navigate("/admin/assistant", { replace: true });
      return;
    }
    setBusy(true);
    try {
      await assessmentAdminRequest(setupToken ? "setup" : "login", setupToken
        ? { setupToken, password: loginData.password }
        : { email, password: loginData.password });
      setStoredAdminRole(ADMIN_ROLES.ADMIN);
      const requested = location.state?.returnTo;
      const returnTo = setupToken ? "/admin/final-assessments" : typeof requested === "string" &&
        /^\/(admin(?:\/(?:final-assessments|lms|live-sessions|graduated-students))?|enrolled-students)(\?|$)/.test(requested)
        ? requested : "/admin";
      navigate(returnTo, { replace: true });
    } catch (failure) {
      setError(failure.message);
      if (["admin_setup_complete", "admin_setup_invalid"].includes(failure.code)) {
        setSetupToken("");
        setLoginData({ email: ownerLogin, password: "" });
      }
    } finally {
      setBusy(false);
    }
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
          <h1>{setupToken ? "Set your admin password" : "Welcome back"}</h1>
          <p>{setupToken ? "Choose a private password for your existing admin account. It must have at least 12 characters." : "Sign in to your academy workspace."}</p>

          {error && <div className="admin-login-error" role="alert">{error}</div>}

          {!setupToken && <label htmlFor="admin-email">
            Admin username
            <input
              id="admin-email"
              type="email"
              name="email"
              autoComplete="username"
              disabled={busy}
              required
              value={loginData.email}
              onChange={handleChange}
              placeholder="admin@ovtechacademy.com"
            />
          </label>}

          <label htmlFor="admin-password">
            {setupToken ? "New password" : "Password"}
            <input
              id="admin-password"
              type="password"
              name="password"
              autoComplete={setupToken ? "new-password" : "current-password"}
              minLength={setupToken ? 12 : undefined}
              maxLength={256}
              disabled={busy}
              required
              value={loginData.password}
              onChange={handleChange}
              placeholder="Enter admin password"
            />
          </label>
          {setupToken && <label htmlFor="admin-password-confirm">Confirm new password
            <input id="admin-password-confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={256}
              disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>}

          <button type="submit" disabled={busy}>{busy ? "Please wait…" : setupToken ? "Save password and sign in" : "Sign in"}</button>
          <Link className="admin-login-back" to="/">Back to the academy website</Link>
        </form>
      </div>
    </main>
  );
};

export default AdminLogin;
