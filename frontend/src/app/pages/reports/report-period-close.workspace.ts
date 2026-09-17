import {
  EligibleEvidence,
  ReportDetail,
  ReportEvidenceSource,
  ReportScope,
  ReportSection,
} from './reports.models';

export type PeriodCloseScopeField =
  | 'period_from'
  | 'period_to'
  | 'comparison_from'
  | 'comparison_to'
  | 'currency'
  | 'comparison_mode'
  | 'is_provisional';

export type ReportEvidenceSourceInput = Pick<
  ReportEvidenceSource,
  | 'section_key'
  | 'review_attachment_id'
  | 'published_evidence_id'
  | 'caption'
  | 'role'
  | 'captured_at'
>;

export function updatePeriodCloseScopeField(
  scope: ReportScope | null,
  field: PeriodCloseScopeField,
  value: string | boolean,
): ReportScope | null {
  return scope ? { ...scope, [field]: value } : scope;
}

export function updatePeriodCloseScopeFilter(
  scope: ReportScope | null,
  field: keyof ReportScope['filters'],
  rawValue: string,
): ReportScope | null {
  if (!scope) return scope;
  const values = [
    ...new Set(
      rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return { ...scope, filters: { ...scope.filters, [field]: values } };
}

export function setPeriodCloseSectionEnabled(
  sections: ReportSection[],
  sectionId: string,
  enabled: boolean,
): ReportSection[] {
  return sections.map((section) => (section.id === sectionId ? { ...section, enabled } : section));
}

export function setPeriodCloseSectionTitle(
  sections: ReportSection[],
  sectionId: string,
  title: string,
): ReportSection[] {
  return sections.map((section) => (section.id === sectionId ? { ...section, title } : section));
}

export function movePeriodCloseSection(
  sections: ReportSection[],
  sectionId: string,
  direction: -1 | 1,
): ReportSection[] {
  const index = sections.findIndex((section) => section.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function togglePeriodCloseAction(
  actionIds: string[],
  actionId: string,
  selected: boolean,
): string[] {
  const next = new Set(actionIds);
  selected ? next.add(actionId) : next.delete(actionId);
  return [...next];
}

export function toEvidenceSourceInput(source: ReportEvidenceSource): ReportEvidenceSourceInput {
  return {
    section_key: source.section_key,
    review_attachment_id: source.review_attachment_id,
    published_evidence_id: source.published_evidence_id,
    caption: source.caption,
    role: source.role,
    captured_at: source.captured_at,
  };
}

export function togglePeriodCloseEvidence(
  report: ReportDetail,
  candidate: EligibleEvidence,
  selected: boolean,
): ReportEvidenceSourceInput[] | null {
  const section = report.sections.find((item) => item.kind === 'EVIDENCE');
  if (!section) return null;

  const sources = report.evidence_sources
    .filter((item) => item.review_attachment_id !== candidate.id)
    .map(toEvidenceSourceInput);
  if (selected) {
    sources.push({
      section_key: section.section_key,
      review_attachment_id: candidate.id,
      published_evidence_id: null,
      caption: candidate.item_description || candidate.review_title || candidate.filename,
      role: 'CONTEXT',
      captured_at: null,
    });
  }
  return sources;
}

export function updatePeriodCloseEvidenceMetadata(
  sources: ReportEvidenceSource[],
  sourceId: string,
  field: 'caption' | 'role' | 'captured_at',
  value: string,
): ReportEvidenceSource[] {
  return sources.map((source) => {
    if (source.id !== sourceId) return source;
    if (field === 'role') return { ...source, role: value as ReportEvidenceSource['role'] };
    if (field === 'captured_at') return { ...source, captured_at: value || null };
    return { ...source, caption: value };
  });
}
