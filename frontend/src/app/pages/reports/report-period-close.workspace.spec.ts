import {
  movePeriodCloseSection,
  setPeriodCloseSectionEnabled,
  togglePeriodCloseAction,
  togglePeriodCloseEvidence,
  updatePeriodCloseScopeFilter,
} from './report-period-close.workspace';

describe('report period close workspace helpers', () => {
  it('normalizes scope filters and preserves other filter values', () => {
    const scope = {
      filters: { organization_codes: ['ORG-1'], product_codes: [], divisions: [], lines: [] },
    } as never;

    const updated = updatePeriodCloseScopeFilter(
      scope,
      'organization_codes',
      'ORG-2, ORG-2, ORG-3',
    );

    expect(updated?.filters.organization_codes).toEqual(['ORG-2', 'ORG-3']);
    expect(updated?.filters.product_codes).toEqual([]);
  });

  it('updates period-close sections without mutating the prior list', () => {
    const sections = [
      { id: 'first', enabled: true, title: 'First' },
      { id: 'second', enabled: true, title: 'Second' },
    ] as never;

    expect(setPeriodCloseSectionEnabled(sections, 'second', false)).toEqual([
      { id: 'first', enabled: true, title: 'First' },
      { id: 'second', enabled: false, title: 'Second' },
    ]);
    expect(movePeriodCloseSection(sections, 'second', -1).map((section) => section.id)).toEqual([
      'second',
      'first',
    ]);
  });

  it('builds evidence source payloads and action selections immutably', () => {
    const report = {
      sections: [{ kind: 'EVIDENCE', section_key: 'evidence' }],
      evidence_sources: [],
    } as never;
    const candidate = {
      id: 'attachment-1',
      item_description: 'Image evidence',
      review_title: 'Review',
      filename: 'image.png',
    } as never;

    expect(togglePeriodCloseAction(['action-1'], 'action-2', true)).toEqual([
      'action-1',
      'action-2',
    ]);
    expect(togglePeriodCloseEvidence(report, candidate, true)).toEqual([
      expect.objectContaining({
        section_key: 'evidence',
        review_attachment_id: 'attachment-1',
        caption: 'Image evidence',
      }),
    ]);
  });
});
