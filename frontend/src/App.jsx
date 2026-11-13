import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import CompleteProfile from "./components/CompleteProfile";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentLayout from "./components/layout/StudentLayout";
import Home from "./pages/student/Home";
import Placeholder from "./pages/student/Placeholder";
import LockedPage from "./components/LockedPage";
import Offers from "./pages/student/Offers";
import OfferDetail from "./pages/student/OfferDetail";
import Applications from "./pages/student/Applications";
import Convention from "./pages/student/Convention";
import Supervisor from "./pages/student/Supervisor";
import Journal from "./pages/student/Journal";
import Report from "./pages/student/Report";
import Notifications from "./pages/student/Notifications";
import Profile from "./pages/student/Profile";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
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
        <Route path="/student/offres" element={<Offers />} />
        <Route path="/student/offres/:offerId" element={<OfferDetail />} />
        <Route path="/student/candidatures" element={<Applications />} />
        <Route path="/student/convention" element={<Convention />} />
        <Route path="/student/encadrant" element={<Supervisor />} />
        <Route path="/student/journal" element={<Journal />} />
        <Route path="/student/rapport" element={<Report />} />
        <Route path="/student/notifications" element={<Notifications />} />
        <Route path="/student/profil" element={<Profile />} />
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
            <TeacherDashboard />
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