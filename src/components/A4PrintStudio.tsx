import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Printer,
  Trash2,
  Save,
  CheckCircle2,
  ArrowLeft,
  Scissors,
  FileText,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  SlipLayoutMode,
  SlipPrintConfig,
  UserRequest,
  VoterRecord,
} from '../types/schema';
import {
  chunkArray,
  getSlipsPerPage,
  persistLocalPrintConfig,
} from '../utils/slipHelpers';

interface A4PrintStudioProps {
  voters: VoterRecord[];
  config: SlipPrintConfig;
  userRequest: UserRequest | null;
  userId: string;
  onChangeConfig: (next: SlipPrintConfig) => void;
  onRemoveVoter: (voterId: string) => void;
  onClearQueue: () => void;
  onBackToSearch: () => void;
}

const LABELS = {
  bn: {
    slipTitle: 'ভোটার স্লিপ',
    serial: 'ক্রমিক নং',
    voterNo: 'ভোটার নং',
    name: 'নাম',
    father: 'পিতা',
    mother: 'মাতা',
    dob: 'জন্ম তারিখ',
    gender: 'লিঙ্গ',
    occupation: 'পেশা',
    center: 'ভোটকেন্দ্র',
    wardUnion: 'ওয়ার্ড/ইউনিয়ন',
    areaCode: 'এলাকা কোড',
    address: 'ঠিকানা',
    candidate: 'প্রার্থী',
    symbol: 'প্রতীক',
  },
  en: {
    slipTitle: 'VOTER SLIP',
    serial: 'Serial No',
    voterNo: 'Voter No',
    name: 'Name',
    father: 'Father',
    mother: 'Mother',
    dob: 'Date of Birth',
    gender: 'Gender',
    occupation: 'Occupation',
    center: 'Polling Center',
    wardUnion: 'Ward / Union',
    areaCode: 'Area Code',
    address: 'Address',
    candidate: 'Candidate',
    symbol: 'Symbol',
  },
};

const LAYOUT_OPTIONS: { value: SlipLayoutMode; label: string; gridNote: string }[] = [
  { value: '4-up', label: '4 Slips / A4', gridNote: '2×2 Grid' },
  { value: '6-up', label: '6 Slips / A4', gridNote: '2×3 Grid' },
  { value: '8-up', label: '8 Slips / A4', gridNote: '2×4 Grid' },
  { value: '1-up', label: '1 Slip / A4', gridNote: 'Full Sheet' },
];

export function A4PrintStudio({
  voters,
  config,
  userRequest,
  userId,
  onChangeConfig,
  onRemoveVoter,
  onClearQueue,
  onBackToSearch,
}: A4PrintStudioProps) {
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const perPage = getSlipsPerPage(config.layout);
  const pages = chunkArray(voters, perPage);
  const t = LABELS[config.language];

  const updateConfig = (patch: Partial<SlipPrintConfig>) => {
    const next = { ...config, ...patch };
    onChangeConfig(next);
    persistLocalPrintConfig(next);
  };

  const handleSaveCampaignDefaults = async () => {
    persistLocalPrintConfig(config);
    if (!userRequest) {
      setSavedMessage('Saved locally for this browser.');
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
        updatedAt: new Date().toISOString(),
      });
      setSavedMessage('Campaign header defaults synced to your account.');
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

  if (voters.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
        <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <FileText className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-slate-900">Your A4 Print Queue is empty</h2>
          <p className="text-sm text-slate-600">
            Select individual voters or a serial number range in the Voter Search directory to generate formatted A4 sheets.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToSearch}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Voter Directory
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
            Back to Search
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">A4 Print Studio</h1>
            <p className="text-xs text-slate-500 tabular-nums">
              {voters.length} voter {voters.length === 1 ? 'slip' : 'slips'} · {pages.length} A4{' '}
              {pages.length === 1 ? 'page' : 'pages'} · {config.layout.toUpperCase()} portrait
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
            Clear Queue
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print A4 Slips
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls Panel (Hidden when printing) */}
        <aside className="no-print xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">A4 Grid Density</h2>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => updateConfig({ language: 'bn' })}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    config.language === 'bn'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ language: 'en' })}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    config.language === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {LAYOUT_OPTIONS.map((opt) => {
                const active = config.layout === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig({ layout: opt.value })}
                    className={`p-2.5 text-left rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.gridNote}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Campaign Slip Header</h2>
              <button
                type="button"
                onClick={handleSaveCampaignDefaults}
                disabled={savingDefaults}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                {savingDefaults ? 'Saving...' : 'Save Defaults'}
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
                <label className="block text-xs text-slate-600 mb-1">Election Name &amp; Year</label>
                <input
                  type="text"
                  value={config.electionNameYear}
                  onChange={(e) => updateConfig({ electionNameYear: e.target.value })}
                  placeholder="e.g. ত্রয়োদশ জাতীয় সংসদ নির্বাচন ২০২৬"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Post Name</label>
                  <input
                    type="text"
                    value={config.postName}
                    onChange={(e) => updateConfig({ postName: e.target.value })}
                    placeholder="e.g. চেয়ারম্যান পদপ্রার্থী"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Symbol</label>
                  <input
                    type="text"
                    value={config.symbolName}
                    onChange={(e) => updateConfig({ symbolName: e.target.value })}
                    placeholder="e.g. আনারস"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={config.candidateName}
                  onChange={(e) => updateConfig({ candidateName: e.target.value })}
                  placeholder="e.g. মোঃ আব্দুল করিম"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Footer Note</label>
                <input
                  type="text"
                  value={config.footerNote}
                  onChange={(e) => updateConfig({ footerNote: e.target.value })}
                  placeholder="Optional voter reminder line"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Visible Slip Fields</h2>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showFatherMother}
                  onChange={(e) => updateConfig({ showFatherMother: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Father &amp; Mother
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showDob}
                  onChange={(e) => updateConfig({ showDob: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Date of Birth
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showAddress}
                  onChange={(e) => updateConfig({ showAddress: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Address
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showOccupation}
                  onChange={(e) => updateConfig({ showOccupation: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Occupation
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showCenterAreaCode}
                  onChange={(e) => updateConfig({ showCenterAreaCode: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Area Code
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showCutGuides}
                  onChange={(e) => updateConfig({ showCutGuides: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Cut Guides
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Queued Voters ({voters.length})
            </h2>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
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
                    <div className="text-[11px] font-mono text-slate-500 tabular-nums truncate">
                      {v.voterNo}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveVoter(v.id)}
                    aria-label={`Remove ${v.name} from print queue`}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right A4 Sheet Preview & Print Output */}
        <section className="xl:col-span-8 space-y-6">
          <div className="print-only-root space-y-6">
            {pages.map((pageVoters, pageIdx) => {
              const gridClass =
                config.layout === '1-up'
                  ? 'grid-cols-1'
                  : 'grid-cols-2';

              const slipSpacingClass =
                config.layout === '8-up'
                  ? 'p-2.5 text-[10.5px] leading-snug'
                  : config.layout === '6-up'
                  ? 'p-3 text-[11.5px] leading-snug'
                  : config.layout === '4-up'
                  ? 'p-4 text-[12.5px] leading-normal'
                  : 'p-6 text-sm leading-relaxed';

              return (
                <div key={pageIdx} className="space-y-2">
                  <div className="no-print flex items-center justify-between text-xs text-slate-500 px-1">
                    <span className="font-medium">
                      A4 Sheet {pageIdx + 1} of {pages.length}
                    </span>
                    <span className="tabular-nums">210mm × 297mm · Portrait</span>
                  </div>

                  <div className="a4-page-sheet bg-white border border-slate-300 shadow-xs mx-auto w-full max-w-[210mm] p-[6mm] print:p-0">
                    <div
                      className={`grid ${gridClass} ${
                        config.showCutGuides ? 'gap-[3mm]' : 'gap-[4mm]'
                      }`}
                    >
                      {pageVoters.map((voter) => (
                        <article
                          key={voter.id}
                          className={`a4-slip-card bg-white text-black ${slipSpacingClass} ${
                            config.showCutGuides
                              ? 'border border-dashed border-slate-500 print:border-black'
                              : 'border border-slate-800'
                          }`}
                        >
                          {/* Campaign Header */}
                          <div className="border-b border-black pb-1.5 mb-2 text-center space-y-0.5">
                            {config.electionNameYear ? (
                              <div className="font-bold text-[1.05em] tracking-tight">
                                {config.electionNameYear}
                              </div>
                            ) : (
                              <div className="font-bold text-[1.05em] tracking-tight">
                                {t.slipTitle}
                              </div>
                            )}

                            {(config.candidateName || config.postName || config.symbolName) && (
                              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[0.92em]">
                                {config.postName && (
                                  <span className="font-medium">{config.postName}</span>
                                )}
                                {config.candidateName && (
                                  <span className="font-bold">{config.candidateName}</span>
                                )}
                                {config.symbolName && (
                                  <span className="border border-black px-1.5 py-0.25 font-semibold">
                                    {t.symbol}: {config.symbolName}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Serial & Voter Number Highlight Row */}
                          <div className="flex items-center justify-between gap-2 bg-slate-100 print:bg-slate-100 border border-black px-2 py-1 mb-2 font-mono tabular-nums">
                            <div>
                              <span className="font-sans font-semibold mr-1">{t.serial}:</span>
                              <span className="font-bold text-[1.1em]">{voter.serialNo}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-sans font-semibold mr-1">{t.voterNo}:</span>
                              <span className="font-bold">{voter.voterNo}</span>
                            </div>
                          </div>

                          {/* Voter Identity Details */}
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-semibold shrink-0">{t.name}:</span>
                              <span className="font-bold text-[1.05em]">{voter.name}</span>
                            </div>

                            {config.showFatherMother && (
                              <>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-semibold shrink-0">{t.father}:</span>
                                  <span>{voter.fatherName || '—'}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-semibold shrink-0">{t.mother}:</span>
                                  <span>{voter.motherName || '—'}</span>
                                </div>
                              </>
                            )}

                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              {config.showDob && (
                                <div className="flex items-baseline gap-1">
                                  <span className="font-semibold">{t.dob}:</span>
                                  <span className="font-mono tabular-nums">
                                    {voter.dateOfBirth || '—'}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-baseline gap-1">
                                <span className="font-semibold">{t.gender}:</span>
                                <span>{voter.gender || '—'}</span>
                              </div>
                              {config.showOccupation && voter.occupation && (
                                <div className="flex items-baseline gap-1">
                                  <span className="font-semibold">{t.occupation}:</span>
                                  <span>{voter.occupation}</span>
                                </div>
                              )}
                            </div>

                            {/* Polling Center Box */}
                            <div className="mt-1.5 pt-1.5 border-t border-slate-400 print:border-black space-y-0.5">
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-semibold shrink-0">{t.center}:</span>
                                <span className="font-bold">{voter.centerName}</span>
                              </div>
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[0.9em]">
                                <span>
                                  {t.wardUnion}: {voter.union} · {voter.ward}
                                </span>
                                {config.showCenterAreaCode && voter.voterAreaCode && (
                                  <span className="font-mono tabular-nums">
                                    {t.areaCode}: {voter.voterAreaCode}
                                  </span>
                                )}
                              </div>
                              {config.showAddress && voter.address && (
                                <div className="text-[0.9em]">
                                  <span className="font-semibold">{t.address}: </span>
                                  <span>{voter.address}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Optional Footer */}
                          {config.footerNote && (
                            <div className="mt-2 pt-1 border-t border-dotted border-slate-400 text-center text-[0.85em] text-slate-800 print:text-black flex items-center justify-center gap-1">
                              {config.showCutGuides && (
                                <Scissors className="no-print w-3 h-3 text-slate-400 shrink-0" />
                              )}
                              <span>{config.footerNote}</span>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
