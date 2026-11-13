import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import CompleteProfile from "./components/CompleteProfile";
import ProtectedRoute from "./components/ProtectedRoute";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import { getUser, homeFor, isAuthenticated, logout } from "./auth";

function PublicOnly({ children }) {
  if (isAuthenticated()) {
    const home = homeFor(getUser()?.role);
    if (home !== "/login") return <Navigate to={home} replace />;
  }
  return children;
}

function Placeholder({ title }) {
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

const PROTECTED = [
  ["/student", ["ETU"], "Espace étudiant"],
  ["/company", ["ENT"], "Espace entreprise"],
  ["/responsable", ["RESP"], "Espace responsable"],
  ["/admin", ["ADM"], "Espace administrateur"],
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/signup/complete-profile" element={<CompleteProfile />} />
      {PROTECTED.map(([path, roles, title]) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute roles={roles}>
              <Placeholder title={title} />
            </ProtectedRoute>
          }
        />
      ))}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={["ENS"]}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}