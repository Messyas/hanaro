import { Component } from '@angular/core';
import { UiIcon } from '../../ui-icon';

@Component({
  selector: 'app-reports-page',
  imports: [UiIcon],
  template: `<section class="empty-state panel" aria-labelledby="reports-title">
    <span class="empty-icon"><ui-icon name="chart-bar" /></span>
    <h1 class="page-title" id="reports-title">Relatórios</h1>
    <p>Esta área está preparada para receber os relatórios gerenciais.</p>
  </section>`,
})
export class ReportsPage {}
