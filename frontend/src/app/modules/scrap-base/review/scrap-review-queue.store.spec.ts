import { ScrapListItem } from '../list/scrap-base.models';
import { ScrapReviewQueueStore } from './scrap-review-queue.store';

const occurrence = (id: string): ScrapListItem =>
  ({ occurrence_id: id, organization_code: id }) as ScrapListItem;

describe('ScrapReviewQueueStore', () => {
  it('preserves selection order, navigates both directions and stops at the ends', () => {
    const store = new ScrapReviewQueueStore();
    const first = occurrence('occ-1');
    const second = occurrence('occ-2');
    store.setOccurrences(['occ-2', 'occ-1'], [first, second]);

    expect(store.currentOccurrenceId()).toBe('occ-2');
    expect(store.currentOccurrence()).toBe(second);
    expect(store.isFirst()).toBe(true);
    expect(store.previous()).toBe(false);
    expect(store.next()).toBe(true);
    expect(store.currentOccurrenceId()).toBe('occ-1');
    expect(store.isLast()).toBe(true);
    expect(store.next()).toBe(false);
    expect(store.previous()).toBe(true);
    expect(store.currentOccurrenceId()).toBe('occ-2');
  });

  it('shows no prior item metadata when the active ID is not in the snapshot', () => {
    const store = new ScrapReviewQueueStore();
    store.setOccurrences(['occ-missing'], [occurrence('occ-old')]);

    expect(store.currentOccurrenceId()).toBe('occ-missing');
    expect(store.currentOccurrence()).toBeNull();
  });

  it('resets the queue and its index', () => {
    const store = new ScrapReviewQueueStore();
    store.setOccurrences(['occ-1', 'occ-2']);
    store.next();
    store.reset();

    expect(store.occurrenceIds()).toEqual([]);
    expect(store.knownOccurrences()).toEqual([]);
    expect(store.index()).toBe(0);
    expect(store.currentOccurrenceId()).toBeNull();
  });
});
