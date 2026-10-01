export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="max-w-md rounded-2xl border border-rose-900/50 bg-rose-950/20 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">
          Sign-in link invalid or expired
        </h1>
        <p className="mt-2 text-xs text-slate-400">
          Magic links expire after first use. Please request a new one from the
          login page.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          Back to Login
        </a>
      </div>
    </div>
  );
}
