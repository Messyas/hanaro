import { TestBed } from '@angular/core/testing';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the semantic tone and label', async () => {
    await TestBed.configureTestingModule({ imports: [StatusBadge] }).compileComponents();
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('label', 'Concluído');
    fixture.componentRef.setInput('tone', 'success');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge-success');
    expect(badge?.textContent).toContain('Concluído');
  });
});
