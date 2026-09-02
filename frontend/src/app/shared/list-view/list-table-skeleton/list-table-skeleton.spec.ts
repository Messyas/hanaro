import { TestBed } from '@angular/core/testing';
import { ListTableSkeleton } from './list-table-skeleton';

describe('ListTableSkeleton', () => {
  it('keeps table headers visible and renders the requested placeholder rows', async () => {
    await TestBed.configureTestingModule({ imports: [ListTableSkeleton] }).compileComponents();
    const fixture = TestBed.createComponent(ListTableSkeleton);
    fixture.componentRef.setInput('columns', ['Data', 'Organização', 'Item']);
    fixture.componentRef.setInput('rows', 4);

    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('thead th')).toHaveLength(3);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(element.querySelector('[role="status"]')?.getAttribute('aria-label')).toContain(
      'Carregando',
    );
  });
});
