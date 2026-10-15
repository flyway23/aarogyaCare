import { Link } from 'react-router-dom';

export default function AuthFrame({
  title,
  subtitle,
  children,
  footer,
  footerLink,
  footerText,
}) {
  return (
    <main className="grid min-h-screen bg-cream lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-32 -top-24 h-96 w-96 rounded-full bg-forest/40 blur-3xl" />
        <Link
          to="/"
          className="relative flex items-center gap-3 text-lg font-semibold tracking-tight"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl">
            A
          </span>
          AarogyaCare
        </Link>
        <div className="relative max-w-lg">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
            Care that connects
          </p>
          <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight xl:text-6xl">
            A calmer way to manage your care.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-emerald-50/75">
            Book visits, keep your profile close, and stay connected with your
            care team.
          </p>
        </div>
        <p className="relative text-xs text-emerald-50/50">
          AarogyaCare · Hospital care, connected
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-10 flex items-center gap-3 font-semibold text-ink lg:hidden"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest text-white">
              A
            </span>
            AarogyaCare
          </Link>
          <div className="rounded-3xl border border-emerald-950/5 bg-white p-6 shadow-card sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
              Welcome
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            {footer}{' '}
            <Link
              className="font-semibold text-forest hover:text-ink"
              to={footerLink}
            >
              {footerText}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
