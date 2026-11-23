import type { Timestamp } from 'firebase/firestore';

export type FirestoreDateValue =
  | Timestamp
  | { seconds: number; nanoseconds?: number }
  | string
  | null
  | undefined;

export type UserRequestStatus = 'pending' | 'approved' | 'blocked';

export interface AdminUser {
  uid: string;
  email: string;
  createdAt: FirestoreDateValue;
}

export interface PollingCenter {
  id: string;
  division: string;
  district: string;
  upazila: string;
  union: string;
  ward: string;
  centerName: string;
  voterAreaCode?: string;
  totalVoters: number;
  maleCount: number;
  femaleCount: number;
  uploadedByUid: string;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface VoterRecord {
  id: string;
  centerId: string;
  division: string;
  district: string;
  upazila: string;
  union: string;
  ward: string;
  centerName: string;
  voterAreaCode?: string;
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
  buildingName?: string;
  roomNumber?: string;
  createdAt: FirestoreDateValue;
}

export interface SeatPlanRecord {
  id: string;
  centerId: string;
  voterAreaCode: string;
  ward: string;
  centerName: string;
  buildingName: string;
  roomNumber: string;
  gender: 'পুরুষ' | 'মহিলা';
  startSerial: number;
  endSerial: number;
  updatedCount: number;
  createdByUid: string;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface UserRequest {
  userId: string;
  name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  union: string;
  ward: string;
  paymentNote: string;
  deviceId: string;
  electionNameYear?: string;
  postName?: string;
  candidateName?: string;
  symbolName?: string;
  candidatePhotoUrl?: string;
  symbolPhotoUrl?: string;
  status: UserRequestStatus;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export type SlipLayoutMode = '4-up' | '2-up' | '1-up';
export type SlipPrintColorMode = 'bw' | 'color';

export interface SlipPrintConfig {
  layout: SlipLayoutMode;
  printColorMode: SlipPrintColorMode;
  electionNameYear: string;
  postName: string;
  candidateName: string;
  symbolName: string;
  candidatePhotoUrl: string;
  symbolPhotoUrl: string;
  footerNote: string;
  showFatherMother: boolean;
  showAddress: boolean;
  showCutGuides: boolean;
}
