import { Component, OnInit, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { finalize } from 'rxjs';
import { ManagedUser, UsersService, roleLabel } from './users.service';
import { UserDialog } from './user-dialog';
import { DeleteUserDialog } from './delete-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { ListPanel } from '../../shared/list-view/list-panel/list-panel';
import { ListPagination } from '../../shared/list-view/list-pagination/list-pagination';
import { StatusBadge } from '../../shared/list-view/status-badge/status-badge';
import { UiIcon } from '../../ui-icon';
import { ListFeedback } from '../../shared/list-view/list-feedback/list-feedback';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-users-page',
  imports: [ListPanel, ListPagination, ListFeedback, StatusBadge, UiIcon],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPage implements OnInit {
  private readonly service = inject(UsersService);
  private readonly dialog = inject(Dialog);
  readonly auth = inject(AuthService);
  private requestVersion = 0;
  readonly users = signal<ManagedUser[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal<number | null>(null);
  readonly loadError = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly totalItems = signal(0);
  readonly totalPages = signal(0);
  readonly allowedPageSizes = [10, 25, 50, 100] as const;
  readonly roleLabel = roleLabel;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const requestVersion = ++this.requestVersion;
    this.loading.set(true);
    this.loadError.set(false);
    this.users.set([]);
    this.service
      .list(this.page(), this.pageSize())
      .pipe(
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          if (requestVersion !== this.requestVersion) return;
          if (result.total_pages > 0 && this.page() > result.total_pages) {
            this.page.set(result.total_pages);
            this.load();
            return;
          }
          this.users.set(result.items);
          this.totalItems.set(result.total_items);
          this.totalPages.set(result.total_pages);
        },
        error: () => {
          if (requestVersion !== this.requestVersion) return;
          this.users.set([]);
          this.loadError.set(true);
        },
      });
  }

  selectPageSize(size: number): void {
    if (!this.allowedPageSizes.some((allowed) => allowed === size)) return;
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  previousPage(): void {
    if (this.page() <= 1) return;
    this.page.update((page) => page - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update((page) => page + 1);
    this.load();
  }

  create(): void {
    this.dialog
      .open<boolean>(UserDialog, {
        ariaLabelledBy: 'new-user-title',
        ariaModal: true,
        autoFocus: 'input',
        backdropClass: 'logout-confirm-dialog-backdrop',
        maxWidth: 'calc(100vw - 2rem)',
        width: '32rem',
        restoreFocus: true,
      })
      .closed.subscribe((created) => {
        if (created) {
          this.page.set(1);
          this.load();
        }
      });
  }

  toggle(user: ManagedUser, active: boolean): void {
    this.busyId.set(user.id);
    this.service
      .setActive(user, active)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (updated) => this.replace(updated),
        error: () => this.showAlert('Não foi possível alterar o status.'),
      });
  }

  edit(user: ManagedUser): void {
    this.dialog
      .open<boolean>(EditUserDialog, {
        data: user,
        ariaLabelledBy: 'edit-user-title',
        ariaModal: true,
        autoFocus: 'input',
        backdropClass: 'logout-confirm-dialog-backdrop',
        maxWidth: 'calc(100vw - 2rem)',
        width: '32rem',
        restoreFocus: true,
      })
      .closed.subscribe((saved) => {
        if (saved) this.load();
      });
  }

  remove(user: ManagedUser): void {
    this.dialog
      .open<boolean>(DeleteUserDialog, {
        data: user,
        ariaLabelledBy: 'delete-user-title',
        ariaModal: true,
        autoFocus: 'dialog',
        backdropClass: 'logout-confirm-dialog-backdrop',
        maxWidth: 'calc(100vw - 2rem)',
        width: '28rem',
        restoreFocus: true,
      })
      .closed.subscribe((confirmed) => {
        if (confirmed) this.deleteConfirmed(user);
      });
  }

  private deleteConfirmed(user: ManagedUser): void {
    this.busyId.set(user.id);
    this.service
      .remove(user)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          if (this.users().length === 1 && this.page() > 1) this.page.update((page) => page - 1);
          this.load();
        },
        error: () => this.showAlert('Não foi possível excluir o usuário.'),
      });
  }

  private replace(updated: ManagedUser): void {
    this.users.update((users) => users.map((user) => (user.id === updated.id ? updated : user)));
    this.showAlert('Alteração salva.');
  }

  private showAlert(message: string): void {
    window.alert(message);
  }
}
