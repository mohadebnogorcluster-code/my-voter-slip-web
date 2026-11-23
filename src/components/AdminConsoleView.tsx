import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
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
import { formatIsoDateShort } from '../utils/slipHelpers';

interface AdminConsoleViewProps {
  adminUid: string;
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
}

export function AdminConsoleView({ adminUid }: AdminConsoleViewProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'centers'>('requests');

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
        list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
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
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setCenters(list);
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
        updatedAt: new Date().toISOString(),
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
        text: 'Complete all center fields and paste a valid JSON array of voters.',
      });
      return;
    }

    let parsedRows: RawVoterImportRow[];
    try {
      const candidate = JSON.parse(impJsonText);
      if (!Array.isArray(candidate) || candidate.length === 0) {
        throw new Error('JSON must be a non-empty array of voter objects.');
      }
      parsedRows = candidate;
    } catch (err) {
      setImportFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Invalid JSON format.',
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
        text: `Imported "${impCenterName.trim()}" with ${voterPayloads.length} voter records.`,
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
          <h1 className="text-lg font-semibold text-slate-900">Administrator Console</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Approve user activation requests and manage polling center datasets.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activation Requests ({counts.pending} pending)
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
            Polling Centers ({centers.length})
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
                placeholder="Filter by name, phone, area, or TrxID..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'pending', 'approved', 'blocked'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st} ({counts[st]})
                </button>
              ))}
            </div>
          </div>

          {loadingRequests ? (
            <div className="p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
              Loading requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No activation requests match your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Applicant</th>
                    <th className="py-2.5 px-3">Area</th>
                    <th className="py-2.5 px-3">Payment Note</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Updated</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
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
                          {req.union}, Ward {req.ward}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {req.upazila} · {req.district} · {req.division}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-[200px] break-words">
                        {req.paymentNote}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium capitalize">
                          {req.status === 'approved' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-800">Approved</span>
                            </>
                          ) : req.status === 'blocked' ? (
                            <>
                              <Ban className="w-3.5 h-3.5 text-red-600" />
                              <span className="text-red-700">Blocked</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span className="text-amber-800">Pending</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
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
                              Approve
                            </button>
                          )}
                          {req.status !== 'blocked' && (
                            <button
                              type="button"
                              disabled={updatingUid === req.userId}
                              onClick={() => handleUpdateUserStatus(req.userId, 'blocked')}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                            >
                              Block
                            </button>
                          )}
                          {req.status !== 'pending' && (
                            <button
                              type="button"
                              disabled={updatingUid === req.userId}
                              onClick={() => handleUpdateUserStatus(req.userId, 'pending')}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                            >
                              Set Pending
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
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowImporter((s) => !s)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {showImporter ? 'Close JSON Importer' : 'Import Center Voter JSON'}
            </button>
          </div>

          {showImporter && (
            <form
              onSubmit={handleImportCenter}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Import Polling Center &amp; Voter Records
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Writes directly to <code className="font-mono">centers_list</code> and{' '}
                  <code className="font-mono">voters_data</code> using the Android schema.
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
                  placeholder="Division *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impDistrict}
                  onChange={(e) => setImpDistrict(e.target.value)}
                  placeholder="District *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impUpazila}
                  onChange={(e) => setImpUpazila(e.target.value)}
                  placeholder="Upazila *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impUnion}
                  onChange={(e) => setImpUnion(e.target.value)}
                  placeholder="Union *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impWard}
                  onChange={(e) => setImpWard(e.target.value)}
                  placeholder="Ward *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={impCenterName}
                  onChange={(e) => setImpCenterName(e.target.value)}
                  placeholder="Polling Center Name *"
                  className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={impAreaCode}
                  onChange={(e) => setImpAreaCode(e.target.value)}
                  placeholder="Voter Area Code"
                  className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Voter Array JSON (fields: serialNo, name, voterNo, fatherName, motherName, gender, dateOfBirth, address, occupation)
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {importing ? 'Uploading Batches...' : 'Upload Center & Voters'}
                </button>
              </div>
            </form>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingCenters ? (
              <div className="p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                Loading polling centers...
              </div>
            ) : centers.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No polling centers uploaded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Center Name</th>
                      <th className="py-2.5 px-3">Administrative Area</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-right">Male</th>
                      <th className="py-2.5 px-3 text-right">Female</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {centers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{c.centerName}</div>
                          {c.voterAreaCode && (
                            <div className="text-[11px] font-mono text-slate-500">
                              Code: {c.voterAreaCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div>
                            {c.union}, Ward {c.ward}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.upazila} · {c.district} · {c.division}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {c.totalVoters.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {c.maleCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {c.femaleCount.toLocaleString()}
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
                                {deletingCenterId === c.id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
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
