import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { CheckCircle2, Clock, Ban, LogOut, Send, AlertCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { UserRequest } from '../types/schema';
import { formatIsoDateShort, getOrCreateWebDeviceId } from '../utils/slipHelpers';

interface ActivationViewProps {
  user: User;
  existingRequest: UserRequest | null;
  onSignOut: () => void;
}

export function ActivationView({ user, existingRequest, onSignOut }: ActivationViewProps) {
  const [name, setName] = useState(existingRequest?.name || user.displayName || '');
  const [phone, setPhone] = useState(existingRequest?.phone || '');
  const [division, setDivision] = useState(existingRequest?.division || '');
  const [district, setDistrict] = useState(existingRequest?.district || '');
  const [upazila, setUpazila] = useState(existingRequest?.upazila || '');
  const [union, setUnion] = useState(existingRequest?.union || '');
  const [ward, setWard] = useState(existingRequest?.ward || '');
  const [paymentNote, setPaymentNote] = useState(existingRequest?.paymentNote || '');
  const [electionNameYear, setElectionNameYear] = useState(
    existingRequest?.electionNameYear || ''
  );
  const [postName, setPostName] = useState(existingRequest?.postName || '');
  const [candidateName, setCandidateName] = useState(existingRequest?.candidateName || '');
  const [symbolName, setSymbolName] = useState(existingRequest?.symbolName || '');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [editingPending, setEditingPending] = useState(!existingRequest);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (
      !name.trim() ||
      !phone.trim() ||
      !division.trim() ||
      !district.trim() ||
      !upazila.trim() ||
      !union.trim() ||
      !ward.trim() ||
      !paymentNote.trim()
    ) {
      setFeedback({
        type: 'error',
        text: 'Please complete all required personal, area, and payment note fields.',
      });
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const path = `user_requests/${user.uid}`;

    const payload: UserRequest = {
      userId: user.uid,
      name: name.trim(),
      phone: phone.trim(),
      division: division.trim(),
      district: district.trim(),
      upazila: upazila.trim(),
      union: union.trim(),
      ward: ward.trim(),
      paymentNote: paymentNote.trim(),
      deviceId: existingRequest?.deviceId || getOrCreateWebDeviceId(),
      electionNameYear: electionNameYear.trim(),
      postName: postName.trim(),
      candidateName: candidateName.trim(),
      symbolName: symbolName.trim(),
      status: existingRequest?.status ?? 'pending',
      createdAt: existingRequest?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'user_requests', user.uid), payload, { merge: true });
      setFeedback({
        type: 'success',
        text: existingRequest
          ? 'Your activation request details were updated.'
          : 'Activation request submitted. An administrator will review and approve your account.',
      });
      setEditingPending(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setSubmitting(false);
    }
  };

  const isBlocked = existingRequest?.status === 'blocked';
  const isPending = existingRequest?.status === 'pending';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Voter Slip Portal
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-600 truncate max-w-[220px]">
              {user.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
        {existingRequest && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isBlocked ? (
                    <Ban className="w-5 h-5 text-red-600 shrink-0" />
                  ) : isPending ? (
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <h1 className="text-xl font-semibold text-slate-900">
                    {isBlocked
                      ? 'Account Access Blocked'
                      : isPending
                      ? 'Activation Pending Review'
                      : 'Account Approved'}
                  </h1>
                </div>
                <p className="text-sm text-slate-600">
                  {isBlocked
                    ? 'Your activation request has been marked as blocked by an administrator. Contact support for assistance.'
                    : 'Your registration has been received. Once an administrator approves your request, the full voter directory and A4 print studio will unlock automatically.'}
                </p>
              </div>

              {isPending && (
                <button
                  type="button"
                  onClick={() => setEditingPending((prev) => !prev)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {editingPending ? 'Cancel Edit' : 'Update Request Details'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-sm">
              <div>
                <div className="text-xs text-slate-500">Applicant</div>
                <div className="font-medium text-slate-900 mt-0.5">{existingRequest.name}</div>
                <div className="text-xs font-mono text-slate-600 mt-0.5 tabular-nums">
                  {existingRequest.phone}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Assigned Area</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {existingRequest.union}, Ward {existingRequest.ward}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {existingRequest.upazila} · {existingRequest.district} · {existingRequest.division}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Payment &amp; Submission</div>
                <div className="font-medium text-slate-900 mt-0.5 break-words">
                  {existingRequest.paymentNote}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Updated {formatIsoDateShort(existingRequest.updatedAt)}
                </div>
              </div>
            </div>
          </section>
        )}

        {feedback && (
          <div
            role="status"
            className={`flex items-start gap-2.5 p-3.5 rounded-lg border text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {(!existingRequest || (isPending && editingPending)) && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {existingRequest ? 'Update Activation Request' : 'Request Account Activation'}
              </h2>
              <p className="text-sm text-slate-600">
                Enter your administrative area and offline payment reference. This matches the exact Android app activation schema.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Md. Rafiqul Islam"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Administrative Area</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Division *
                  </label>
                  <input
                    type="text"
                    required
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    placeholder="e.g. Rajshahi"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    District *
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Bogura"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Upazila / Thana *
                  </label>
                  <input
                    type="text"
                    required
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    placeholder="e.g. Sadar"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Union / Pourashava *
                  </label>
                  <input
                    type="text"
                    required
                    value={union}
                    onChange={(e) => setUnion(e.target.value)}
                    placeholder="e.g. Ward 04"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Ward *
                  </label>
                  <input
                    type="text"
                    required
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="e.g. 04"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Payment Reference / TrxID *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="bKash/Nagad TrxID or Note"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Voter Slip Campaign Header (Optional)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-populates your printed A4 voter slips with candidate and election information.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Election Name &amp; Year
                  </label>
                  <input
                    type="text"
                    value={electionNameYear}
                    onChange={(e) => setElectionNameYear(e.target.value)}
                    placeholder="e.g. ইউনিয়ন পরিষদ নির্বাচন ২০২৬"
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
                    placeholder="e.g. চেয়ারম্যান পদপ্রার্থী"
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
                    placeholder="e.g. আনারস / ঘোড়া"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                {submitting
                  ? 'Saving...'
                  : existingRequest
                  ? 'Save Changes'
                  : 'Submit Activation Request'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
