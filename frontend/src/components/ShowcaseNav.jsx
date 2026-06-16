import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/',            label: 'Home',         end: true },
  { to: '/architecture', label: 'Architecture', end: false },
  { to: '/engineering',  label: 'Engineering',  end: false },
  { to: '/case-study',   label: 'Case Study',   end: false },
];

export default function ShowcaseNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold text-indigo-600">FlexHire</Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Auth buttons — desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-indigo-600">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Sign up
          </Link>
        </div>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="rounded p-2 text-gray-600 hover:bg-gray-100 md:hidden"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-100 bg-white px-6 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
