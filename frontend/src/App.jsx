import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import FreelancerDashboard from './pages/FreelancerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Client-only routes */}
        <Route element={<ProtectedRoute allowedRole="client" />}>
          <Route path="/client" element={<ClientDashboard />} />
        </Route>

        {/* Freelancer-only routes */}
        <Route element={<ProtectedRoute allowedRole="freelancer" />}>
          <Route path="/freelancer" element={<FreelancerDashboard />} />
        </Route>

        {/* Admin-only routes */}
        <Route element={<ProtectedRoute allowedRole="admin" />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
