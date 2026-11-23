import type { SlipLayoutMode, SlipPrintConfig, UserRequest } from '../types/schema';

const WEB_DEVICE_ID_KEY = 'voterslip_web_device_id';
const PRINT_CONFIG_KEY = 'voterslip_print_config_v1';

export function getOrCreateWebDeviceId(): string {
  try {
    const existing = localStorage.getItem(WEB_DEVICE_ID_KEY);
    if (existing && existing.trim().length > 0) {
      return existing;
    }
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const newId = `web-${randomPart}`;
    localStorage.setItem(WEB_DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return `web-${Date.now().toString(36)}`;
  }
}

const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function banglaToEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] ?? d);
}

export function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return '';
  return banglaToEnglishDigits(value).trim().toLowerCase();
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function getSlipsPerPage(layout: SlipLayoutMode): number {
  switch (layout) {
    case '1-up':
      return 1;
    case '4-up':
      return 4;
    case '6-up':
      return 6;
    case '8-up':
      return 8;
  }
}

export function buildDefaultPrintConfig(userRequest: UserRequest | null): SlipPrintConfig {
  let saved: Partial<SlipPrintConfig> = {};
  try {
    const raw = localStorage.getItem(PRINT_CONFIG_KEY);
    if (raw) {
      saved = JSON.parse(raw) as Partial<SlipPrintConfig>;
    }
  } catch {
    saved = {};
  }

  return {
    layout: saved.layout ?? '6-up',
    electionNameYear: userRequest?.electionNameYear ?? saved.electionNameYear ?? '',
    postName: userRequest?.postName ?? saved.postName ?? '',
    candidateName: userRequest?.candidateName ?? saved.candidateName ?? '',
    symbolName: userRequest?.symbolName ?? saved.symbolName ?? '',
    footerNote:
      saved.footerNote ?? 'ভোটকেন্দ্রে নির্ধারিত সময়ে উপস্থিত হয়ে আপনার মূল্যবান ভোট প্রদান করুন।',
    showFatherMother: saved.showFatherMother ?? true,
    showDob: saved.showDob ?? true,
    showAddress: saved.showAddress ?? true,
    showOccupation: saved.showOccupation ?? false,
    showCenterAreaCode: saved.showCenterAreaCode ?? true,
    showCutGuides: saved.showCutGuides ?? true,
    language: saved.language ?? 'bn',
  };
}

export function persistLocalPrintConfig(config: SlipPrintConfig): void {
  try {
    localStorage.setItem(PRINT_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatIsoDateShort(iso: string | undefined | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
