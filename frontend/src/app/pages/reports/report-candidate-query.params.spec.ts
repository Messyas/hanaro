import { serializeReportCandidateQuery } from './report-candidate-query.params';

describe('serializeReportCandidateQuery', () => {
  it('serializes pagination and an optional search term consistently', () => {
    const params = serializeReportCandidateQuery({ page: 3, pageSize: 50, search: 'setup' });

    expect(params.keys()).toEqual(['page', 'page_size', 'search']);
    expect(params.get('page')).toBe('3');
    expect(params.get('page_size')).toBe('50');
    expect(params.get('search')).toBe('setup');
  });

  it('does not send an empty search term', () => {
    const params = serializeReportCandidateQuery({ page: 1, pageSize: 25, search: '' });

    expect(params.keys()).toEqual(['page', 'page_size']);
  });
});
