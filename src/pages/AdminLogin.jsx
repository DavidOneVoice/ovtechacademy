import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/firebase";
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

    const adminEmail = "admin@ovtechacademy.com";
    const adminPassword = "OVTech2026!";
    const email = loginData.email.trim();

    if (email.toLowerCase() !== adminEmail.toLowerCase() || loginData.password !== adminPassword) {
      setError("Invalid admin email or password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, loginData.password);
      localStorage.setItem("ovtechAdmin", "true");
      navigate("/admin", { replace: true });
    } catch (error) {
      console.error("Firebase admin sign-in failed:", error);
      localStorage.removeItem("ovtechAdmin");
      setError("Admin account could not be authenticated. Please verify the Firebase admin user exists and try again.");
    }
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
