import type { AppTranslations, LanguageCode } from './language.models';
import { PT_TRANSLATIONS } from './language.pt';
import { EN_TRANSLATIONS } from './language.en';
import { KO_TRANSLATIONS } from './language.ko';

export const TRANSLATIONS: Record<LanguageCode, AppTranslations> = {
  pt: PT_TRANSLATIONS,
  en: EN_TRANSLATIONS,
  ko: KO_TRANSLATIONS,
};
