import { Component, DestroyRef, computed, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/i18n/language.service';
import { ListFilterSelect } from '../../../shared/components/list-filters/list-filter-select';
import { ListPagination } from '../../../shared/components/list-view/list-pagination/list-pagination';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { workflowCopy } from '../../governance/governance.public-api';
import { COPY } from '../reports.copy';
import { ExportFormat, ExportJob, ExportOptions, ReportVersion } from '../reports.models';
import { ReportEditorStore } from '../editor/report-editor.store';
import { ReportListStore } from '../catalog/report-list.store';
import { ReportExportCoordinator } from './report-export.coordinator';

@Component({
  selector: 'app-report-version-history',
  imports: [ListFilterSelect, ListPagination, UiIcon],
  templateUrl: './report-version-history.html',
  styleUrl: './report-version-history.css',
})
export class ReportVersionHistory {
  private readonly editorStore = inject(ReportEditorStore);
  private readonly listStore = inject(ReportListStore);
  private readonly exportCoordinator = inject(ReportExportCoordinator);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageChanged = output<void>();
  readonly c = computed(() => COPY[this.language.currentLanguage()]);
  readonly workflows = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly active = this.editorStore.active;
  readonly versions = this.editorStore.versions;
  readonly versionsPage = this.editorStore.versionsPage;
  readonly exportJobs = this.editorStore.exportJobs;
  readonly exportFormatOptions = this.editorStore.exportFormatOptions;
  readonly exportsAvailable = this.listStore.exportsAvailable;
  readonly workspaceError = this.editorStore.workspaceError;
  readonly candidatePageSize = 25;

  previousVersionPage(): void {
    if (this.editorStore.previousVersionPage()) this.pageChanged.emit();
  }

  nextVersionPage(): void {
    if (this.editorStore.nextVersionPage()) this.pageChanged.emit();
  }

  export(
    version: ReportVersion,
    format: ExportFormat,
    options = this.exportOptionsFor(version.id),
  ): void {
    const key = `${version.id}:${format}`;
    if (['QUEUED', 'RUNNING'].includes(this.exportJobs()[key]?.status)) return;
    this.exportCoordinator
      .request(version, format, options, this.exportJobs()[key])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.editorStore.setExportJob(version.id, job);
          this.exportCoordinator
            .poll(job.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (updated) => this.editorStore.setExportJob(version.id, updated),
              error: (error) => this.workspaceError.set(this.message(error)),
            });
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }

  exportOptionsFor(versionId: string): ExportOptions {
    return this.editorStore.exportOptionsFor(versionId, this.language.currentLanguage());
  }

  setVersionExportOption(
    versionId: string,
    key: Exclude<keyof ExportOptions, 'language'>,
    value: boolean,
  ): void {
    this.editorStore.setExportOption(versionId, key, value, this.language.currentLanguage());
  }

  exportFormatFor(versionId: string): ExportFormat {
    return this.editorStore.exportFormatFor(versionId);
  }

  setVersionExportFormat(versionId: string, format: ExportFormat): void {
    this.editorStore.setExportFormat(versionId, format);
  }

  emitVersionExport(version: ReportVersion): void {
    const format = this.exportFormatFor(version.id);
    const exportJob = this.job(version.id, format);
    if (exportJob?.status === 'COMPLETED') {
      this.download(exportJob);
      return;
    }
    this.export(version, format, this.exportOptionsFor(version.id));
  }

  download(job: ExportJob): void {
    if (!job.artifact) return;
    this.exportCoordinator
      .download(job)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }

  job(versionId: string, format: ExportFormat): ExportJob | undefined {
    return this.editorStore.exportJob(versionId, format);
  }

  versionTitle(version: ReportVersion): string {
    if (version.content_schema_version >= 2) {
      return version.content.document?.report.title || this.active()?.title || this.c().title;
    }
    const legacyReport = version.content['report'] as { title?: string } | undefined;
    return legacyReport?.title || this.active()?.title || this.c().title;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const code = this.language.currentLanguage();
    const locale = code === 'pt' ? 'pt-BR' : code === 'ko' ? 'ko-KR' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  }

  private message(error: { error?: { detail?: string }; message?: string }): string {
    return error.error?.detail || error.message || this.c().genericError;
  }
}
