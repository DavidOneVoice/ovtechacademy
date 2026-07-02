import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../src/firebase";
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!isFirebaseConfigured || !auth) {
      setError("Admin login is temporarily unavailable because Firebase is not configured.");
      return;
    }

    try {
      await signInWithEmailAndPassword(
        auth,
        loginData.email.trim(),
        loginData.password,
      );
      localStorage.setItem("ovtechAdmin", "true");
      navigate("/admin");
    } catch (error) {
      console.log(error);
      localStorage.removeItem("ovtechAdmin");
      setError("Invalid admin email or password.");
    }
  };

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleLogin}>
        <span>OVTech Admin</span>
        <h1>Admin Login</h1>
        <p>Sign in to manage scholarship applications.</p>

        {!isFirebaseConfigured && (
          <div className="admin-login-error">
            Firebase is not configured for this deployment. Add the required
            VITE_FIREBASE_* environment variables to enable admin login.
          </div>
        )}

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

        <button type="submit" disabled={!isFirebaseConfigured}>Login</button>
      </form>
    </main>
  );
};

export default AdminLogin;
