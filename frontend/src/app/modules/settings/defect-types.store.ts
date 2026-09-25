import { computed, Injectable, signal } from '@angular/core';
import type { ScrapDefectType } from '../scrap-base/scrap-base.public-api';

@Injectable()
export class DefectTypesStore {
  readonly items = signal<ScrapDefectType[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly feedback = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly newName = signal('');
  readonly newCode = signal('');
  readonly newDescription = signal('');
  readonly codeManuallyEdited = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editDescription = signal('');
  readonly confirmingDeleteItem = signal<ScrapDefectType | null>(null);
  readonly activeCount = computed(() => this.items().filter((item) => item.is_active).length);
  readonly totalCount = computed(() => this.items().length);
}
