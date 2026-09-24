import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportSourceSelectionCoordinator } from './report-source-selection.coordinator';
import { ReportsService } from './reports.service';

describe('ReportSourceSelectionCoordinator', () => {
  it('loads occurrence and report candidates together', () => {
    const occurrences = { items: [{ id: 'occurrence-1' }] } as never;
    const reports = { items: [{ id: 'report-1' }] } as never;
    const service = {
      eligibleOccurrences: vi.fn().mockReturnValue(of(occurrences)),
      sourceReports: vi.fn().mockReturnValue(of(reports)),
    } as unknown as ReportsService;
    const coordinator = new ReportSourceSelectionCoordinator(service);

    coordinator
      .loadCandidates(
        'report-1',
        { page: 1, pageSize: 100, search: 'occurrence' },
        { page: 2, pageSize: 100, search: 'report' },
      )
      .subscribe((result) => {
        expect(result).toEqual({ occurrences, reports });
      });

    expect(service.eligibleOccurrences).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      search: 'occurrence',
    });
    expect(service.sourceReports).toHaveBeenCalledWith('report-1', {
      page: 2,
      pageSize: 100,
      search: 'report',
    });
  });
});
