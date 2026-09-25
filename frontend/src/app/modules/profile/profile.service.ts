import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
export interface UserProfile {
  name: string;
  username: string;
  email: string;
  notification_email: string | null;
  phone: string | null;
  job_title: string | null;
  profile_image_url: string | null;
}

export interface ProfileUpdate {
  name: string;
  email: string;
  notification_email: string | null;
  phone: string | null;
  job_title: string | null;
}

export interface ProfileImageResponse {
  profile_image_url: string | null;
}

@Service()
export class ProfileService {
  private readonly http = inject(HttpClient);

  getCurrent(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiBaseUrl}/users/me`);
  }

  update(username: string, profile: ProfileUpdate): Observable<unknown> {
    return this.http.patch(
      `${environment.apiBaseUrl}/users/${encodeURIComponent(username)}`,
      profile,
    );
  }

  uploadImage(image: FormData): Observable<ProfileImageResponse> {
    return this.http.put<ProfileImageResponse>(
      `${environment.apiBaseUrl}/users/me/profile-image`,
      image,
    );
  }

  removeImage(): Observable<ProfileImageResponse> {
    return this.http.delete<ProfileImageResponse>(
      `${environment.apiBaseUrl}/users/me/profile-image`,
    );
  }
}
