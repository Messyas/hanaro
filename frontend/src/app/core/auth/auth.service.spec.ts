import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService, AuthUser } from './auth.service';

const USER: AuthUser = {
  id: 1,
  name: 'Maria Operadora',
  username: 'maria',
  email: 'maria@example.com',
  notification_email: null,
  phone: null,
  job_title: null,
  role: 'analista',
  profile_image_url: null,
  is_superuser: false,
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps anonymous users inside the public application', () => {
    let authenticated = true;
    auth.ensureSessionChecked().subscribe((value) => (authenticated = value));

    http.expectOne('/api/v1/auth/check-auth').flush({ authenticated: false });

    expect(authenticated).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
  });

  it('logs in with form credentials and loads the authenticated identity', () => {
    let authenticated = false;
    auth.login('maria', 'safe-password').subscribe((value) => (authenticated = value));

    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.method).toBe('POST');
    expect(login.request.body.get('username')).toBe('maria');
    expect(login.request.body.get('password')).toBe('safe-password');
    login.flush({ csrf_token: 'csrf-cookie-value' });

    http.expectOne('/api/v1/auth/check-auth').flush({ authenticated: true, user: USER });

    expect(authenticated).toBe(true);
    expect(auth.user()).toEqual(USER);
  });
});
