import { ExportJob, ReportExportRequestBuilder, ReportVersion } from './reports.models';

describe('ReportExportRequestBuilder', () => {
  const version = { id: 'version-1', content_schema_version: 2 } as ReportVersion;

  it('derives defaults and the schema version from the report version', () => {
    expect(ReportExportRequestBuilder.forVersion(version).build()).toEqual({
      versionId: 'version-1',
      format: 'PDF',
      options: {
        language: 'pt',
        include_money: true,
        include_summary: true,
        include_occurrences: true,
        include_justifications: true,
        include_evidence: true,
        notify_on_completion: false,
      },
      retryFailed: false,
      templateVersion: '2',
    });
  });

  it('copies options and enables retry only for failed jobs', () => {
    const options = {
      language: 'en' as const,
      include_money: false,
      include_summary: true,
      include_occurrences: false,
      include_justifications: true,
      include_evidence: false,
      notify_on_completion: true,
    };
    const failedJob = { status: 'FAILED' } as ExportJob;
    const request = ReportExportRequestBuilder.forVersion(version)
      .withFormat('CSV')
      .withOptions(options)
      .retryAfter(failedJob)
      .build();

    options.include_money = true;
    expect(request.format).toBe('CSV');
    expect(request.retryFailed).toBe(true);
    expect(request.options.include_money).toBe(false);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.options)).toBe(true);
  });
});
