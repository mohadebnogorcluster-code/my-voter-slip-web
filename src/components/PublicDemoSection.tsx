import { useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Loader2,
  Plus,
  Printer,
  Search,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import { PERMANENT_DEMO_VOTERS } from '../data/demoVoters';
import type { SlipPrintConfig, VoterRecord } from '../types/schema';
import {
  buildDefaultPrintConfig,
  chunkArray,
  formatBnNumber,
  normalizeSearchText,
  toBanglaDigits,
} from '../utils/slipHelpers';
import { generateBwA4PdfFromElements } from '../utils/slipCapture';
import { VoterSlipCard } from './VoterSlipCard';
import { ShareColorSlipModal } from './ShareColorSlipModal';

interface PublicDemoSectionProps {
  onRequestSignIn?: () => void;
}

export function PublicDemoSection({ onRequestSignIn }: PublicDemoSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    PERMANENT_DEMO_VOTERS.slice(0, 4).map((v) => v.id)
  );
  const [demoConfig, setDemoConfig] = useState<SlipPrintConfig>(() => ({
    ...buildDefaultPrintConfig(null),
    electionNameYear: 'ইউনিয়ন পরিষদ নির্বাচন - ২০২৬',
    postName: 'চেয়ারম্যান পদপ্রার্থী',
    candidateName: 'মোঃ মোস্তফা কামাল',
    symbolName: 'কলম',
    printColorMode: 'bw',
  }));
  const [shareVoter, setShareVoter] = useState<VoterRecord | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const bwCaptureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filteredDemoVoters = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q) return PERMANENT_DEMO_VOTERS;
    return PERMANENT_DEMO_VOTERS.filter((v) =>
      [v.name, v.serialNo, v.voterNo, v.fatherName, v.motherName, v.address, v.gender]
        .map(normalizeSearchText)
        .join(' ')
        .includes(q)
    );
  }, [searchQuery]);

  const selectedVoters = useMemo(
    () => PERMANENT_DEMO_VOTERS.filter((v) => selectedIds.includes(v.id)),
    [selectedIds]
  );

  const pages = chunkArray(selectedVoters, 4);

  const toggleSelect = (voterId: string) => {
    setSelectedIds((prev) =>
      prev.includes(voterId) ? prev.filter((id) => id !== voterId) : [...prev, voterId]
    );
  };

  const handleDownloadDemoPdf = async () => {
    const elements = bwCaptureRefs.current
      .slice(0, selectedVoters.length)
      .filter((el): el is HTMLDivElement => el !== null);
    if (elements.length === 0) return;

    setGeneratingPdf(true);
    setPdfError(null);
    try {
      await generateBwA4PdfFromElements(elements, 'demo-voter-slips-bw-a4.pdf');
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'ডেমো PDF ডাউনলোড করতে সমস্যা হয়েছে।'
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrintDemo = () => {
    window.print();
  };

  return (
    <section
      id="public-demo-workspace"
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
    >
      {/* Demo Header */}
      <div className="no-print px-5 py-4 bg-emerald-50/70 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              পাবলিক লাইভ ডেমো — ৫ জন নমুনা ভোটার ও স্লিপ জেনারেটর
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              রেজিস্ট্রেশনের আগেই নিচের ৫ জন স্থায়ী নমুনা ভোটার থেকে সার্চ, সাদাকালো এ৪ (A4) প্রিন্ট/PDF ডাউনলোড এবং রঙিন শেয়ার পরীক্ষা করে দেখুন।
            </p>
          </div>
        </div>

        {onRequestSignIn && (
          <button
            type="button"
            onClick={onRequestSignIn}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap"
          >
            অ্যাকাউন্ট রেজিস্ট্রেশন / লগইন করুন
          </button>
        )}
      </div>

      {/* Interactive Demo Body */}
      <div className="p-5 space-y-6">
        {/* Search & Quick Demo Header Customization */}
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ডেমো ভোটার খুঁজুন
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম, ক্রমিক বা ভোটার নম্বর..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              প্রার্থীর নাম (ডেমো)
            </label>
            <input
              type="text"
              value={demoConfig.candidateName}
              onChange={(e) =>
                setDemoConfig((prev) => ({ ...prev, candidateName: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              প্রতীক (ডেমো)
            </label>
            <input
              type="text"
              value={demoConfig.symbolName}
              onChange={(e) =>
                setDemoConfig((prev) => ({ ...prev, symbolName: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="lg:col-span-3 flex items-center gap-2 flex-wrap justify-start lg:justify-end">
            <button
              type="button"
              onClick={handleDownloadDemoPdf}
              disabled={selectedVoters.length === 0 || generatingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-black disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              {generatingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              সাদাকালো PDF ({formatBnNumber(selectedVoters.length)})
            </button>
            <button
              type="button"
              onClick={handlePrintDemo}
              disabled={selectedVoters.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              এ৪ প্রিন্ট
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="no-print p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {pdfError}
          </div>
        )}

        {/* 5 Permanent Demo Voters Table */}
        <div className="no-print border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Users className="w-4 h-4 text-emerald-700" />
              স্থায়ী ডেমো ভোটার তালিকা ({formatBnNumber(PERMANENT_DEMO_VOTERS.length)} জন) ·
              আগরদাঁড়ি সরকারি প্রাথমিক বিদ্যালয়, সাতক্ষীরা সদর
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(PERMANENT_DEMO_VOTERS.map((v) => v.id))}
                className="text-emerald-700 font-medium hover:underline cursor-pointer"
              >
                সব নির্বাচন ({formatBnNumber(PERMANENT_DEMO_VOTERS.length)})
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                সব বাতিল
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold text-slate-700">
                  <th className="py-2 px-3 w-10">স্লিপ</th>
                  <th className="py-2 px-3">ক্রমিক</th>
                  <th className="py-2 px-3">ভোটারের নাম</th>
                  <th className="py-2 px-3">ভোটার নম্বর</th>
                  <th className="py-2 px-3">পিতা / মাতা</th>
                  <th className="py-2 px-3">লিঙ্গ</th>
                  <th className="py-2 px-3">ভবন ও কক্ষ</th>
                  <th className="py-2 px-3 text-right">রঙিন শেয়ার</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredDemoVoters.map((voter) => {
                  const selected = selectedIds.includes(voter.id);
                  return (
                    <tr
                      key={voter.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        selected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(voter.id)}
                          aria-label={`${voter.name} নির্বাচন করুন`}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${
                            selected
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-300 text-slate-500'
                          }`}
                        >
                          {selected ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                        {voter.serialNo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {voter.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {voter.voterNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 min-w-[160px]">
                        <div>{voter.fatherName}</div>
                        <div className="text-[11px] text-slate-500">{voter.motherName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {voter.gender}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        <div>{voter.buildingName}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          কক্ষ: {toBanglaDigits(voter.roomNumber)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setShareVoter(voter)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          রঙিন শেয়ার
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Demo A4 B&W Slip Preview */}
        {selectedVoters.length > 0 ? (
          <div className="print-only-root space-y-4">
            <div className="no-print flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                ডেমো এ৪ (A4) সাদাকালো স্লিপ প্রিভিউ ({formatBnNumber(selectedVoters.length)}টি নির্বাচিত)
              </span>
              <span>১, ২, ৩ বা ৪টি স্লিপে একই স্থির আকার বজায় থাকে</span>
            </div>

            {pages.map((pageVoters, pageIdx) => (
              <div key={pageIdx} className="a4-page-wrapper space-y-2 print:space-y-0">
                <div className="a4-page-sheet bg-white border border-slate-300 shadow-xs mx-auto w-full max-w-[210mm] p-2.5 sm:p-[6mm] print:p-0">
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 print:gap-[4mm]">
                    {pageVoters.map((voter) => (
                      <div key={voter.id} className="relative">
                        <VoterSlipCard
                          voter={voter}
                          config={demoConfig}
                          compact={true}
                          monochrome={true}
                        />
                        <button
                          type="button"
                          onClick={() => setShareVoter(voter)}
                          className="no-print absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700/95 rounded-md shadow-sm hover:bg-emerald-800 cursor-pointer"
                        >
                          <Share2 className="w-3 h-3" />
                          রঙিন শেয়ার
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-print p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
            স্লিপ প্রিভিউ দেখতে উপরের তালিকা থেকে কমপক্ষে ১ জন ডেমো ভোটার নির্বাচন করুন।
          </div>
        )}
      </div>

      {/* Offscreen B&W Capture Nodes for Demo PDF */}
      <div
        aria-hidden="true"
        className="no-print fixed -left-[9999px] top-0 pointer-events-none"
      >
        {selectedVoters.map((voter, idx) => (
          <div
            key={voter.id}
            ref={(el) => {
              bwCaptureRefs.current[idx] = el;
            }}
            className="w-[390px] bg-white p-0.5"
          >
            <VoterSlipCard voter={voter} config={demoConfig} compact={true} monochrome={true} />
          </div>
        ))}
      </div>

      <ShareColorSlipModal
        voter={shareVoter}
        config={demoConfig}
        onClose={() => setShareVoter(null)}
      />
    </section>
  );
}
