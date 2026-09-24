import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportPreviewCoordinator } from './report-preview.coordinator';
import { PeriodClosePreview, ReportPreview } from './reports.models';
import { ReportsService } from './reports.service';

describe('ReportPreviewCoordinator', () => {
  it('loads the period-close preview', () => {
    const preview = {} as PeriodClosePreview;
    const service = {
      periodClosePreview: vi.fn().mockReturnValue(of(preview)),
      preview: vi.fn(),
    } as unknown as ReportsService;
    const coordinator = new ReportPreviewCoordinator(service);

    coordinator.loadPeriodClose('report-1').subscribe((result) => expect(result).toBe(preview));

    expect(service.periodClosePreview).toHaveBeenCalledWith('report-1');
  });

  it('loads the dossier preview', () => {
    const preview = {} as ReportPreview;
    const service = {
      periodClosePreview: vi.fn(),
      preview: vi.fn().mockReturnValue(of(preview)),
    } as unknown as ReportsService;
    const coordinator = new ReportPreviewCoordinator(service);

    coordinator.loadDossier('report-1').subscribe((result) => expect(result).toBe(preview));

    expect(service.preview).toHaveBeenCalledWith('report-1');
  });
});
