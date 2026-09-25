import { Component, effect, input, signal } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-delayed-progress-spinner',
  imports: [MatProgressSpinner],
  templateUrl: './delayed-progress-spinner.html',
  styleUrl: './delayed-progress-spinner.css',
  host: {
    '[class.is-visible]': 'visible()',
  },
})
export class DelayedProgressSpinner {
  /** Evita exibir feedback de carregamento para consultas rápidas. */
  readonly active = input(false);
  readonly delayMs = input(1000);
  readonly ariaLabel = input('Consultando dados');
  readonly visible = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.active()) {
        this.visible.set(false);
        return;
      }

      const timer = setTimeout(() => this.visible.set(true), this.delayMs());
      onCleanup(() => clearTimeout(timer));
    });
  }
}
