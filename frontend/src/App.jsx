import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import CompleteProfile from "./components/CompleteProfile";
import CompanyHome from "./components/Company/CompanyHome";
import CompanyLayout from "./components/Company/CompanyLayout";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Signup from "./components/Signup";
import StudentLayout from "./components/layout/StudentLayout";
import TeacherLayout from "./components/layout/TeacherLayout";
import { getUser, homeFor, isAuthenticated, logout } from "./auth";
import Notifications from "./pages/student/Notifications";
import Applications from "./pages/student/Applications";
import Convention from "./pages/student/Convention";
import Home from "./pages/student/Home";
import Journal from "./pages/student/Journal";
import OfferDetail from "./pages/student/OfferDetail";
import Offers from "./pages/student/Offers";
import Profile from "./pages/student/Profile";
import Report from "./pages/student/Report";
import Supervisor from "./pages/student/Supervisor";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherProfile from "./pages/teacher/TeacherProfile";
import TeacherReports from "./pages/teacher/TeacherReports";
import TeacherRequests from "./pages/teacher/TeacherRequests";
import TeacherStudentDetail from "./pages/teacher/TeacherStudentDetail";
import TeacherStudents from "./pages/teacher/TeacherStudents";

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
    <main className="p-8">
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

function CompanyPlaceholder({ title }) {
  return (
    <section className="rounded border border-line bg-surface p-8">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">
        Espace entreprise
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold">
        Bientôt disponible
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        La section « {title} » sera disponible prochainement dans votre espace
        entreprise.
      </p>
    </section>
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
            <CompanyLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CompanyHome />} />
        <Route
          path="offers/*"
          element={<CompanyPlaceholder title="Mes offres" />}
        />
        <Route
          path="applications/*"
          element={<CompanyPlaceholder title="Candidatures" />}
        />
        <Route
          path="convention/*"
          element={<CompanyPlaceholder title="Conventions" />}
        />
        <Route
          path="journals/*"
          element={<CompanyPlaceholder title="Journaux" />}
        />
        <Route
          path="reports/*"
          element={<CompanyPlaceholder title="Rapports" />}
        />
        <Route
          path="notifications"
          element={<CompanyPlaceholder title="Notifications" />}
        />
        <Route
          path="profile"
          element={<CompanyPlaceholder title="Profil" />}
        />
      </Route>

      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={["ENS"]}>
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="etudiants" element={<TeacherStudents />} />
        <Route
          path="etudiants/:studentId"
          element={<TeacherStudentDetail />}
        />
        <Route path="demandes" element={<TeacherRequests />} />
        <Route path="rapports" element={<TeacherReports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profil" element={<TeacherProfile />} />
      </Route>

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
      <Route path="/" element={<Navigate to="/company" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
