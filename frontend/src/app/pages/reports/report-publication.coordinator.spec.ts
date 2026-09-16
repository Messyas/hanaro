import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportPublicationCoordinator } from './report-publication.coordinator';
import { ReportDetail, ReportVersion } from './reports.models';
import { ReportsService } from './reports.service';

describe('ReportPublicationCoordinator', () => {
  it('publishes with the report version and matching template', () => {
    const published = {} as ReportVersion;
    const service = {
      publish: vi.fn().mockReturnValue(of(published)),
      version: vi.fn(),
    } as unknown as ReportsService;
    const coordinator = new ReportPublicationCoordinator(service);
    const report = { id: 'report-1', version: 4, report_kind: 'PERIOD_CLOSE' } as ReportDetail;

    coordinator.publish(report).subscribe((result) => expect(result).toBe(published));

    expect(service.publish).toHaveBeenCalledWith('report-1', 4, '2');
  });

  it('loads a published version for the history drawer', () => {
    const version = {} as ReportVersion;
    const service = {
      publish: vi.fn(),
      version: vi.fn().mockReturnValue(of(version)),
    } as unknown as ReportsService;
    const coordinator = new ReportPublicationCoordinator(service);

    coordinator.version('report-1', 3).subscribe((result) => expect(result).toBe(version));

    expect(service.version).toHaveBeenCalledWith('report-1', 3);
  });
});
