export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  jobTitle?: string;
}

export interface OTRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  jobTitle?: string;
  date: string; // ISO string YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  reason: string;
  createdAt: string;
}

export interface OTLimits {
  week: number;
  month: number;
  year: number;
}

export const LIMITS: OTLimits = {
  week: 12,
  month: 40,
  year: 300,
};
