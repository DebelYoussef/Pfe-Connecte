import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import CompleteProfile from "./components/CompleteProfile";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/complete-profile" element={<CompleteProfile />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
