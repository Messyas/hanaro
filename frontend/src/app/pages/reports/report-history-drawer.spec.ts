import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ReportHistoryDrawer } from './report-history-drawer';

describe('ReportHistoryDrawer', () => {
  let fixture: ComponentFixture<ReportHistoryDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportHistoryDrawer] }).compileComponents();
    fixture = TestBed.createComponent(ReportHistoryDrawer);
    fixture.componentRef.setInput('version', {
      revision: 2,
      content_schema_version: 1,
      content: {
        report: { title: 'Historical report', description: 'A prior revision', author: 'Ana' },
        metrics: { occurrence_count: 3, amount_usd: '12.50' },
      },
      items: [],
      published_at: '2026-09-15T12:00:00Z',
    } as never);
    fixture.componentRef.setInput('copy', {
      revision: 'Revision',
      close: 'Close',
      author: 'Author',
      occurrences: 'Occurrences',
    });
    fixture.componentRef.setInput('workflows', { details: 'Details' });
    fixture.componentRef.setInput('formatDate', (value: string | null | undefined) => value || '—');
    fixture.componentRef.setInput('formatCurrency', (value: string) => value);
    fixture.detectChanges();
  });

  it('renders a historical revision and emits close', () => {
    const close = vi.fn();
    fixture.componentInstance.close.subscribe(close);

    expect(fixture.nativeElement.textContent).toContain('Historical report');
    expect(fixture.nativeElement.textContent).toContain('Revision 2');
    fixture.nativeElement.querySelector('button').click();

    expect(close).toHaveBeenCalledOnce();
  });
});
