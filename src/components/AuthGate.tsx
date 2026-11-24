import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { FileCheck2, Printer, Search, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { DeveloperFooter, SITE_LOGO_SRC } from './DeveloperFooter';
import { PublicDemoSection } from './PublicDemoSection';

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
        setError('লগইন প্রক্রিয়া বাতিল করা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      } else if (code === 'auth/popup-blocked') {
        setError(
          'ব্রাউজারে পপ-আপ ব্লক করা আছে। অনুগ্রহ করে এই সাইটের জন্য পপ-আপ অনুমতি দিয়ে পুনরায় চেষ্টা করুন।'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          `এই ডোমেইনটি (${window.location.hostname}) ফায়ারবেস অথেনটিকেশনে অনুমোদিত নয়। অনুগ্রহ করে Firebase Console → Authentication → Settings → Authorized domains-এ এটি যুক্ত করুন।`
        );
      } else {
        setError(
          err instanceof Error ? err.message : 'গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করা যায়নি।'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div className="h-1 bg-emerald-700 w-full" aria-hidden="true" />
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={SITE_LOGO_SRC}
              alt="ভোটার স্লিপ লোগো"
              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
            />
            <div className="leading-tight">
              <span className="block text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                ভোটার স্লিপ পোর্টাল
              </span>
              <span className="block text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                শিক্ষক ডায়েরি
              </span>
            </div>
          </div>
          <span className="hidden sm:inline text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
            নির্বাচনী তথ্য ব্যবস্থাপনা ও এ৪ (A4) প্রিন্ট স্টুডিও
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="no-print max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <section className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wide text-emerald-700">
                ক্লাউড ভোটার ডিরেক্টরি · মোবাইল অ্যাপের সাথে সমন্বিত
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-tight">
                প্রতিটি ভোটকেন্দ্রের জন্য দ্রুত ভোটার অনুসন্ধান ও এ৪ স্লিপ প্রিন্টিং।
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                আপনার নির্ধারিত বিভাগ, জেলা, উপজেলা, ইউনিয়ন ও ওয়ার্ডের ভোটার তালিকা মুহূর্তেই খুঁজুন, প্রার্থীর তথ্য ও প্রতীকসহ স্লিপ সাজান এবং ব্রাউজার থেকে সরাসরি এ৪ (A4) কাগজে প্রিন্ট করুন।
              </p>
              <div className="pt-1">
                <a
                  href="#public-demo-workspace"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  রেজিস্ট্রেশনের আগে লাইভ ডেমো দেখুন (৫ জন ভোটার)
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="flex items-start gap-3 pt-1">
                <Search className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">দ্রুত কেন্দ্রভিত্তিক অনুসন্ধান</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    বাংলা বা ইংরেজি নাম, ভোটার নম্বর, ক্রমিক নম্বর কিংবা পিতা-মাতার নাম দিয়ে সহজে খুঁজুন।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <Printer className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">এ৪ মাল্টি-স্লিপ গ্রিড</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    একটি এ৪ পাতায় ১, ৪, ৬ অথবা ৮টি ভোটার স্লিপ কাটিং গাইডসহ পরিচ্ছন্নভাবে প্রিন্ট করুন।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileCheck2 className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">নির্বাচনী হেডার কাস্টমাইজেশন</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    প্রতিটি স্লিপের ওপরে নির্বাচনের নাম, পদবি, প্রার্থীর নাম ও প্রতীক সংরক্ষণ করুন।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-700 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">সুরক্ষিত অ্যাকাউন্ট সিঙ্ক</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    আপনার বিদ্যমান গুগল অ্যাকাউন্ট, অনুমোদিত এলাকা ও ভোটকেন্দ্রের তথ্যের সাথে সরাসরি যুক্ত।
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <img
                src={SITE_LOGO_SRC}
                alt="ভোটার স্লিপ পোর্টাল"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs"
              />
              <h2 className="text-xl font-semibold text-slate-900">পোর্টালে প্রবেশ করুন</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                আপনার অ্যাকাউন্টের অনুমোদন যাচাই করতে অথবা অ্যাডমিন কনসোলে প্রবেশ করতে গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
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
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#ffffff"
                    d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                {signingIn ? 'সাইন ইন হচ্ছে...' : 'গুগল দিয়ে সাইন ইন করুন'}
              </button>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                নতুন ব্যবহারকারীরা সাইন ইন করার পরপরই অ্যাকাউন্ট সক্রিয়করণের আবেদন জমা দিতে পারবেন।
              </p>
            </div>
          </section>
          </div>

          {/* 5-Voter Public Demo Before Registration */}
          <PublicDemoSection onRequestSignIn={handleGoogleSignIn} />
        </div>
      </main>

      <DeveloperFooter />
    </div>
  );
}
