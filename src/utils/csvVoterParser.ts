import { banglaToEnglishDigits } from './slipHelpers';

export interface ParsedVoterImportRow {
  serialNo: string;
  serialNumeric: number;
  name: string;
  voterNo: string;
  fatherName: string;
  motherName: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  occupation: string;
  votingCenter: string;
  voterArea: string;
  voterAreaCode: string;
}

const HEADER_ALIASES: Record<keyof Omit<ParsedVoterImportRow, 'serialNumeric'>, string[]> = {
  serialNo: [
    'serialno',
    'serial_no',
    'serial',
    'sl',
    'sl_no',
    'ক্রম',
    'ক্রমিক',
    'ক্রমিকনং',
    'ক্রমিকনম্বর',
    'সিরিয়াল',
  ],
  name: ['name', 'votername', 'voter_name', 'নাম', 'ভোটারেরনাম', 'ভোটারনাম'],
  voterNo: [
    'voterno',
    'voter_no',
    'voterid',
    'voter_id',
    'nid',
    'ভোটারনং',
    'ভোটারনম্বর',
    'আইডি',
  ],
  fatherName: [
    'fathername',
    'father_name',
    'father',
    'husband',
    'পিতারনাম',
    'পিতা',
    'পিতাস্বামী',
    'স্বামীরনাম',
  ],
  motherName: ['mothername', 'mother_name', 'mother', 'মাতারনাম', 'মাতা'],
  gender: ['gender', 'sex', 'লিঙ্গ'],
  dateOfBirth: ['dateofbirth', 'date_of_birth', 'dob', 'birthdate', 'জন্মতারিখ'],
  address: ['address', 'ঠিকানা', 'গ্রাম'],
  occupation: ['occupation', 'profession', 'পেশা'],
  votingCenter: [
    'votingcenter',
    'voting_center',
    'pollingcenter',
    'polling_center',
    'ভোটকেন্দ্র',
    'ভোটকেন্দ্রেরনাম',
  ],
  voterArea: ['voterarea', 'voter_area', 'area', 'ভোটারএলাকা', 'এলাকা'],
  voterAreaCode: [
    'voterareacode',
    'voter_area_code',
    'areacode',
    'area_code',
    'ভোটারএলাকাকোড',
    'এলাকাকোড',
  ],
};

function normalizeHeaderKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_:./()]+/g, '');
}

function matchHeaderField(
  header: string
): keyof Omit<ParsedVoterImportRow, 'serialNumeric'> | null {
  const norm = normalizeHeaderKey(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) {
      return field as keyof Omit<ParsedVoterImportRow, 'serialNumeric'>;
    }
  }
  return null;
}

export function parseSerialInteger(serialStr: string, fallbackIndex: number): number {
  const englishDigitsOnly = banglaToEnglishDigits(serialStr).replace(/\D/g, '');
  if (!englishDigitsOnly) return fallbackIndex;
  const parsed = parseInt(englishDigitsOnly, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallbackIndex;
}

/**
 * RFC-4180 compliant CSV parser handling quoted fields, embedded commas, and newlines.
 */
export function parseCsvMatrix(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current.trim());
      current = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  return rows;
}

export function parseVoterCsvText(csvText: string): ParsedVoterImportRow[] {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    throw new Error(
      'CSV ফাইলে অন্তত একটি হেডার সারি (Column Header) এবং কমপক্ষে একটি ভোটার সারি থাকতে হবে।'
    );
  }

  const headers = matrix[0];
  const columnMap = headers.map((h) => matchHeaderField(h));
  const hasAnyRecognizedHeader = columnMap.some((f) => f !== null);
  if (!hasAnyRecognizedHeader) {
    throw new Error(
      'CSV ফাইলের কলাম হেডার চেনা যায়নি। নমুনা CSV ডাউনলোড করে সঠিক কলাম নাম (serialNo, name, voterNo, fatherName, motherName, gender, dateOfBirth, address, occupation) ব্যবহার করুন।'
    );
  }

  const results: ParsedVoterImportRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    if (cells.every((c) => !c.trim())) continue;

    const record: Record<string, string> = {};
    columnMap.forEach((field, idx) => {
      if (field && cells[idx] !== undefined) {
        record[field] = cells[idx].trim();
      }
    });

    const serialStr = (record.serialNo || String(results.length + 1)).slice(0, 40);
    const serialNumeric = parseSerialInteger(serialStr, results.length + 1);
    const name = record.name || '';
    const voterNo = record.voterNo || '';

    if (!name && !voterNo) continue;

    results.push({
      serialNo: serialStr,
      serialNumeric,
      name,
      voterNo,
      fatherName: record.fatherName || '',
      motherName: record.motherName || '',
      gender: record.gender || '',
      dateOfBirth: record.dateOfBirth || '',
      address: record.address || '',
      occupation: record.occupation || '',
      votingCenter: record.votingCenter || '',
      voterArea: record.voterArea || '',
      voterAreaCode: record.voterAreaCode || '',
    });
  }

  if (results.length === 0) {
    throw new Error('CSV ফাইল থেকে কোনো বৈধ ভোটার তথ্য পাওয়া যায়নি।');
  }

  return results;
}

export const SAMPLE_VOTER_CSV_CONTENT =
  '\uFEFFserialNo,name,voterNo,fatherName,motherName,gender,dateOfBirth,address,occupation,voterArea,voterAreaCode\n' +
  '০০১,মোঃ রহিম মিয়া,8765432100001,মোঃ করিম উদ্দিন,মোছাঃ আমেনা বেগম,পুরুষ,01/01/1985,পূর্ব পাড়া,কৃষি,পূর্ব পাড়া,০৪৫৬\n' +
  '০০২,মোছাঃ খাদিজা খাতুন,8765432100002,মোঃ জব্বার আলী,মোছাঃ রোকেয়া বেগম,মহিলা,12/05/1990,মধ্য পাড়া,গৃহিণী,মধ্য পাড়া,০৪৫৬\n';
