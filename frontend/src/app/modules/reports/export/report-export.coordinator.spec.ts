import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BROWSER_DOWNLOAD } from './browser-download.port';
import { ReportExportCoordinator } from './report-export.coordinator';
import { ReportExportService } from './report-export.service';

describe('ReportExportCoordinator', () => {
  it('downloads an exported artifact through the configured port', () => {
    const blob = new Blob(['report']);
    const download = vi.fn();
    const service = { download: vi.fn().mockReturnValue(of(blob)) };
    TestBed.configureTestingModule({
      providers: [
        ReportExportCoordinator,
        { provide: ReportExportService, useValue: service },
        { provide: BROWSER_DOWNLOAD, useValue: { download } },
      ],
    });

    const coordinator = TestBed.inject(ReportExportCoordinator);
    coordinator
      .download({ id: 'job-1', artifact: { filename: 'report.pdf' } } as never)
      .subscribe();

    expect(service.download).toHaveBeenCalledWith('job-1');
    expect(download).toHaveBeenCalledWith(blob, 'report.pdf');
  });

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
        { provide: BROWSER_DOWNLOAD, useValue: { download: vi.fn() } },
      ],
    });

    const coordinator = TestBed.inject(ReportExportCoordinator);
    coordinator.restore('version-1').subscribe((jobs) => {
      expect(jobs).toEqual([oldest, newest]);
    });

    expect(service.history).toHaveBeenCalledWith('version-1');
  });

  it('emits completed restored jobs without polling them again', () => {
    const job = { id: 'job-1', status: 'COMPLETED', format: 'PDF' } as never;
    const service = {
      history: vi.fn().mockReturnValue(of({ items: [job] })),
      status: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ReportExportCoordinator,
        { provide: ReportExportService, useValue: service },
        { provide: BROWSER_DOWNLOAD, useValue: { download: vi.fn() } },
      ],
    });

    const coordinator = TestBed.inject(ReportExportCoordinator);
    coordinator.restoreAndPoll('version-1').subscribe((result) => expect(result).toBe(job));

    expect(service.status).not.toHaveBeenCalled();
  });
});
