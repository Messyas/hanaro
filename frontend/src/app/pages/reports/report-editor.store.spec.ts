import { TestBed } from '@angular/core/testing';
import { ReportEditorStore } from './report-editor.store';

describe('ReportEditorStore', () => {
  it('owns version history state and resets it with the editor', () => {
    const store = TestBed.configureTestingModule({ providers: [ReportEditorStore] }).inject(
      ReportEditorStore,
    );
    store.versionPage.set(3);
    store.versions.set([{ id: 'version-1' } as never]);
    store.draftTitle.set('Draft title');
    store.draftDescription.set('Draft description');
    store.saving.set(true);
    store.saveStatus.set('saving');
    store.lastSavedTime.set('now');
    store.selectedOccurrences.set(new Set(['occurrence-1']));
    store.selectedReports.set(new Set(['report-1']));
    store.occurrenceSearch.set('needle');
    store.sourceReportSearch.set('source');
    store.activeDrawer.set('occurrence');
    store.analytics.set({} as never);
    store.scopeDraft.set({} as never);
    store.actionSearch.set('action');
    store.evidencePage.set(2);
    store.occurrenceCandidates.set({} as never);

    store.reset();

    expect(store.versionPage()).toBe(1);
    expect(store.versions()).toEqual([]);
    expect(store.versionsPage()).toBeNull();
    expect(store.historical()).toBeNull();
    expect(store.draftTitle()).toBe('');
    expect(store.draftDescription()).toBe('');
    expect(store.saving()).toBe(false);
    expect(store.saveStatus()).toBe('idle');
    expect(store.lastSavedTime()).toBeNull();
    expect(store.selectedOccurrences()).toEqual(new Set());
    expect(store.selectedReports()).toEqual(new Set());
    expect(store.occurrenceSearch()).toBe('');
    expect(store.sourceReportSearch()).toBe('');
    expect(store.activeDrawer()).toBeNull();
    expect(store.analytics()).toBeNull();
    expect(store.scopeDraft()).toBeNull();
    expect(store.actionSearch()).toBe('');
    expect(store.evidencePage()).toBe(1);
    expect(store.occurrenceCandidates()).toBeNull();
  });
});
