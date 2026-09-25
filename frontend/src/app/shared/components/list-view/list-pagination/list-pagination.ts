import { Component, computed, input, output } from '@angular/core';
import { ListFilterSelect, ListFilterSelectOption } from '../../list-filters/list-filter-select';
import { UiIcon } from '../../ui-icon/ui-icon';

@Component({
  selector: 'app-list-pagination',
  imports: [ListFilterSelect, UiIcon],
  templateUrl: './list-pagination.html',
  styleUrl: './list-pagination.css',
})
export class ListPagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageSizes = input.required<readonly number[]>();
  readonly pageLabel = input('Página');
  readonly ofLabel = input('de');
  readonly perPageLabel = input('Por página');
  readonly previousLabel = input('Página anterior');
  readonly nextLabel = input('Próxima página');
  readonly pageSizeChanged = output<number>();
  readonly previous = output<void>();
  readonly next = output<void>();

  readonly pageSizeValue = computed(() => String(this.pageSize()));
  readonly pageSizeOptions = computed<readonly ListFilterSelectOption[]>(() =>
    this.pageSizes().map((value) => ({ value: String(value), label: String(value) })),
  );

  changePageSize(value: string): void {
    this.pageSizeChanged.emit(Number(value));
  }
}
