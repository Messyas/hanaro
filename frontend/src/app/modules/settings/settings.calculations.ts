import type {
  ScrapClassificationKind,
  ScrapClassificationRuleWrite,
} from './scrap-classification.service';

export interface MonthlyTarget {
  month: number;
  name: string;
  amount: number;
}

export interface ClassificationFormValues {
  kind: ScrapClassificationKind;
  source: string;
  context: string;
  target: string;
  secondaryTarget: string;
  booleanValue: 'true' | 'false';
  matchMode: 'EXACT' | 'REGEX';
  priority: number;
}

export function createMonthlyTargets(labels: readonly string[]): MonthlyTarget[] {
  return Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    name: labels[index] ?? `M${index + 1}`,
    amount: 0,
  }));
}

export function createPrefilledTargets(
  labels: readonly string[],
  mode: 'linear' | 'curve',
  annualTotal: number,
  januaryValue: number,
  decemberValue: number,
): MonthlyTarget[] {
  if (mode === 'linear') {
    const monthlyAmount = Math.round((Math.max(0, Number(annualTotal) || 0) / 12) * 100) / 100;
    return createMonthlyTargets(labels).map((target) => ({ ...target, amount: monthlyAmount }));
  }

  const startAmount = Math.max(0, Number(januaryValue) || 0);
  const endAmount = Math.max(0, Number(decemberValue) || 0);
  return createMonthlyTargets(labels).map((target, index) => ({
    ...target,
    amount: Math.round((startAmount + (endAmount - startAmount) * (index / 11)) * 100) / 100,
  }));
}

export function createClassificationRuleWrite(
  values: ClassificationFormValues,
): ScrapClassificationRuleWrite {
  return {
    kind: values.kind,
    source_value: values.source.trim(),
    source_context: values.context.trim() || null,
    target_value: values.target.trim() || null,
    target_secondary: values.secondaryTarget.trim() || null,
    boolean_value: values.kind === 'COUNTING' ? values.booleanValue === 'true' : null,
    match_mode: values.kind === 'ITEM_TYPE' ? values.matchMode : 'EXACT',
    priority: Number(values.priority) || 0,
    is_active: true,
  };
}

export function createDefectTypeCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}
