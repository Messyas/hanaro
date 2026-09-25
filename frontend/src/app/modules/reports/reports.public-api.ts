import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ReportCatalogService } from './report-catalog.service';
import { ReportPublicationService } from './report-publication.service';

export interface ActionPlanReportOption {
  reportId: string;
  title: string;
}

export interface ActionPlanReportVersionOption {
  versionId: string;
  revision: number;
  publishedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class ActionPlanReportLookup {
  private readonly catalog = inject(ReportCatalogService);
  private readonly publication = inject(ReportPublicationService);

  searchPublishedReports(search: string): Observable<ActionPlanReportOption[]> {
    return this.catalog
      .list({ page: 1, pageSize: 25, search, status: 'PUBLISHED' })
      .pipe(map(({ items }) => items.map(({ id, title }) => ({ reportId: id, title }))));
  }

  listPublishedVersions(reportId: string): Observable<ActionPlanReportVersionOption[]> {
    return this.publication.versions(reportId).pipe(
      map(({ items }) =>
        items.map(({ id, revision, published_at }) => ({
          versionId: id,
          revision,
          publishedAt: published_at,
        })),
      ),
    );
  }
}
