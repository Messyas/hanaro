import { TestBed } from '@angular/core/testing';
import { ListFeedback } from './list-feedback';

describe('ListFeedback', () => {
  it('uses an alert role and exposes retry for errors', async () => {
    await TestBed.configureTestingModule({ imports: [ListFeedback] }).compileComponents();
    const fixture = TestBed.createComponent(ListFeedback);
    fixture.componentRef.setInput('kind', 'error');
    fixture.componentRef.setInput('title', 'Falha ao carregar');
    fixture.detectChanges();

    let retried = false;
    fixture.componentInstance.retried.subscribe(() => (retried = true));
    fixture.nativeElement.querySelector('button').click();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(retried).toBe(true);
  });
});
