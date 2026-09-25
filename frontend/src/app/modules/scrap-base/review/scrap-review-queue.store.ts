import { Injectable, computed, signal } from '@angular/core';
import { ScrapListItem } from '../list/scrap-base.models';

@Injectable()
export class ScrapReviewQueueStore {
  readonly occurrenceIds = signal<string[]>([]);
  readonly knownOccurrences = signal<ScrapListItem[]>([]);
  readonly index = signal(0);
  readonly currentOccurrenceId = computed(() => this.occurrenceIds()[this.index()] ?? null);
  readonly currentOccurrence = computed(() => {
    const occurrenceId = this.currentOccurrenceId();
    return this.knownOccurrences().find((item) => item.occurrence_id === occurrenceId) ?? null;
  });
  readonly total = computed(() => this.occurrenceIds().length);
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() >= this.total() - 1);

  setOccurrences(ids: readonly string[], knownOccurrences: readonly ScrapListItem[] = []): void {
    const nextIds = [...ids];
    const currentIds = this.occurrenceIds();
    const idsUnchanged =
      currentIds.length === nextIds.length &&
      currentIds.every((id, index) => id === nextIds[index]);
    const currentOccurrences = this.knownOccurrences();
    const occurrencesUnchanged =
      currentOccurrences.length === knownOccurrences.length &&
      currentOccurrences.every((item, index) => item === knownOccurrences[index]);
    if (!idsUnchanged) {
      this.occurrenceIds.set(nextIds);
      this.index.set(0);
    }
    if (!occurrencesUnchanged) this.knownOccurrences.set([...knownOccurrences]);
  }

  next(): boolean {
    if (this.isLast()) return false;
    this.index.update((index) => index + 1);
    return true;
  }

  previous(): boolean {
    if (this.isFirst()) return false;
    this.index.update((index) => index - 1);
    return true;
  }

  reset(): void {
    this.occurrenceIds.set([]);
    this.knownOccurrences.set([]);
    this.index.set(0);
  }
}
