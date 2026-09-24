import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ManagedUser } from './users.service';

@Component({
  selector: 'app-delete-user-dialog',
  template: `
    <section class="user-dialog" aria-labelledby="delete-user-title">
      <h2 id="delete-user-title">Excluir usuário</h2>
      <p>
        A conta de <strong>{{ user.name }}</strong> perderá o acesso ao sistema. O histórico será
        preservado.
      </p>
      <footer>
        <button type="button" class="secondary" (click)="ref.close(false)">Cancelar</button>
        <button type="button" class="primary" (click)="ref.close(true)">Excluir usuário</button>
      </footer>
    </section>
  `,
  styleUrl: './users-page.css',
})
export class DeleteUserDialog {
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
  readonly user = inject<ManagedUser>(DIALOG_DATA);
}
