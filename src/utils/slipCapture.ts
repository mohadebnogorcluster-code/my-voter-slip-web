import { toBlob, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SlipPrintConfig, VoterRecord } from '../types/schema';
import { formatGenderBangla, toBanglaDigits } from './slipHelpers';

export async function captureSlipElementToPngBlob(
  element: HTMLElement,
  pixelRatio = 2.6
): Promise<Blob> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness warnings
    }
  }

  try {
    const blob = await toBlob(element, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#ffffff',
    });
    if (blob) return blob;
  } catch {
    // Retry without font stylesheet inlining if a cross-origin stylesheet blocks cssRules
  }

  const fallbackBlob = await toBlob(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#ffffff',
    skipFonts: true,
  });
  if (!fallbackBlob) {
    throw new Error('ভোটার স্লিপের ছবি তৈরি করা যায়নি।');
  }
  return fallbackBlob;
}

export async function captureSlipElementToDataUrl(
  element: HTMLElement,
  pixelRatio = 2.4
): Promise<string> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness warnings
    }
  }

  try {
    return await toPng(element, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#ffffff',
    });
  } catch {
    return await toPng(element, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#ffffff',
      skipFonts: true,
    });
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Generates an A4 portrait PDF (210mm x 297mm) with 4 fixed-size slots per page (2x2).
 * Printing 1, 2, or 3 slips keeps the exact same 97mm x 138.71mm slip size.
 */
export async function generateBwA4PdfFromElements(
  elements: HTMLElement[],
  filename = 'voter-slips-bw-a4.pdf'
): Promise<void> {
  if (elements.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const marginMm = 6;
  const gapMm = 4;
  const cellWidthMm = (210 - marginMm * 2 - gapMm) / 2; // 97mm
  const cellHeightMm = (cellWidthMm * 2.86) / 2; // 138.71mm

  const slots: [number, number][] = [
    [marginMm, marginMm],
    [marginMm + cellWidthMm + gapMm, marginMm],
    [marginMm, marginMm + cellHeightMm + gapMm],
    [marginMm + cellWidthMm + gapMm, marginMm + cellHeightMm + gapMm],
  ];

  for (let i = 0; i < elements.length; i++) {
    const slotIdx = i % 4;
    if (i > 0 && slotIdx === 0) {
      pdf.addPage('a4', 'portrait');
    }
    const [x, y] = slots[slotIdx];
    const dataUrl = await captureSlipElementToDataUrl(elements[i], 2.2);
    pdf.addImage(dataUrl, 'PNG', x, y, cellWidthMm, cellHeightMm, undefined, 'FAST');
  }

  pdf.save(filename);
}

export function buildSlipShareText(voter: VoterRecord, config: SlipPrintConfig): string {
  const lines = [
    config.electionNameYear.trim() || 'ভোটার স্লিপ',
    `ভোটারের নাম: ${voter.name}`,
    `ক্রমিক নং: ${toBanglaDigits(voter.serialNo)} | লিঙ্গ: ${formatGenderBangla(voter.gender)}`,
    `ভোটার নম্বর: ${toBanglaDigits(voter.voterNo)}`,
    `ভোট কেন্দ্র: ${voter.centerName}`,
    voter.buildingName?.trim()
      ? `ভবন: ${voter.buildingName.trim()}${
          voter.roomNumber?.trim() ? ` | কক্ষ নং: ${toBanglaDigits(voter.roomNumber.trim())}` : ''
        }`
      : voter.roomNumber?.trim()
      ? `কক্ষ নং: ${toBanglaDigits(voter.roomNumber.trim())}`
      : '',
    config.candidateName.trim()
      ? `${config.candidateName.trim()}${
          config.symbolName.trim() ? ` (${config.symbolName.trim()} প্রতীক)` : ''
        }`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}
