import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { SlipPrintConfig, UserRequest } from '../types/schema';
import { formatIsoDateShort, persistLocalPrintConfig } from '../utils/slipHelpers';

interface SlipSettingsViewProps {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  userRequest: UserRequest | null;
  printConfig: SlipPrintConfig;
  onUpdatePrintConfig: (next: SlipPrintConfig) => void;
}

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
  const [footerNote, setFooterNote] = useState(printConfig.footerNote);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

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
          updatedAt: new Date().toISOString(),
        });
        setSavedNotice('Campaign slip defaults saved to your Firestore profile.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(false);
      setSavedNotice('Campaign slip defaults saved for this browser.');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Account &amp; Slip Profile</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Synced with your Android &amp; Web Voter Slip account.
            </p>
          </div>
          {isAdmin && (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Cloud Administrator
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-sm">
          <div>
            <div className="text-xs text-slate-500">Google Account</div>
            <div className="font-medium text-slate-900 mt-0.5 break-all">{userEmail}</div>
            <div className="text-xs font-mono text-slate-500 mt-0.5 truncate">UID: {userId}</div>
          </div>

          {userRequest ? (
            <>
              <div>
                <div className="text-xs text-slate-500">Assigned Area</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {userRequest.union}, Ward {userRequest.ward}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {userRequest.upazila} · {userRequest.district} · {userRequest.division}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Activation Status</div>
                <div className="font-medium text-slate-900 capitalize mt-0.5">
                  {userRequest.status}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Updated {formatIsoDateShort(userRequest.updatedAt)}
                </div>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 text-xs text-slate-600 flex items-center">
              Administrator session active without a separate client activation document.
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
            Default Campaign Slip Branding
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            These fields appear at the top of every printed A4 voter slip.
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
              Election Name &amp; Year
            </label>
            <input
              type="text"
              value={electionNameYear}
              onChange={(e) => setElectionNameYear(e.target.value)}
              placeholder="e.g. ত্রয়োদশ জাতীয় সংসদ নির্বাচন ২০২৬"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Post Name
            </label>
            <input
              type="text"
              value={postName}
              onChange={(e) => setPostName(e.target.value)}
              placeholder="e.g. সংসদ সদস্য পদপ্রার্থী"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Candidate Name
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. মোঃ আব্দুল করিম"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Election Symbol
            </label>
            <input
              type="text"
              value={symbolName}
              onChange={(e) => setSymbolName(e.target.value)}
              placeholder="e.g. আনারস"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Printed Slip Footer Note
            </label>
            <input
              type="text"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder="Short reminder printed at the bottom of each slip"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Branding Defaults'}
          </button>
        </div>
      </form>
    </div>
  );
}
