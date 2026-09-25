import { Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { UiIcon } from '../../shared/components/ui-icon/ui-icon';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-logout-confirm-dialog',
  imports: [UiIcon],
  template: `
    @let t = language.translations();
    <section class="logout-confirm-dialog">
      <header class="logout-confirm-dialog-header">
        <button type="button" [attr.aria-label]="t.back" (click)="close(false)">
          <ui-icon name="arrow-left" />
        </button>
        <h2 id="logout-confirm-title">{{ t.logoutTitle }}</h2>
        <button type="button" [attr.aria-label]="t.close" (click)="close(false)">
          <ui-icon name="x" />
        </button>
      </header>

      <div class="logout-confirm-dialog-body">
        <p id="logout-confirm-description">{{ t.logoutDescription }}</p>
      </div>

      <footer class="logout-confirm-dialog-footer">
        <button class="logout-confirm-cancel" type="button" (click)="close(false)">
          {{ t.cancel }}
        </button>
        <button class="logout-confirm-action" type="button" (click)="close(true)">
          {{ t.confirmSignOut }}
        </button>
      </footer>
    </section>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .logout-confirm-dialog {
      overflow: hidden;
      border-radius: 1rem;
      background: var(--app-surface-raised);
      box-shadow: 0 18px 42px rgb(15 23 42 / 20%);
      color: var(--app-page-title);
    }

    .logout-confirm-dialog-header {
      display: grid;
      min-height: 4.5rem;
      grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
      align-items: center;
      gap: 0.5rem;
      background: var(--app-surface-muted);
      padding: 0 1rem;
    }

    .logout-confirm-dialog-header button {
      display: grid;
      width: 2.5rem;
      height: 2.5rem;
      place-items: center;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--app-text-secondary);
      cursor: pointer;
    }

    .logout-confirm-dialog-header button:hover {
      background: color-mix(in srgb, var(--app-text) 5%, transparent);
      color: var(--app-text);
    }

    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.25;
    }

    .logout-confirm-dialog-body {
      min-height: 15.25rem;
      padding: 2.1rem 1.4rem;
    }

    p {
      margin: 0;
      font-size: 1.125rem;
      line-height: 1.5;
    }

    .logout-confirm-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.7rem;
      border-top: 1px solid var(--app-border);
      padding: 1.1rem 1.4rem;
    }

    .logout-confirm-dialog-footer button {
      min-height: 3.45rem;
      border-radius: 0.7rem;
      cursor: pointer;
      padding: 0.65rem 1rem;
      font: inherit;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .logout-confirm-cancel {
      border: 1px solid var(--app-border);
      background: transparent;
      color: var(--app-page-title);
    }

    .logout-confirm-action {
      border: 1px solid var(--app-danger);
      background: var(--app-danger);
      color: #fff;
    }

    @media (max-width: 640px) {
      .logout-confirm-dialog-header {
        min-height: 4rem;
        padding-inline: 0.75rem;
      }

      h2 {
        font-size: 1.25rem;
      }

      .logout-confirm-dialog-body {
        min-height: 10rem;
        padding: 1.5rem 1.25rem;
      }

      p,
      .logout-confirm-dialog-footer button {
        font-size: 1rem;
      }

      .logout-confirm-dialog-footer {
        padding: 0.9rem 1.25rem;
      }
    }
  `,
})
export class LogoutConfirmDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  readonly language = inject(LanguageService);

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
