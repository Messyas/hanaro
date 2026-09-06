import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { ScrapPage } from '../scrap-base/scrap-base.models';
import { ScrapBaseService } from '../scrap-base/scrap-base.service';
import { ScrapReview } from '../scrap-base/scrap-review.models';
import { ScrapReviewService } from '../scrap-base/scrap-review.service';
import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  let component: ReportsPage;
  let fixture: ComponentFixture<ReportsPage>;
  let scrapBaseServiceMock: { list: ReturnType<typeof vi.fn> };
  let scrapReviewServiceMock: {
    getDefectTypes: ReturnType<typeof vi.fn>;
    getReview: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockReviewedPage: ScrapPage = {
    items: [
      {
        id: 'trans-10',
        occurrence_id: 'occ-10',
        current_transaction_id: 'trans-10',
        source_line: 1,
        organization_code: 'NWK',
        account_code: '5110',
        account_alias: 'SCRAP',
        receipt_department: 'QUALIDADE',
        item_code: 'ITEM-FINAL',
        item_description: 'Placa revisada',
        transaction_date: '2026-08-31',
        issue_quantity: '-1',
        issue_amount_brl: '-50',
        work_order: 'WO-10',
        amount_usd: '-10',
        to_be_counted: true,
        occurrence_status: 'ACTIVE',
        review_id: 'rev-10',
        review_status: 'REVIEWED',
        defect_type_id: 'dt-1',
        defect_type_name: 'Solda Trincada',
        responsible_user_id: 1,
        responsible_name: 'João Inspetor',
        reviewed_at: '2026-08-31T12:00:00Z',
        review_updated_at: '2026-08-31T12:00:00Z',
        attachment_count: 2,
      },
    ],
    page: 1,
    page_size: 25,
    total_items: 1,
    total_pages: 1,
  };

  const mockReview: ScrapReview = {
    id: 'rev-10',
    occurrence_id: 'occ-10',
    status: 'REVIEWED',
    defect_type: {
      id: 'dt-1',
      code: 'SOLDA',
      name: 'Solda Trincada',
      description: null,
      display_order: 1,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    responsible_user_id: 1,
    responsible_name: 'João Inspetor',
    title: 'Análise de solda',
    description: 'Fissura térmica detectada no ponto B2.',
    version: 1,
    source_review_id: null,
    bulk_operation_id: null,
    reviewed_at: '2026-08-31T12:00:00Z',
    created_at: '',
    updated_at: '',
    attachments: [],
  };

  beforeEach(async () => {
    scrapBaseServiceMock = {
      list: vi.fn().mockReturnValue(of(mockReviewedPage)),
    };
    scrapReviewServiceMock = {
      getDefectTypes: vi.fn().mockReturnValue(of([])),
      getReview: vi.fn().mockReturnValue(of(mockReview)),
    };

    const authServiceMock = {
      user: () => ({ id: 1, name: 'João Inspetor', username: 'joao' }),
    };

    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        provideRouter([]),
        LanguageService,
        { provide: ScrapBaseService, useValue: scrapBaseServiceMock },
        { provide: ScrapReviewService, useValue: scrapReviewServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLanguage('pt');
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('queries scrap base with review_status=REVIEWED on init', () => {
    expect(scrapBaseServiceMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ review_status: 'REVIEWED' }),
    );
  });

  it('renders reviewed items with item_code and defect_type', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('ITEM-FINAL');
    expect(text).toContain('Solda Trincada');
    expect(text).toContain('João Inspetor');
  });

  it('navigates to report detail on openReportDetail', () => {
    component.openReportDetail('occ-10', mockReviewedPage.items[0]);
    expect(component.selectedOccurrenceId()).toBe('occ-10');
    expect(router.navigate).toHaveBeenCalledWith(['/relatorios', 'occ-10'], {
      queryParamsHandling: 'preserve',
    });
  });
});
