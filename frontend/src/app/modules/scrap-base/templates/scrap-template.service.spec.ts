import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ScrapReviewTemplate } from './scrap-template.models';
import { ScrapTemplateService } from './scrap-template.service';

describe('ScrapTemplateService', () => {
  let service: ScrapTemplateService;
  let httpTesting: HttpTestingController;

  const template: ScrapReviewTemplate = {
    id: 'tpl-1',
    name: 'Modelo original',
    title: 'Título original',
    description: 'Descrição original',
    defect_type_id: 'type-1',
    created_by_user_id: 1,
    source_review_id: 'review-1',
    defect_type: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScrapTemplateService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ScrapTemplateService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends a template update to the API and returns the updated record', () => {
    const payload = {
      name: 'Modelo refinado',
      title: 'Título refinado',
      description: 'Descrição refinada',
      defect_type_id: 'type-2',
    };
    const updated = { ...template, ...payload };

    service.updateTemplate(template.id, payload).subscribe((result) => {
      expect(result).toEqual(updated);
    });

    const request = httpTesting.expectOne('/api/v1/scrap/reviews/templates/tpl-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush(updated);
  });
});
