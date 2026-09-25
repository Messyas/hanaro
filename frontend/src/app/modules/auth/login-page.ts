import { Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { LoginDialog } from './login-dialog';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-login-page',
  imports: [LoginDialog, NgOptimizedImage],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  readonly markSrc = computed(() =>
    this.theme.isDark()
      ? 'collapsed_sidebar/dark-theme/logo-sem-dark.svg'
      : 'collapsed_sidebar/light-theme/logo-sem-light.svg',
  );

  completeLogin(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
