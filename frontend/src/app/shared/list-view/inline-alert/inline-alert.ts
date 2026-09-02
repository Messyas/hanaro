import { Component, input } from '@angular/core';
import { UiIcon } from '../../../ui-icon';

@Component({
  selector: 'app-inline-alert',
  imports: [UiIcon],
  templateUrl: './inline-alert.html',
  styleUrl: './inline-alert.css',
})
export class InlineAlert {
  readonly message = input.required<string>();
}
