import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { LoginDialog } from '../../layouts/dashboard-shell/login-dialog';
import { ThemeService } from '../../theme/theme.service';
import { UiIcon } from '../../ui-icon';
import { ScrapDefectType } from '../scrap-base/scrap-review.models';
import { ScrapReviewService } from '../scrap-base/scrap-review.service';
import { ScrapTargetService } from './scrap-target.service';
import {
  ScrapClassificationKind,
  ScrapClassificationRule,
  ScrapClassificationRuleWrite,
  ScrapClassificationService,
} from './scrap-classification.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, MatSlideToggle, UiIcon, CurrencyPipe, DecimalPipe],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage implements OnInit {
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  readonly authService = inject(AuthService);
  readonly scrapReviewService = inject(ScrapReviewService);
  readonly scrapTargetService = inject(ScrapTargetService);
  readonly scrapClassificationService = inject(ScrapClassificationService);
  private readonly dialog = inject(MatDialog);

  readonly activeTab = signal<'preferences' | 'classifications' | 'system' | 'targets'>(
    'preferences',
  );

  // Defect types state
  readonly defectTypes = signal<ScrapDefectType[]>([]);
  readonly loadingDefectTypes = signal(false);
  readonly submitting = signal(false);
  readonly feedbackMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  readonly classificationRules = signal<ScrapClassificationRule[]>([]);
  readonly loadingClassifications = signal(false);
  readonly savingClassification = signal(false);
  readonly classificationFeedback = signal<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  readonly editingClassificationId = signal<string | null>(null);
  readonly classificationKind = signal<ScrapClassificationKind>('PRODUCT_ALIAS');
  readonly classificationSource = signal('');
  readonly classificationContext = signal('');
  readonly classificationTarget = signal('');
  readonly classificationSecondary = signal('');
  readonly classificationBoolean = signal<'true' | 'false'>('true');
  readonly classificationMode = signal<'EXACT' | 'REGEX'>('EXACT');
  readonly classificationPriority = signal(0);

  // New defect form
  readonly newName = signal('');
  readonly newCode = signal('');
  readonly newDesc = signal('');
  readonly codeManuallyEdited = signal(false);

  // Edit mode
  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editDesc = signal('');

  readonly activeCount = computed(() => this.defectTypes().filter((d) => d.is_active).length);
  readonly totalCount = computed(() => this.defectTypes().length);

  // Targets state
  readonly selectedTargetYear = signal<number>(2026);
  readonly availableTargetYears = signal<number[]>([2025, 2026, 2027]);
  readonly monthlyTargets = signal<{ month: number; name: string; amount: number }[]>([
    { month: 1, name: 'Jan', amount: 0 },
    { month: 2, name: 'Fev', amount: 0 },
    { month: 3, name: 'Mar', amount: 0 },
    { month: 4, name: 'Abr', amount: 0 },
    { month: 5, name: 'Mai', amount: 0 },
    { month: 6, name: 'Jun', amount: 0 },
    { month: 7, name: 'Jul', amount: 0 },
    { month: 8, name: 'Ago', amount: 0 },
    { month: 9, name: 'Set', amount: 0 },
    { month: 10, name: 'Out', amount: 0 },
    { month: 11, name: 'Nov', amount: 0 },
    { month: 12, name: 'Dez', amount: 0 },
  ]);
  readonly previousYearTargets = signal<Record<number, number>>({});
  readonly loadingTargets = signal<boolean>(false);
  readonly submittingTargets = signal<boolean>(false);
  readonly targetFeedback = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Prefill assistant state
  readonly prefillMode = signal<'linear' | 'curve'>('curve');
  readonly prefillAnnualTotal = signal<number>(120000);
  readonly prefillJanValue = signal<number>(12000);
  readonly prefillDecValue = signal<number>(6000);

  // Computeds
  readonly canEditTargets = computed(() => this.authService.isAuthenticated());

  readonly currentYearTotal = computed(() =>
    this.monthlyTargets().reduce((acc, m) => acc + (Number(m.amount) || 0), 0),
  );

  readonly currentYearAverage = computed(() => {
    const total = this.currentYearTotal();
    return total > 0 ? total / 12 : 0;
  });

  readonly previousYearTotal = computed(() => {
    const prev = this.previousYearTargets();
    const sum = Object.values(prev).reduce((acc, val) => acc + (Number(val) || 0), 0);
    return sum > 0 ? sum : null;
  });

  readonly previousYearVariationPercent = computed(() => {
    const prev = this.previousYearTotal();
    const curr = this.currentYearTotal();
    if (prev === null || prev === 0 || curr === 0) return null;
    return ((curr - prev) / prev) * 100;
  });

  readonly monthLabels = computed(() => {
    const lang = this.language.currentLanguage();
    if (lang === 'en') {
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }
    if (lang === 'ko') {
      return [
        '1월',
        '2월',
        '3월',
        '4월',
        '5월',
        '6월',
        '7월',
        '8월',
        '9월',
        '10월',
        '11월',
        '12월',
      ];
    }
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  });

  readonly sparklinePoints = computed(() => {
    const targets = this.monthlyTargets();
    const amounts = targets.map((t) => Number(t.amount) || 0);
    const max = Math.max(...amounts, 1);
    const width = 360;
    const height = 70;
    const padding = 10;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    return amounts
      .map((val, idx) => {
        const x = padding + (idx / 11) * innerWidth;
        const y = height - padding - (val / max) * innerHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Preferences é pública; dados de configuração exigem sessão.
    if (this.authService.isAuthenticated()) {
      this.loadDefectTypes();
      this.loadTargets(this.selectedTargetYear());
      this.loadClassifications();
    }
  }

  selectTab(tab: 'preferences' | 'classifications' | 'system' | 'targets'): void {
    if (tab !== 'preferences' && !this.authService.isAuthenticated()) return;
    this.activeTab.set(tab);
    if (tab === 'system' && this.defectTypes().length === 0) {
      this.loadDefectTypes();
    } else if (tab === 'classifications' && this.classificationRules().length === 0) {
      this.loadClassifications();
    } else if (tab === 'targets') {
      this.loadTargets(this.selectedTargetYear());
    }
  }

  loadClassifications(): void {
    this.loadingClassifications.set(true);
    this.scrapClassificationService.list().subscribe({
      next: (rules) => {
        this.classificationRules.set(rules);
        this.loadingClassifications.set(false);
      },
      error: () => this.loadingClassifications.set(false),
    });
  }

  classificationKindLabel(kind: ScrapClassificationKind): string {
    return {
      PRODUCT_ALIAS: 'Apelido de produto',
      ORGANIZATION: 'Organização → produto/divisão',
      DEPARTMENT: 'Setor de recebimento → departamento',
      COUNTING: 'Conta → entra no IF Cost',
      ITEM_TYPE: 'Descrição → tipo de item',
    }[kind];
  }

  resetClassificationForm(): void {
    this.editingClassificationId.set(null);
    this.classificationKind.set('PRODUCT_ALIAS');
    this.classificationSource.set('');
    this.classificationContext.set('');
    this.classificationTarget.set('');
    this.classificationSecondary.set('');
    this.classificationBoolean.set('true');
    this.classificationMode.set('EXACT');
    this.classificationPriority.set(0);
  }

  editClassification(rule: ScrapClassificationRule): void {
    this.editingClassificationId.set(rule.id);
    this.classificationKind.set(rule.kind);
    this.classificationSource.set(rule.source_value);
    this.classificationContext.set(rule.source_context || '');
    this.classificationTarget.set(rule.target_value || '');
    this.classificationSecondary.set(rule.target_secondary || '');
    this.classificationBoolean.set(rule.boolean_value === false ? 'false' : 'true');
    this.classificationMode.set(rule.match_mode);
    this.classificationPriority.set(rule.priority);
  }

  saveClassification(): void {
    const kind = this.classificationKind();
    const source = this.classificationSource().trim();
    if (!source || this.savingClassification()) return;
    const payload: ScrapClassificationRuleWrite = {
      kind,
      source_value: source,
      source_context: this.classificationContext().trim() || null,
      target_value: this.classificationTarget().trim() || null,
      target_secondary: this.classificationSecondary().trim() || null,
      boolean_value: kind === 'COUNTING' ? this.classificationBoolean() === 'true' : null,
      match_mode: kind === 'ITEM_TYPE' ? this.classificationMode() : 'EXACT',
      priority: Number(this.classificationPriority()) || 0,
      is_active: true,
    };
    this.savingClassification.set(true);
    const id = this.editingClassificationId();
    const request = id
      ? this.scrapClassificationService.update(id, payload)
      : this.scrapClassificationService.create(payload);
    request.subscribe({
      next: (saved) => {
        this.savingClassification.set(false);
        this.classificationRules.update((rules) =>
          id ? rules.map((rule) => (rule.id === saved.id ? saved : rule)) : [...rules, saved],
        );
        this.classificationFeedback.set({
          type: 'success',
          text: 'Regra salva. Reaplique para refletir dados já ingeridos.',
        });
        this.resetClassificationForm();
      },
      error: (error) => {
        this.savingClassification.set(false);
        this.classificationFeedback.set({
          type: 'error',
          text: error.error?.detail || 'Não foi possível salvar a regra.',
        });
      },
    });
  }

  deleteClassification(rule: ScrapClassificationRule): void {
    if (this.savingClassification()) return;
    this.savingClassification.set(true);
    this.scrapClassificationService.delete(rule.id).subscribe({
      next: () => {
        this.savingClassification.set(false);
        this.classificationRules.update((rules) => rules.filter((item) => item.id !== rule.id));
        this.classificationFeedback.set({
          type: 'success',
          text: 'Regra removida. Reaplique para atualizar o histórico.',
        });
      },
      error: () => {
        this.savingClassification.set(false);
        this.classificationFeedback.set({
          type: 'error',
          text: 'Não foi possível remover a regra.',
        });
      },
    });
  }

  reapplyClassifications(): void {
    if (this.savingClassification()) return;
    this.savingClassification.set(true);
    this.scrapClassificationService.reapply().subscribe({
      next: ({ reclassified_records }) => {
        this.savingClassification.set(false);
        this.classificationFeedback.set({
          type: 'success',
          text: `${reclassified_records} registros foram reclassificados.`,
        });
      },
      error: () => {
        this.savingClassification.set(false);
        this.classificationFeedback.set({
          type: 'error',
          text: 'Não foi possível reaplicar as classificações.',
        });
      },
    });
  }

  private slugify(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  }

  onNewNameInput(value: string): void {
    this.newName.set(value);
    if (!this.codeManuallyEdited()) {
      this.newCode.set(this.slugify(value));
    }
  }

  onNewCodeInput(value: string): void {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    this.newCode.set(formatted);
    this.codeManuallyEdited.set(true);
  }

  loadDefectTypes(): void {
    this.loadingDefectTypes.set(true);
    this.scrapReviewService.getDefectTypes(true).subscribe({
      next: (types) => {
        this.defectTypes.set(types);
        this.loadingDefectTypes.set(false);
      },
      error: () => {
        this.loadingDefectTypes.set(false);
      },
    });
  }

  createDefectType(): void {
    const name = this.newName().trim();
    let code = this.newCode().trim() || this.slugify(name);
    if (!name || !code || this.submitting()) return;

    this.submitting.set(true);
    this.feedbackMessage.set(null);

    this.scrapReviewService
      .createDefectType({
        name,
        code,
        description: this.newDesc().trim() || null,
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.defectTypes.update((current) => [...current, created]);
          this.newName.set('');
          this.newCode.set('');
          this.newDesc.set('');
          this.codeManuallyEdited.set(false);
          this.setFeedback('success', this.language.translations().scrapDefectTypeSuccessCreate);
        },
        error: () => {
          this.submitting.set(false);
          this.setFeedback('error', this.language.translations().scrapDefectTypeErrorCreate);
        },
      });
  }

  toggleActive(type: ScrapDefectType, checked: boolean): void {
    this.scrapReviewService.updateDefectType(type.id, { is_active: checked }).subscribe({
      next: (updated) => {
        this.defectTypes.update((types) =>
          types.map((item) => (item.id === updated.id ? updated : item)),
        );
      },
      error: () => {
        this.setFeedback('error', this.language.translations().scrapDefectTypeErrorUpdate);
      },
    });
  }

  startEdit(type: ScrapDefectType): void {
    this.editingId.set(type.id);
    this.editName.set(type.name);
    this.editDesc.set(type.description || '');
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(type: ScrapDefectType): void {
    const name = this.editName().trim();
    if (!name || this.submitting()) return;

    this.submitting.set(true);
    this.scrapReviewService
      .updateDefectType(type.id, {
        name,
        description: this.editDesc().trim() || null,
      })
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.editingId.set(null);
          this.defectTypes.update((types) =>
            types.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.setFeedback('success', this.language.translations().scrapDefectTypeSuccessUpdate);
        },
        error: () => {
          this.submitting.set(false);
          this.setFeedback('error', this.language.translations().scrapDefectTypeErrorUpdate);
        },
      });
  }

  readonly confirmingDeleteItem = signal<ScrapDefectType | null>(null);

  promptDelete(type: ScrapDefectType): void {
    this.confirmingDeleteItem.set(type);
  }

  cancelDelete(): void {
    this.confirmingDeleteItem.set(null);
  }

  confirmDelete(type: ScrapDefectType): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.confirmingDeleteItem.set(null);

    this.scrapReviewService.deleteDefectType(type.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.defectTypes.update((types) => types.filter((item) => item.id !== type.id));
        this.setFeedback('success', this.language.translations().scrapDefectTypeSuccessDelete);
      },
      error: (err) => {
        this.submitting.set(false);
        const detail = err.error?.detail || this.language.translations().scrapDefectTypeErrorDelete;
        this.setFeedback('error', detail);
      },
    });
  }

  private setFeedback(type: 'success' | 'error', text: string): void {
    this.feedbackMessage.set({ type, text });
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = setTimeout(() => {
      this.feedbackMessage.set(null);
    }, 4500);
  }

  loadTargets(year: number): void {
    this.loadingTargets.set(true);
    this.scrapTargetService.getTargets(year).subscribe({
      next: (targets) => {
        const labels = this.monthLabels();
        const updated = Array.from({ length: 12 }, (_, i) => {
          const monthNum = i + 1;
          const found = targets.find((t) => t.month === monthNum);
          return {
            month: monthNum,
            name: labels[i] ?? `M${monthNum}`,
            amount: found ? Number(found.amount) : 0,
          };
        });
        this.monthlyTargets.set(updated);
        this.loadingTargets.set(false);
      },
      error: () => {
        this.loadingTargets.set(false);
      },
    });

    // Load previous year for comparison
    this.scrapTargetService.getTargets(year - 1).subscribe({
      next: (targets) => {
        const map: Record<number, number> = {};
        for (const t of targets) {
          map[t.month] = Number(t.amount);
        }
        this.previousYearTargets.set(map);
      },
      error: () => {
        this.previousYearTargets.set({});
      },
    });
  }

  selectTargetYear(year: number): void {
    this.selectedTargetYear.set(year);
    this.loadTargets(year);
  }

  updateMonthAmount(month: number, value: string | number): void {
    const num = Math.max(0, Number(value) || 0);
    this.monthlyTargets.update((list) =>
      list.map((m) => (m.month === month ? { ...m, amount: num } : m)),
    );
  }

  applyPrefill(): void {
    const mode = this.prefillMode();
    const labels = this.monthLabels();

    if (mode === 'linear') {
      const total = Math.max(0, Number(this.prefillAnnualTotal()) || 0);
      const perMonth = Math.round((total / 12) * 100) / 100;
      this.monthlyTargets.set(
        Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          name: labels[i],
          amount: perMonth,
        })),
      );
    } else {
      const start = Math.max(0, Number(this.prefillJanValue()) || 0);
      const end = Math.max(0, Number(this.prefillDecValue()) || 0);
      this.monthlyTargets.set(
        Array.from({ length: 12 }, (_, i) => {
          const fraction = i / 11;
          const val = start + (end - start) * fraction;
          return {
            month: i + 1,
            name: labels[i],
            amount: Math.round(val * 100) / 100,
          };
        }),
      );
    }
  }

  saveTargetsPlan(): void {
    if (!this.canEditTargets()) return;
    this.submittingTargets.set(true);
    const year = this.selectedTargetYear();
    const items = this.monthlyTargets().map((m) => ({
      month: m.month,
      amount: m.amount,
    }));

    this.scrapTargetService.saveYearPlan(year, items).subscribe({
      next: () => {
        this.submittingTargets.set(false);
        this.showTargetFeedback('success', this.language.translations().targetPlanSavedSuccess);
        this.loadTargets(year);
      },
      error: () => {
        this.submittingTargets.set(false);
        this.showTargetFeedback('error', this.language.translations().targetPlanSaveError);
      },
    });
  }

  clearTargetsPlan(): void {
    if (!this.canEditTargets()) return;
    const year = this.selectedTargetYear();
    this.submittingTargets.set(true);
    this.scrapTargetService.deleteYearPlan(year).subscribe({
      next: () => {
        this.submittingTargets.set(false);
        this.showTargetFeedback('success', this.language.translations().targetPlanClearedSuccess);
        this.loadTargets(year);
      },
      error: () => {
        this.submittingTargets.set(false);
        this.showTargetFeedback('error', this.language.translations().targetPlanSaveError);
      },
    });
  }

  openLoginDialog(): void {
    this.dialog.open(LoginDialog, {
      ariaLabelledBy: 'login-dialog-title',
      panelClass: 'login-dialog-panel',
    });
  }

  private showTargetFeedback(type: 'success' | 'error', text: string): void {
    this.targetFeedback.set({ type, text });
    setTimeout(() => this.targetFeedback.set(null), 4500);
  }
}
