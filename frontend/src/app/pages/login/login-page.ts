import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginDialog } from '../../layouts/dashboard-shell/login-dialog';
import { ThemeService } from '../../theme/theme.service';

@Component({
  selector: 'app-login-page',
  imports: [LoginDialog],
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
