import { Component, inject } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { LanguageService } from '../../i18n/language.service';
import { ThemeService } from '../../theme/theme.service';

@Component({
  selector: 'app-settings-page',
  imports: [MatSlideToggle],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
}
