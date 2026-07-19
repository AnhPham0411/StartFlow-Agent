import type { CaseInput } from '@startflow/contracts';
import type { CaseDetail } from './models';

const STORAGE_KEY = 'startflow.demo.cases.v1';

function isStoredCase(value: unknown): value is CaseDetail {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<CaseDetail>;
  return (
    typeof item.id === 'string' &&
    item.id.startsWith('demo-case-local-') &&
    typeof item.companyName === 'string' &&
    typeof item.registrationNumber === 'string' &&
    typeof item.requestedAmount === 'number' &&
    typeof item.purpose === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.financials === 'object' &&
    Array.isArray(item.submittedDocuments) &&
    Array.isArray(item.runs)
  );
}

export function listStoredDemoCases(): CaseDetail[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isStoredCase).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function findStoredDemoCase(caseId: string) {
  return listStoredDemoCases().find((item) => item.id === caseId) ?? null;
}

export function saveStoredDemoCase(input: CaseInput): CaseDetail {
  const id = `demo-case-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const created: CaseDetail = {
    id,
    companyName: input.companyName,
    registrationNumber: input.registrationNumber,
    requestedAmount: input.requestedAmount,
    purpose: input.purpose,
    createdAt: new Date().toISOString(),
    createdBy: 'demo:banker',
    demoData: true,
    financials: { ...input.financials },
    submittedDocuments: [...input.submittedDocuments],
    runs: [],
    runCount: 0,
    latestRun: null,
  };
  if (typeof window !== 'undefined') {
    const next = [created, ...listStoredDemoCases()].slice(0, 20);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return created;
}
