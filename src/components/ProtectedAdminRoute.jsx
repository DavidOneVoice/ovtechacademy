import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ADMIN_ROLES, getStoredAdminRole, setStoredAdminRole } from "../auth/adminRoles";
import { assessmentAdminRequest } from "../lms/assessmentAdminClient";

const ProtectedAdminRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const [role, setRole] = useState(undefined);

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      if (getStoredAdminRole() === ADMIN_ROLES.ASSISTANT) {
        setRole(ADMIN_ROLES.ASSISTANT);
        return;
      }
      try {
        const result = await assessmentAdminRequest("session", {}, controller.signal);
        if (!controller.signal.aborted) {
          const signedIn = result.role === ADMIN_ROLES.ADMIN;
          if (signedIn) setStoredAdminRole(ADMIN_ROLES.ADMIN);
          setRole(signedIn ? ADMIN_ROLES.ADMIN : null);
        }
      } catch {
        if (!controller.signal.aborted) setRole(null);
      }
    }
    void check();
    return () => controller.abort();
  }, []);

  if (role === undefined) return <p role="status" className="route-loading">Loading…</p>;
  if (!role || (allowedRoles && !allowedRoles.includes(role))) {
    return <Navigate to="/admin-login" replace state={{ returnTo: location.pathname + location.search }} />;
  }
  return children;
};

export default ProtectedAdminRoute;
