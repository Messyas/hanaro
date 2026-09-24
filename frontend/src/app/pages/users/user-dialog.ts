import { Component, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { UsersService } from './users.service';
import { UserRoleSelect } from './user-role-select';

@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule, UserRoleSelect],
  template: `
    <section class="user-dialog" aria-labelledby="new-user-title">
      <header>
        <h2 id="new-user-title">Novo usuário</h2>
      </header>
      <form [formGroup]="form" (ngSubmit)="save()">
        <label>Nome <input formControlName="name" autocomplete="name" maxlength="30" /></label>
        <label
          >Usuário
          <input formControlName="username" autocomplete="off" maxlength="20" pattern="[a-z0-9]+"
        /></label>
        <label
          >E-mail <input formControlName="email" type="email" autocomplete="email" maxlength="50"
        /></label>
        <label
          >Cargo
          <app-user-role-select formControlName="role" ariaLabel="Cargo" />
        </label>
        <label
          >Senha inicial
          <input
            formControlName="password"
            type="password"
            autocomplete="new-password"
            minlength="12"
            maxlength="72"
        /></label>
        <p class="hint">Use pelo menos 12 caracteres e uma senha difícil de adivinhar.</p>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <footer>
          <button type="button" class="secondary" (click)="close()" [disabled]="saving()">
            Cancelar
          </button>
          <button type="submit" class="primary" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Criando...' : 'Criar usuário' }}
          </button>
        </footer>
      </form>
    </section>
  `,
  styleUrl: './users-page.css',
})
export class UserDialog {
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly users = inject(UsersService);
  private readonly fb = inject(FormBuilder);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['analista' as const, [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  close(): void {
    this.ref.close(false);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.users
      .create(this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.ref.close(true),
        error: (error: HttpErrorResponse) =>
          this.error.set(
            error.status === 409
              ? 'Usuário ou e-mail já cadastrado.'
              : error.status === 422
                ? 'Confira os dados e escolha uma senha mais forte.'
                : 'Não foi possível criar o usuário. Tente novamente.',
          ),
      });
  }
}
