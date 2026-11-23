import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Ban,
  Clock,
  Search,
  Trash2,
  Upload,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  PollingCenter,
  UserRequest,
  UserRequestStatus,
} from '../types/schema';
import {
  formatBnNumber,
  formatIsoDateShort,
  toFirestoreMillis,
} from '../utils/slipHelpers';
import { SeatPlanManager } from './SeatPlanManager';

interface AdminConsoleViewProps {
  adminUid: string;
  onCentersLoaded?: (centers: PollingCenter[]) => void;
  onSeatPlanUpdated?: (centerId: string) => void;
}

interface RawVoterImportRow {
  serialNo?: string | number;
  serialNumeric?: number;
  name?: string;
  voterNo?: string;
  fatherName?: string;
  motherName?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  occupation?: string;
  buildingName?: string;
  roomNumber?: string;
}

const REQUEST_STATUS_FILTERS: { id: 'all' | UserRequestStatus; label: string }[] = [
  { id: 'all', label: 'সকল' },
  { id: 'pending', label: 'অপেক্ষমাণ' },
  { id: 'approved', label: 'অনুমোদিত' },
  { id: 'blocked', label: 'স্থগিত' },
];

export function AdminConsoleView({
  adminUid,
  onCentersLoaded,
  onSeatPlanUpdated,
}: AdminConsoleViewProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'centers' | 'seatPlans'>('requests');
  const [seatPlanModalOpen, setSeatPlanModalOpen] = useState(false);

  // User Requests state
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | UserRequestStatus>('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Centers state
  const [centers, setCenters] = useState<PollingCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [deletingCenterId, setDeletingCenterId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Import state
  const [showImporter, setShowImporter] = useState(false);
  const [impDivision, setImpDivision] = useState('');
  const [impDistrict, setImpDistrict] = useState('');
  const [impUpazila, setImpUpazila] = useState('');
  const [impUnion, setImpUnion] = useState('');
  const [impWard, setImpWard] = useState('');
  const [impCenterName, setImpCenterName] = useState('');
  const [impAreaCode, setImpAreaCode] = useState('');
  const [impJsonText, setImpJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Subscribe to user_requests
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'user_requests'),
      (snap) => {
        const list: UserRequest[] = snap.docs.map((d) => ({
          ...(d.data() as UserRequest),
          userId: d.id,
        }));
        list.sort((a, b) => toFirestoreMillis(b.updatedAt) - toFirestoreMillis(a.updatedAt));
        setRequests(list);
        setLoadingRequests(false);
      },
      (err) => {
        setLoadingRequests(false);
        handleFirestoreError(err, OperationType.LIST, 'user_requests');
      }
    );
    return () => unsub();
  }, []);

  // Load centers list
  const refreshCenters = async () => {
    setLoadingCenters(true);
    try {
      const snap = await getDocs(collection(db, 'centers_list'));
      const list: PollingCenter[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PollingCenter, 'id'>),
      }));
      list.sort((a, b) => toFirestoreMillis(b.createdAt) - toFirestoreMillis(a.createdAt));
      setCenters(list);
      onCentersLoaded?.(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'centers_list');
    } finally {
      setLoadingCenters(false);
    }
  };

  useEffect(() => {
    refreshCenters();
  }, []);

  const handleUpdateUserStatus = async (userId: string, status: UserRequestStatus) => {
    setUpdatingUid(userId);
    const path = `user_requests/${userId}`;
    try {
      await updateDoc(doc(db, 'user_requests', userId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleDeleteCenter = async (centerId: string) => {
    setDeletingCenterId(centerId);
    try {
      const votersSnap = await getDocs(
        query(collection(db, 'voters_data'), where('centerId', '==', centerId))
      );
      const docs = votersSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      const centerBatch = writeBatch(db);
      centerBatch.delete(doc(db, 'centers_list', centerId));
      await centerBatch.commit();
      setConfirmDeleteId(null);
      await refreshCenters();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `centers_list/${centerId}`);
    } finally {
      setDeletingCenterId(null);
    }
  };

  const handleImportCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportFeedback(null);

    if (
      !impDivision.trim() ||
      !impDistrict.trim() ||
      !impUpazila.trim() ||
      !impUnion.trim() ||
      !impWard.trim() ||
      !impCenterName.trim() ||
      !impJsonText.trim()
    ) {
      setImportFeedback({
        type: 'error',
        text: 'অনুগ্রহ করে কেন্দ্রের সব প্রয়োজনীয় ঘর পূরণ করুন এবং সঠিক JSON তালিকা পেস্ট করুন।',
      });
      return;
    }

    let parsedRows: RawVoterImportRow[];
    try {
      const candidate = JSON.parse(impJsonText);
      if (!Array.isArray(candidate) || candidate.length === 0) {
        throw new Error('JSON অবশ্যই ভোটার তথ্যের একটি অ-শূন্য তালিকা (Array) হতে হবে।');
      }
      parsedRows = candidate;
    } catch (err) {
      setImportFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'JSON ফরম্যাট সঠিক নয়।',
      });
      return;
    }

    setImporting(true);
    try {
      const now = new Date().toISOString();
      const centerRef = doc(collection(db, 'centers_list'));
      const centerId = centerRef.id;

      let maleCount = 0;
      let femaleCount = 0;

      const voterPayloads = parsedRows.map((row, idx) => {
        const serialStr = String(row.serialNo ?? idx + 1);
        const serialNum =
          typeof row.serialNumeric === 'number'
            ? row.serialNumeric
            : parseInt(serialStr.replace(/\D/g, ''), 10) || idx + 1;

        const genderStr = String(row.gender ?? '');
        const gLower = genderStr.toLowerCase();
        if (gLower.includes('female') || gLower.includes('মহিলা') || gLower.includes('নারী')) {
          femaleCount += 1;
        } else if (gLower.includes('male') || gLower.includes('পুরুষ')) {
          maleCount += 1;
        }

        return {
          centerId,
          division: impDivision.trim(),
          district: impDistrict.trim(),
          upazila: impUpazila.trim(),
          union: impUnion.trim(),
          ward: impWard.trim(),
          centerName: impCenterName.trim(),
          voterAreaCode: impAreaCode.trim(),
          serialNo: serialStr,
          serialNumeric: serialNum,
          name: String(row.name ?? ''),
          voterNo: String(row.voterNo ?? ''),
          fatherName: String(row.fatherName ?? ''),
          motherName: String(row.motherName ?? ''),
          gender: genderStr,
          dateOfBirth: String(row.dateOfBirth ?? ''),
          address: String(row.address ?? ''),
          occupation: String(row.occupation ?? ''),
          buildingName: String(row.buildingName ?? ''),
          roomNumber: String(row.roomNumber ?? ''),
          createdAt: now,
        };
      });

      const centerPayload: Omit<PollingCenter, 'id'> = {
        division: impDivision.trim(),
        district: impDistrict.trim(),
        upazila: impUpazila.trim(),
        union: impUnion.trim(),
        ward: impWard.trim(),
        centerName: impCenterName.trim(),
        voterAreaCode: impAreaCode.trim(),
        totalVoters: voterPayloads.length,
        maleCount,
        femaleCount,
        uploadedByUid: adminUid,
        createdAt: now,
        updatedAt: now,
      };

      // Write center metadata first
      const headerBatch = writeBatch(db);
      headerBatch.set(centerRef, centerPayload);
      await headerBatch.commit();

      // Write voter records in chunks of 400
      for (let i = 0; i < voterPayloads.length; i += 400) {
        const batch = writeBatch(db);
        voterPayloads.slice(i, i + 400).forEach((vp) => {
          const vRef = doc(collection(db, 'voters_data'));
          batch.set(vRef, vp);
        });
        await batch.commit();
      }

      setImportFeedback({
        type: 'success',
        text: `"${impCenterName.trim()}" কেন্দ্রে ${formatBnNumber(
          voterPayloads.length
        )} জন ভোটারের তথ্য সফলভাবে আপলোড হয়েছে।`,
      });
      setImpCenterName('');
      setImpAreaCode('');
      setImpJsonText('');
      await refreshCenters();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'centers_list / voters_data');
    } finally {
      setImporting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.phone, r.division, r.district, r.upazila, r.union, r.paymentNote]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [requests, statusFilter, requestSearch]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      blocked: requests.filter((r) => r.status === 'blocked').length,
    };
  }, [requests]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">অ্যাডমিনিস্ট্রেটর কনসোল</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            ব্যবহারকারীর সক্রিয়করণ আবেদন অনুমোদন করুন এবং ভোটকেন্দ্রের ডাটাবেস পরিচালনা করুন।
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সক্রিয়করণের আবেদন ({formatBnNumber(counts.pending)}টি অপেক্ষমাণ)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('centers')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'centers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ভোটকেন্দ্রসমূহ ({formatBnNumber(centers.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('seatPlans')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'seatPlans'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            আসন বিন্যাস
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                placeholder="নাম, মোবাইল, এলাকা বা TrxID দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {REQUEST_STATUS_FILTERS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === st.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label} ({formatBnNumber(counts[st.id])})
                </button>
              ))}
            </div>
          </div>

          {loadingRequests ? (
            <div className="p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
              আবেদন তালিকা লোড হচ্ছে...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              আপনার ফিল্টার অনুযায়ী কোনো আবেদন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <th className="py-2.5 px-4">আবেদনকারী</th>
                    <th className="py-2.5 px-3">এলাকা</th>
                    <th className="py-2.5 px-3">পেমেন্ট নোট</th>
                    <th className="py-2.5 px-3">অবস্থা</th>
                    <th className="py-2.5 px-3">হালনাগাদ</th>
                    <th className="py-2.5 px-4 text-right">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredRequests.map((req) => (
                    <tr key={req.userId} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{req.name}</div>
                        <div className="font-mono tabular-nums text-slate-600">{req.phone}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div>
                          {req.union}, ওয়ার্ড {req.ward}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {req.upazila} · {req.district} · {req.division}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-[200px] break-words">
                        {req.paymentNote}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {req.status === 'approved' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-800">অনুমোদিত</span>
                            </>
                          ) : req.status === 'blocked' ? (
                            <>
                              <Ban className="w-3.5 h-3.5 text-red-600" />
                              <span className="text-red-700">স্থগিত</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span className="text-amber-800">অপেক্ষমাণ</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-slate-500 whitespace-nowrap">
                        {formatIsoDateShort(req.updatedAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {req.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={updatingUid === req.userId}
                              onClick={() => handleUpdateUserStatus(req.userId, 'approved')}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                            >
                              অনুমোদন দিন
                            </button>
                          )}
                          {req.status !== 'blocked' && (
                            <button
                              type="button"
                              disabled={updatingUid === req.userId}
                              onClick={() => handleUpdateUserStatus(req.userId, 'blocked')}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                            >
                              ব্লক করুন
                            </button>
                          )}
                          {req.status !== 'pending' && (
                            <button
                              type="button"
                              disabled={updatingUid === req.userId}
                              onClick={() => handleUpdateUserStatus(req.userId, 'pending')}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                            >
                              অপেক্ষমাণ রাখুন
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : activeTab === 'seatPlans' ? (
        <SeatPlanManager
          centers={centers}
          currentUserId={adminUid}
          isModalOpen={seatPlanModalOpen}
          onOpenModal={() => setSeatPlanModalOpen(true)}
          onCloseModal={() => setSeatPlanModalOpen(false)}
          onSeatPlanUpdated={onSeatPlanUpdated}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowImporter((s) => !s)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {showImporter ? 'JSON আমদানি প্যানেল বন্ধ করুন' : 'নতুন কেন্দ্রের JSON আপলোড করুন'}
            </button>
          </div>

          {showImporter && (
            <form
              onSubmit={handleImportCenter}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  ভোটকেন্দ্র ও ভোটার তালিকা আমদানি করুন
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  অ্যান্ড্রয়েড অ্যাপের মূল ডাটাবেস কাঠামো অনুযায়ী সরাসরি{' '}
                  <code className="font-mono">centers_list</code> ও{' '}
                  <code className="font-mono">voters_data</code>-তে সংরক্ষণ হবে।
                </p>
              </div>

              {importFeedback && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
                    importFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importFeedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={impDivision}
                  onChange={(e) => setImpDivision(e.target.value)}
                  placeholder="বিভাগ *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impDistrict}
                  onChange={(e) => setImpDistrict(e.target.value)}
                  placeholder="জেলা *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impUpazila}
                  onChange={(e) => setImpUpazila(e.target.value)}
                  placeholder="উপজেলা *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impUnion}
                  onChange={(e) => setImpUnion(e.target.value)}
                  placeholder="ইউনিয়ন / পৌরসভা *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impWard}
                  onChange={(e) => setImpWard(e.target.value)}
                  placeholder="ওয়ার্ড *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impCenterName}
                  onChange={(e) => setImpCenterName(e.target.value)}
                  placeholder="ভোটকেন্দ্রের নাম *"
                  className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={impAreaCode}
                  onChange={(e) => setImpAreaCode(e.target.value)}
                  placeholder="ভোটার এলাকা কোড"
                  className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ভোটার তালিকা JSON (ফিল্ডসমূহ: serialNo, name, voterNo, fatherName, motherName, gender, dateOfBirth, address, occupation)
                </label>
                <textarea
                  rows={5}
                  required
                  value={impJsonText}
                  onChange={(e) => setImpJsonText(e.target.value)}
                  placeholder='[{"serialNo":"0001","name":"মোঃ রহিম মিয়া","voterNo":"1234567890123","fatherName":"...","motherName":"...","gender":"পুরুষ","dateOfBirth":"01/01/1985","address":"...","occupation":"কৃষি"}]'
                  className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
                >
                  {importing ? 'আপলোড হচ্ছে...' : 'কেন্দ্র ও ভোটার তালিকা আপলোড করুন'}
                </button>
              </div>
            </form>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingCenters ? (
              <div className="p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                ভোটকেন্দ্রের তালিকা লোড হচ্ছে...
              </div>
            ) : centers.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                এখনো কোনো ভোটকেন্দ্র আপলোড করা হয়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                      <th className="py-2.5 px-4">ভোটকেন্দ্রের নাম</th>
                      <th className="py-2.5 px-3">প্রশাসনিক এলাকা</th>
                      <th className="py-2.5 px-3 text-right">মোট ভোটার</th>
                      <th className="py-2.5 px-3 text-right">পুরুষ</th>
                      <th className="py-2.5 px-3 text-right">মহিলা</th>
                      <th className="py-2.5 px-4 text-right">পদক্ষেপ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {centers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{c.centerName}</div>
                          {c.voterAreaCode && (
                            <div className="text-[11px] font-mono text-slate-500">
                              কোড: {c.voterAreaCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div>
                            {c.union}, ওয়ার্ড {c.ward}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.upazila} · {c.district} · {c.division}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatBnNumber(c.totalVoters)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatBnNumber(c.maleCount)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatBnNumber(c.femaleCount)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {confirmDeleteId === c.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deletingCenterId === c.id}
                                onClick={() => handleDeleteCenter(c.id)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                              >
                                {deletingCenterId === c.id ? 'মুছে ফেলা হচ্ছে...' : 'নিশ্চিত করুন'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                              >
                                বাতিল
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              মুছুন
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
