export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p>
            © {new Date().getFullYear()} ODFP. Built for researchers, engineers, and educators.
          </p>
          <nav className="flex items-center gap-4">
            <a className="hover:text-slate-900 dark:hover:text-white" href="/docs">Docs</a>
            <a className="hover:text-slate-900 dark:hover:text-white" href="/about">Status</a>
            <a className="hover:text-slate-900 dark:hover:text-white" href="#">Privacy</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

