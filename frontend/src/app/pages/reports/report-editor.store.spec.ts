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
    store.previewOpen.set(true);
    store.workspaceError.set('error');
    store.active.set({} as never);
    store.exportFormats.set({ 'version-1': 'PDF' });
    store.exportJobs.set({ 'version-1:PDF': {} as never });

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
    expect(store.previewOpen()).toBe(false);
    expect(store.workspaceError()).toBeNull();
    expect(store.active()).toBeNull();
    expect(store.exportFormats()).toEqual({});
    expect(store.exportJobs()).toEqual({});
  });
});
