import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ManagedUser {
  id: number;
  name: string;
  username: string;
  email: string;
  job_title: string | null;
  role: UserRole;
  is_superuser: boolean;
  is_deleted: boolean;
}

export type UserRole = 'gestor' | 'analista' | 'admin';

export function roleLabel(role: UserRole): string {
  return role === 'gestor' ? 'Gestor' : role === 'admin' ? 'Admin' : 'Analista';
}

export interface ManagedUsersPage {
  items: ManagedUser[];
  total_items: number;
  total_pages: number;
  page: number;
}

export interface NewUser {
  name: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/users';

  list(page: number, itemsPerPage: number): Observable<ManagedUsersPage> {
    return this.http.get<ManagedUsersPage>(`${this.base}/admin/all`, {
      params: { page, items_per_page: itemsPerPage },
    });
  }

  create(user: NewUser): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${this.base}/`, user);
  }

  update(
    user: ManagedUser,
    values: Pick<ManagedUser, 'name' | 'username' | 'email' | 'role'>,
  ): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(`${this.base}/admin/${user.id}`, values);
  }

  setActive(user: ManagedUser, is_active: boolean): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(`${this.base}/admin/${user.id}/status`, { is_active });
  }

  remove(user: ManagedUser): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/${user.id}`);
  }
}
