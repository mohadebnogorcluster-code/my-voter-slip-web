import type {
  FirestoreDateValue,
  SlipLayoutMode,
  SlipPrintConfig,
  UserRequest,
} from '../types/schema';

const WEB_DEVICE_ID_KEY = 'voterslip_web_device_id';
const PRINT_CONFIG_KEY = 'voterslip_print_config_v2';

export function getOrCreateWebDeviceId(): string {
  try {
    const existing = localStorage.getItem(WEB_DEVICE_ID_KEY);
    if (existing && existing.trim().length >= 4) {
      return existing.trim();
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

const ENGLISH_TO_BANGLA_DIGITS: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

export function banglaToEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] ?? d);
}

export function toBanglaDigits(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[0-9]/g, (d) => ENGLISH_TO_BANGLA_DIGITS[d] ?? d);
}

export function formatBnNumber(value: number): string {
  return value.toLocaleString('bn-BD');
}

export function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return '';
  return banglaToEnglishDigits(value).trim().toLowerCase();
}

export function parseSerialNumber(input: string | number | undefined | null): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  const eng = banglaToEnglishDigits(String(input)).replace(/\D/g, '');
  const parsed = parseInt(eng, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function matchesGenderLabel(
  voterGender: string | undefined | null,
  target: 'পুরুষ' | 'মহিলা'
): boolean {
  const g = (voterGender ?? '').trim().toLowerCase();
  if (!g) return false;
  const isFemale = g.includes('female') || g.includes('মহিলা') || g.includes('নারী');
  const isMale = (g.includes('male') && !g.includes('female')) || g.includes('পুরুষ');
  return target === 'মহিলা' ? isFemale : isMale;
}

export function formatGenderBangla(voterGender: string | undefined | null): string {
  if (matchesGenderLabel(voterGender, 'মহিলা')) return 'মহিলা';
  if (matchesGenderLabel(voterGender, 'পুরুষ')) return 'পুরুষ';
  return voterGender?.trim() || 'ভোটার';
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function getSlipsPerPage(_layout?: SlipLayoutMode): number {
  // Always 4 slips per A4 sheet so 1, 2, or 3 slips preserve exact 2x2 slip size
  return 4;
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
    layout: '4-up',
    printColorMode: saved.printColorMode === 'color' ? 'color' : 'bw',
    electionNameYear:
      userRequest?.electionNameYear ||
      saved.electionNameYear ||
      'ইউনিয়ন পরিষদ নির্বাচন - ২০২৬',
    postName: userRequest?.postName || saved.postName || 'চেয়ারম্যান পদপ্রার্থী',
    candidateName: userRequest?.candidateName || saved.candidateName || '',
    symbolName: userRequest?.symbolName || saved.symbolName || '',
    candidatePhotoUrl:
      userRequest?.candidatePhotoUrl || saved.candidatePhotoUrl || '',
    symbolPhotoUrl: userRequest?.symbolPhotoUrl || saved.symbolPhotoUrl || '',
    footerNote: saved.footerNote || 'মূল্যবান ভোট ও দোয়া চাই',
    showFatherMother: saved.showFatherMother ?? true,
    showAddress: saved.showAddress ?? true,
    showCutGuides: saved.showCutGuides ?? true,
  };
}

export function persistLocalPrintConfig(config: SlipPrintConfig): void {
  try {
    localStorage.setItem(PRINT_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function toFirestoreMillis(value: FirestoreDateValue): number {
  if (!value) return 0;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    if ('seconds' in value && typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return 0;
}

export function formatIsoDateShort(value: FirestoreDateValue): string {
  if (!value) return '—';
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  const ms = toFirestoreMillis(value);
  if (ms <= 0) return 'এইমাত্র';
  return new Date(ms).toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function resizeImageFileToDataUrl(
  file: File,
  maxDimension = 260
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ছবি পড়া যায়নি।'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('সঠিক ছবির ফরম্যাট নির্বাচন করুন।'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === 'image/png';
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
