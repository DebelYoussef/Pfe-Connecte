import { Navigate } from "react-router-dom";
import { getUser, homeFor, isAuthenticated } from "../auth";

export default function ProtectedRoute({ roles, children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getUser();
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return children;
}