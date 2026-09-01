import { TestBed } from '@angular/core/testing';
import { ListPagination } from './list-pagination';

describe('ListPagination', () => {
  it('renders the page state and emits navigation and page-size changes', async () => {
    await TestBed.configureTestingModule({ imports: [ListPagination] }).compileComponents();
    const fixture = TestBed.createComponent(ListPagination);
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('pageSizes', [10, 25, 50]);
    fixture.detectChanges();

    let nextCalled = false;
    let selectedSize = 0;
    fixture.componentInstance.next.subscribe(() => (nextCalled = true));
    fixture.componentInstance.pageSizeChanged.subscribe((value) => (selectedSize = value));
    fixture.componentInstance.next.emit();
    fixture.componentInstance.changePageSize('50');

    expect(fixture.nativeElement.textContent).toContain('Página 2 de 3');
    expect(nextCalled).toBe(true);
    expect(selectedSize).toBe(50);
  });
});
