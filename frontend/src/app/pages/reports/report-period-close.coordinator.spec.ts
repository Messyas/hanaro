import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportPeriodCloseCoordinator } from './report-period-close.coordinator';
import { ReportPeriodCloseService } from './report-period-close.service';

describe('ReportPeriodCloseCoordinator', () => {
  const report = { id: 'report-1', factory_id: 'factory-1', version: 4 } as never;

  it('uses report identity and version for period-close mutations', () => {
    const result = { id: 'report-1' };
    const service = {
      updateScope: vi.fn().mockReturnValue(of(result)),
      replaceSections: vi.fn().mockReturnValue(of(result)),
      replaceActionSources: vi.fn().mockReturnValue(of(result)),
      replaceEvidenceSources: vi.fn().mockReturnValue(of(result)),
      eligibleActions: vi.fn(),
      eligibleEvidence: vi.fn(),
    } as unknown as ReportPeriodCloseService;
    const coordinator = new ReportPeriodCloseCoordinator(service);
    const scope = {} as never;
    const sections = [] as never;
    const evidence = [] as never;

    coordinator.updateScope(report, scope).subscribe();
    coordinator.replaceSections(report, sections).subscribe();
    coordinator.replaceActionSources(report, ['action-1']).subscribe();
    coordinator.replaceEvidenceSources(report, evidence).subscribe();

    expect(service.updateScope).toHaveBeenCalledWith('report-1', 4, scope);
    expect(service.replaceSections).toHaveBeenCalledWith('report-1', 4, sections);
    expect(service.replaceActionSources).toHaveBeenCalledWith('report-1', 4, ['action-1']);
    expect(service.replaceEvidenceSources).toHaveBeenCalledWith('report-1', 4, evidence);
  });

  it('loads candidates through the report identity', () => {
    const service = {
      updateScope: vi.fn(),
      replaceSections: vi.fn(),
      replaceActionSources: vi.fn(),
      replaceEvidenceSources: vi.fn(),
      eligibleActions: vi.fn().mockReturnValue(of({ items: [] })),
      eligibleEvidence: vi.fn().mockReturnValue(of({ items: [] })),
    } as unknown as ReportPeriodCloseService;
    const coordinator = new ReportPeriodCloseCoordinator(service);
    const query = { page: 1, pageSize: 25 };

    coordinator.loadActionCandidates(report, query).subscribe();
    coordinator.loadEvidenceCandidates(report, query).subscribe();

    expect(service.eligibleActions).toHaveBeenCalledWith('factory-1', query);
    expect(service.eligibleEvidence).toHaveBeenCalledWith('report-1', query);
  });
});
