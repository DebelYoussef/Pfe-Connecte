import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import CompleteProfile from "./components/CompleteProfile";
import CompanyHome from "./components/Company/CompanyHome";
import CompanyLayout from "./components/Company/CompanyLayout";
import CompanyOfferDetail from "./components/Company/CompanyOfferDetail";
import CompanyOfferForm from "./components/Company/CompanyOfferForm";
import CompanyOffers from "./components/Company/CompanyOffers";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Signup from "./components/Signup";
import StudentLayout from "./components/layout/StudentLayout";
import TeacherLayout from "./components/layout/TeacherLayout";
import EmptyState from "./components/ui/EmptyState";
import PageHeader from "./components/ui/PageHeader";
import { getUser, homeFor, isAuthenticated, logout } from "./auth";
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
import Notifications from "./pages/shared/Notifications";

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
    <>
      <PageHeader eyebrow="Espace entreprise" title={title} />
      <EmptyState
        title={title}
        message="Cette section arrive bientôt."
        actionLabel="Retour à l’accueil"
        actionTo="/company"
      />
    </>
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
        <Route path="offres" element={<CompanyOffers />} />
        <Route
          path="offres/nouvelle"
          element={<CompanyOfferForm />}
        />
        <Route
          path="offres/:offerId"
          element={<CompanyOfferDetail />}
        />
        <Route
          path="offres/:offerId/modifier"
          element={<CompanyOfferForm />}
        />
        <Route
          path="candidatures"
          element={<CompanyPlaceholder title="Candidatures" />}
        />
        <Route
          path="conventions"
          element={<CompanyPlaceholder title="Conventions" />}
        />
        <Route
          path="conventions/:conventionId"
          element={<CompanyPlaceholder title="Convention" />}
        />
        <Route
          path="journaux"
          element={<CompanyPlaceholder title="Journaux" />}
        />
        <Route
          path="journaux/:studentId"
          element={<CompanyPlaceholder title="Journaux" />}
        />
        <Route
          path="rapports"
          element={<CompanyPlaceholder title="Rapports" />}
        />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profil" element={<CompanyPlaceholder title="Mon profil" />} />
        <Route path="profile" element={<Navigate to="/company/profil" replace />} />
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
