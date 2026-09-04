import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DelayedProgressSpinner } from './delayed-progress-spinner';

describe('DelayedProgressSpinner', () => {
  let fixture: ComponentFixture<DelayedProgressSpinner>;

  afterEach(() => vi.useRealTimers());

  it('only presents the indeterminate spinner after the configured delay', async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [DelayedProgressSpinner] }).compileComponents();
    fixture = TestBed.createComponent(DelayedProgressSpinner);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(999);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).not.toBeNull();

    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeNull();
  });
});
