import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('requests the selected page and page size', () => {
    TestBed.configureTestingModule({
      providers: [UsersService, provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(UsersService);
    const http = TestBed.inject(HttpTestingController);
    const result = { items: [], page: 2, total_items: 26, total_pages: 2 };

    service.list(2, 25).subscribe((page) => expect(page).toEqual(result));

    const request = http.expectOne('/api/v1/users/admin/all?page=2&items_per_page=25');
    expect(request.request.method).toBe('GET');
    request.flush(result);
    http.verify();
  });

  it('updates profile fields through the existing user endpoint', () => {
    TestBed.configureTestingModule({
      providers: [UsersService, provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(UsersService);
    const http = TestBed.inject(HttpTestingController);
    const user = {
      id: 2,
      name: 'Ana',
      username: 'ana',
      email: 'ana@example.com',
      job_title: null,
      role: 'analista' as const,
      is_superuser: false,
      is_deleted: false,
    };

    service
      .update(user, {
        name: 'Ana Silva',
        username: 'ana',
        email: 'ana@example.com',
        role: 'gestor',
      })
      .subscribe();

    const request = http.expectOne('/api/v1/users/admin/2');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.role).toBe('gestor');
    request.flush({ ...user, role: 'gestor' });
    http.verify();
  });
});
