import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  firestoreInfo: FirestoreErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      firestoreInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsed: FirestoreErrorInfo | null = null;
    try {
      const candidate = JSON.parse(error.message);
      if (candidate && typeof candidate === 'object' && 'operationType' in candidate) {
        parsed = candidate as FirestoreErrorInfo;
      }
    } catch {
      parsed = null;
    }

    return {
      hasError: true,
      errorMessage: parsed
        ? parsed.error
        : error.message || 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।',
      firestoreInfo: parsed,
    };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', firestoreInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h1 className="text-lg font-semibold text-slate-900">
                  অনুরোধটি সম্পন্ন করা যায়নি
                </h1>
                <p className="text-sm text-slate-600 break-words">
                  {this.state.errorMessage}
                </p>
              </div>
            </div>

            {this.state.firestoreInfo && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 space-y-1">
                <div>অপারেশন: {this.state.firestoreInfo.operationType}</div>
                <div>পাথ: {this.state.firestoreInfo.path ?? 'প্রযোজ্য নয়'}</div>
                <div>ব্যবহারকারী: {this.state.firestoreInfo.authInfo.email ?? 'সাইন আউট'}</div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                পুনরায় লোড করুন
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
