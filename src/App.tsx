import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Loader2, LogOut, Printer } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, testConnection } from './firebase';
import type { SlipPrintConfig, UserRequest, VoterRecord } from './types/schema';
import { buildDefaultPrintConfig } from './utils/slipHelpers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { ActivationView } from './components/ActivationView';
import { VoterSearchWorkspace } from './components/VoterSearchWorkspace';
import { A4PrintStudio } from './components/A4PrintStudio';
import { SlipSettingsView } from './components/SlipSettingsView';
import { AdminConsoleView } from './components/AdminConsoleView';

type ActiveView = 'search' | 'print' | 'settings' | 'admin';

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

  // Check admin status in admins/{uid}
  useEffect(() => {
    if (!user) return;
    let active = true;
    setAdminChecked(false);

    async function checkAdmin() {
      try {
        const snap = await getDoc(doc(db, 'admins', user!.uid));
        if (active) {
          setIsAdmin(snap.exists());
        }
      } catch {
        // Permission denied means user is not an admin under strict rules
        if (active) setIsAdmin(false);
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
        // Only throw via handleFirestoreError if unexpected error
        if (err instanceof Error && !err.message.includes('permission-denied')) {
          handleFirestoreError(err, OperationType.GET, path);
        }
      }
    );

    return () => unsub();
  }, [user, configHydratedFromRequest]);

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

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          Initializing Voter Slip Portal...
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
          Verifying account permissions...
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
    { id: 'search', label: 'Voter Search' },
    { id: 'print', label: `A4 Print Studio${printQueue.length > 0 ? ` (${printQueue.length})` : ''}` },
    { id: 'settings', label: 'Slip Profile' },
  ];
  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Console' });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: Brand wordmark — Nav links — Primary action */}
      <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveView('search')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Voter Slip Portal
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
                      ? 'border-emerald-700 text-slate-900'
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
              Print Queue ({printQueue.length})
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title={`Sign out (${user.email ?? 'User'})`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
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
          <VoterSearchWorkspace
            userRequest={userRequest}
            queuedIds={queuedIds}
            onToggleQueue={handleToggleQueue}
            onAddManyToQueue={handleAddManyToQueue}
            onQuickPrintSingle={handleQuickPrintSingle}
            onOpenPrintStudio={() => setActiveView('print')}
          />
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

        {activeView === 'admin' && isAdmin && <AdminConsoleView adminUid={user.uid} />}
      </main>
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
