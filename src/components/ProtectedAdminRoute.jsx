import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../src/firebase";
import { getStoredAdminRole } from "../auth/adminRoles";

const ProtectedAdminRoute = ({ children, allowedRoles }) => {
  const hasStoredAdmin = () => Boolean(getStoredAdminRole());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(hasStoredAdmin);

  useEffect(() => {
    if (hasStoredAdmin()) {
      setIsAdmin(true);
      setIsCheckingAuth(false);
      return undefined;
    }

    if (!isFirebaseConfigured || !auth) {
      setIsAdmin(false);
      setIsCheckingAuth(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(Boolean(user) || hasStoredAdmin());
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (isCheckingAuth) {
    return null;
  }

  if (!isAdmin || (allowedRoles && !allowedRoles.includes(getStoredAdminRole()))) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
