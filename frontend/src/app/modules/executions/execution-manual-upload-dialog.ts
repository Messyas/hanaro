import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InlineAlert } from '../../shared/list-view/inline-alert/inline-alert';
import { UiIcon } from '../../ui-icon';
import { ExecutionsService } from './executions.service';

@Component({
  selector: 'app-execution-manual-upload-dialog',
  imports: [InlineAlert, UiIcon],
  templateUrl: './execution-manual-upload-dialog.html',
  styleUrl: './execution-manual-upload-dialog.css',
})
export class ExecutionManualUploadDialog {
  private readonly executions = inject(ExecutionsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly uploaded = output<string>();
  readonly file = signal<File | null>(null);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  close(): void {
    if (this.submitting()) return;
    this.file.set(null);
    this.error.set(null);
    this.closed.emit();
  }

  selectFile(event: Event): void {
    const selectedFile = (event.target as HTMLInputElement).files?.item(0) ?? null;
    if (!selectedFile) return;

    if (!selectedFile.name.startsWith('Other_Account_Transaction_Text')) {
      this.file.set(null);
      this.error.set('Selecione o relatório Other Account Transaction Text exportado do GERP.');
      return;
    }

    this.file.set(selectedFile);
    this.error.set(null);
  }

  submit(): void {
    const selectedFile = this.file();
    if (!selectedFile || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.executions
      .uploadManualReport(selectedFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ execution_id }) => {
          this.submitting.set(false);
          this.file.set(null);
          this.closed.emit();
          this.uploaded.emit(execution_id);
        },
        error: (error: { status?: number; error?: { detail?: string }; message?: string }) => {
          this.error.set(
            error.status && error.status >= 500
              ? 'O servidor não conseguiu iniciar a ingestão. Tente novamente após verificar o serviço.'
              : error.error?.detail ||
                  error.message ||
                  'Não foi possível enviar o relatório para processamento.',
          );
          this.submitting.set(false);
        },
      });
  }
}
