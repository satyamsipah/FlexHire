import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

const ROLE_HOME = { client: '/client', freelancer: '/freelancer', admin: '/admin' };

export default function NotFound() {
  const user = useAuthStore(s => s.user);
  const home = ROLE_HOME[user?.role] ?? '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <p className="text-8xl font-bold text-indigo-200 leading-none">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to={home}
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
