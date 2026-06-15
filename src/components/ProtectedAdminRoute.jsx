import { Navigate } from "react-router-dom";

const ProtectedAdminRoute = ({ children }) => {
  const isAdmin = localStorage.getItem("ovtechAdmin") === "true";

  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
