export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
}

export interface OTRecord {
  id: string;
  employeeId: string;
  date: string; // ISO string YYYY-MM-DD
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
