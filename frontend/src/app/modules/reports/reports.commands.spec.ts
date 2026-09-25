import { ReportSourceMutationCommand, UpdateReportCommand } from './reports.models';

describe('Reports commands', () => {
  it('models report updates as named data', () => {
    const command: UpdateReportCommand = {
      reportId: 'report-1',
      expectedVersion: 3,
      title: 'Updated title',
      description: 'Updated description',
    };

    expect(command).toEqual({
      reportId: 'report-1',
      expectedVersion: 3,
      title: 'Updated title',
      description: 'Updated description',
    });
  });

  it('keeps source mutations discriminated by kind and operation', () => {
    const command: ReportSourceMutationCommand = {
      reportId: 'report-1',
      kind: 'report',
      operation: 'remove',
      expectedVersion: 4,
      ids: ['source-1'],
    };

    expect(command.kind).toBe('report');
    expect(command.operation).toBe('remove');
  });
});
