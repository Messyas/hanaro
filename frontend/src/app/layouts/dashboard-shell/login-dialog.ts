import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageCode, LanguageService } from '../../i18n/language.service';
import { UiIcon } from '../../ui-icon';

interface LoginDialogCopy {
  title: string;
  username: string;
  usernamePlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  cancel: string;
  submit: string;
  submitting: string;
  required: string;
  invalid: string;
  unavailable: string;
  capsLock: string;
  showPassword: string;
  hidePassword: string;
  rateLimited: (seconds: number | null) => string;
}

const COPY: Record<LanguageCode, LoginDialogCopy> = {
  pt: {
    title: 'Entrar',
    username: 'Usuário',
    usernamePlaceholder: 'Digite seu usuário',
    password: 'Senha',
    passwordPlaceholder: 'Digite sua senha',
    cancel: 'Cancelar',
    submit: 'Entrar',
    submitting: 'Entrando…',
    required: 'Informe o usuário e a senha.',
    invalid: 'Usuário ou senha incorretos.',
    unavailable: 'Não foi possível entrar. Verifique a conexão e tente novamente.',
    capsLock: 'Caps Lock está ativado.',
    showPassword: 'Mostrar senha',
    hidePassword: 'Ocultar senha',
    rateLimited: (seconds) =>
      seconds
        ? `Muitas tentativas. Tente novamente em ${seconds} segundos.`
        : 'Muitas tentativas. Aguarde e tente novamente.',
  },
  en: {
    title: 'Sign in',
    username: 'Username',
    usernamePlaceholder: 'Enter your username',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    cancel: 'Cancel',
    submit: 'Sign in',
    submitting: 'Signing in…',
    required: 'Enter your username and password.',
    invalid: 'Incorrect username or password.',
    unavailable: 'Unable to sign in. Check the connection and try again.',
    capsLock: 'Caps Lock is on.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    rateLimited: (seconds) =>
      seconds
        ? `Too many attempts. Try again in ${seconds} seconds.`
        : 'Too many attempts. Wait and try again.',
  },
  ko: {
    title: '로그인',
    username: '사용자 이름',
    usernamePlaceholder: '사용자 이름 입력',
    password: '비밀번호',
    passwordPlaceholder: '비밀번호 입력',
    cancel: '취소',
    submit: '로그인',
    submitting: '로그인 중…',
    required: '사용자 이름과 비밀번호를 입력하세요.',
    invalid: '사용자 이름 또는 비밀번호가 올바르지 않습니다.',
    unavailable: '로그인할 수 없습니다. 연결 상태를 확인하고 다시 시도하세요.',
    capsLock: 'Caps Lock이 켜져 있습니다.',
    showPassword: '비밀번호 표시',
    hidePassword: '비밀번호 숨기기',
    rateLimited: (seconds) =>
      seconds
        ? `로그인 시도가 너무 많습니다. ${seconds}초 후에 다시 시도하세요.`
        : '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
  },
};

@Component({
  selector: 'app-login-dialog',
  imports: [ReactiveFormsModule, UiIcon],
  templateUrl: './login-dialog.html',
  styleUrl: './login-dialog.css',
})
export class LoginDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  readonly language = inject(LanguageService);

  readonly copy = computed(() => COPY[this.language.currentLanguage()]);
  readonly submitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly capsLockActive = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.maxLength(128)]],
    password: ['', [Validators.required, Validators.maxLength(256)]],
  });

  close(): void {
    if (!this.submitting()) this.dialogRef.close(false);
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  updateCapsLock(event: KeyboardEvent): void {
    this.capsLockActive.set(event.getModifierState('CapsLock'));
  }

  clearCapsLockWarning(): void {
    this.capsLockActive.set(false);
  }

  submit(): void {
    if (this.submitting()) return;

    this.errorMessage.set(null);
    if (this.form.invalid || !this.form.controls.username.value.trim()) {
      this.form.markAllAsTouched();
      this.errorMessage.set(this.copy().required);
      return;
    }

    const credentials = this.form.getRawValue();
    this.submitting.set(true);
    this.form.disable({ emitEvent: false });
    this.auth
      .login(credentials.username, credentials.password)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.form.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (authenticated) => {
          if (authenticated) {
            this.form.controls.password.reset('');
            this.dialogRef.close(true);
          } else {
            this.errorMessage.set(this.copy().unavailable);
          }
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 401 || error.status === 403) {
      this.errorMessage.set(this.copy().invalid);
      return;
    }

    if (error.status === 429) {
      const retryAfter = Number(error.headers.get('Retry-After'));
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null;
      this.errorMessage.set(this.copy().rateLimited(seconds));
      return;
    }

    this.errorMessage.set(this.copy().unavailable);
  }
}
