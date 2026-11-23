import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Search,
  Printer,
  Plus,
  Check,
  Users,
  MapPin,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Building2,
  Share2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { PollingCenter, UserRequest, VoterRecord } from '../types/schema';
import { formatBnNumber, normalizeSearchText, toBanglaDigits } from '../utils/slipHelpers';

interface VoterSearchWorkspaceProps {
  userRequest: UserRequest | null;
  queuedIds: Set<string>;
  onToggleQueue: (voter: VoterRecord) => void;
  onAddManyToQueue: (voters: VoterRecord[]) => void;
  onQuickPrintSingle: (voter: VoterRecord) => void;
  onShareSingle?: (voter: VoterRecord) => void;
  onOpenPrintStudio: () => void;
  refreshKey?: number;
  onCentersLoaded?: (centers: PollingCenter[]) => void;
  onVotersUpdated?: (voters: VoterRecord[]) => void;
  onOpenSeatPlanModal?: (centerId?: string) => void;
  canManageSeatPlan?: boolean;
}

const PAGE_SIZE = 50;

const GENDER_FILTER_LABELS: Record<'all' | 'male' | 'female', string> = {
  all: 'সকল',
  male: 'পুরুষ',
  female: 'মহিলা',
};

export function VoterSearchWorkspace({
  userRequest,
  queuedIds,
  onToggleQueue,
  onAddManyToQueue,
  onQuickPrintSingle,
  onShareSingle,
  onOpenPrintStudio,
  refreshKey = 0,
  onCentersLoaded,
  onVotersUpdated,
  onOpenSeatPlanModal,
  canManageSeatPlan = false,
}: VoterSearchWorkspaceProps) {
  const [centers, setCenters] = useState<PollingCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [centersError, setCentersError] = useState<string | null>(null);

  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [union, setUnion] = useState('');
  const [ward, setWard] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('');

  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [page, setPage] = useState(1);

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [globalVoterNo, setGlobalVoterNo] = useState('');
  const [globalSearching, setGlobalSearching] = useState(false);
  const [isGlobalMode, setIsGlobalMode] = useState(false);

  // Load polling centers directory
  useEffect(() => {
    let active = true;

    async function fetchCenters() {
      setLoadingCenters(true);
      setCentersError(null);
      try {
        const snap = await getDocs(collection(db, 'centers_list'));
        if (!active) return;
        const list: PollingCenter[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PollingCenter, 'id'>),
        }));
        list.sort((a, b) => a.centerName.localeCompare(b.centerName));
        setCenters(list);
        onCentersLoaded?.(list);
      } catch (err) {
        // Fallback to user's assigned area if rules enforce scoped reads
        if (userRequest?.division && userRequest?.district && userRequest?.upazila) {
          try {
            const scopedQ = query(
              collection(db, 'centers_list'),
              where('division', '==', userRequest.division),
              where('district', '==', userRequest.district),
              where('upazila', '==', userRequest.upazila)
            );
            const scopedSnap = await getDocs(scopedQ);
            if (!active) return;
            const list: PollingCenter[] = scopedSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<PollingCenter, 'id'>),
            }));
            list.sort((a, b) => a.centerName.localeCompare(b.centerName));
            setCenters(list);
            onCentersLoaded?.(list);
          } catch (scopedErr) {
            if (!active) return;
            setCentersError(
              scopedErr instanceof Error
                ? scopedErr.message
                : 'ভোটকেন্দ্রের তালিকা লোড করা যায়নি।'
            );
            handleFirestoreError(scopedErr, OperationType.LIST, 'centers_list');
          }
        } else {
          if (!active) return;
          setCentersError(
            err instanceof Error ? err.message : 'ভোটকেন্দ্রের তালিকা লোড করা যায়নি।'
          );
          handleFirestoreError(err, OperationType.LIST, 'centers_list');
        }
      } finally {
        if (active) setLoadingCenters(false);
      }
    }

    fetchCenters();
    return () => {
      active = false;
    };
  }, [userRequest?.division, userRequest?.district, userRequest?.upazila]);

  // Auto-select user's assigned area once centers load (if matching)
  useEffect(() => {
    if (centers.length === 0 || division || selectedCenterId) return;
    if (userRequest?.division) {
      const hasDiv = centers.some((c) => c.division === userRequest.division);
      if (hasDiv) {
        setDivision(userRequest.division);
        const hasDist = centers.some(
          (c) => c.division === userRequest.division && c.district === userRequest.district
        );
        if (hasDist) {
          setDistrict(userRequest.district);
          const hasUpz = centers.some(
            (c) =>
              c.division === userRequest.division &&
              c.district === userRequest.district &&
              c.upazila === userRequest.upazila
          );
          if (hasUpz) {
            setUpazila(userRequest.upazila);
            const matchingCenters = centers.filter(
              (c) =>
                c.division === userRequest.division &&
                c.district === userRequest.district &&
                c.upazila === userRequest.upazila &&
                (!userRequest.union || c.union === userRequest.union)
            );
            if (matchingCenters.length === 1) {
              setUnion(matchingCenters[0].union);
              setWard(matchingCenters[0].ward);
              setSelectedCenterId(matchingCenters[0].id);
            }
          }
        }
      }
    } else if (centers.length === 1) {
      const only = centers[0];
      setDivision(only.division);
      setDistrict(only.district);
      setUpazila(only.upazila);
      setUnion(only.union);
      setWard(only.ward);
      setSelectedCenterId(only.id);
    }
  }, [centers, userRequest, division, selectedCenterId]);

  // Cascading filter options
  const divisions = useMemo(
    () => Array.from(new Set(centers.map((c) => c.division))).sort(),
    [centers]
  );

  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          centers
            .filter((c) => !division || c.division === division)
            .map((c) => c.district)
        )
      ).sort(),
    [centers, division]
  );

  const upazilas = useMemo(
    () =>
      Array.from(
        new Set(
          centers
            .filter(
              (c) =>
                (!division || c.division === division) &&
                (!district || c.district === district)
            )
            .map((c) => c.upazila)
        )
      ).sort(),
    [centers, division, district]
  );

  const unions = useMemo(
    () =>
      Array.from(
        new Set(
          centers
            .filter(
              (c) =>
                (!division || c.division === division) &&
                (!district || c.district === district) &&
                (!upazila || c.upazila === upazila)
            )
            .map((c) => c.union)
        )
      ).sort(),
    [centers, division, district, upazila]
  );

  const wards = useMemo(
    () =>
      Array.from(
        new Set(
          centers
            .filter(
              (c) =>
                (!division || c.division === division) &&
                (!district || c.district === district) &&
                (!upazila || c.upazila === upazila) &&
                (!union || c.union === union)
            )
            .map((c) => c.ward)
        )
      ).sort(),
    [centers, division, district, upazila, union]
  );

  const filteredCenters = useMemo(
    () =>
      centers.filter(
        (c) =>
          (!division || c.division === division) &&
          (!district || c.district === district) &&
          (!upazila || c.upazila === upazila) &&
          (!union || c.union === union) &&
          (!ward || c.ward === ward)
      ),
    [centers, division, district, upazila, union, ward]
  );

  const activeCenter = useMemo(
    () => centers.find((c) => c.id === selectedCenterId) ?? null,
    [centers, selectedCenterId]
  );

  // Fetch voters when a center is selected
  useEffect(() => {
    if (!selectedCenterId) {
      if (!isGlobalMode) setVoters([]);
      return;
    }

    let active = true;
    setIsGlobalMode(false);

    async function fetchVotersByCenter() {
      setLoadingVoters(true);
      setVotersError(null);
      setPage(1);
      try {
        const q = query(
          collection(db, 'voters_data'),
          where('centerId', '==', selectedCenterId)
        );
        const snap = await getDocs(q);
        if (!active) return;
        const rows: VoterRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VoterRecord, 'id'>),
        }));
        rows.sort((a, b) => (a.serialNumeric ?? 0) - (b.serialNumeric ?? 0));
        setVoters(rows);
        onVotersUpdated?.(rows);
      } catch (err) {
        if (!active) return;
        setVotersError(
          err instanceof Error
            ? err.message
            : 'এই ভোটকেন্দ্রের ভোটার তালিকা লোড করা যায়নি।'
        );
        handleFirestoreError(err, OperationType.LIST, `voters_data?centerId=${selectedCenterId}`);
      } finally {
        if (active) setLoadingVoters(false);
      }
    }

    fetchVotersByCenter();
    return () => {
      active = false;
    };
  }, [selectedCenterId, refreshKey]);

  const handleGlobalVoterLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = globalVoterNo.trim();
    if (!trimmed) return;

    setGlobalSearching(true);
    setVotersError(null);
    setIsGlobalMode(true);
    setSelectedCenterId('');
    setPage(1);

    try {
      const q = query(collection(db, 'voters_data'), where('voterNo', '==', trimmed));
      const snap = await getDocs(q);
      const rows: VoterRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VoterRecord, 'id'>),
      }));
      rows.sort((a, b) => (a.serialNumeric ?? 0) - (b.serialNumeric ?? 0));
      setVoters(rows);
    } catch (err) {
      setVotersError(err instanceof Error ? err.message : 'ভোটার নম্বর অনুসন্ধান ব্যর্থ হয়েছে।');
      handleFirestoreError(err, OperationType.LIST, `voters_data?voterNo=${trimmed}`);
    } finally {
      setGlobalSearching(false);
    }
  };

  const resetAreaFilters = () => {
    setDivision('');
    setDistrict('');
    setUpazila('');
    setUnion('');
    setWard('');
    setSelectedCenterId('');
    setIsGlobalMode(false);
    setVoters([]);
  };

  // Client-side instant filtering across Bangla & English text
  const filteredVoters = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return voters.filter((v) => {
      if (genderFilter !== 'all') {
        const g = (v.gender || '').toLowerCase();
        const isMale = (g.includes('male') && !g.includes('female')) || g.includes('পুরুষ');
        const isFemale = g.includes('female') || g.includes('মহিলা') || g.includes('নারী');
        if (genderFilter === 'male' && !isMale) return false;
        if (genderFilter === 'female' && !isFemale) return false;
      }

      if (!q) return true;
      const haystack = [
        v.name,
        v.voterNo,
        v.serialNo,
        v.fatherName,
        v.motherName,
        v.address,
        v.dateOfBirth,
      ]
        .map(normalizeSearchText)
        .join(' ');
      return haystack.includes(q);
    });
  }, [voters, searchQuery, genderFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, genderFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVoters.length / PAGE_SIZE));
  const pagedVoters = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredVoters.slice(start, start + PAGE_SIZE);
  }, [filteredVoters, page]);

  const handleAddRange = () => {
    const startNum = parseInt(rangeStart, 10);
    const endNum = parseInt(rangeEnd, 10);
    if (Number.isNaN(startNum) || Number.isNaN(endNum)) return;
    const min = Math.min(startNum, endNum);
    const max = Math.max(startNum, endNum);
    const matched = filteredVoters.filter(
      (v) => v.serialNumeric >= min && v.serialNumeric <= max
    );
    if (matched.length > 0) {
      onAddManyToQueue(matched);
      setRangeStart('');
      setRangeEnd('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Area & Polling Center Selector */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
            <h1 className="text-base font-semibold text-slate-900">
              ভোটকেন্দ্র ডিরেক্টরি ও এলাকা নির্বাচন
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <form onSubmit={handleGlobalVoterLookup} className="flex items-center gap-2">
              <input
                type="text"
                value={globalVoterNo}
                onChange={(e) => setGlobalVoterNo(e.target.value)}
                placeholder="সরাসরি ভোটার নম্বর লিখুন..."
                className="w-48 sm:w-56 px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={globalSearching || !globalVoterNo.trim()}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {globalSearching ? 'খোঁজা হচ্ছে...' : 'ভোটার নম্বর খুঁজুন'}
              </button>
            </form>

            {(division || selectedCenterId || isGlobalMode) && (
              <button
                type="button"
                onClick={resetAreaFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                রিসেট
              </button>
            )}
          </div>
        </div>

        {centersError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{centersError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">বিভাগ</label>
            <select
              value={division}
              disabled={loadingCenters}
              onChange={(e) => {
                setDivision(e.target.value);
                setDistrict('');
                setUpazila('');
                setUnion('');
                setWard('');
                setSelectedCenterId('');
              }}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">সকল বিভাগ</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">জেলা</label>
            <select
              value={district}
              disabled={loadingCenters}
              onChange={(e) => {
                setDistrict(e.target.value);
                setUpazila('');
                setUnion('');
                setWard('');
                setSelectedCenterId('');
              }}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">সকল জেলা</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">উপজেলা / থানা</label>
            <select
              value={upazila}
              disabled={loadingCenters}
              onChange={(e) => {
                setUpazila(e.target.value);
                setUnion('');
                setWard('');
                setSelectedCenterId('');
              }}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">সকল উপজেলা</option>
              {upazilas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ইউনিয়ন / পৌরসভা
            </label>
            <select
              value={union}
              disabled={loadingCenters}
              onChange={(e) => {
                setUnion(e.target.value);
                setWard('');
                setSelectedCenterId('');
              }}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">সকল ইউনিয়ন</option>
              {unions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ওয়ার্ড</label>
            <select
              value={ward}
              disabled={loadingCenters}
              onChange={(e) => {
                setWard(e.target.value);
                setSelectedCenterId('');
              }}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">সকল ওয়ার্ড</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ভোটকেন্দ্র ({formatBnNumber(filteredCenters.length)})
            </label>
            <select
              value={selectedCenterId}
              disabled={loadingCenters}
              onChange={(e) => setSelectedCenterId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">
                {loadingCenters ? 'কেন্দ্র লোড হচ্ছে...' : 'ভোটকেন্দ্র নির্বাচন করুন'}
              </option>
              {filteredCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.centerName} ({formatBnNumber(c.totalVoters)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Center Summary Strip */}
        {activeCenter && (
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            <div className="col-span-2">
              <div className="text-slate-500">নির্বাচিত ভোটকেন্দ্র</div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                {activeCenter.centerName}
              </div>
              <div className="text-slate-600 mt-0.5">
                {activeCenter.union} · ওয়ার্ড {activeCenter.ward}
                {activeCenter.voterAreaCode
                  ? ` · এলাকা কোড ${activeCenter.voterAreaCode}`
                  : ''}
              </div>
            </div>
            <div>
              <div className="text-slate-500">মোট ভোটার</div>
              <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                {formatBnNumber(activeCenter.totalVoters)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">পুরুষ ভোটার</div>
              <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                {formatBnNumber(activeCenter.maleCount)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">মহিলা ভোটার</div>
              <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                {formatBnNumber(activeCenter.femaleCount)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Voter Search & Results Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Search & Batch Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={voters.length === 0}
                placeholder="ভোটারের নাম, ভোটার নম্বর, ক্রমিক, পিতা-মাতার নাম বা ঠিকানা দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenderFilter(g)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      genderFilter === g
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {GENDER_FILTER_LABELS[g]}
                  </button>
                ))}
              </div>

              {canManageSeatPlan && onOpenSeatPlanModal && (
                <button
                  type="button"
                  onClick={() => onOpenSeatPlanModal(selectedCenterId || undefined)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B6E5C] bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  ভবন ও কক্ষ বিন্যাস
                </button>
              )}

              {queuedIds.size > 0 && (
                <button
                  type="button"
                  onClick={onOpenPrintStudio}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট স্টুডিও ({formatBnNumber(queuedIds.size)})
                </button>
              )}
            </div>
          </div>

          {filteredVoters.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="text-slate-600 tabular-nums">
                মোট {formatBnNumber(filteredVoters.length)} জন ভোটারের মধ্যে{' '}
                {formatBnNumber(pagedVoters.length)} জন দেখানো হচ্ছে
                {isGlobalMode ? ' (ভোটার নম্বর অনুযায়ী অনুসন্ধান)' : ''}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500">ক্রমিক নম্বর অনুযায়ী যোগ করুন:</span>
                <input
                  type="number"
                  min={1}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  placeholder="শুরু"
                  className="w-20 px-2 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <span className="text-slate-400">–</span>
                <input
                  type="number"
                  min={1}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  placeholder="শেষ"
                  className="w-20 px-2 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={handleAddRange}
                  disabled={!rangeStart || !rangeEnd}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  রেঞ্জ যোগ করুন
                </button>
                <button
                  type="button"
                  onClick={() => onAddManyToQueue(pagedVoters)}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                >
                  পুরো পৃষ্ঠা যোগ করুন ({formatBnNumber(pagedVoters.length)})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table Body / Empty / Loading States */}
        {votersError && (
          <div className="p-6 flex items-start gap-2.5 text-sm text-red-800 bg-red-50">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{votersError}</span>
          </div>
        )}

        {loadingVoters || globalSearching ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
            <p className="text-sm">ভোটার তালিকা লোড হচ্ছে...</p>
          </div>
        ) : !selectedCenterId && !isGlobalMode ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-sm font-semibold text-slate-900">
              ভোটার তালিকা দেখতে একটি ভোটকেন্দ্র নির্বাচন করুন
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              উপরের বিভাগ, জেলা, উপজেলা, ইউনিয়ন ও ওয়ার্ড ফিল্টার ব্যবহার করুন অথবা সরাসরি ভোটার নম্বর লিখে অনুসন্ধান করুন।
            </p>
          </div>
        ) : filteredVoters.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Search className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-sm font-semibold text-slate-900">কোনো ভোটার পাওয়া যায়নি</h2>
            <p className="text-xs text-slate-500">
              সার্চ বক্স খালি করে অথবা লিঙ্গ ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <th className="py-2.5 px-4 w-10">তালিকা</th>
                    <th className="py-2.5 px-3">ক্রমিক নং</th>
                    <th className="py-2.5 px-3">ভোটার নম্বর</th>
                    <th className="py-2.5 px-3">ভোটারের নাম</th>
                    <th className="py-2.5 px-3">পিতা / মাতা</th>
                    <th className="py-2.5 px-3">জন্ম তারিখ · লিঙ্গ</th>
                    <th className="py-2.5 px-3">ভবন ও কক্ষ</th>
                    <th className="py-2.5 px-3">ঠিকানা</th>
                    <th className="py-2.5 px-4 text-right">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {pagedVoters.map((voter) => {
                    const inQueue = queuedIds.has(voter.id);
                    return (
                      <tr
                        key={voter.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          inQueue ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => onToggleQueue(voter)}
                            aria-label={
                              inQueue
                                ? `${voter.name}-কে প্রিন্ট তালিকা থেকে সরান`
                                : `${voter.name}-কে প্রিন্ট তালিকায় যোগ করুন`
                            }
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                              inQueue
                                ? 'bg-emerald-700 border-emerald-700 text-white'
                                : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                            }`}
                          >
                            {inQueue ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap">
                          {voter.serialNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {voter.voterNo}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 min-w-[160px]">
                          <div>{voter.name}</div>
                          {isGlobalMode && (
                            <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                              {voter.centerName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 min-w-[180px]">
                          <div>{voter.fatherName || '—'}</div>
                          <div className="text-[11px] text-slate-500">
                            {voter.motherName || '—'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          <div className="font-mono tabular-nums">{voter.dateOfBirth || '—'}</div>
                          <div className="text-[11px] text-slate-500">{voter.gender || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          <div className="font-medium text-slate-900">
                            {voter.buildingName?.trim() || '—'}
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {voter.roomNumber?.trim()
                              ? `কক্ষ: ${toBanglaDigits(voter.roomNumber.trim())}`
                              : 'কক্ষ নির্ধারিত নয়'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate">
                          {voter.address || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {onShareSingle && (
                              <button
                                type="button"
                                onClick={() => onShareSingle(voter)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                রঙিন শেয়ার
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onQuickPrintSingle(voter)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              স্লিপ প্রিন্ট
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="tabular-nums">
                  পৃষ্ঠা {formatBnNumber(page)} / {formatBnNumber(totalPages)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    পূর্ববর্তী
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    পরবর্তী
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
