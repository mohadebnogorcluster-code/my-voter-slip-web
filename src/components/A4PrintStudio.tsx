import React, { useRef, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  Printer,
  Trash2,
  Save,
  CheckCircle2,
  ArrowLeft,
  FileText,
  ImagePlus,
  X,
  Download,
  Share2,
  Loader2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  SlipPrintColorMode,
  SlipPrintConfig,
  UserRequest,
  VoterRecord,
} from '../types/schema';
import {
  chunkArray,
  formatBnNumber,
  persistLocalPrintConfig,
  resizeImageFileToDataUrl,
} from '../utils/slipHelpers';
import { generateBwA4PdfFromElements } from '../utils/slipCapture';
import { VoterSlipCard } from './VoterSlipCard';

interface A4PrintStudioProps {
  voters: VoterRecord[];
  config: SlipPrintConfig;
  userRequest: UserRequest | null;
  userId: string;
  onChangeConfig: (next: SlipPrintConfig) => void;
  onRemoveVoter: (voterId: string) => void;
  onClearQueue: () => void;
  onBackToSearch: () => void;
  onShareVoter?: (voter: VoterRecord) => void;
}

export function A4PrintStudio({
  voters,
  config,
  userRequest,
  userId,
  onChangeConfig,
  onRemoveVoter,
  onClearQueue,
  onBackToSearch,
  onShareVoter,
}: A4PrintStudioProps) {
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const bwCaptureRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Fixed 4 slips per A4 page (2x2) so 1, 2, or 3 slips preserve the exact same slip size
  const pages = chunkArray(voters, 4);
  const isMonochrome = config.printColorMode !== 'color';

  const updateConfig = (patch: Partial<SlipPrintConfig>) => {
    const next = { ...config, layout: '4-up' as const, ...patch };
    onChangeConfig(next);
    persistLocalPrintConfig(next);
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'candidatePhotoUrl' | 'symbolPhotoUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, 260);
      updateConfig({ [field]: dataUrl });
    } catch {
      // Ignore invalid image files
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveCampaignDefaults = async () => {
    persistLocalPrintConfig(config);
    if (!userRequest) {
      setSavedMessage('এই ব্রাউজারে স্লিপের ডিফল্ট তথ্য সংরক্ষিত হয়েছে।');
      setTimeout(() => setSavedMessage(null), 3000);
      return;
    }

    setSavingDefaults(true);
    setSavedMessage(null);
    const path = `user_requests/${userId}`;
    try {
      await updateDoc(doc(db, 'user_requests', userId), {
        electionNameYear: config.electionNameYear.trim(),
        postName: config.postName.trim(),
        candidateName: config.candidateName.trim(),
        symbolName: config.symbolName.trim(),
        candidatePhotoUrl: config.candidatePhotoUrl,
        symbolPhotoUrl: config.symbolPhotoUrl,
        updatedAt: serverTimestamp(),
      });
      setSavedMessage('প্রচারণা স্লিপের তথ্য ও ছবি আপনার অ্যাকাউন্টে সংরক্ষিত হয়েছে।');
      setTimeout(() => setSavedMessage(null), 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setSavingDefaults(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadBwPdf = async () => {
    const elements = bwCaptureRefs.current
      .slice(0, voters.length)
      .filter((el): el is HTMLDivElement => el !== null);
    if (elements.length === 0) return;

    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const dateSlug = new Date().toISOString().slice(0, 10);
      await generateBwA4PdfFromElements(elements, `voter-slips-bw-a4-${dateSlug}.pdf`);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : 'পিডিএফ তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে প্রিন্ট বাটন থেকে Save as PDF ব্যবহার করুন।'
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (voters.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
        <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <FileText className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-slate-900">প্রিন্ট তালিকা বর্তমানে খালি</h2>
          <p className="text-sm text-slate-600">
            এ৪ কাগজে সাদাকালো ভোটার স্লিপ প্রিন্ট বা পিডিএফ ডাউনলোড করতে ভোটার অনুসন্ধান তালিকা থেকে ১, ২, ৩ বা ৪+ জন ভোটার নির্বাচন করুন।
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToSearch}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          ভোটার তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio Action Header (Hidden when printing) */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSearch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            অনুসন্ধানে ফিরুন
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              এ৪ (A4) সাদাকালো প্রিন্ট ও পিডিএফ স্টুডিও
            </h1>
            <p className="text-xs text-slate-500 tabular-nums">
              {formatBnNumber(voters.length)}টি ভোটার স্লিপ · {formatBnNumber(pages.length)}টি এ৪ পাতা · প্রতি পাতায় সর্বোচ্চ ৪টি (স্থির আকার)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onClearQueue}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            তালিকা খালি করুন
          </button>

          <button
            type="button"
            onClick={handleDownloadBwPdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-black disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {generatingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {generatingPdf ? 'সাদাকালো PDF তৈরি হচ্ছে...' : 'সাদাকালো PDF ডাউনলোড'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            {isMonochrome ? 'সাদাকালো এ৪ প্রিন্ট' : 'রঙিন এ৪ প্রিন্ট'}
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="no-print p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          {pdfError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls Panel (Hidden when printing) */}
        <aside className="no-print xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          {/* Fixed 4-up & Color Mode info */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">এ৪ প্রিন্ট ও পিডিএফ বিন্যাস</h2>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900">
                প্রতি পাতায় ৪টি স্লিপ (২×২ স্থির মাপ)
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                ১, ২ বা ৩টি স্লিপ প্রিন্ট বা PDF ডাউনলোড করলেও প্রতিটি স্লিপের আকার (৯৭ × ১৩৮.৭ মিমি) অপরিবর্তিত থাকবে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'bw', label: 'সাদাকালো (ডিফল্ট)', note: 'লেজার প্রিন্ট ও PDF' },
                  { id: 'color', label: 'রঙিন প্রিভিউ', note: 'কালার প্রিন্টারের জন্য' },
                ] as { id: SlipPrintColorMode; label: string; note: string }[]
              ).map((mode) => {
                const active = (config.printColorMode || 'bw') === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => updateConfig({ printColorMode: mode.id })}
                    className={`p-2 text-left rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">{mode.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{mode.note}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">স্লিপের প্রচারণা ও হেডার</h2>
              <button
                type="button"
                onClick={handleSaveCampaignDefaults}
                disabled={savingDefaults}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                {savingDefaults ? 'সংরক্ষণ হচ্ছে...' : 'ডিফল্ট সংরক্ষণ'}
              </button>
            </div>

            {savedMessage && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{savedMessage}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs text-slate-600 mb-1">নির্বাচনের শিরোনাম</label>
                <input
                  type="text"
                  value={config.electionNameYear}
                  onChange={(e) => updateConfig({ electionNameYear: e.target.value })}
                  placeholder="যেমন: ইউনিয়ন পরিষদ নির্বাচন - ২০২৬"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">পদের নাম</label>
                  <input
                    type="text"
                    value={config.postName}
                    onChange={(e) => updateConfig({ postName: e.target.value })}
                    placeholder="যেমন: চেয়ারম্যান পদপ্রার্থী"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">প্রতীকের নাম</label>
                  <input
                    type="text"
                    value={config.symbolName}
                    onChange={(e) => updateConfig({ symbolName: e.target.value })}
                    placeholder="যেমন: কলম"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">প্রার্থীর নাম</label>
                <input
                  type="text"
                  value={config.candidateName}
                  onChange={(e) => updateConfig({ candidateName: e.target.value })}
                  placeholder="যেমন: মোঃ মোস্তফা কামাল"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">স্লিপের শেষ ব্যানার লেখা</label>
                <input
                  type="text"
                  value={config.footerNote}
                  onChange={(e) => updateConfig({ footerNote: e.target.value })}
                  placeholder="যেমন: মূল্যবান ভোট ও দোয়া চাই"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Candidate & Symbol Image Uploaders */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="border border-slate-200 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                    <span>প্রার্থীর ছবি</span>
                    {config.candidatePhotoUrl && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ candidatePhotoUrl: '' })}
                        className="text-red-600 hover:text-red-700 cursor-pointer"
                        title="ছবি সরান"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <label className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{config.candidatePhotoUrl ? 'পরিবর্তন' : 'আপলোড'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'candidatePhotoUrl')}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="border border-slate-200 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                    <span>প্রতীকের ছবি</span>
                    {config.symbolPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ symbolPhotoUrl: '' })}
                        className="text-red-600 hover:text-red-700 cursor-pointer"
                        title="ছবি সরান"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <label className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{config.symbolPhotoUrl ? 'পরিবর্তন' : 'আপলোড'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'symbolPhotoUrl')}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-900">স্লিপের ঐচ্ছিক তথ্য</h2>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showFatherMother}
                  onChange={(e) => updateConfig({ showFatherMother: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                পিতা ও মাতার নাম
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showAddress}
                  onChange={(e) => updateConfig({ showAddress: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                ঠিকানা
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              প্রিন্ট তালিকায় থাকা ভোটার ({formatBnNumber(voters.length)})
            </h2>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {voters.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      <span className="font-mono tabular-nums text-slate-500 mr-1.5">
                        #{v.serialNo}
                      </span>
                      {v.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      ভবন: {v.buildingName || '—'} · কক্ষ: {v.roomNumber || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onShareVoter && (
                      <button
                        type="button"
                        onClick={() => onShareVoter(v)}
                        title="রঙিন ছবি শেয়ার করুন"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3 h-3" />
                        রঙিন শেয়ার
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveVoter(v.id)}
                      aria-label={`${v.name}-কে তালিকা থেকে সরান`}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right A4 Sheet Preview & Print Output (Always 2x2 Grid so 1/2/3 slips never change size) */}
        <section className="xl:col-span-8 space-y-6">
          <div className="print-only-root space-y-6">
            {pages.map((pageVoters, pageIdx) => (
              <div key={pageIdx} className="a4-page-wrapper space-y-2 print:space-y-0">
                <div className="no-print flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
                  <span className="font-medium">
                    এ৪ পাতা {formatBnNumber(pageIdx + 1)} / {formatBnNumber(pages.length)} (
                    {isMonochrome ? 'সাদাকালো প্রিন্ট ও PDF' : 'রঙিন প্রিভিউ'})
                  </span>
                  <span className="tabular-nums">
                    ২১০ মিমি × ২৯৭ মিমি · ২×২ স্থির মাপ ({formatBnNumber(pageVoters.length)}/৪টি স্লিপ)
                  </span>
                </div>

                <div className="a4-page-sheet bg-white border border-slate-300 shadow-xs mx-auto w-full max-w-[210mm] p-2.5 sm:p-[6mm] print:p-0">
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 print:gap-[4mm]">
                    {pageVoters.map((voter) => (
                      <div key={voter.id} className="relative group">
                        <VoterSlipCard
                          voter={voter}
                          config={config}
                          compact={true}
                          monochrome={isMonochrome}
                        />
                        {onShareVoter && (
                          <button
                            type="button"
                            onClick={() => onShareVoter(voter)}
                            className="no-print absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700/95 rounded-md shadow-sm hover:bg-emerald-800 transition-opacity cursor-pointer"
                            title="এই স্লিপটি রঙিন ছবি হিসেবে শেয়ার করুন"
                          >
                            <Share2 className="w-3 h-3" />
                            রঙিন শেয়ার
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Offscreen Monochrome Capture Nodes for Direct B&W A4 PDF Export */}
      <div
        aria-hidden="true"
        className="no-print fixed -left-[9999px] top-0 pointer-events-none"
      >
        {voters.map((voter, idx) => (
          <div
            key={voter.id}
            ref={(el) => {
              bwCaptureRefs.current[idx] = el;
            }}
            className="w-[390px] bg-white p-0.5"
          >
            <VoterSlipCard voter={voter} config={config} compact={true} monochrome={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
