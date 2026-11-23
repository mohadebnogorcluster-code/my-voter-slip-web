import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Building2,
  Save,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
} from 'lucide-react';
import { db } from '../firebase';
import type { PollingCenter, SeatPlanRecord, VoterRecord } from '../types/schema';
import {
  formatBnNumber,
  matchesGenderLabel,
  parseSerialNumber,
  toBanglaDigits,
  toFirestoreMillis,
} from '../utils/slipHelpers';

interface SeatPlanManagerProps {
  centers: PollingCenter[];
  currentUserId: string;
  defaultCenterId?: string;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
  onSeatPlanUpdated?: (centerId: string) => void;
  showTable?: boolean;
}

const LOCAL_SEAT_PLANS_KEY = 'voterslip_seat_plans_cache_v1';

function readLocalSeatPlans(): SeatPlanRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SEAT_PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SeatPlanRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSeatPlans(plans: SeatPlanRecord[]): void {
  try {
    localStorage.setItem(LOCAL_SEAT_PLANS_KEY, JSON.stringify(plans));
  } catch {
    // Ignore quota errors
  }
}

export function SeatPlanManager({
  centers,
  currentUserId,
  defaultCenterId,
  isModalOpen,
  onCloseModal,
  onOpenModal,
  onSeatPlanUpdated,
  showTable = true,
}: SeatPlanManagerProps) {
  const [plans, setPlans] = useState<SeatPlanRecord[]>(() => readLocalSeatPlans());
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SeatPlanRecord | null>(null);

  // Modal Form State
  const [selectedCenterId, setSelectedCenterId] = useState(defaultCenterId || '');
  const [buildingName, setBuildingName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [gender, setGender] = useState<'পুরুষ' | 'মহিলা'>('পুরুষ');
  const [startSerial, setStartSerial] = useState('');
  const [endSerial, setEndSerial] = useState('');

  const [saving, setSaving] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Sync default center selection when modal opens for a new entry
  useEffect(() => {
    if (isModalOpen && !editingPlan) {
      if (defaultCenterId) {
        setSelectedCenterId(defaultCenterId);
      } else if (!selectedCenterId && centers.length > 0) {
        setSelectedCenterId(centers[0].id);
      }
    }
  }, [isModalOpen, editingPlan, defaultCenterId, centers, selectedCenterId]);

  // Listen to seat_plans collection in Firestore with graceful localStorage fallback
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'seat_plans'),
      (snap) => {
        const list: SeatPlanRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SeatPlanRecord, 'id'>),
        }));
        list.sort((a, b) => toFirestoreMillis(b.updatedAt) - toFirestoreMillis(a.updatedAt));
        setPlans(list);
        writeLocalSeatPlans(list);
        setLoadingPlans(false);
      },
      () => {
        // Fallback to localStorage cache if seat_plans rules are not configured yet
        setPlans(readLocalSeatPlans());
        setLoadingPlans(false);
      }
    );
    return () => unsub();
  }, []);

  const sortedCenters = useMemo(
    () =>
      [...centers].sort((a, b) =>
        (a.voterAreaCode || a.centerName).localeCompare(b.voterAreaCode || b.centerName)
      ),
    [centers]
  );

  const resetForm = () => {
    setEditingPlan(null);
    setSelectedCenterId(defaultCenterId || centers[0]?.id || '');
    setBuildingName('');
    setRoomNumber('');
    setGender('পুরুষ');
    setStartSerial('');
    setEndSerial('');
    setFeedback(null);
  };

  const handleOpenNew = () => {
    resetForm();
    onOpenModal();
  };

  const handleEditPlan = (plan: SeatPlanRecord) => {
    setEditingPlan(plan);
    setSelectedCenterId(plan.centerId);
    setBuildingName(plan.buildingName);
    setRoomNumber(plan.roomNumber);
    setGender(plan.gender);
    setStartSerial(String(plan.startSerial));
    setEndSerial(String(plan.endSerial));
    setFeedback(null);
    onOpenModal();
  };

  async function fetchCenterVoters(center: PollingCenter): Promise<VoterRecord[]> {
    const byCenterSnap = await getDocs(
      query(collection(db, 'voters_data'), where('centerId', '==', center.id))
    );
    if (!byCenterSnap.empty) {
      return byCenterSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VoterRecord, 'id'>),
      }));
    }
    if (center.voterAreaCode) {
      const byCodeSnap = await getDocs(
        query(
          collection(db, 'voters_data'),
          where('voterAreaCode', '==', center.voterAreaCode)
        )
      );
      return byCodeSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VoterRecord, 'id'>),
      }));
    }
    return [];
  }

  const handleSaveSeatPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const center = centers.find((c) => c.id === selectedCenterId);
    if (!center) {
      setFeedback({ type: 'error', text: 'অনুগ্রহ করে একটি ভোটার এলাকা কোড নির্বাচন করুন।' });
      return;
    }

    if (!buildingName.trim() || !roomNumber.trim()) {
      setFeedback({ type: 'error', text: 'ভবনের নাম এবং কক্ষ নম্বর উভয়ই লিখুন।' });
      return;
    }

    const sNum = parseSerialNumber(startSerial);
    const eNum = parseSerialNumber(endSerial);
    if (sNum <= 0 || eNum <= 0) {
      setFeedback({
        type: 'error',
        text: 'সঠিক শুরুর ক্রমিক ও শেষ ক্রমিক নম্বর লিখুন।',
      });
      return;
    }

    const minSerial = Math.min(sNum, eNum);
    const maxSerial = Math.max(sNum, eNum);

    setSaving(true);
    try {
      const centerVoters = await fetchCenterVoters(center);

      // If editing an existing plan whose range/gender/center changed, clear old assignments first
      if (editingPlan) {
        const oldCenter = centers.find((c) => c.id === editingPlan.centerId);
        const oldCenterVoters =
          oldCenter && oldCenter.id !== center.id
            ? await fetchCenterVoters(oldCenter)
            : centerVoters;
        const toClear = oldCenterVoters.filter((v) => {
          const sn = v.serialNumeric || parseSerialNumber(v.serialNo);
          return (
            sn >= editingPlan.startSerial &&
            sn <= editingPlan.endSerial &&
            matchesGenderLabel(v.gender, editingPlan.gender)
          );
        });
        for (let i = 0; i < toClear.length; i += 400) {
          const clearBatch = writeBatch(db);
          toClear.slice(i, i + 400).forEach((v) => {
            clearBatch.update(doc(db, 'voters_data', v.id), {
              buildingName: '',
              roomNumber: '',
            });
          });
          await clearBatch.commit();
        }
      }

      // Match voters by area code / center, gender, and serial range
      const matchedVoters = centerVoters.filter((v) => {
        const sn = v.serialNumeric || parseSerialNumber(v.serialNo);
        return (
          sn >= minSerial &&
          sn <= maxSerial &&
          matchesGenderLabel(v.gender, gender)
        );
      });

      // Batch update all matching voters in voters_data
      for (let i = 0; i < matchedVoters.length; i += 400) {
        const batch = writeBatch(db);
        matchedVoters.slice(i, i + 400).forEach((v) => {
          batch.update(doc(db, 'voters_data', v.id), {
            buildingName: buildingName.trim(),
            roomNumber: roomNumber.trim(),
          });
        });
        await batch.commit();
      }

      const planId = editingPlan?.id || doc(collection(db, 'seat_plans')).id;
      const nowIso = new Date().toISOString();
      const planRecord: SeatPlanRecord = {
        id: planId,
        centerId: center.id,
        voterAreaCode: center.voterAreaCode || '',
        ward: center.ward,
        centerName: center.centerName,
        buildingName: buildingName.trim(),
        roomNumber: roomNumber.trim(),
        gender,
        startSerial: minSerial,
        endSerial: maxSerial,
        updatedCount: matchedVoters.length,
        createdByUid: editingPlan?.createdByUid || currentUserId,
        createdAt: editingPlan?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      // Persist seat plan summary in Firestore (with local fallback if rules reject seat_plans)
      try {
        await setDoc(doc(db, 'seat_plans', planId), {
          ...planRecord,
          createdAt: editingPlan ? editingPlan.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        const current = readLocalSeatPlans().filter((p) => p.id !== planId);
        const next = [planRecord, ...current];
        setPlans(next);
        writeLocalSeatPlans(next);
      }

      setFeedback({
        type: 'success',
        text: `আসন বিন্যাস সংরক্ষিত হয়েছে এবং ${formatBnNumber(
          matchedVoters.length
        )} জন ভোটারের ভবন ও কক্ষ নম্বর আপডেট হয়েছে।`,
      });

      onSeatPlanUpdated?.(center.id);
      if (editingPlan) {
        setEditingPlan(null);
      } else {
        setBuildingName('');
        setRoomNumber('');
        setStartSerial('');
        setEndSerial('');
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? `আপডেট করতে সমস্যা হয়েছে: ${err.message}`
            : 'আসন বিন্যাস সংরক্ষণ করা যায়নি।',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (plan: SeatPlanRecord) => {
    setDeletingPlanId(plan.id);
    setFeedback(null);
    try {
      const center = centers.find((c) => c.id === plan.centerId);
      if (center) {
        const centerVoters = await fetchCenterVoters(center);
        const matched = centerVoters.filter((v) => {
          const sn = v.serialNumeric || parseSerialNumber(v.serialNo);
          return (
            sn >= plan.startSerial &&
            sn <= plan.endSerial &&
            matchesGenderLabel(v.gender, plan.gender)
          );
        });
        for (let i = 0; i < matched.length; i += 400) {
          const batch = writeBatch(db);
          matched.slice(i, i + 400).forEach((v) => {
            batch.update(doc(db, 'voters_data', v.id), {
              buildingName: '',
              roomNumber: '',
            });
          });
          await batch.commit();
        }
      }

      try {
        await deleteDoc(doc(db, 'seat_plans', plan.id));
      } catch {
        const next = plans.filter((p) => p.id !== plan.id);
        setPlans(next);
        writeLocalSeatPlans(next);
      }

      onSeatPlanUpdated?.(plan.centerId);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'আসন বিন্যাস মুছতে সমস্যা হয়েছে।',
      });
    } finally {
      setDeletingPlanId(null);
    }
  };

  if (!showTable && !isModalOpen) {
    return null;
  }

  return (
    <div className={showTable ? 'space-y-6' : ''}>
      {/* Saved Seat Plans Table Section */}
      {showTable && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#0B6E5C] shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                সংরক্ষিত কেন্দ্রভিত্তিক আসন বিন্যাস
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                এখানে সংরক্ষিত ভবন ও কক্ষ নম্বর ভোটার স্লিপে স্বয়ংক্রিয়ভাবে যুক্ত হয়।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B6E5C] rounded-full hover:bg-[#09594b] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            নতুন আসন বিন্যাস যোগ করুন
          </button>
        </div>

        {loadingPlans ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-[#0B6E5C]" />
            আসন বিন্যাস লোড হচ্ছে...
          </div>
        ) : plans.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900">
              এখনো কোনো আসন বিন্যাস সংরক্ষণ করা হয়নি
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              কেন্দ্রের ভবনের নাম, কক্ষ নম্বর ও ক্রমিক রেঞ্জ নির্ধারণ করতে উপরের বাটনে ক্লিক করুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="py-2.5 px-4">এলাকা কোড ও কেন্দ্র</th>
                  <th className="py-2.5 px-3">ভবনের নাম</th>
                  <th className="py-2.5 px-3">কক্ষ নম্বর</th>
                  <th className="py-2.5 px-3">লিঙ্গ</th>
                  <th className="py-2.5 px-3">ক্রমিক রেঞ্জ</th>
                  <th className="py-2.5 px-3 text-right">হালনাগাদকৃত ভোটার</th>
                  <th className="py-2.5 px-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{plan.centerName}</div>
                      <div className="text-[11px] text-slate-500">
                        কোড: {plan.voterAreaCode ? toBanglaDigits(plan.voterAreaCode) : '—'} ·
                        ওয়ার্ড: {toBanglaDigits(plan.ward)}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {plan.buildingName}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 tabular-nums">
                      {toBanglaDigits(plan.roomNumber)}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{plan.gender}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-700">
                      {toBanglaDigits(plan.startSerial)} – {toBanglaDigits(plan.endSerial)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-slate-800">
                      {formatBnNumber(plan.updatedCount)} জন
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditPlan(plan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#0B6E5C] bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          এডিট
                        </button>
                        <button
                          type="button"
                          disabled={deletingPlanId === plan.id}
                          onClick={() => handleDeletePlan(plan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          {deletingPlanId === plan.id ? 'মুছছে...' : 'ডিলিট'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* Seat Plan Modal Dialog (Matching Screenshot 2 Design) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="seat-plan-modal-title"
        >
          <div className="w-full max-w-md bg-[#F6F2F8] border border-slate-200 rounded-[28px] p-6 sm:p-7 shadow-xl space-y-5">
            {/* Modal Title */}
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-[#0B6E5C] shrink-0" />
              <h2
                id="seat-plan-modal-title"
                className="text-xl font-semibold text-slate-900 leading-snug"
              >
                কেন্দ্রভিত্তিক ভবন ও কক্ষ বিন্যাস
              </h2>
            </div>

            {feedback && (
              <div
                className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
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

            <form onSubmit={handleSaveSeatPlan} className="space-y-4">
              {/* Voter Area Code Dropdown */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ভোটার এলাকা কোড নির্বাচন করুন *
                </label>
                <select
                  required
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent border border-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B6E5C] focus:border-[#0B6E5C] text-slate-900"
                >
                  <option value="">এলাকা কোড নির্বাচন করুন...</option>
                  {sortedCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      কোড: {c.voterAreaCode ? toBanglaDigits(c.voterAreaCode) : '—'} (ওয়ার্ড:{' '}
                      {toBanglaDigits(c.ward)}, {c.centerName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Building Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ভবনের নাম
                </label>
                <input
                  type="text"
                  required
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="ভবনের নাম (যেমন: পুরাতন ভবন)"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent border border-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B6E5C] focus:border-[#0B6E5C] text-slate-900 placeholder:text-slate-500"
                />
              </div>

              {/* Room Number */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  কক্ষ নম্বর
                </label>
                <input
                  type="text"
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="কক্ষ নম্বর (যেমন: ০৪)"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent border border-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B6E5C] focus:border-[#0B6E5C] text-slate-900 placeholder:text-slate-500"
                />
              </div>

              {/* Gender Selection Pill Buttons */}
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-800">
                  লিঙ্গ নির্বাচন করুন:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {(['পুরুষ', 'মহিলা'] as const).map((g) => {
                    const active = gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`py-2 px-4 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0B6E5C] text-white border border-[#0B6E5C]'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Serial Number Range */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    শুরুর ক্রমিক
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={startSerial}
                    onChange={(e) => setStartSerial(e.target.value)}
                    placeholder="শুরুর ক্রমিক"
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-transparent border border-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B6E5C] text-slate-900 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    শেষ ক্রমিক
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={endSerial}
                    onChange={(e) => setEndSerial(e.target.value)}
                    placeholder="শেষ ক্রমিক"
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-transparent border border-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B6E5C] text-slate-900 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Bottom Action Row: বাতিল — সংরক্ষণ করুন */}
              <div className="pt-2 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onCloseModal();
                  }}
                  className="px-4 py-2 text-sm font-semibold text-[#0B6E5C] hover:text-[#084f42] transition-colors cursor-pointer whitespace-nowrap"
                >
                  বাতিল
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0B6E5C] rounded-full hover:bg-[#09594b] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>

            {/* Bottom Right Close Button */}
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onCloseModal();
                }}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold text-[#0B6E5C] hover:text-[#084f42] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
