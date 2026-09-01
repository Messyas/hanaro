import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { ScrapPage } from './scrap-base.models';
import { ScrapBasePage } from './scrap-base-page';
import { ScrapBaseService } from './scrap-base.service';

describe('ScrapBasePage', () => {
  let component: ScrapBasePage;
  let fixture: ComponentFixture<ScrapBasePage>;
  let service: { list: ReturnType<typeof vi.fn>; getCached: ReturnType<typeof vi.fn> };

  const page: ScrapPage = {
    items: [
      {
        id: 'transaction-1',
        occurrence_id: 'occurrence-1',
        current_transaction_id: 'transaction-1',
        source_line: 4,
        organization_code: 'NWK',
        account_code: '5110',
        account_alias: 'SCRAP',
        receipt_department: 'RECEBIMENTO',
        item_code: 'ITEM-001',
        item_description: 'Peça descartada',
        transaction_date: '2026-08-30',
        issue_quantity: '-2.5',
        issue_amount_brl: '-100.5',
        work_order: 'WO-1',
        amount_usd: '-18.2',
        to_be_counted: true,
        occurrence_status: 'ACTIVE',
      },
    ],
    page: 1,
    page_size: 50,
    total_items: 1,
    total_pages: 1,
  };

  beforeEach(async () => {
    service = {
      list: vi.fn().mockReturnValue(of(page)),
      getCached: vi.fn().mockReturnValue(null),
    };
    await TestBed.configureTestingModule({
      imports: [ScrapBasePage],
      providers: [{ provide: ScrapBaseService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(ScrapBasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads and renders the base of current scrap occurrences', () => {
    expect(service.list).toHaveBeenCalledWith({
      page: 1,
      page_size: 50,
      sort_by: 'transaction_date',
      sort_order: 'desc',
    });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Base de Scrap');
    expect(element.querySelectorAll('.scrap-table tbody tr')).toHaveLength(1);
    expect(element.textContent).toContain('ITEM-001');
    expect(element.textContent).toContain('Ativa');
  });

  it('sends typed organization values as repeated backend filters', () => {
    component.organization.set('NWK, NW1');
    component.onOrganizationChange();
    expect(service.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ organizations: ['NWK', 'NW1'] }),
    );
  });

  it('clears filters and returns to the first page', () => {
    component.dateFrom.set('2026-08-01');
    component.organization.set('NWK');
    component.searchText.set('ITEM');
    component.searchQuery.set('ITEM');
    component.page.set(2);
    component.clearFilters();
    expect(component.dateFrom()).toBe('');
    expect(component.organization()).toBe('');
    expect(component.searchQuery()).toBe('');
    expect(component.page()).toBe(1);
  });

  it('keeps current rows visible while filters refresh in the background', async () => {
    const refreshRequest = new Subject<ScrapPage>();
    service.list.mockReturnValueOnce(refreshRequest);

    component.onSortChange('item_code');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.scrap-table tbody tr')).toHaveLength(1);
    expect(element.querySelector('.list-table-frame')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('app-list-table-skeleton')).toBeNull();

    refreshRequest.next(page);
    refreshRequest.complete();
    await fixture.whenStable();

    expect(element.querySelector('.list-table-frame')?.getAttribute('aria-busy')).toBe('false');
  });

  it('uses the cached default result on return without requesting data again', async () => {
    service.list.mockClear();
    service.getCached.mockReturnValue(page);

    const cachedFixture = TestBed.createComponent(ScrapBasePage);
    cachedFixture.detectChanges();
    await cachedFixture.whenStable();

    expect(service.list).not.toHaveBeenCalled();
    expect(cachedFixture.nativeElement.querySelectorAll('.scrap-table tbody tr')).toHaveLength(1);
  });
});
