import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-list-table-skeleton',
  imports: [],
  templateUrl: './list-table-skeleton.html',
  styleUrl: './list-table-skeleton.css',
})
export class ListTableSkeleton {
  readonly columns = input.required<readonly string[]>();
  readonly rows = input(6);
  readonly minWidth = input('68rem');
  readonly loadingLabel = input('Carregando dados da tabela');

  readonly rowIndexes = computed(() => Array.from({ length: this.rows() }, (_, index) => index));
}
