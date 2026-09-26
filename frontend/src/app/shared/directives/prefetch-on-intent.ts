import { DestroyRef, Directive, inject, input, output } from '@angular/core';

/** Sinaliza intenção de navegação; a tela decide quais dados pré-carregar. */
@Directive({
  selector: '[appPrefetchOnIntent]',
  host: {
    '(pointerenter)': 'onPointerEnter($event)',
    '(pointerleave)': 'cancel()',
    '(focusin)': 'schedule()',
    '(focusout)': 'cancel()',
    '(click)': 'cancel()',
  },
})
export class PrefetchOnIntent {
  readonly prefetchDelay = input(150);
  readonly prefetchIntent = output<void>();
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  onPointerEnter(event: PointerEvent): void {
    if (event.pointerType !== 'touch') this.schedule();
  }

  schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.prefetchIntent.emit();
    }, this.prefetchDelay());
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
