import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ScrapPage } from './scrap-base.models';
import { ScrapBaseService } from './scrap-base.service';

describe('ScrapBaseService', () => {
  let service: ScrapBaseService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScrapBaseService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ScrapBaseService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists scrap occurrences and repeats organization filter parameters', () => {
    const page: ScrapPage = { items: [], page: 1, page_size: 50, total_items: 0, total_pages: 0 };

    service
      .list({
        organizations: ['NWK', 'NW1'],
        search: 'linha inicial',
        page: 1,
        page_size: 50,
        sort_by: 'item_code',
        sort_order: 'asc',
      })
      .subscribe((result) => expect(result).toEqual(page));

    const request = httpTesting.expectOne((request) => request.url === '/api/v1/scrap');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.getAll('organizations')).toEqual(['NWK', 'NW1']);
    expect(request.request.params.get('search')).toBe('linha inicial');
    expect(request.request.params.get('sort_by')).toBe('item_code');
    request.flush(page);

    expect(
      service.getCached({
        organizations: ['NWK', 'NW1'],
        search: 'linha inicial',
        page: 1,
        page_size: 50,
        sort_by: 'item_code',
        sort_order: 'asc',
      }),
    ).toEqual(page);
  });
});
