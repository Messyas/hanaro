import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportSourceSelectionCoordinator } from './report-source-selection.coordinator';
import { ReportSourceService } from './report-source.service';

describe('ReportSourceSelectionCoordinator', () => {
  it('loads occurrence and report candidates together', () => {
    const occurrences = { items: [{ id: 'occurrence-1' }] } as never;
    const reports = { items: [{ id: 'report-1' }] } as never;
    const sources = {
      eligibleOccurrences: vi.fn().mockReturnValue(of(occurrences)),
      sourceReports: vi.fn().mockReturnValue(of(reports)),
    } as unknown as ReportSourceService;
    const coordinator = new ReportSourceSelectionCoordinator(sources);

    coordinator
      .loadCandidates(
        'report-1',
        { page: 1, pageSize: 100, search: 'occurrence' },
        { page: 2, pageSize: 100, search: 'report' },
      )
      .subscribe((result) => {
        expect(result).toEqual({ occurrences, reports });
      });

    expect(sources.eligibleOccurrences).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      search: 'occurrence',
    });
    expect(sources.sourceReports).toHaveBeenCalledWith('report-1', {
      page: 2,
      pageSize: 100,
      search: 'report',
    });
  });
});
