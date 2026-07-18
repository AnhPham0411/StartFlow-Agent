import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import type { AgentPlanTask, AgentResult, FinalDecision } from '@startflow/contracts';
import type { RunDetail } from '../../core/api/models';
import { RunWorkspaceComponent } from './run-workspace.component';
import { RunFacade } from './run.facade';

describe('RunWorkspaceComponent', () => {
  let fixture: ComponentFixture<RunWorkspaceComponent>;
  let facade: RunFacadeStub;

  beforeEach(async () => {
    facade = createFacadeStub(runDetail());
    await TestBed.configureTestingModule({ imports: [RunWorkspaceComponent] })
      .overrideComponent(RunWorkspaceComponent, {
        set: { providers: [{ provide: RunFacade, useValue: facade }] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(RunWorkspaceComponent);
    fixture.componentRef.setInput('runId', '10000000-0000-4000-8000-000000000000');
    fixture.detectChanges();
  });

  it('loads the route-bound run and renders planner, three specialist lanes and decision rail', () => {
    expect(facade.load).toHaveBeenCalledOnceWith('10000000-0000-4000-8000-000000000000');
    expect(query('[data-testid="planner-strip"]')?.textContent).toContain('Kế hoạch phối hợp');
    expect(fixture.nativeElement.querySelectorAll('app-agent-lane')).toHaveSize(3);
    expect(query('[data-testid="decision-rail"]')?.textContent).toContain('Đề xuất có điều kiện');
  });

  it('renders accessible timeline and evidence regions for persisted analysis', () => {
    expect(query('app-run-timeline')?.getAttribute('aria-label')).toBe(
      'Dòng thời gian lượt đánh giá',
    );
    expect(query('app-evidence-panel')?.getAttribute('aria-label')).toBe('Bằng chứng và công cụ');
  });

  it('keeps successful specialist results visible while warning about partial failure', () => {
    facade.run.set(
      runDetail({
        status: 'PARTIAL',
        agentResults: [agentResult('CREDIT', 'COMPLETED'), agentResult('OPERATIONS', 'FAILED')],
      }),
    );
    facade.isPartial.set(true);
    fixture.detectChanges();

    expect(query('[data-testid="partial-warning"]')?.textContent).toContain('kết quả một phần');
    expect(fixture.nativeElement.querySelectorAll('app-agent-lane')).toHaveSize(3);
  });

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }
});

interface RunFacadeStub {
  run: ReturnType<typeof signal<RunDetail | null>>;
  events: ReturnType<typeof signal<never[]>>;
  loading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<string | null>>;
  connection: ReturnType<typeof signal<'closed'>>;
  streamError: ReturnType<typeof signal<null>>;
  fatalStreamError: ReturnType<typeof signal<null>>;
  failedAgents: ReturnType<typeof signal<AgentResult['agent'][]>>;
  isPartial: ReturnType<typeof signal<boolean>>;
  isTerminal: ReturnType<typeof signal<boolean>>;
  load: jasmine.Spy<(runId: string) => Promise<void>>;
  reload: jasmine.Spy<() => Promise<void>>;
  applySnapshot: jasmine.Spy<(snapshot: RunDetail) => void>;
}

function createFacadeStub(snapshot: RunDetail): RunFacadeStub {
  return {
    run: signal(snapshot),
    events: signal([]),
    loading: signal(false),
    error: signal(null),
    connection: signal('closed'),
    streamError: signal(null),
    fatalStreamError: signal(null),
    failedAgents: signal([]),
    isPartial: signal(false),
    isTerminal: signal(false),
    load: jasmine.createSpy('load').and.resolveTo(),
    reload: jasmine.createSpy('reload').and.resolveTo(),
    applySnapshot: jasmine.createSpy('applySnapshot'),
  };
}

function runDetail(overrides: Partial<RunDetail> = {}): RunDetail {
  const plan: AgentPlanTask[] = ['CREDIT', 'COMPLIANCE', 'OPERATIONS'].map((agent) => ({
    id: `task-${agent.toLowerCase()}`,
    agent: agent as AgentPlanTask['agent'],
    title: `Phân tích ${agent}`,
    objective: 'Đánh giá rủi ro chuyên ngành',
    dependencies: [],
    successCriteria: ['Có kết luận và bằng chứng'],
    status: 'COMPLETED',
  }));
  const finalDecision: FinalDecision = {
    status: 'RECOMMEND',
    summary: 'Có thể cấp tín dụng khi đáp ứng điều kiện.',
    rationale: ['Dòng tiền đủ trả nợ.'],
    conditions: ['Bổ sung bảo lãnh.'],
    conflicts: [],
    confidence: 0.82,
    requiresHumanApproval: false,
    proposedAction: null,
  };
  return {
    id: '10000000-0000-4000-8000-000000000000',
    caseId: '20000000-0000-4000-8000-000000000000',
    status: 'COMPLETED',
    createdAt: '2026-07-18T00:00:00.000Z',
    completedAt: '2026-07-18T00:05:00.000Z',
    finalDecisionStatus: 'RECOMMEND',
    version: 1,
    plan,
    agentResults: ['CREDIT', 'COMPLIANCE', 'OPERATIONS'].map((agent) =>
      agentResult(agent as AgentResult['agent'], 'COMPLETED'),
    ),
    finalDecision,
    events: [],
    approval: null,
    actionTicket: null,
    caseSnapshot: {
      companyName: 'Công ty Minh An',
      requestedAmount: 2_000_000_000,
      purpose: 'Mở rộng nhà xưởng',
    },
    ...overrides,
  };
}

function agentResult(agent: AgentResult['agent'], status: AgentResult['status']): AgentResult {
  return {
    agent,
    status,
    summary: status === 'FAILED' ? 'Không thể hoàn tất phân tích' : 'Đã hoàn tất phân tích',
    confidence: status === 'FAILED' ? 0 : 0.8,
    findings: [],
    toolNames: [],
    errorCode: status === 'FAILED' ? 'TOOL_FAILED' : null,
  };
}
