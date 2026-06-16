import ShowcaseNav from './ShowcaseNav.jsx';

export default function ShowcaseLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ShowcaseNav />
      <main>{children}</main>
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-sm text-gray-500 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} FlexHire</span>
          <div className="flex gap-6">
            <a
              href="https://github.com/satyamsipah/FlexHire"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600"
            >
              GitHub
            </a>
            <a href="#" className="hover:text-indigo-600">Portfolio</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
