import { TestBed } from '@angular/core/testing';
import { ListPanel } from './list-panel';

describe('ListPanel', () => {
  it('renders the shared title and metadata', async () => {
    await TestBed.configureTestingModule({ imports: [ListPanel] }).compileComponents();
    const fixture = TestBed.createComponent(ListPanel);
    fixture.componentRef.setInput('title', 'Histórico');
    fixture.componentRef.setInput('meta', 'TOTAL: 2');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain('Histórico');
    expect(fixture.nativeElement.querySelector('.meta-label')?.textContent).toContain('TOTAL: 2');
  });
});
