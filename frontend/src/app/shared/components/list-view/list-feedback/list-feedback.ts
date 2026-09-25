import { Component, input, output } from '@angular/core';
import { UiIcon } from '../../ui-icon/ui-icon';

export type ListFeedbackKind = 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-list-feedback',
  imports: [UiIcon],
  templateUrl: './list-feedback.html',
  styleUrl: './list-feedback.css',
})
export class ListFeedback {
  readonly kind = input.required<ListFeedbackKind>();
  readonly title = input('');
  readonly message = input('');
  readonly retryLabel = input('Tentar novamente');
  readonly retried = output<void>();
}
