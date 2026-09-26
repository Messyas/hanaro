import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

import type { AppTranslations, LanguageCode, LanguageOption } from './language.models';
import { TRANSLATIONS } from './language.translations';

export type { AppTranslations, LanguageCode, LanguageOption } from './language.models';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storageKey = 'hanaro-language-preference';

  readonly currentLanguage = signal<LanguageCode>(this.readInitialLanguage());
  readonly isKorean = computed(() => this.currentLanguage() === 'ko');
  readonly translations = computed<AppTranslations>(() => TRANSLATIONS[this.currentLanguage()]);
  readonly availableLanguages = computed<readonly LanguageOption[]>(() => {
    const t = this.translations();
    return [
      { code: 'pt', label: t.portugueseLanguage, nativeName: 'Português (BR)' },
      { code: 'en', label: t.englishLanguage, nativeName: 'English' },
      { code: 'ko', label: t.koreanLanguage, nativeName: '한국어' },
    ];
  });

  constructor() {
    effect(() => {
      const language = this.currentLanguage();

      if (this.isBrowser) {
        this.document.documentElement.setAttribute('lang', language === 'pt' ? 'pt-BR' : language);

        try {
          localStorage.setItem(this.storageKey, language);
        } catch {
          // The language remains active for this session when storage is unavailable.
        }
      }
    });
  }

  setLanguage(code: LanguageCode): void {
    if (this.isValidLanguage(code)) this.currentLanguage.set(code);
  }

  private readInitialLanguage(): LanguageCode {
    if (!this.isBrowser) return 'pt';

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (this.isValidLanguage(stored)) return stored;
    } catch {
      // Fall back to the document or browser locale when storage is unavailable.
    }

    const documentLang = this.document.documentElement.getAttribute('lang')?.toLowerCase();
    if (documentLang?.startsWith('ko')) return 'ko';
    if (documentLang?.startsWith('en')) return 'en';
    if (documentLang?.startsWith('pt')) return 'pt';

    const browserLang = navigator.language?.toLowerCase().slice(0, 2);
    if (browserLang === 'ko') return 'ko';
    if (browserLang === 'en') return 'en';
    return 'pt';
  }

  private isValidLanguage(value: string | null | undefined): value is LanguageCode {
    return value === 'pt' || value === 'en' || value === 'ko';
  }
}
