import { Injectable, signal } from '@angular/core';
import type {
  ScrapClassificationKind,
  ScrapClassificationRule,
} from './scrap-classification.service';

@Injectable()
export class ClassificationsStore {
  readonly rules = signal<ScrapClassificationRule[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly feedback = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly kind = signal<ScrapClassificationKind>('PRODUCT_ALIAS');
  readonly source = signal('');
  readonly context = signal('');
  readonly target = signal('');
  readonly secondaryTarget = signal('');
  readonly booleanValue = signal<'true' | 'false'>('true');
  readonly matchMode = signal<'EXACT' | 'REGEX'>('EXACT');
  readonly priority = signal(0);
}
