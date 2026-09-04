import { TestBed } from '@angular/core/testing';
import { InlineAlert } from './inline-alert';

describe('InlineAlert', () => {
  it('renders an accessible error message', async () => {
    await TestBed.configureTestingModule({ imports: [InlineAlert] }).compileComponents();
    const fixture = TestBed.createComponent(InlineAlert);
    fixture.componentRef.setInput('message', 'Período inválido');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Período inválido');
  });
});
