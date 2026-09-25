import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportPreviewCoordinator } from './report-preview.coordinator';
import { PeriodClosePreview, ReportPreview } from './reports.models';
import { ReportsService } from './reports.service';
import { ReportPeriodCloseService } from './report-period-close.service';

describe('ReportPreviewCoordinator', () => {
  it('loads the period-close preview', () => {
    const preview = {} as PeriodClosePreview;
    const periodClose = {
      preview: vi.fn().mockReturnValue(of(preview)),
    } as unknown as ReportPeriodCloseService;
    const service = { preview: vi.fn() } as unknown as ReportsService;
    const coordinator = new ReportPreviewCoordinator(service, periodClose);

    coordinator.loadPeriodClose('report-1').subscribe((result) => expect(result).toBe(preview));

    expect(periodClose.preview).toHaveBeenCalledWith('report-1');
  });

  it('loads the dossier preview', () => {
    const preview = {} as ReportPreview;
    const periodClose = { preview: vi.fn() } as unknown as ReportPeriodCloseService;
    const service = { preview: vi.fn().mockReturnValue(of(preview)) } as unknown as ReportsService;
    const coordinator = new ReportPreviewCoordinator(service, periodClose);

    coordinator.loadDossier('report-1').subscribe((result) => expect(result).toBe(preview));

    expect(service.preview).toHaveBeenCalledWith('report-1');
  });
});
