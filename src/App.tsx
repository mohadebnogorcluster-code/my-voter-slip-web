import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Loader2, LogOut, Printer } from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  isSuperAdminEmail,
  OperationType,
  SUPER_ADMIN_EMAIL,
  testConnection,
} from './firebase';
import type { PollingCenter, SlipPrintConfig, UserRequest, VoterRecord } from './types/schema';
import { buildDefaultPrintConfig, formatBnNumber } from './utils/slipHelpers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { ActivationView } from './components/ActivationView';
import { VoterSearchWorkspace } from './components/VoterSearchWorkspace';
import { A4PrintStudio } from './components/A4PrintStudio';
import { SlipSettingsView } from './components/SlipSettingsView';
import { AdminConsoleView } from './components/AdminConsoleView';
import { SeatPlanManager } from './components/SeatPlanManager';
import { DeveloperFooter, SITE_LOGO_SRC } from './components/DeveloperFooter';
import { ShareColorSlipModal } from './components/ShareColorSlipModal';

type ActiveView = 'search' | 'print' | 'seat-plan' | 'settings' | 'admin';

function PortalShell() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const [userRequest, setUserRequest] = useState<UserRequest | null>(null);
  const [requestChecked, setRequestChecked] = useState(false);

  const [activeView, setActiveView] = useState<ActiveView>('search');
  const [printQueue, setPrintQueue] = useState<VoterRecord[]>([]);
  const [printConfig, setPrintConfig] = useState<SlipPrintConfig>(() =>
    buildDefaultPrintConfig(null)
  );
  const [configHydratedFromRequest, setConfigHydratedFromRequest] = useState(false);

  const [centersList, setCentersList] = useState<PollingCenter[]>([]);
  const [voterRefreshKey, setVoterRefreshKey] = useState(0);
  const [seatPlanModalOpen, setSeatPlanModalOpen] = useState(false);
  const [seatPlanDefaultCenterId, setSeatPlanDefaultCenterId] = useState<string | undefined>(
    undefined
  );
  const [shareVoter, setShareVoter] = useState<VoterRecord | null>(null);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setIsAdmin(false);
        setAdminChecked(false);
        setUserRequest(null);
        setRequestChecked(false);
        setPrintQueue([]);
        setConfigHydratedFromRequest(false);
      }
    });
    return () => unsub();
  }, []);

  // Recognize bootstrapped Super Admin immediately upon Google Sign-In AND check admins/{uid} in Firestore
  useEffect(() => {
    if (!user) return;
    let active = true;
    const isBootstrappedSuperAdmin = isSuperAdminEmail(user.email);

    if (isBootstrappedSuperAdmin) {
      setIsAdmin(true);
      setAdminChecked(true);
    } else {
      setIsAdmin(false);
      setAdminChecked(false);
    }

    async function checkAdmin() {
      try {
        const adminRef = doc(db, 'admins', user!.uid);
        const snap = await getDoc(adminRef);
        if (snap.exists()) {
          if (active) setIsAdmin(true);
        } else if (isBootstrappedSuperAdmin) {
          try {
            await setDoc(
              adminRef,
              {
                uid: user!.uid,
                email: user!.email ?? SUPER_ADMIN_EMAIL,
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch {
            // Rules may prevent client writes to admins/{uid}; Super Admin access remains active via email
          }
        }
      } catch {
        if (active && !isBootstrappedSuperAdmin) {
          setIsAdmin(false);
        }
      } finally {
        if (active) setAdminChecked(true);
      }
    }

    checkAdmin();
    return () => {
      active = false;
    };
  }, [user]);

  // Listen to user_requests/{uid}
  useEffect(() => {
    if (!user) return;
    setRequestChecked(false);

    const path = `user_requests/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'user_requests', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = {
            ...(snap.data() as UserRequest),
            userId: snap.id,
          };
          setUserRequest(data);
          if (!configHydratedFromRequest) {
            setPrintConfig(buildDefaultPrintConfig(data));
            setConfigHydratedFromRequest(true);
          }
        } else {
          setUserRequest(null);
        }
        setRequestChecked(true);
      },
      (err) => {
        setRequestChecked(true);
        if (err instanceof Error && !err.message.includes('permission-denied')) {
          handleFirestoreError(err, OperationType.GET, path);
        }
      }
    );

    return () => unsub();
  }, [user, configHydratedFromRequest]);

  // Preload centers_list when workspace access is granted so SeatPlanManager works from any tab
  useEffect(() => {
    const allowed = isAdmin || userRequest?.status === 'approved';
    if (!user || !allowed || centersList.length > 0) return;
    let active = true;

    async function preloadCenters() {
      try {
        const snap = await getDocs(collection(db, 'centers_list'));
        if (!active) return;
        const list: PollingCenter[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PollingCenter, 'id'>),
        }));
        list.sort((a, b) => a.centerName.localeCompare(b.centerName));
        setCentersList(list);
      } catch {
        if (userRequest?.division && userRequest?.district && userRequest?.upazila) {
          try {
            const scopedSnap = await getDocs(
              query(
                collection(db, 'centers_list'),
                where('division', '==', userRequest.division),
                where('district', '==', userRequest.district),
                where('upazila', '==', userRequest.upazila)
              )
            );
            if (!active) return;
            const list: PollingCenter[] = scopedSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<PollingCenter, 'id'>),
            }));
            list.sort((a, b) => a.centerName.localeCompare(b.centerName));
            setCentersList(list);
          } catch {
            // Handled inside VoterSearchWorkspace if needed
          }
        }
      }
    }

    preloadCenters();
    return () => {
      active = false;
    };
  }, [user, isAdmin, userRequest, centersList.length]);

  const queuedIds = useMemo(() => new Set(printQueue.map((v) => v.id)), [printQueue]);

  const handleToggleQueue = (voter: VoterRecord) => {
    setPrintQueue((prev) =>
      prev.some((v) => v.id === voter.id)
        ? prev.filter((v) => v.id !== voter.id)
        : [...prev, voter]
    );
  };

  const handleAddManyToQueue = (voters: VoterRecord[]) => {
    setPrintQueue((prev) => {
      const existing = new Set(prev.map((v) => v.id));
      const additions = voters.filter((v) => !existing.has(v.id));
      return [...prev, ...additions];
    });
  };

  const handleQuickPrintSingle = (voter: VoterRecord) => {
    setPrintQueue((prev) => {
      if (prev.length === 0) return [voter];
      if (prev.some((v) => v.id === voter.id)) return prev;
      return [...prev, voter];
    });
    setActiveView('print');
  };

  const handleRemoveFromQueue = (voterId: string) => {
    setPrintQueue((prev) => prev.filter((v) => v.id !== voterId));
  };

  const handleSyncVotersIntoQueue = (latestVoters: VoterRecord[]) => {
    if (latestVoters.length === 0) return;
    const byId = new Map(latestVoters.map((v) => [v.id, v]));
    setPrintQueue((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        const updated = byId.get(item.id);
        if (
          updated &&
          (updated.buildingName !== item.buildingName || updated.roomNumber !== item.roomNumber)
        ) {
          changed = true;
          return updated;
        }
        return item;
      });
      return changed ? next : prev;
    });
  };

  const handleSeatPlanUpdated = async (centerId: string) => {
    setVoterRefreshKey((k) => k + 1);
    // Sync any voters from this center already sitting in printQueue
    try {
      const snap = await getDocs(
        query(collection(db, 'voters_data'), where('centerId', '==', centerId))
      );
      if (!snap.empty) {
        const rows: VoterRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VoterRecord, 'id'>),
        }));
        handleSyncVotersIntoQueue(rows);
      }
    } catch {
      // Ignore if query fails; VoterSearchWorkspace refresh will still sync
    }
  };

  const handleOpenSeatPlanModal = (centerId?: string) => {
    setSeatPlanDefaultCenterId(centerId);
    setSeatPlanModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          ভোটার স্লিপ পোর্টাল চালু হচ্ছে...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  if (!adminChecked || !requestChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          অ্যাকাউন্টের অনুমতি যাচাই করা হচ্ছে...
        </div>
      </div>
    );
  }

  const hasWorkspaceAccess = isAdmin || userRequest?.status === 'approved';

  if (!hasWorkspaceAccess) {
    return (
      <ActivationView
        user={user}
        existingRequest={userRequest}
        onSignOut={handleSignOut}
      />
    );
  }

  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'search', label: 'ভোটার অনুসন্ধান' },
    {
      id: 'print',
      label: `এ৪ প্রিন্ট স্টুডিও${
        printQueue.length > 0 ? ` (${formatBnNumber(printQueue.length)})` : ''
      }`,
    },
    { id: 'seat-plan', label: 'আসন বিন্যাস' },
    { id: 'settings', label: 'স্লিপ প্রোফাইল' },
  ];
  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'অ্যাডমিন কনসোল' });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: Brand wordmark — Nav links — Primary action */}
      <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="h-1 bg-emerald-700 w-full" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveView('search')}
            className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src={SITE_LOGO_SRC}
              alt="ভোটার স্লিপ লোগো"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-xs shrink-0"
            />
            <span className="leading-tight">
              <span className="block text-base sm:text-lg font-bold tracking-tight text-slate-900">
                ভোটার স্লিপ পোর্টাল
              </span>
              <span className="block text-[11px] font-medium text-emerald-700">
                শিক্ষক ডায়েরি
              </span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-emerald-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('print')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              প্রিন্ট তালিকা ({formatBnNumber(printQueue.length)})
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="সাইন আউট"
              title={`সাইন আউট (${user.email ?? 'ব্যবহারকারী'})`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">সাইন আউট</span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <nav className="md:hidden border-t border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 print:max-w-none print:p-0 print:m-0">
        {activeView === 'search' && (
          <>
            <VoterSearchWorkspace
              userRequest={userRequest}
              queuedIds={queuedIds}
              onToggleQueue={handleToggleQueue}
              onAddManyToQueue={handleAddManyToQueue}
              onQuickPrintSingle={handleQuickPrintSingle}
              onShareSingle={setShareVoter}
              onOpenPrintStudio={() => setActiveView('print')}
              refreshKey={voterRefreshKey}
              onCentersLoaded={setCentersList}
              onVotersUpdated={handleSyncVotersIntoQueue}
              onOpenSeatPlanModal={handleOpenSeatPlanModal}
              canManageSeatPlan={true}
            />
            <SeatPlanManager
              centers={centersList}
              currentUserId={user.uid}
              defaultCenterId={seatPlanDefaultCenterId}
              isModalOpen={seatPlanModalOpen}
              onOpenModal={() => setSeatPlanModalOpen(true)}
              onCloseModal={() => setSeatPlanModalOpen(false)}
              onSeatPlanUpdated={handleSeatPlanUpdated}
              showTable={false}
            />
          </>
        )}

        {activeView === 'print' && (
          <A4PrintStudio
            voters={printQueue}
            config={printConfig}
            userRequest={userRequest}
            userId={user.uid}
            onChangeConfig={setPrintConfig}
            onRemoveVoter={handleRemoveFromQueue}
            onClearQueue={() => setPrintQueue([])}
            onBackToSearch={() => setActiveView('search')}
            onShareVoter={setShareVoter}
          />
        )}

        {activeView === 'seat-plan' && (
          <SeatPlanManager
            centers={centersList}
            currentUserId={user.uid}
            defaultCenterId={seatPlanDefaultCenterId}
            isModalOpen={seatPlanModalOpen}
            onOpenModal={() => setSeatPlanModalOpen(true)}
            onCloseModal={() => setSeatPlanModalOpen(false)}
            onSeatPlanUpdated={handleSeatPlanUpdated}
          />
        )}

        {activeView === 'settings' && (
          <SlipSettingsView
            userId={user.uid}
            userEmail={user.email ?? ''}
            isAdmin={isAdmin}
            userRequest={userRequest}
            printConfig={printConfig}
            onUpdatePrintConfig={setPrintConfig}
          />
        )}

        {activeView === 'admin' && isAdmin && (
          <AdminConsoleView
            adminUid={user.uid}
            onCentersLoaded={setCentersList}
            onSeatPlanUpdated={handleSeatPlanUpdated}
          />
        )}
      </main>
      <ShareColorSlipModal
        voter={shareVoter}
        config={printConfig}
        onClose={() => setShareVoter(null)}
      />
      <DeveloperFooter />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PortalShell />
    </ErrorBoundary>
  );
}
