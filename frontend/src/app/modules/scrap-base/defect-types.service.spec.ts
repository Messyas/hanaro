import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DefectTypesService } from './defect-types.service';
import { ScrapDefectType } from './scrap-review.models';

describe('DefectTypesService', () => {
  let defectTypes: DefectTypesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DefectTypesService, provideHttpClient(), provideHttpClientTesting()],
    });
    defectTypes = TestBed.inject(DefectTypesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('fetches defect types', () => {
    const mockTypes: ScrapDefectType[] = [
      {
        id: 'type-1',
        code: 'DEF-01',
        name: 'Defeito de solda',
        description: 'Solda fria',
        display_order: 1,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    defectTypes.getDefectTypes().subscribe((result) => expect(result).toEqual(mockTypes));

    const req = httpTesting.expectOne('/api/v1/scrap/review-types');
    expect(req.request.method).toBe('GET');
    req.flush(mockTypes);
  });

  it('creates defect type via POST', () => {
    const payload = { code: 'DEF-02', name: 'Trinca', description: 'Trinca estrutural' };
    const mockCreated = {
      ...payload,
      id: 'type-2',
      display_order: 0,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    defectTypes
      .createDefectType(payload)
      .subscribe((result) => expect(result).toEqual(mockCreated));

    const req = httpTesting.expectOne('/api/v1/scrap/review-types');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockCreated);
  });

  it('updates defect type via PATCH', () => {
    const patchPayload = { name: 'Trinca Severa', is_active: false };
    const mockUpdated = {
      id: 'type-2',
      code: 'DEF-02',
      name: 'Trinca Severa',
      description: null,
      display_order: 0,
      is_active: false,
      created_at: '',
      updated_at: '',
    };

    defectTypes
      .updateDefectType('type-2', patchPayload)
      .subscribe((result) => expect(result).toEqual(mockUpdated));

    const req = httpTesting.expectOne('/api/v1/scrap/review-types/type-2');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patchPayload);
    req.flush(mockUpdated);
  });

  it('deletes defect type via DELETE', () => {
    defectTypes.deleteDefectType('type-2').subscribe();

    const req = httpTesting.expectOne('/api/v1/scrap/review-types/type-2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
