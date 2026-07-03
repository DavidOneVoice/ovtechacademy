import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../src/firebase";

const ProtectedAdminRoute = ({ children }) => {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsAdmin(false);
      setIsCheckingAuth(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(Boolean(user));
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (isCheckingAuth) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
