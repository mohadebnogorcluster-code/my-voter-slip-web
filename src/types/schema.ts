export type UserRequestStatus = 'pending' | 'approved' | 'blocked';

export interface AdminUser {
  uid: string;
  email: string;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
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
  status: UserRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export type SlipLayoutMode = '4-up' | '6-up' | '8-up' | '1-up';

export interface SlipPrintConfig {
  layout: SlipLayoutMode;
  electionNameYear: string;
  postName: string;
  candidateName: string;
  symbolName: string;
  footerNote: string;
  showFatherMother: boolean;
  showDob: boolean;
  showAddress: boolean;
  showOccupation: boolean;
  showCenterAreaCode: boolean;
  showCutGuides: boolean;
  language: 'bn' | 'en';
}
