import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ManagedUser, UserRole, UsersService } from './users.service';
import { AuthService } from '../../core/auth/auth.service';
import { UserRoleSelect } from './user-role-select';

@Component({
  selector: 'app-edit-user-dialog',
  imports: [ReactiveFormsModule, UserRoleSelect],
  template: `
    <section class="user-dialog" aria-labelledby="edit-user-title">
      <header><h2 id="edit-user-title">Editar usuário</h2></header>
      <form [formGroup]="form" (ngSubmit)="save()">
        <label>Nome <input formControlName="name" autocomplete="name" maxlength="30" /></label>
        <label
          >Usuário
          <input formControlName="username" autocomplete="off" autocapitalize="off" maxlength="20"
        /></label>
        <label
          >E-mail <input formControlName="email" type="email" autocomplete="email" maxlength="50"
        /></label>
        <label
          >Cargo
          <app-user-role-select formControlName="role" ariaLabel="Cargo" [locked]="isCurrentUser" />
        </label>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <footer>
          <button type="button" class="secondary" (click)="close()" [disabled]="saving()">
            Cancelar
          </button>
          <button type="submit" class="primary" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Salvando...' : 'Salvar alterações' }}
          </button>
        </footer>
      </form>
    </section>
  `,
  styleUrl: './users-page.css',
})
export class EditUserDialog {
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  readonly user = inject<ManagedUser>(DIALOG_DATA);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly isCurrentUser = this.auth.user()?.id === this.user.id;
  readonly form = this.fb.nonNullable.group({
    name: [
      this.user.name,
      [Validators.required, Validators.minLength(2), Validators.maxLength(30)],
    ],
    username: [
      this.user.username,
      [Validators.required, Validators.pattern(/^[a-z0-9]+$/), Validators.maxLength(20)],
    ],
    email: [this.user.email, [Validators.required, Validators.email, Validators.maxLength(50)]],
    role: [this.user.role as UserRole, [Validators.required]],
  });

  close(): void {
    if (!this.saving()) this.ref.close(false);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.users
      .update(this.user, this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.ref.close(true),
        error: (error: HttpErrorResponse) =>
          this.error.set(
            error.status === 422
              ? 'Confira os dados informados.'
              : error.status === 409
                ? 'Usuário ou e-mail já cadastrado.'
                : 'Não foi possível salvar as alterações. Tente novamente.',
          ),
      });
  }
}
