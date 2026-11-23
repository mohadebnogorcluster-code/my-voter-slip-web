import { Scissors, User as UserIcon } from 'lucide-react';
import type { SlipPrintConfig, VoterRecord } from '../types/schema';
import { formatGenderBangla, toBanglaDigits } from '../utils/slipHelpers';

interface VoterSlipCardProps {
  voter: VoterRecord;
  config: SlipPrintConfig;
  compact?: boolean;
  monochrome?: boolean;
}

export function VoterSlipCard({
  voter,
  config,
  compact = true,
  monochrome = false,
}: VoterSlipCardProps) {
  const electionTitle = config.electionNameYear.trim() || 'ইউনিয়ন পরিষদ নির্বাচন - ২০২৬';
  const upcomingBanner = electionTitle.startsWith('আসন্ন')
    ? electionTitle
    : `আসন্ন ${electionTitle}`;
  const postTitle = config.postName.trim() || 'চেয়ারম্যান পদপ্রার্থী';
  const rawCandidate = config.candidateName.trim();
  const candidateTitle = rawCandidate
    ? rawCandidate.endsWith('এর')
      ? rawCandidate
      : `${rawCandidate} এর`
    : 'প্রার্থীর নাম';
  const symbolTitle = config.symbolName.trim()
    ? `${config.symbolName.trim()} প্রতীকে`
    : 'নির্বাচিত প্রতীকে';
  const footerText = config.footerNote.trim() || 'মূল্যবান ভোট ও দোয়া চাই';

  const serialText = toBanglaDigits(voter.serialNo) || '—';
  const voterNoText = toBanglaDigits(voter.voterNo) || '—';
  const wardText = toBanglaDigits(voter.ward) || '—';
  const areaCodeText = voter.voterAreaCode ? toBanglaDigits(voter.voterAreaCode) : '—';
  const roomText = voter.roomNumber ? toBanglaDigits(voter.roomNumber) : '—';
  const buildingText = voter.buildingName?.trim() || '—';
  const genderText = formatGenderBangla(voter.gender);

  // Fixed ratio container so design & slip dimensions never break across 1/2/3/4-up or A4 print
  return (
    <article
      className={`voter-slip-print-exact a4-slip-card relative w-full bg-white border-[4px] rounded-[14px] overflow-hidden flex flex-col justify-between text-slate-900 ${
        monochrome ? 'border-[#111111]' : 'border-[#0F3D68]'
      } ${compact ? 'text-[10.5px] sm:text-[11px] print:text-[9.5px]' : 'text-[13.5px]'}`}
      style={{ aspectRatio: '2 / 2.86' }}
    >
      {/* Top Section: Header Banner + Area Info + Serial Capsule */}
      <div className={monochrome ? 'relative bg-white' : 'relative bg-[#FFFBEB]'}>
        {/* Top Decorative Strip */}
        <div
          className={`h-2 w-full ${
            monochrome
              ? 'bg-[#E5E7EB]'
              : 'bg-gradient-to-r from-[#FDE047] via-[#FEF08A] to-[#FDE047]'
          }`}
          aria-hidden="true"
        />

        {/* Header Capsule */}
        <div
          className={`mx-3 -mt-0.5 border rounded-full px-3 py-1 text-center shadow-xs ${
            monochrome
              ? 'bg-[#111111] border-[#111111]'
              : 'bg-[#0B4F9C] border-[#0F3D68]'
          }`}
        >
          <div
            className={`font-bold text-[1.28em] leading-tight tracking-tight ${
              monochrome ? 'text-white' : 'text-[#FACC15]'
            }`}
          >
            {electionTitle}
          </div>
          <div
            className={`h-[1.5px] w-3/5 mx-auto mt-0.5 rounded-full ${
              monochrome ? 'bg-white/85' : 'bg-[#FACC15]/85'
            }`}
          />
        </div>

        {/* Administrative Area Details */}
        <div className="px-2.5 pt-1.5 pb-2 text-center text-[0.86em] leading-snug text-slate-950 space-y-0.5">
          <div className="truncate">
            বিভাগ: {voter.division || '—'} | জেলা: {voter.district || '—'} | উপজেলা:{' '}
            {voter.upazila || '—'}
          </div>
          <div className="truncate">
            ইউনিয়ন: {voter.union || '—'} | ওয়ার্ড নং: {wardText}
          </div>
          <div className="font-bold text-black truncate">
            ভোট কেন্দ্র: {voter.centerName || '—'} | ভোটার এলাকা কোড: {areaCodeText}
          </div>
        </div>

        {/* Decorative Wing & Centered Serial Capsule */}
        <div className="relative pb-2 flex items-center justify-center">
          <div
            className={`absolute inset-x-0 bottom-0 h-7 ${
              monochrome ? 'bg-[#1F2937]' : 'bg-[#0B4F9C]'
            }`}
            style={{
              clipPath: 'polygon(0 28%, 50% 0%, 100% 28%, 100% 100%, 0% 100%)',
            }}
            aria-hidden="true"
          />
          <div
            className={`relative z-10 border-2 rounded-full px-5 py-1 text-center min-w-[56%] shadow-xs ${
              monochrome
                ? 'bg-[#111111] border-white'
                : 'bg-[#0B4F9C] border-[#FACC15]'
            }`}
          >
            <div className="text-white font-semibold text-[0.85em] leading-tight">
              ভোটারের ক্রমিক নং
            </div>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span
                className={`h-[1.5px] flex-1 ${
                  monochrome ? 'bg-white/85' : 'bg-[#FACC15]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`font-bold text-[1.55em] leading-none tabular-nums ${
                  monochrome ? 'text-white' : 'text-[#FACC15]'
                }`}
              >
                {serialText}
              </span>
              <span
                className={`h-[1.5px] flex-1 ${
                  monochrome ? 'bg-white/85' : 'bg-[#FACC15]'
                }`}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Middle 2-Column Section: 65% Voter Details / 35% Gender + Building + Room */}
      <div className="px-2.5 pt-2 pb-1.5 flex items-stretch gap-2 bg-white">
        {/* Left Column (65%) */}
        <div
          className={`w-[65%] border rounded-lg overflow-hidden flex flex-col ${
            monochrome
              ? 'bg-white border-[#111111]'
              : 'bg-[#EFF6FF] border-[#2563EB]/75'
          }`}
        >
          <div
            className={`text-white font-semibold text-[0.82em] px-2.5 py-0.5 rounded-br-lg self-start ${
              monochrome ? 'bg-[#111111]' : 'bg-[#0B4F9C]'
            }`}
          >
            ভোটারের নাম:
          </div>
          <div className="px-2.5 pt-1 pb-1 font-bold text-[1.22em] text-black leading-tight truncate">
            {voter.name || '—'}
          </div>
          <div
            className={`border-t mx-2 ${
              monochrome ? 'border-[#555555]' : 'border-[#60A5FA]'
            }`}
          />
          <div className="px-2.5 py-1.5 space-y-0.5 text-[0.86em] leading-snug text-slate-950 flex-1 flex flex-col justify-center">
            <div className="truncate">
              <span className="font-semibold">ভোটার নম্বর:</span>{' '}
              <span className="font-medium tabular-nums">{voterNoText}</span>
            </div>
            {config.showFatherMother && (
              <>
                <div className="truncate">
                  <span className="font-semibold">পিতার নাম:</span> {voter.fatherName || '—'}
                </div>
                <div className="truncate">
                  <span className="font-semibold">মাতার নাম:</span> {voter.motherName || '—'}
                </div>
              </>
            )}
            {config.showAddress && (
              <div className="truncate">
                <span className="font-semibold">ঠিকানা:</span> {voter.address || '—'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (35%) */}
        <div className="w-[35%] flex flex-col gap-1.5">
          <div
            className={`text-white rounded-full py-1 px-2 text-center font-bold text-[0.92em] leading-tight ${
              monochrome ? 'bg-[#111111]' : 'bg-[#15803D]'
            }`}
          >
            {genderText}
          </div>

          <div
            className={`border rounded-lg px-1.5 py-1 text-center flex-1 flex flex-col justify-center ${
              monochrome
                ? 'bg-[#F8FAFC] border-[#111111]'
                : 'bg-[#FEF9E7] border-slate-700'
            }`}
          >
            <div
              className={`font-semibold text-[0.78em] leading-tight ${
                monochrome ? 'text-[#111111]' : 'text-[#0B4F9C]'
              }`}
            >
              ভবনের নাম:
            </div>
            <div className="font-bold text-black text-[0.92em] leading-tight mt-0.5 break-words">
              {buildingText}
            </div>
          </div>

          <div
            className={`border rounded-lg px-1.5 py-1 text-center flex-1 flex flex-col justify-center ${
              monochrome
                ? 'bg-[#F8FAFC] border-[#111111]'
                : 'bg-[#F5EEF8] border-slate-700'
            }`}
          >
            <div
              className={`font-semibold text-[0.78em] leading-tight ${
                monochrome ? 'text-[#111111]' : 'text-[#0B4F9C]'
              }`}
            >
              কক্ষ নম্বর:
            </div>
            <div className="font-bold text-black text-[1.4em] leading-none mt-0.5 tabular-nums">
              {roomText}
            </div>
          </div>
        </div>
      </div>

      {/* Dashed Cutting Line with Scissors Icon */}
      <div className="relative px-2 py-1 flex items-center bg-white">
        <div
          className={`w-full border-t-[1.5px] border-dashed ${
            monochrome ? 'border-black' : 'border-slate-700'
          }`}
        />
        <div className="absolute right-4 bg-white px-1 text-slate-900">
          <Scissors className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Bottom Campaign Section */}
      <div
        className={`flex-1 flex flex-col justify-between px-2.5 pb-2 pt-0.5 ${
          monochrome
            ? 'bg-white'
            : 'bg-gradient-to-b from-white via-[#F0F9FF] to-[#DCFCE7]/70'
        }`}
      >
        <div>
          {/* Upcoming Election Banner */}
          <div
            className={`text-white text-center font-semibold text-[0.88em] py-0.5 px-2 rounded-t-md leading-tight ${
              monochrome ? 'bg-[#111111]' : 'bg-[#0B4F9C]'
            }`}
          >
            {upcomingBanner}
          </div>
          {/* Post Banner */}
          <div
            className={`text-black text-center font-bold text-[0.98em] py-0.5 px-2 rounded-b-md leading-tight ${
              monochrome ? 'bg-[#E5E7EB] border-x border-b border-[#111111]' : 'bg-[#FACC15]'
            }`}
          >
            {postTitle}
          </div>

          {/* Candidate Name */}
          <div className="text-center font-bold text-[1.18em] text-black mt-1.5 leading-tight truncate">
            {candidateTitle}
          </div>
        </div>

        {/* Photo + Symbol 2-Column Row */}
        <div className="grid grid-cols-2 gap-2 items-center py-1 my-auto">
          {/* Left: Candidate Photo */}
          <div className="flex justify-center">
            <div
              className={`border-2 rounded-lg overflow-hidden bg-white flex items-center justify-center ${
                monochrome ? 'border-[#111111]' : 'border-[#3B82F6]'
              } ${compact ? 'w-[62px] h-[78px]' : 'w-[94px] h-[116px]'}`}
            >
              {config.candidatePhotoUrl ? (
                <img
                  src={config.candidatePhotoUrl}
                  alt={rawCandidate || 'প্রার্থীর ছবি'}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover ${
                    monochrome ? 'grayscale contrast-115' : ''
                  }`}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                  <UserIcon className="w-7 h-7" />
                  <span className="text-[8px] mt-0.5">প্রার্থীর ছবি</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Symbol Label + Circular Ring Emblem */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="font-bold text-black text-[0.96em] mb-1 leading-tight">
              {symbolTitle}
            </div>
            <div className="relative flex flex-col items-center">
              <div
                className={`rounded-full border-[2.5px] p-0.5 bg-white flex items-center justify-center ${
                  monochrome ? 'border-[#111111]' : 'border-[#0B4F9C]'
                } ${compact ? 'w-[62px] h-[62px]' : 'w-[88px] h-[88px]'}`}
              >
                <div className="w-full h-full rounded-full border-[1.5px] border-slate-900 overflow-hidden bg-white flex items-center justify-center p-1">
                  {config.symbolPhotoUrl ? (
                    <img
                      src={config.symbolPhotoUrl}
                      alt={config.symbolName || 'নির্বাচনী প্রতীক'}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-contain ${
                        monochrome ? 'grayscale contrast-125' : ''
                      }`}
                    />
                  ) : (
                    /* Clean Vector Pen Nib Emblem Fallback */
                    <svg
                      viewBox="0 0 64 64"
                      className="w-4/5 h-4/5 text-slate-950"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M46 10L54 18L26 46L14 50L18 38L46 10Z" />
                      <path d="M39 17L47 25" />
                      <path d="M14 50L25 39" />
                      <circle cx="29" cy="35" r="2.2" fill="currentColor" />
                    </svg>
                  )}
                </div>
              </div>
              {/* Leaf Accents below Symbol Ring */}
              <div className="flex items-center justify-center gap-1 -mt-1" aria-hidden="true">
                <span
                  className={`w-2 h-1 rounded-full -rotate-45 ${
                    monochrome ? 'bg-[#333333]' : 'bg-emerald-600'
                  }`}
                />
                <span
                  className={`w-2 h-1 rounded-full -rotate-12 ${
                    monochrome ? 'bg-[#333333]' : 'bg-emerald-600'
                  }`}
                />
                <span
                  className={`w-2 h-1 rounded-full rotate-12 ${
                    monochrome ? 'bg-[#333333]' : 'bg-emerald-600'
                  }`}
                />
                <span
                  className={`w-2 h-1 rounded-full rotate-45 ${
                    monochrome ? 'bg-[#333333]' : 'bg-emerald-600'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Capsule Footer */}
        <div
          className={`text-white rounded-full py-1 px-3 text-center font-bold text-[0.9em] leading-tight flex items-center justify-center gap-2 shadow-xs ${
            monochrome ? 'bg-[#111111]' : 'bg-[#C62828]'
          }`}
        >
          <span aria-hidden="true">★</span>
          <span className="truncate">{footerText}</span>
          <span aria-hidden="true">★</span>
        </div>
      </div>
    </article>
  );
}
