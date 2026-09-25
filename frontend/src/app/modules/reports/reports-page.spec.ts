import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../i18n/language.service';
import { GovernanceCapabilitiesService } from '../../core/governance/governance-capabilities.service';
import { ReportDetail, ReportPreview, ReportVersion } from './reports.models';
import { ReportsPage } from './reports-page';
import { ReportEditorService } from './report-editor.service';
import { ReportDossierPreviewService } from './report-dossier-preview.service';
import { ReportSourceService } from './report-source.service';
import { ReportPublicationService } from './report-publication.service';
import { ReportCatalogService } from './report-catalog.service';
import { ReportPeriodCloseService } from './report-period-close.service';
import { BROWSER_DOWNLOAD } from './browser-download.port';

describe('ReportsPage', () => {
  let fixture: ComponentFixture<ReportsPage>;
  let component: ReportsPage;
  let editorService: Record<string, ReturnType<typeof vi.fn>>;
  let dossierPreviewService: Record<string, ReturnType<typeof vi.fn>>;
  let sourceService: Record<string, ReturnType<typeof vi.fn>>;
  let publicationService: Record<string, ReturnType<typeof vi.fn>>;
  let catalogService: Record<string, ReturnType<typeof vi.fn>>;

  const report: ReportDetail = {
    id: '77d1ad54-1b7e-4986-809b-a81cc503430c',
    factory_id: '197ea434-b7cb-48c9-9318-b58e71417b75',
    code: 'REP-001',
    title: 'Weekly loss review',
    description: 'Reviewed Scrap occurrences',
    status: 'DRAFT',
    report_kind: 'DOSSIER',
    content_schema_version: 1,
    created_by_user_id: 1,
    version: 2,
    created_at: '2026-09-09T10:00:00Z',
    updated_at: '2026-09-09T10:00:00Z',
    occurrence_source_ids: [],
    report_source_ids: [],
    latest_version: null,
    scope: null,
    sections: [],
    action_source_ids: [],
    evidence_sources: [],
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
    editorService = {
      update: vi.fn().mockReturnValue(of({ ...report, version: 3 })),
    };
    dossierPreviewService = { load: vi.fn().mockReturnValue(of(preview)) };
    catalogService = {
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
    };
    publicationService = {
      publish: vi.fn().mockReturnValue(of({} as ReportVersion)),
      version: vi.fn().mockReturnValue(of({} as ReportVersion)),
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
    };
    sourceService = {
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
    };
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        provideRouter([]),
        { provide: BROWSER_DOWNLOAD, useValue: { download: vi.fn() } },
        LanguageService,
        {
          provide: GovernanceCapabilitiesService,
          useValue: { get: vi.fn().mockReturnValue(of({ exports_available: true })) },
        },
        { provide: ReportEditorService, useValue: editorService },
        { provide: ReportDossierPreviewService, useValue: dossierPreviewService },
        { provide: ReportCatalogService, useValue: catalogService },
        { provide: ReportSourceService, useValue: sourceService },
        { provide: ReportPublicationService, useValue: publicationService },
        { provide: ReportPeriodCloseService, useValue: {} },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('pt');
    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('renders the server-paginated report list', () => {
    expect(catalogService['list']).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
    expect(fixture.nativeElement.textContent).toContain('Weekly loss review');
    expect(fixture.nativeElement.textContent).toContain('REP-001');
  });

  it('opens a report and loads candidates, preview, and history', async () => {
    component.openReport(report.id, false);
    await fixture.whenStable();
    expect(catalogService['get']).toHaveBeenCalledWith(report.id);
    expect(sourceService['eligibleOccurrences']).toHaveBeenCalled();
    expect(sourceService['sourceReports']).toHaveBeenCalledWith(report.id, {
      page: 1,
      pageSize: 25,
      search: undefined,
    });
    expect(dossierPreviewService['load']).toHaveBeenCalledWith(report.id);
    expect(publicationService['versions']).toHaveBeenCalledWith(report.id, {
      page: 1,
      pageSize: 25,
    });
  });

  it('sends a bulk source mutation with the optimistic version', async () => {
    component.openReport(report.id, false);
    await fixture.whenStable();
    component.toggleSelection('occurrence', '842361c6-33dc-4f9a-9125-12e14885f360', true);
    component.addSelected('occurrence');
    expect(sourceService['mutateSources']).toHaveBeenCalledWith({
      reportId: report.id,
      kind: 'occurrence',
      operation: 'add',
      expectedVersion: 2,
      ids: ['842361c6-33dc-4f9a-9125-12e14885f360'],
    });
  });

  it('reloads the current draft after an optimistic conflict', async () => {
    editorService['update'].mockReturnValueOnce(throwError(() => ({ status: 409 })));
    component.openReport(report.id, false);
    await fixture.whenStable();
    component.draftTitle.set('Local edit to preserve');
    component.saveDraft();
    await fixture.whenStable();
    expect(component.workspaceError()).toContain('alterado em outra sessão');
    expect(catalogService['get']).toHaveBeenCalledTimes(2);
    expect(component.draftTitle()).toBe('Local edit to preserve');
  });
});
