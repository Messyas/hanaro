import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BrowserDownloadAdapter } from './browser-download.adapter';
import { ReportExportCoordinator } from './report-export.coordinator';
import { ReportExportService } from './report-export.service';

describe('ReportExportCoordinator', () => {
  it('restores export history in newest-first order', () => {
    const oldest = { id: 'job-oldest', status: 'COMPLETED' } as never;
    const newest = { id: 'job-newest', status: 'COMPLETED' } as never;
    const service = {
      history: vi.fn().mockReturnValue(of({ items: [newest, oldest] })),
    };
    TestBed.configureTestingModule({
      providers: [
        ReportExportCoordinator,
        { provide: ReportExportService, useValue: service },
        { provide: BrowserDownloadAdapter, useValue: { download: vi.fn() } },
      ],
    });

    const coordinator = TestBed.inject(ReportExportCoordinator);
    coordinator.restore('version-1').subscribe((jobs) => {
      expect(jobs).toEqual([oldest, newest]);
    });

    expect(service.history).toHaveBeenCalledWith('version-1');
  });
});
