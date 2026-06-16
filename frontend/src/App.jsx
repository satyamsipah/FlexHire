import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import FreelancerDashboard from './pages/FreelancerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ProjectChat from './pages/ProjectChat.jsx';
import NotFound from './pages/NotFound.jsx';

// Public showcase pages — lazy-loaded so they don't bloat the initial bundle
const Architecture = lazy(() => import('./pages/Architecture.jsx'));
const Engineering   = lazy(() => import('./pages/Engineering.jsx'));
const CaseStudy     = lazy(() => import('./pages/CaseStudy.jsx'));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
      Loading…
    </div>
  );
}

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
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Public showcase pages — lazy-loaded */}
          <Route
            path="/architecture"
            element={<Suspense fallback={<PageLoader />}><Architecture /></Suspense>}
          />
          <Route
            path="/engineering"
            element={<Suspense fallback={<PageLoader />}><Engineering /></Suspense>}
          />
          <Route
            path="/case-study"
            element={<Suspense fallback={<PageLoader />}><CaseStudy /></Suspense>}
          />

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
