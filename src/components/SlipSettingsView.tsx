import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CheckCircle2, ImagePlus, Save, ShieldCheck, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { SlipPrintConfig, UserRequest } from '../types/schema';
import {
  formatIsoDateShort,
  persistLocalPrintConfig,
  resizeImageFileToDataUrl,
} from '../utils/slipHelpers';

interface SlipSettingsViewProps {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  userRequest: UserRequest | null;
  printConfig: SlipPrintConfig;
  onUpdatePrintConfig: (next: SlipPrintConfig) => void;
}

const STATUS_LABELS: Record<UserRequest['status'], string> = {
  pending: 'অপেক্ষমাণ',
  approved: 'অনুমোদিত',
  blocked: 'স্থগিত',
};

export function SlipSettingsView({
  userId,
  userEmail,
  isAdmin,
  userRequest,
  printConfig,
  onUpdatePrintConfig,
}: SlipSettingsViewProps) {
  const [electionNameYear, setElectionNameYear] = useState(
    userRequest?.electionNameYear ?? printConfig.electionNameYear
  );
  const [postName, setPostName] = useState(userRequest?.postName ?? printConfig.postName);
  const [candidateName, setCandidateName] = useState(
    userRequest?.candidateName ?? printConfig.candidateName
  );
  const [symbolName, setSymbolName] = useState(
    userRequest?.symbolName ?? printConfig.symbolName
  );
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState(
    userRequest?.candidatePhotoUrl ?? printConfig.candidatePhotoUrl
  );
  const [symbolPhotoUrl, setSymbolPhotoUrl] = useState(
    userRequest?.symbolPhotoUrl ?? printConfig.symbolPhotoUrl
  );
  const [footerNote, setFooterNote] = useState(printConfig.footerNote);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleImagePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, 260);
      setter(dataUrl);
    } catch {
      // Ignore invalid image
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);

    const updatedConfig: SlipPrintConfig = {
      ...printConfig,
      electionNameYear: electionNameYear.trim(),
      postName: postName.trim(),
      candidateName: candidateName.trim(),
      symbolName: symbolName.trim(),
      candidatePhotoUrl,
      symbolPhotoUrl,
      footerNote: footerNote.trim(),
    };
    onUpdatePrintConfig(updatedConfig);
    persistLocalPrintConfig(updatedConfig);

    if (userRequest) {
      const path = `user_requests/${userId}`;
      try {
        await updateDoc(doc(db, 'user_requests', userId), {
          electionNameYear: electionNameYear.trim(),
          postName: postName.trim(),
          candidateName: candidateName.trim(),
          symbolName: symbolName.trim(),
          candidatePhotoUrl,
          symbolPhotoUrl,
          updatedAt: serverTimestamp(),
        });
        setSavedNotice('প্রচারণা স্লিপের ডিফল্ট তথ্য ও ছবি আপনার ক্লাউড প্রোফাইলে সংরক্ষিত হয়েছে।');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(false);
      setSavedNotice('প্রচারণা স্লিপের ডিফল্ট তথ্য ও ছবি এই ব্রাউজারে সংরক্ষিত হয়েছে।');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">অ্যাকাউন্ট ও স্লিপ প্রোফাইল</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              আপনার অ্যান্ড্রয়েড ও ওয়েব ভোটার স্লিপ অ্যাকাউন্টের সাথে সমন্বিত তথ্য।
            </p>
          </div>
          {isAdmin && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              ক্লাউড অ্যাডমিনিস্ট্রেটর
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-sm">
          <div>
            <div className="text-xs text-slate-500">গুগল অ্যাকাউন্ট</div>
            <div className="font-medium text-slate-900 mt-0.5 break-all">{userEmail}</div>
            <div className="text-xs font-mono text-slate-500 mt-0.5 truncate">UID: {userId}</div>
          </div>

          {userRequest ? (
            <>
              <div>
                <div className="text-xs text-slate-500">নির্ধারিত এলাকা</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {userRequest.union}, ওয়ার্ড {userRequest.ward}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {userRequest.upazila} · {userRequest.district} · {userRequest.division}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">অ্যাকাউন্টের অবস্থা</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {STATUS_LABELS[userRequest.status]}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  হালনাগাদ: {formatIsoDateShort(userRequest.updatedAt)}
                </div>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 text-xs text-slate-600 flex items-center">
              সুপার অ্যাডমিন সেশন সরাসরি সক্রিয় রয়েছে (আলাদা গ্রাহক আবেদনের প্রয়োজন নেই)।
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            ডিফল্ট নির্বাচনী স্লিপ ব্র্যান্ডিং ও ছবি
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            এই তথ্য ও ছবিসমূহ প্রিন্ট করা প্রতিটি এ৪ ভোটার স্লিপে প্রদর্শিত হবে।
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              নির্বাচনের নাম ও সাল
            </label>
            <input
              type="text"
              value={electionNameYear}
              onChange={(e) => setElectionNameYear(e.target.value)}
              placeholder="যেমন: ইউনিয়ন পরিষদ নির্বাচন - ২০২৬"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              পদের নাম
            </label>
            <input
              type="text"
              value={postName}
              onChange={(e) => setPostName(e.target.value)}
              placeholder="যেমন: চেয়ারম্যান পদপ্রার্থী"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              প্রার্থীর নাম
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="যেমন: মোঃ মোস্তফা কামাল"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              নির্বাচনী প্রতীক
            </label>
            <input
              type="text"
              value={symbolName}
              onChange={(e) => setSymbolName(e.target.value)}
              placeholder="যেমন: কলম"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              স্লিপের নিচের লাল ব্যানারের বার্তা
            </label>
            <input
              type="text"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder="যেমন: মূল্যবান ভোট ও দোয়া চাই"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {candidatePhotoUrl ? (
                <img
                  src={candidatePhotoUrl}
                  alt="প্রার্থীর ছবি"
                  className="w-12 h-14 object-cover rounded border border-slate-200"
                />
              ) : (
                <div className="w-12 h-14 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                  ছবি নেই
                </div>
              )}
              <div className="text-xs">
                <div className="font-medium text-slate-800">প্রার্থীর ছবি</div>
                <div className="text-slate-500">স্লিপের বাম পাশে দেখাবে</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                আপলোড
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImagePick(e, setCandidatePhotoUrl)}
                  className="sr-only"
                />
              </label>
              {candidatePhotoUrl && (
                <button
                  type="button"
                  onClick={() => setCandidatePhotoUrl('')}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                  title="সরান"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {symbolPhotoUrl ? (
                <img
                  src={symbolPhotoUrl}
                  alt="প্রতীকের ছবি"
                  className="w-12 h-12 object-contain rounded-full border border-slate-200 p-0.5"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                  প্রতীক
                </div>
              )}
              <div className="text-xs">
                <div className="font-medium text-slate-800">প্রতীকের ছবি</div>
                <div className="text-slate-500">স্লিপের ডান পাশে দেখাবে</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                আপলোড
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImagePick(e, setSymbolPhotoUrl)}
                  className="sr-only"
                />
              </label>
              {symbolPhotoUrl && (
                <button
                  type="button"
                  onClick={() => setSymbolPhotoUrl('')}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                  title="সরান"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'ব্র্যান্ডিং ও ছবি সংরক্ষণ করুন'}
          </button>
        </div>
      </form>
    </div>
  );
}
