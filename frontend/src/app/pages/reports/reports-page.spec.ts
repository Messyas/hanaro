import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../i18n/language.service';
import { ReportDetail, ReportPreview, ReportVersion } from './reports.models';
import { ReportsPage } from './reports-page';
import { ReportsService } from './reports.service';

describe('ReportsPage', () => {
  let fixture: ComponentFixture<ReportsPage>;
  let component: ReportsPage;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const report: ReportDetail = {
    id: '77d1ad54-1b7e-4986-809b-a81cc503430c',
    factory_id: '197ea434-b7cb-48c9-9318-b58e71417b75',
    code: 'REP-001',
    title: 'Weekly loss review',
    description: 'Reviewed Scrap occurrences',
    status: 'DRAFT',
    created_by_user_id: 1,
    version: 2,
    created_at: '2026-09-09T10:00:00Z',
    updated_at: '2026-09-09T10:00:00Z',
    occurrence_source_ids: [],
    report_source_ids: [],
    latest_version: null,
  };
  const preview: ReportPreview = {
    report,
    items: [],
    metrics: { occurrence_count: 0, issue_amount_brl: '0', amount_usd: '0' },
    lineage: {},
    source_versions: [],
    generated_at: '2026-09-09T10:00:00Z',
  };

  beforeEach(async () => {
    service = {
      list: vi.fn().mockReturnValue(
        of({
          items: [report],
          page: 1,
          page_size: 25,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        }),
      ),
      create: vi.fn().mockReturnValue(of(report)),
      get: vi.fn().mockReturnValue(of(report)),
      update: vi.fn().mockReturnValue(of({ ...report, version: 3 })),
      mutateSources: vi.fn().mockReturnValue(of({ ...report, version: 3 })),
      eligibleOccurrences: vi.fn().mockReturnValue(
        of({
          items: [],
          page: 1,
          page_size: 100,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        }),
      ),
      sourceReports: vi.fn().mockReturnValue(
        of({
          items: [],
          page: 1,
          page_size: 100,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        }),
      ),
      preview: vi.fn().mockReturnValue(of(preview)),
      publish: vi.fn().mockReturnValue(of({} as ReportVersion)),
      versions: vi.fn().mockReturnValue(
        of({
          items: [],
          page: 1,
          page_size: 100,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        }),
      ),
      requestExport: vi.fn(),
      exportStatus: vi.fn(),
      download: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        provideRouter([]),
        LanguageService,
        { provide: ReportsService, useValue: service },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('pt');
    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('renders the server-paginated report list', () => {
    expect(service['list']).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
    expect(fixture.nativeElement.textContent).toContain('Weekly loss review');
    expect(fixture.nativeElement.textContent).toContain('REP-001');
  });

  it('opens a report and loads candidates, preview, and history', async () => {
    component.openReport(report.id, false);
    await fixture.whenStable();
    expect(service['get']).toHaveBeenCalledWith(report.id);
    expect(service['eligibleOccurrences']).toHaveBeenCalled();
    expect(service['sourceReports']).toHaveBeenCalledWith(report.id, '');
    expect(service['preview']).toHaveBeenCalledWith(report.id);
    expect(service['versions']).toHaveBeenCalledWith(report.id);
  });

  it('sends a bulk source mutation with the optimistic version', async () => {
    component.openReport(report.id, false);
    await fixture.whenStable();
    component.toggleSelection('occurrence', '842361c6-33dc-4f9a-9125-12e14885f360', true);
    component.addSelected('occurrence');
    expect(service['mutateSources']).toHaveBeenCalledWith(report.id, 'occurrence', 'add', 2, [
      '842361c6-33dc-4f9a-9125-12e14885f360',
    ]);
  });

  it('reloads the current draft after an optimistic conflict', async () => {
    service['update'].mockReturnValueOnce(throwError(() => ({ status: 409 })));
    component.openReport(report.id, false);
    await fixture.whenStable();
    component.draftTitle.set('Local edit to preserve');
    component.saveDraft();
    await fixture.whenStable();
    expect(component.workspaceError()).toContain('alterado em outra sessão');
    expect(service['get']).toHaveBeenCalledTimes(2);
    expect(component.draftTitle()).toBe('Local edit to preserve');
  });
});
