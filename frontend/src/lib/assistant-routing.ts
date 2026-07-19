import rawCatalog from '@/src/data/agent-catalog.json';
import type { AssistantAgentTask, AssistantFileSummary } from './assistant-types';

interface CatalogAgent {
  agent_id: string;
  slug: string;
  domain_code: string;
  domain: string;
  purpose: string;
  skills: string[];
  tools: string[];
  human_approval_required: boolean;
  core_dependencies: string[];
}

const catalog = rawCatalog.agents as CatalogAgent[];

const domainTerms: Record<string, string[]> = {
  D02: ['identity', 'access', 'permission', 'consent', 'danh tinh', 'quyen truy cap', 'xac thuc'],
  D03: ['data', 'database', 'csv', 'excel', 'schema', 'quality', 'du lieu', 'tich hop'],
  D04: ['document', 'policy', 'knowledge', 'search', 'summary', 'tai lieu', 'chinh sach', 'tom tat'],
  D05: ['customer', 'marketing', 'segment', 'campaign', 'churn', 'khach hang', 'tiep thi'],
  D06: ['advice', 'product', 'pricing', 'account', 'deposit', 'tu van', 'san pham', 'tien gui'],
  D07: ['kyc', 'onboarding', 'ocr', 'passport', 'identity card', 'ho so', 'giay to', 'cccd'],
  D08: ['credit', 'loan', 'underwriting', 'collateral', 'tin dung', 'khoan vay', 'tai san dam bao'],
  D09: ['collection', 'covenant', 'delinquency', 'monitoring', 'thu hoi no', 'giam sat tin dung'],
  D10: ['payment', 'card', 'transfer', 'reconciliation', 'thanh toan', 'the', 'chuyen khoan', 'doi soat'],
  D11: ['fraud', 'aml', 'sanction', 'suspicious', 'gian lan', 'rua tien', 'trung phat'],
  D12: ['complaint', 'ticket', 'sla', 'operation', 'khieu nai', 'van hanh', 'yeu cau dich vu'],
  D13: ['sme', 'corporate', 'trade finance', 'invoice', 'lc', 'doanh nghiep', 'tai tro thuong mai'],
  D14: ['treasury', 'liquidity', 'finance', 'esg', 'market risk', 'thanh khoan', 'tai chinh', 'rui ro'],
  D15: ['deploy', 'incident', 'latency', 'gpu', 'model', 'platform', 'su co', 'trien khai'],
  D16: ['audit', 'security', 'vulnerability', 'control', 'compliance', 'kiem toan', 'bao mat', 'kiem soat'],
};

const extensionBoosts: Record<string, string[]> = {
  image: ['A029', 'A050', 'A051', 'A055'],
  document: ['A025', 'A029', 'A050', 'A052', 'A053'],
  spreadsheet: ['A018', 'A020', 'A021', 'A079'],
  data: ['A018', 'A019', 'A020', 'A021'],
  archive: ['A021', 'A025'],
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fileKind(file: AssistantFileSummary) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|tiff?|bmp|heic)$/.test(name))
    return 'image';
  if (/\.(csv|xlsx?|ods)$/.test(name)) return 'spreadsheet';
  if (/\.(json|jsonl|xml|parquet|avro|sql)$/.test(name)) return 'data';
  if (/\.(zip|7z|rar|tar|gz)$/.test(name)) return 'archive';
  return 'document';
}

function taskFor(
  agent: CatalogAgent,
  index: number,
  prompt: string,
  approvalRequired: boolean,
  status: AssistantAgentTask['status'] = 'completed',
): AssistantAgentTask {
  const label = agent.slug.replaceAll('_', ' ');
  return {
    id: `task-${index + 1}-${agent.agent_id}`,
    agentId: agent.agent_id,
    agentName: label,
    domain: agent.domain.replaceAll('_', ' '),
    objective: agent.purpose,
    reason:
      agent.domain_code === 'D01'
        ? 'Điều phối và kiểm soát yêu cầu trước khi giao việc chuyên môn.'
        : `Phù hợp với nội dung “${prompt.slice(0, 90)}${prompt.length > 90 ? '…' : ''}”.`,
    status: approvalRequired ? 'awaiting_approval' : status,
    approvalRequired,
    coreDependencies: agent.core_dependencies,
  };
}

const executionPatterns = [
  /\b(phe duyet|giai ngan)\b.{0,50}\b(khoan vay|han muc|ho so|tin dung)\b/,
  /\b(chuyen|gui)\b.{0,30}\b(tien|vnd|usd|eur|trieu|ty)\b/,
  /\b(tao|thuc hien|tien hanh)\b.{0,40}\b(giao dich|lenh chuyen|thanh toan)\b/,
  /\b(khoa|mo khoa|dong|kich hoat)\b.{0,35}\b(tai khoan|the|nguoi dung)\b/,
  /\b(cap|thu hoi|thay doi)\b.{0,35}\b(quyen|han muc|vai tro)\b/,
  /\b(xoa|sua|cap nhat)\b.{0,35}\b(du lieu|ho so|thong tin khach hang)\b/,
  /\b(nop|gui)\b.{0,35}\b(bao cao aml|bao cao sar|bao cao co quan)\b/,
];

const advisoryPatterns = [
  /\b(cach|huong dan|quy trinh|chinh sach|quy dinh|dieu kien)\b/,
  /\b(kiem tra|check|phan tich|danh gia|tom tat|giai thich|tra cuu|so sanh|tu van)\b/,
  /\b(la gi|nhu the nao|can nhung gi|nen lam gi)\b/,
];

export function requiresHumanApproval(prompt: string) {
  const query = normalize(prompt);
  const execution = executionPatterns.some((pattern) => pattern.test(query));
  if (!execution) return false;
  const advisory = advisoryPatterns.some((pattern) => pattern.test(query));
  const explicitExecution = /\b(hay|vui long|thuc hien ngay|tien hanh ngay|tu dong)\b/.test(query);
  return explicitExecution || !advisory;
}

export function planAssistantRequest(prompt: string, files: AssistantFileSummary[]) {
  const query = normalize(prompt);
  const queryTokens = new Set(query.split(' ').filter((token) => token.length > 2));
  const boostedAgents = new Set(files.flatMap((file) => extensionBoosts[fileKind(file)] ?? []));
  const highImpactAction = requiresHumanApproval(prompt);
  const policyQuery = /\b(chinh sach|quy dinh|quy trinh|huong dan)\b/.test(query);
  const simpleAdvisory =
    files.length === 0 &&
    !highImpactAction &&
    !/\b(va sau do|dong thoi|ket hop|nhieu buoc)\b/.test(query);

  const scores = catalog
    .filter((agent) => agent.domain_code !== 'D01')
    .map((agent) => {
      const searchable = normalize(
        [agent.slug, agent.domain, agent.purpose, ...agent.skills, ...agent.tools].join(' '),
      );
      let score = boostedAgents.has(agent.agent_id) ? 18 : 0;
      for (const token of queryTokens) if (searchable.includes(token)) score += 2;
      for (const term of domainTerms[agent.domain_code] ?? []) {
        if (query.includes(normalize(term))) score += 7;
      }
      if (agent.agent_id === 'A026' && policyQuery) score += 60;
      if (
        agent.agent_id === 'A052' &&
        !policyQuery &&
        /\b(check|kiem tra).{0,30}\bho so\b/.test(query)
      )
        score += 22;
      if (files.length && ['A029', 'A050'].includes(agent.agent_id)) score += 8;
      if (highImpactAction && agent.human_approval_required && score > 0) score += 35;
      return { agent, score };
    })
    .sort((left, right) => right.score - left.score || left.agent.agent_id.localeCompare(right.agent.agent_id));

  const selected: CatalogAgent[] = [];
  const selectedDomains = new Map<string, number>();
  const maxSpecialists = files.length ? 3 : simpleAdvisory ? 1 : 2;
  const maxPerDomain = files.length ? 2 : 1;
  for (const candidate of scores) {
    if (selected.length >= maxSpecialists) break;
    if (candidate.score <= 0 && selected.length >= 1) break;
    if ((selectedDomains.get(candidate.agent.domain_code) ?? 0) >= maxPerDomain) continue;
    selected.push(candidate.agent);
    selectedDomains.set(
      candidate.agent.domain_code,
      (selectedDomains.get(candidate.agent.domain_code) ?? 0) + 1,
    );
  }

  if (!selected.length) {
    for (const id of ['A026']) {
      const agent = catalog.find((item) => item.agent_id === id);
      if (agent) selected.push(agent);
    }
  }

  const orchestrationIds = simpleAdvisory ? ['A002'] : ['A002', 'A003', 'A004'];
  const orchestration = orchestrationIds.flatMap((id) => {
    const agent = catalog.find((item) => item.agent_id === id);
    return agent ? [agent] : [];
  });
  return [...orchestration, ...selected].map((agent, index) =>
    taskFor(agent, index, prompt, highImpactAction && agent.human_approval_required),
  );
}

export function catalogSummary() {
  return {
    agents: catalog.length,
    domains: new Set(catalog.map((agent) => agent.domain_code)).size,
  };
}
