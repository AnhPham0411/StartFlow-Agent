import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { NbaOperationsConsoleComponent } from './nba-operations-console.component';

describe('NbaOperationsConsoleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NbaOperationsConsoleComponent],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data: { console: 'operations' } } } }],
    }).compileComponents();
  });

  it('renders the typed NBA stage journey with an explicit demo badge', () => {
    const fixture = TestBed.createComponent(NbaOperationsConsoleComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('NBA Operations');
    expect(fixture.nativeElement.textContent).toContain('DEMO MODE');
    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.componentInstance.config.stages.map((stage) => stage.code)).toEqual([
      'M1',
      'AG1',
      'M2',
      'M3',
      'M4',
      'M5',
      'M6',
      'AG2–AG6',
      'M7',
      'M8',
      'M10',
      'M11',
      'M12',
      'M13',
    ]);
    expect(fixture.componentInstance.config.stages.find((stage) => stage.code === 'M10')).toEqual(
      jasmine.objectContaining({ name: 'Mini-run', status: 'demo-ready' }),
    );
    expect(fixture.componentInstance.config.stages.find((stage) => stage.code === 'M13')).toEqual(
      jasmine.objectContaining({ name: 'Masked won/lost RAG', status: 'planned' }),
    );
  });

  it('runs a deterministic local mini-run journey without claiming a production run', fakeAsync(() => {
    const fixture = TestBed.createComponent(NbaOperationsConsoleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startMiniRun();
    expect(fixture.componentInstance.runStatus()).toBe('running');

    tick(900);
    expect(fixture.componentInstance.runStatus()).toBe('complete');
  }));
});
