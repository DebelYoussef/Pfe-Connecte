import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import CompleteProfile from "./components/CompleteProfile";
import ProtectedRoute from "./components/ProtectedRoute";
import CompanyLayout from "./components/Company/CompanyLayout";
import CompanyHome from "./components/Company/CompanyHome";
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
  ["/teacher", ["ENS"], "Espace enseignant"],
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
      <Route path="*" element={<Navigate to="/login" replace />} />
          <Route path="/" element={<Navigate to="/company" replace />} />
      <Route path="/login" element={<div className="p-10"><Placeholder title="Connexion" /></div>} />

        <Route path="/company" element={<CompanyLayout />}>
        <Route index element={<CompanyHome />} />
        <Route path="offers" element={<Placeholder title="Mes offres" />} />
        <Route path="offers/new" element={<Placeholder title="Publier une offre" />} />
        <Route path="offers/:id" element={<Placeholder title="Offre" />} />
        <Route path="offers/:id/edit" element={<Placeholder title="Modifier l’offre" />} />
        <Route path="applications" element={<Placeholder title="Candidatures" />} />
        <Route path="applications/:id" element={<Placeholder title="Candidature" />} />
        <Route path="convention" element={<Placeholder title="Conventions" />} />
        <Route path="journals" element={<Placeholder title="Journaux" />} />
        <Route path="reports" element={<Placeholder title="Rapports" />} />
        <Route path="notifications" element={<Placeholder title="Notifications" />} />
        <Route path="profile" element={<Placeholder title="Profil" />} />
        </Route>
    </Routes>
  );
}