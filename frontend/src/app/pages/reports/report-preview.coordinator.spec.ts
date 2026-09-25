import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportPreviewCoordinator } from './report-preview.coordinator';
import { PeriodClosePreview, ReportPreview } from './reports.models';
import { ReportDossierPreviewService } from './report-dossier-preview.service';
import { ReportPeriodCloseService } from './report-period-close.service';

describe('ReportPreviewCoordinator', () => {
  it('loads the period-close preview', () => {
    const preview = {} as PeriodClosePreview;
    const periodClose = {
      preview: vi.fn().mockReturnValue(of(preview)),
    } as unknown as ReportPeriodCloseService;
    const dossierPreview = { load: vi.fn() } as unknown as ReportDossierPreviewService;
    const coordinator = new ReportPreviewCoordinator(dossierPreview, periodClose);

    coordinator.loadPeriodClose('report-1').subscribe((result) => expect(result).toBe(preview));

    expect(periodClose.preview).toHaveBeenCalledWith('report-1');
  });

  it('loads the dossier preview', () => {
    const preview = {} as ReportPreview;
    const periodClose = { preview: vi.fn() } as unknown as ReportPeriodCloseService;
    const dossierPreview = {
      load: vi.fn().mockReturnValue(of(preview)),
    } as unknown as ReportDossierPreviewService;
    const coordinator = new ReportPreviewCoordinator(dossierPreview, periodClose);

    coordinator.loadDossier('report-1').subscribe((result) => expect(result).toBe(preview));

    expect(dossierPreview.load).toHaveBeenCalledWith('report-1');
  });
});
