import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiCacheInterceptor } from './api-cache.interceptor';

describe('apiCacheInterceptor', () => {
  it('does not reuse or cache a GET started before a mutation', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCacheInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const http = TestBed.inject(HttpClient);
    const requests = TestBed.inject(HttpTestingController);
    const url = '/api/v1/items';
    const values: string[] = [];

    http.get<{ value: string }>(url).subscribe((response) => values.push(response.value));
    const oldGet = requests.expectOne(url);

    http.post(url, {}).subscribe();
    requests.expectOne(url).flush({});

    http.get<{ value: string }>(url).subscribe((response) => values.push(response.value));
    const newGet = requests.expectOne(url);

    oldGet.flush({ value: 'old' });
    http.get<{ value: string }>(url).subscribe((response) => values.push(response.value));
    requests.expectNone(url);

    newGet.flush({ value: 'new' });
    http.get<{ value: string }>(url).subscribe((response) => values.push(response.value));
    requests.expectNone(url);

    expect(values).toEqual(['old', 'new', 'new', 'new']);
    requests.verify();
  });
});
