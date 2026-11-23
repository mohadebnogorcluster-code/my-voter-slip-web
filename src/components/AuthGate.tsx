import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { FileCheck2, Printer, Search, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

export function AuthGate() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Click the button below when ready to continue.');
      } else if (code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Allow popups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          `This domain (${window.location.hostname}) is not authorized in your Firebase Auth settings yet. Add it under Authentication → Settings → Authorized domains.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Voter Slip Portal
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Polling Directory &amp; A4 Print Studio
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <section className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium tracking-wide text-emerald-700">
                Cloud Voter Directory · Synced with Mobile
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
                Fast voter lookup and A4 slip printing for every polling center.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Access your assigned division, district, upazila, union, and ward voter lists in real time, customize candidate slip headers, and print clean multi-slip A4 sheets directly from your browser.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div className="flex items-start gap-3 pt-2">
                <Search className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Instant Center Lookup</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Filter by Bangla or English name, voter ID, serial number, or parent name.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2">
                <Printer className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">A4 Multi-Slip Grid</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Print 1, 4, 6, or 8 voter slips per A4 sheet with scissor cut guides.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileCheck2 className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Campaign Branding</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Include election year, post, candidate name, and symbol on every printed slip.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Shared Account Sync</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Uses your existing Google account, activation status, and polling records.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">Sign in to continue</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Authenticate with your Google account to verify your activation status or access the admin console.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                {signingIn ? 'Signing in...' : 'Continue with Google'}
              </button>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                New accounts can submit an activation request immediately after signing in.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>Voter Slip Portal</span>
          <span>Browser A4 Print Compatible</span>
        </div>
      </footer>
    </div>
  );
}
