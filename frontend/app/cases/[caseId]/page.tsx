import { CaseDetailView } from '@/src/features/cases/case-detail-view';

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseDetailView caseId={caseId} />;
}
