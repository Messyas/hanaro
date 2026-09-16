import { TestBed } from '@angular/core/testing';
import { ReportListStore } from './report-list.store';

describe('ReportListStore', () => {
  it('resets list filters and creation state together', () => {
    const store = TestBed.configureTestingModule({ providers: [ReportListStore] }).inject(
      ReportListStore,
    );
    store.page.set(3);
    store.search.set('weekly');
    store.showCreate.set(true);
    store.createTitle.set('New report');

    store.reset();

    expect(store.page()).toBe(1);
    expect(store.search()).toBe('');
    expect(store.showCreate()).toBe(false);
    expect(store.createTitle()).toBe('');
  });
});
