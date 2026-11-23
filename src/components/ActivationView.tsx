import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { CheckCircle2, Clock, Ban, LogOut, Send, AlertCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { UserRequest } from '../types/schema';
import { formatIsoDateShort, getOrCreateWebDeviceId } from '../utils/slipHelpers';
import { DeveloperFooter, SITE_LOGO_SRC } from './DeveloperFooter';

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
        text: 'অনুগ্রহ করে আপনার নাম, মোবাইল নম্বর, প্রশাসনিক এলাকা এবং পেমেন্ট সংক্রান্ত সব বাধ্যতামূলক ঘর পূরণ করুন।',
      });
      return;
    }

    setSubmitting(true);
    const path = `user_requests/${user.uid}`;

    const existingDeviceId = (existingRequest?.deviceId ?? '').trim();
    const resolvedDeviceId =
      existingDeviceId.length >= 4 ? existingDeviceId : getOrCreateWebDeviceId();
    const safeDeviceId =
      resolvedDeviceId.length >= 4
        ? resolvedDeviceId
        : `web-${resolvedDeviceId}`.padEnd(8, '0');

    const baseFields = {
      userId: user.uid,
      name: name.trim(),
      phone: phone.trim(),
      division: division.trim(),
      district: district.trim(),
      upazila: upazila.trim(),
      union: union.trim(),
      ward: ward.trim(),
      paymentNote: paymentNote.trim(),
      deviceId: safeDeviceId,
      electionNameYear: electionNameYear.trim(),
      postName: postName.trim(),
      candidateName: candidateName.trim(),
      symbolName: symbolName.trim(),
      status: 'pending' as const,
      updatedAt: serverTimestamp(),
    };

    try {
      if (existingRequest) {
        await updateDoc(doc(db, 'user_requests', user.uid), baseFields);
      } else {
        await setDoc(doc(db, 'user_requests', user.uid), {
          ...baseFields,
          createdAt: serverTimestamp(),
        });
      }
      setFeedback({
        type: 'success',
        text: existingRequest
          ? 'আপনার আবেদনের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।'
          : 'অ্যাকাউন্ট সক্রিয়করণের আবেদন জমা হয়েছে। অ্যাডমিনের অনুমোদনের পর পোর্টাল স্বয়ংক্রিয়ভাবে চালু হবে।',
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
      <div className="h-1 bg-emerald-700 w-full" aria-hidden="true" />
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={SITE_LOGO_SRC}
              alt="ভোটার স্লিপ লোগো"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-xs shrink-0"
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
              সাইন আউট
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
                      ? 'অ্যাকাউন্টের প্রবেশাধিকার স্থগিত করা হয়েছে'
                      : isPending
                      ? 'আবেদনটি অনুমোদনের অপেক্ষায় রয়েছে'
                      : 'অ্যাকাউন্ট অনুমোদিত'}
                  </h1>
                </div>
                <p className="text-sm text-slate-600">
                  {isBlocked
                    ? 'অ্যাডমিন কর্তৃক আপনার অ্যাকাউন্টটি ব্লক বা স্থগিত করা হয়েছে। সহায়তার জন্য কর্তৃপক্ষের সাথে যোগাযোগ করুন।'
                    : 'আপনার আবেদন গ্রহণ করা হয়েছে। অ্যাডমিন অনুমোদন দেওয়ার সাথে সাথেই ভোটার তালিকা ও এ৪ প্রিন্ট স্টুডিও চালু হয়ে যাবে।'}
                </p>
              </div>

              {isPending && (
                <button
                  type="button"
                  onClick={() => setEditingPending((prev) => !prev)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {editingPending ? 'সম্পাদনা বাতিল' : 'আবেদনের তথ্য পরিবর্তন করুন'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-sm">
              <div>
                <div className="text-xs text-slate-500">আবেদনকারী</div>
                <div className="font-medium text-slate-900 mt-0.5">{existingRequest.name}</div>
                <div className="text-xs font-mono text-slate-600 mt-0.5 tabular-nums">
                  {existingRequest.phone}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">নির্ধারিত এলাকা</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {existingRequest.union}, ওয়ার্ড {existingRequest.ward}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {existingRequest.upazila} · {existingRequest.district} · {existingRequest.division}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">পেমেন্ট ও জমার তারিখ</div>
                <div className="font-medium text-slate-900 mt-0.5 break-words">
                  {existingRequest.paymentNote}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  সর্বশেষ হালনাগাদ: {formatIsoDateShort(existingRequest.updatedAt)}
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
                {existingRequest
                  ? 'সক্রিয়করণের আবেদন হালনাগাদ করুন'
                  : 'অ্যাকাউন্ট সক্রিয়করণের আবেদন ফরম'}
              </h2>
              <p className="text-sm text-slate-600">
                আপনার নির্ধারিত নির্বাচনী এলাকা ও পেমেন্ট রেফারেন্স লিখুন। এটি মোবাইল অ্যাপের ডাটাবেসের সাথে সম্পূর্ণ সামঞ্জস্যপূর্ণ।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  পূর্ণ নাম *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  মোবাইল নম্বর *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">প্রশাসনিক এলাকা</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    বিভাগ *
                  </label>
                  <input
                    type="text"
                    required
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    placeholder="যেমন: রাজশাহী"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    জেলা *
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="যেমন: বগুড়া"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    উপজেলা / থানা *
                  </label>
                  <input
                    type="text"
                    required
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    placeholder="যেমন: সদর"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    ইউনিয়ন / পৌরসভা *
                  </label>
                  <input
                    type="text"
                    required
                    value={union}
                    onChange={(e) => setUnion(e.target.value)}
                    placeholder="যেমন: মহাদেবপুর"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    ওয়ার্ড নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="যেমন: ০৪"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    পেমেন্ট রেফারেন্স / TrxID *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="বিকাশ/নগদ TrxID বা মন্তব্য"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  ভোটার স্লিপ হেডার তথ্য (ঐচ্ছিক)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  প্রিন্ট করা প্রতিটি এ৪ ভোটার স্লিপের ওপরে প্রার্থী ও নির্বাচনের তথ্য স্বয়ংক্রিয়ভাবে যুক্ত হবে।
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    নির্বাচনের নাম ও সাল
                  </label>
                  <input
                    type="text"
                    value={electionNameYear}
                    onChange={(e) => setElectionNameYear(e.target.value)}
                    placeholder="যেমন: ইউনিয়ন পরিষদ নির্বাচন ২০২৬"
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
                    placeholder="যেমন: মোঃ আব্দুল করিম"
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
                    placeholder="যেমন: আনারস / ঘোড়া"
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
                  ? 'সংরক্ষণ হচ্ছে...'
                  : existingRequest
                  ? 'পরিবর্তন সংরক্ষণ করুন'
                  : 'আবেদন জমা দিন'}
              </button>
            </div>
          </form>
        )}
      </main>
      <DeveloperFooter />
    </div>
  );
}
