import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { LoginDialog } from '../../layouts/dashboard-shell/login-dialog';
import { ThemeService } from '../../theme/theme.service';
import { UiIcon } from '../../ui-icon';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../shared/list-filters/list-filter-select';
import { ScrapDefectType, ScrapReviewService } from '../scrap-base/scrap-base.public-api';
import { ScrapTargetService } from './scrap-target.service';
import { SettingsStore, SettingsTab } from './settings.store';
import {
  createClassificationRuleWrite,
  createDefectTypeCode,
  createPrefilledTargets,
} from './settings.calculations';
import { DefectTypesStore } from './defect-types.store';
import { ClassificationsStore } from './classifications.store';
import { TargetsStore } from './targets.store';
import { ProductionField, ProductionStore } from './production.store';
import { ProductionMeasurementService } from './production-measurement.service';
import {
  ScrapClassificationKind,
  ScrapClassificationRule,
  ScrapClassificationService,
} from './scrap-classification.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, MatSlideToggle, UiIcon, ListFilterSelect, CurrencyPipe, DecimalPipe],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
  providers: [SettingsStore, DefectTypesStore, ClassificationsStore, TargetsStore, ProductionStore],
})
export class SettingsPage {
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  readonly authService = inject(AuthService);
  readonly scrapReviewService = inject(ScrapReviewService);
  readonly scrapTargetService = inject(ScrapTargetService);
  readonly productionMeasurementService = inject(ProductionMeasurementService);
  readonly scrapClassificationService = inject(ScrapClassificationService);
  private readonly dialog = inject(MatDialog);
  private readonly settingsStore = inject(SettingsStore);
  readonly activeTab = this.settingsStore.activeTab;

  private readonly defectTypesStore = inject(DefectTypesStore);
  private readonly classificationsStore = inject(ClassificationsStore);
  private readonly targetsStore = inject(TargetsStore);
  private readonly productionStore = inject(ProductionStore);

  readonly defectTypes = this.defectTypesStore.items;
  readonly loadingDefectTypes = this.defectTypesStore.loading;
  readonly submitting = this.defectTypesStore.submitting;
  readonly feedbackMessage = this.defectTypesStore.feedback;
  readonly newName = this.defectTypesStore.newName;
  readonly newCode = this.defectTypesStore.newCode;
  readonly newDesc = this.defectTypesStore.newDescription;
  readonly codeManuallyEdited = this.defectTypesStore.codeManuallyEdited;
  readonly editingId = this.defectTypesStore.editingId;
  readonly editName = this.defectTypesStore.editName;
  readonly editDesc = this.defectTypesStore.editDescription;
  readonly confirmingDeleteItem = this.defectTypesStore.confirmingDeleteItem;
  readonly activeCount = this.defectTypesStore.activeCount;
  readonly totalCount = this.defectTypesStore.totalCount;

  readonly classificationRules = this.classificationsStore.rules;
  readonly loadingClassifications = this.classificationsStore.loading;
  readonly savingClassification = this.classificationsStore.saving;
  readonly classificationFeedback = this.classificationsStore.feedback;
  readonly editingClassificationId = this.classificationsStore.editingId;
  readonly classificationKind = this.classificationsStore.kind;
  readonly classificationSource = this.classificationsStore.source;
  readonly classificationContext = this.classificationsStore.context;
  readonly classificationTarget = this.classificationsStore.target;
  readonly classificationSecondary = this.classificationsStore.secondaryTarget;
  readonly classificationBoolean = this.classificationsStore.booleanValue;
  readonly classificationMode = this.classificationsStore.matchMode;
  readonly classificationPriority = this.classificationsStore.priority;

  readonly selectedTargetYear = this.targetsStore.selectedYear;
  readonly availableTargetYears = this.targetsStore.availableYears;
  readonly monthlyTargets = this.targetsStore.monthlyTargets;
  readonly previousYearTargets = this.targetsStore.previousYearTargets;
  readonly loadingTargets = this.targetsStore.loading;
  readonly submittingTargets = this.targetsStore.submitting;
  readonly targetFeedback = this.targetsStore.feedback;
  readonly prefillMode = this.targetsStore.prefillMode;
  readonly prefillAnnualTotal = this.targetsStore.prefillAnnualTotal;
  readonly prefillJanValue = this.targetsStore.prefillJanuaryValue;
  readonly prefillDecValue = this.targetsStore.prefillDecemberValue;
  readonly currentYearTotal = this.targetsStore.currentYearTotal;
  readonly currentYearAverage = this.targetsStore.currentYearAverage;
  readonly previousYearTotal = this.targetsStore.previousYearTotal;
  readonly previousYearVariationPercent = this.targetsStore.previousYearVariationPercent;

  readonly selectedProductionYear = this.productionStore.selectedYear;
  readonly availableProductionYears = this.productionStore.availableYears;
  readonly productionMonths = this.productionStore.months;
  readonly productionSaving = this.productionStore.saving;
  readonly loadingProduction = this.productionStore.loading;
  readonly productionFeedback = this.productionStore.feedback;
  readonly productionFilledMonths = this.productionStore.filledMonths;
  readonly productionHasErrors = this.productionStore.hasErrors;
  readonly productionYearOptions = computed<readonly ListFilterSelectOption[]>(() =>
    this.availableProductionYears().map((year) => ({ value: String(year), label: String(year) })),
  );

  readonly canEditTargets = computed(() => this.authService.isAuthenticated());

  readonly monthLabels = computed(() => {
    const lang = this.language.currentLanguage();
    if (lang === 'en') {
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }
    if (lang === 'ko') {
      return [
        '1ì›”',
        '2ì›”',
        '3ì›”',
        '4ì›”',
        '5ì›”',
        '6ì›”',
        '7ì›”',
        '8ì›”',
        '9ì›”',
        '10ì›”',
        '11ì›”',
        '12ì›”',
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

  selectProductionYear(year: number): void {
    this.selectedProductionYear.set(year);
    if (this.authService.isAuthenticated()) this.loadProduction(year);
  }

  loadProduction(year: number): void {
    this.loadingProduction.set(true);
    this.productionMeasurementService.getYear(year).subscribe({
      next: (measurements) => {
        const byMonth = new Map(
          measurements.map((measurement) => [measurement.month, measurement]),
        );
        this.productionMonths.set(
          this.productionStore.createEmptyMonths().map((row) => {
            const measurement = byMonth.get(row.month);
            return measurement
              ? {
                  ...row,
                  revision: measurement.revision,
                  productionValue: measurement.production_value,
                  productionQuantity: measurement.production_quantity,
                  note: measurement.note,
                }
              : row;
          }),
        );
        this.loadingProduction.set(false);
      },
      error: () => {
        this.loadingProduction.set(false);
        this.productionFeedback.set({
          type: 'error',
          text: this.language.translations().productionSettingsLoadError,
        });
      },
    });
  }

  selectTab(tab: SettingsTab): void {
    if (!this.settingsStore.selectTab(tab, this.authService.isAuthenticated())) return;
    if (tab === 'system') {
      this.loadDefectTypes();
    } else if (tab === 'classifications') {
      this.loadClassifications();
    } else if (tab === 'targets') {
      this.loadTargets(this.selectedTargetYear());
    } else if (tab === 'production') {
      this.loadProduction(this.selectedProductionYear());
    }
  }

  updateProductionRow(index: number, field: ProductionField, value: string | number | null): void {
    this.productionMonths.update((rows) =>
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (field === 'note') {
          return { ...row, [field]: String(value ?? '') };
        }
        if (value === '' || value === null || value === undefined) {
          return { ...row, [field]: null };
        }
        const parsed = Number(value);
        return { ...row, [field]: Number.isFinite(parsed) ? parsed : Number.NaN };
      }),
    );
    this.productionFeedback.set(null);
  }

  saveProductionDraft(): void {
    if (this.productionHasErrors()) {
      this.productionFeedback.set({
        type: 'error',
        text: this.language.translations().productionSettingsValidationError,
      });
      return;
    }
    const measurements = this.productionMonths()
      .filter((row) => row.productionValue !== null || row.productionQuantity !== null)
      .map((row) => ({
        month: row.month,
        production_value: row.productionValue,
        production_quantity: row.productionQuantity,
        note: row.note.trim(),
        expected_version: row.revision,
      }));
    if (measurements.length === 0) {
      this.productionFeedback.set({
        type: 'error',
        text: this.language.translations().productionSettingsEmptyError,
      });
      return;
    }
    this.productionSaving.set(true);
    this.productionMeasurementService
      .saveYear(this.selectedProductionYear(), measurements)
      .subscribe({
        next: (saved) => {
          this.productionFeedback.set({
            type: 'success',
            text: this.language.translations().productionSettingsSaved,
          });
          this.productionMonths.set(
            this.productionStore.createEmptyMonths().map((row) => {
              const measurement = saved.find((item) => item.month === row.month);
              return measurement
                ? {
                    ...row,
                    revision: measurement.revision,
                    productionValue: measurement.production_value,
                    productionQuantity: measurement.production_quantity,
                    note: measurement.note,
                  }
                : row;
            }),
          );
          this.productionSaving.set(false);
        },
        error: (error: { status?: number }) => {
          this.productionSaving.set(false);
          this.productionFeedback.set({
            type: 'error',
            text:
              error.status === 409
                ? this.language.translations().productionSettingsConflictError
                : this.language.translations().productionSettingsSaveError,
          });
        },
      });
  }

  clearProductionDraft(): void {
    const expectedVersions = this.productionMonths().reduce<Record<number, number>>(
      (versions, row) => (row.revision > 0 ? { ...versions, [row.month]: row.revision } : versions),
      {},
    );
    if (Object.keys(expectedVersions).length === 0) {
      this.productionMonths.set(this.productionStore.createEmptyMonths());
      this.productionFeedback.set({
        type: 'success',
        text: this.language.translations().productionSettingsDraftCleared,
      });
      return;
    }
    this.productionSaving.set(true);
    this.productionMeasurementService
      .clearYear(this.selectedProductionYear(), expectedVersions)
      .subscribe({
        next: () => {
          this.productionMonths.set(this.productionStore.createEmptyMonths());
          this.productionSaving.set(false);
          this.productionFeedback.set({
            type: 'success',
            text: this.language.translations().productionSettingsCleared,
          });
        },
        error: (error: { status?: number }) => {
          this.productionSaving.set(false);
          this.productionFeedback.set({
            type: 'error',
            text:
              error.status === 409
                ? this.language.translations().productionSettingsConflictError
                : this.language.translations().productionSettingsClearError,
          });
        },
      });
  }

  loadClassifications(): void {
    this.loadingClassifications.set(true);
    this.scrapClassificationService.list().subscribe({
      next: (rules) => {
        this.classificationRules.set(rules);
        this.loadingClassifications.set(false);
        this.classificationFeedback.set(null);
      },
      error: () => {
        this.loadingClassifications.set(false);
        this.classificationFeedback.set({
          type: 'error',
          text: 'NÃ£o foi possÃ­vel carregar as classificaÃ§Ãµes compartilhadas.',
        });
      },
    });
  }

  classificationKindLabel(kind: ScrapClassificationKind): string {
    return {
      PRODUCT_ALIAS: 'Apelido de produto',
      ORGANIZATION: 'OrganizaÃ§Ã£o â†’ produto/divisÃ£o',
      DEPARTMENT: 'Setor de recebimento â†’ departamento',
      COUNTING: 'Conta â†’ entra no IF Cost',
      ITEM_TYPE: 'DescriÃ§Ã£o â†’ tipo de item',
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
    const payload = createClassificationRuleWrite({
      kind,
      source,
      context: this.classificationContext(),
      target: this.classificationTarget(),
      secondaryTarget: this.classificationSecondary(),
      booleanValue: this.classificationBoolean(),
      matchMode: this.classificationMode(),
      priority: this.classificationPriority(),
    });
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
          text: 'Regra salva. Reaplique para refletir dados jÃ¡ ingeridos.',
        });
        this.resetClassificationForm();
      },
      error: (error) => {
        this.savingClassification.set(false);
        this.classificationFeedback.set({
          type: 'error',
          text: error.error?.detail || 'NÃ£o foi possÃ­vel salvar a regra.',
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
          text: 'Regra removida. Reaplique para atualizar o histÃ³rico.',
        });
      },
      error: () => {
        this.savingClassification.set(false);
        this.classificationFeedback.set({
          type: 'error',
          text: 'NÃ£o foi possÃ­vel remover a regra.',
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
          text: 'NÃ£o foi possÃ­vel reaplicar as classificaÃ§Ãµes.',
        });
      },
    });
  }

  onNewNameInput(value: string): void {
    this.newName.set(value);
    if (!this.codeManuallyEdited()) {
      this.newCode.set(createDefectTypeCode(value));
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
    let code = this.newCode().trim() || createDefectTypeCode(name);
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

    this.monthlyTargets.set(
      createPrefilledTargets(
        labels,
        mode,
        this.prefillAnnualTotal(),
        this.prefillJanValue(),
        this.prefillDecValue(),
      ),
    );
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
