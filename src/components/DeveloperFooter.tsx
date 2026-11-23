import { MapPin, MessageCircle, Award } from 'lucide-react';

export const SITE_LOGO_SRC =
  '/assets/aistudio/5537522a-beb7-4f3f-8105-073120bd6056_12674009.png';

export function DeveloperFooter() {
  return (
    <footer className="no-print border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src={SITE_LOGO_SRC}
            alt="ভোটার স্লিপ পোর্টাল লোগো"
            className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
          />
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-slate-900">
              <span>ডেভেলপার: শিক্ষক ডায়েরি</span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span>মোঃ মোস্তফা কামাল</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                <Award className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                আই সি টি এ্যাম্বেসেডর
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                সাতক্ষীরা সদর, সাতক্ষীরা
              </span>
            </div>
          </div>
        </div>

        <a
          href="https://wa.me/8801719850874"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
        >
          <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>হোয়াটসঅ্যাপ: ০১৭১৯৮৫০৮৭৪</span>
        </a>
      </div>
    </footer>
  );
}
