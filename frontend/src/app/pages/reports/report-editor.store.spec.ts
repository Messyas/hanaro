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
  });
});
