import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import FreelancerDashboard from './pages/FreelancerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ProjectChat from './pages/ProjectChat.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            success: { duration: 3000 },
            error:   { duration: 5000 },
          }}
        />

        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute allowedRole="client" />}>
            <Route path="/client" element={<ClientDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRole="freelancer" />}>
            <Route path="/freelancer" element={<FreelancerDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRole="admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Chat — any authenticated user; project membership enforced by socket */}
          <Route element={<ProtectedRoute />}>
            <Route path="/project/:projectId/chat" element={<ProjectChat />} />
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*"    element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
