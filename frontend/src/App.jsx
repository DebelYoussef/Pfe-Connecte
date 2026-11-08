import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import CompleteProfile from "./components/CompleteProfile";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentLayout from "./components/layout/StudentLayout";
import Home from "./pages/student/Home";
import Placeholder from "./pages/student/Placeholder";
import { getUser, homeFor, isAuthenticated, logout } from "./auth";

function PublicOnly({ children }) {
  if (isAuthenticated()) {
    const home = homeFor(getUser()?.role);
    if (home !== "/login") return <Navigate to={home} replace />;
  }
  return children;
}
function RolePlaceholder({ title }) {
  const navigate = useNavigate();
  const user = getUser();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.companyName ||
    user?.email;
  return (
    <main style={{ padding: "2rem" }}>
      <h1>{title}</h1>
      <p>{name}</p>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      >
        Se déconnecter
      </button>
    </main>
  );
}
export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <Signup />
          </PublicOnly>
        }
      />
      <Route path="/signup/complete-profile" element={<CompleteProfile />} />
      <Route
        element={
          <ProtectedRoute roles={["ETU"]}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/student" element={<Home />} />
        <Route path="/student/offres" element={<Placeholder />} />
        <Route path="/student/offres/:offerId" element={<Placeholder />} />
        <Route path="/student/candidatures" element={<Placeholder />} />
        <Route path="/student/convention" element={<Placeholder />} />
        <Route path="/student/encadrant" element={<Placeholder />} />
        <Route path="/student/journal" element={<Placeholder />} />
        <Route path="/student/rapport" element={<Placeholder />} />
        <Route path="/student/notifications" element={<Placeholder />} />
        <Route path="/student/profil" element={<Placeholder />} />
      </Route>
      <Route
        path="/company"
        element={
          <ProtectedRoute roles={["ENT"]}>
            <RolePlaceholder title="Espace entreprise" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={["ENS"]}>
            <RolePlaceholder title="Espace enseignant" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/responsable"
        element={
          <ProtectedRoute roles={["RESP"]}>
            <RolePlaceholder title="Espace responsable" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["ADM"]}>
            <RolePlaceholder title="Espace administrateur" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
