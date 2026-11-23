import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  X,
} from 'lucide-react';
import type { SlipPrintConfig, VoterRecord } from '../types/schema';
import {
  buildSlipShareText,
  captureSlipElementToPngBlob,
  copyPngBlobToClipboard,
  downloadBlob,
} from '../utils/slipCapture';
import { toBanglaDigits } from '../utils/slipHelpers';
import { VoterSlipCard } from './VoterSlipCard';

interface ShareColorSlipModalProps {
  voter: VoterRecord | null;
  config: SlipPrintConfig;
  onClose: () => void;
}

export function ShareColorSlipModal({ voter, config, onClose }: ShareColorSlipModalProps) {
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!voter) {
      setPngBlob(null);
      setStatusMessage(null);
      return;
    }

    let active = true;
    setGenerating(true);
    setPngBlob(null);
    setStatusMessage(null);
    setCopiedImage(false);
    setCopiedText(false);

    const timer = setTimeout(async () => {
      if (!captureRef.current || !active) return;
      try {
        const blob = await captureSlipElementToPngBlob(captureRef.current, 2.6);
        if (active) {
          setPngBlob(blob);
        }
      } catch (err) {
        if (active) {
          setStatusMessage(
            err instanceof Error ? err.message : 'রঙিন স্লিপের ছবি প্রস্তুত করা যায়নি।'
          );
        }
      } finally {
        if (active) setGenerating(false);
      }
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [voter, config]);

  if (!voter) return null;

  const fileName = `voter-slip-${voter.serialNo || voter.voterNo || 'color'}.png`;
  const shareText = buildSlipShareText(voter, config);
  const encodedText = encodeURIComponent(shareText);
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const encodedUrl = encodeURIComponent(pageUrl);

  const ensurePngBlob = async (): Promise<Blob | null> => {
    if (pngBlob) return pngBlob;
    if (!captureRef.current) return null;
    setGenerating(true);
    try {
      const fresh = await captureSlipElementToPngBlob(captureRef.current, 2.6);
      setPngBlob(fresh);
      return fresh;
    } catch {
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleNativeShare = async () => {
    setStatusMessage(null);
    const blob = await ensurePngBlob();
    if (!blob) {
      setStatusMessage('ছবি প্রস্তুত হয়নি, অনুগ্রহ করে ডাউনলোড বাটন ব্যবহার করুন।');
      return;
    }

    const file = new File([blob], fileName, { type: 'image/png' });
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const canShareFile =
          typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
        if (canShareFile) {
          await navigator.share({
            files: [file],
            title: `ভোটার স্লিপ - ${voter.name}`,
            text: shareText,
          });
          setStatusMessage('সফলভাবে সামাজিক যোগাযোগ মাধ্যমে শেয়ার করা হয়েছে।');
          return;
        }
        await navigator.share({
          title: `ভোটার স্লিপ - ${voter.name}`,
          text: shareText,
        });
        downloadBlob(blob, fileName);
        setStatusMessage('স্লিপের রঙিন ছবি ডাউনলোড হয়েছে এবং টেক্সট শেয়ার মেনু খোলা হয়েছে।');
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Fallback when desktop iframe blocks Web Share API
    const copied = await copyPngBlobToClipboard(blob);
    downloadBlob(blob, fileName);
    setStatusMessage(
      copied
        ? 'রঙিন ছবি ক্লিপবোর্ডে কপি ও ডাউনলোড হয়েছে — এখন হোয়াটসঅ্যাপ, ফেসবুক বা মেসেঞ্জারে সরাসরি পেস্ট/সংযুক্ত করুন।'
        : 'রঙিন PNG ছবি ডাউনলোড হয়েছে — এখন হোয়াটসঅ্যাপ, ফেসবুক, মেসেঞ্জার বা টেলিগ্রামে পাঠান।'
    );
  };

  const handleDownloadColorPng = async () => {
    const blob = await ensurePngBlob();
    if (!blob) return;
    downloadBlob(blob, fileName);
    setStatusMessage('রঙিন ভোটার স্লিপের ছবি (PNG) ডাউনলোড শুরু হয়েছে।');
  };

  const handleCopyColorImage = async () => {
    const blob = await ensurePngBlob();
    if (!blob) return;
    const copied = await copyPngBlobToClipboard(blob);
    if (copied) {
      setCopiedImage(true);
      setStatusMessage('রঙিন ছবি কপি হয়েছে — মেসেঞ্জার, হোয়াটসঅ্যাপ বা ফেসবুকে পেস্ট করুন।');
      setTimeout(() => setCopiedImage(false), 2500);
    } else {
      downloadBlob(blob, fileName);
      setStatusMessage('এই ব্রাউজার সরাসরি ছবি কপি সমর্থন করে না, তাই PNG ডাউনলোড করা হয়েছে।');
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setStatusMessage('ভোটার স্লিপের তথ্য টেক্সট আকারে কপি হয়েছে।');
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      setStatusMessage('টেক্সট কপি করা যায়নি।');
    }
  };

  const prepareImageBeforeSocialOpen = async (platformName: string) => {
    const blob = await ensurePngBlob();
    if (blob) {
      const copied = await copyPngBlobToClipboard(blob);
      if (!copied) {
        downloadBlob(blob, fileName);
      }
      setStatusMessage(
        copied
          ? `রঙিন ছবি কপি হয়েছে — ${platformName}-এ পেস্ট (Ctrl+V) বা সংযুক্ত করুন।`
          : `রঙিন ছবি ডাউনলোড হয়েছে — ${platformName}-এ ছবিটি সংযুক্ত করে পাঠান।`
      );
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-color-slip-title"
    >
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <h2 id="share-color-slip-title" className="text-base font-bold text-slate-900">
                রঙিন ভোটার স্লিপ শেয়ার (১টি স্লিপ)
              </h2>
              <p className="text-xs text-slate-500">
                {voter.name} · ক্রমিক {toBanglaDigits(voter.serialNo)} — একসাথে ১টি রঙিন ছবি শেয়ার ও ডাউনলোডের জন্য প্রস্তুত
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left: Full Color Single Slip Preview */}
          <div className="md:col-span-6 flex flex-col items-center">
            <div className="w-full max-w-[300px]">
              <VoterSlipCard voter={voter} config={config} compact={true} monochrome={false} />
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500">
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                  <span>রঙিন ছবি প্রস্তুত হচ্ছে...</span>
                </>
              ) : pngBlob ? (
                <span className="text-emerald-700 font-medium">
                  রঙিন PNG ছবি শেয়ারের জন্য প্রস্তুত
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Social Media Share Controls */}
          <div className="md:col-span-6 space-y-4">
            {statusMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                {statusMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleNativeShare}
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              সরাসরি শেয়ার করুন (মোবাইল ও সকল অ্যাপ)
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadColorPng}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                রঙিন PNG ডাউনলোড
              </button>

              <button
                type="button"
                onClick={handleCopyColorImage}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {copiedImage ? (
                  <Check className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Copy className="w-4 h-4 text-emerald-700" />
                )}
                {copiedImage ? 'ছবি কপি হয়েছে' : 'রঙিন ছবি কপি'}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">
                সামাজিক যোগাযোগ মাধ্যমে পাঠান:
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`https://wa.me/?text=${encodedText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => prepareImageBeforeSocialOpen('হোয়াটসঅ্যাপ')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  হোয়াটসঅ্যাপ
                </a>

                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => prepareImageBeforeSocialOpen('ফেসবুক')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-[#1877F2] rounded-lg hover:bg-[#166FE5] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  ফেসবুক
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => prepareImageBeforeSocialOpen('টেলিগ্রাম')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-[#0284C7] rounded-lg hover:bg-[#0369A1] transition-colors"
                >
                  <Send className="w-4 h-4" />
                  টেলিগ্রাম
                </a>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copiedText ? (
                    <Check className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                  {copiedText ? 'তথ্য কপি হয়েছে' : 'তথ্য টেক্সট কপি'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                একবারে ১টি পূর্ণ-রঙিন ভোটার স্লিপ ছবি তৈরি হয়। মোবাইল থেকে &quot;সরাসরি শেয়ার করুন&quot; চাপলে সরাসরি ছবি সহ মেসেঞ্জার, ইমো, হোয়াটসঅ্যাপ বা ফেসবুকে পাঠানো যাবে।
              </p>
            </div>
          </div>
        </div>

        {/* Offscreen High-Resolution Capture Container (Always Full Color) */}
        <div
          aria-hidden="true"
          className="fixed -left-[9999px] top-0 pointer-events-none opacity-100"
        >
          <div ref={captureRef} className="w-[410px] bg-white p-1">
            <VoterSlipCard voter={voter} config={config} compact={false} monochrome={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
