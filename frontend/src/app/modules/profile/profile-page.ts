import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthenticatedUserSession } from '../../core/auth/authenticated-user-session';
import { LanguageService } from '../../i18n/language.service';
import { ProfileService } from './profile.service';

interface ProfileFormSnapshot {
  name: string;
  username: string;
  email: string;
  notificationEmail: string;
  phone: string;
  jobTitle: string;
}

type Feedback = { kind: 'success' | 'error'; message: string } | null;
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage implements OnInit {
  private readonly profiles = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userSession = inject(AuthenticatedUserSession);
  readonly language = inject(LanguageService);

  readonly loading = signal(true);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly feedback = signal<Feedback>(null);
  readonly profileImageUrl = signal<string | null>(null);
  readonly profileImagePreviewUrl = signal<string | null>(null);
  readonly profileImageFailed = signal(false);
  readonly imageOperation = signal<'uploading' | 'removing' | null>(null);
  readonly imageFeedback = signal<Feedback>(null);

  readonly form = new (class {
    readonly name = new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(30)],
    });
    readonly username = new FormControl('', { nonNullable: true });
    readonly email = new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(50)],
    });
    readonly notificationEmail = new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(50)],
    });
    readonly phone = new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(24)],
    });
    readonly jobTitle = new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)],
    });

    get invalid(): boolean {
      return [this.name, this.email, this.notificationEmail, this.phone, this.jobTitle].some(
        (control) => control.invalid,
      );
    }

    markAllAsTouched(): void {
      [this.name, this.email, this.notificationEmail, this.phone, this.jobTitle].forEach(
        (control) => control.markAsTouched(),
      );
    }

    markAsPristine(): void {
      [
        this.name,
        this.username,
        this.email,
        this.notificationEmail,
        this.phone,
        this.jobTitle,
      ].forEach((control) => control.markAsPristine());
    }

    markAsUntouched(): void {
      [this.name, this.email, this.notificationEmail, this.phone, this.jobTitle].forEach(
        (control) => control.markAsUntouched(),
      );
    }
  })();

  private savedProfile: ProfileFormSnapshot | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeProfileImagePreview());
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  startEditing(): void {
    this.feedback.set(null);
    this.editing.set(true);
  }

  cancelEditing(): void {
    if (this.saving()) return;
    if (this.savedProfile) this.applyProfileSnapshot(this.savedProfile);
    this.feedback.set(null);
    this.editing.set(false);
  }

  save(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const username = this.form.username.value;
    if (!username) return;

    this.saving.set(true);
    this.feedback.set(null);

    this.profiles
      .update(username, {
        name: this.form.name.value.trim(),
        email: this.form.email.value.trim(),
        notification_email: this.emptyToNull(this.form.notificationEmail.value),
        phone: this.emptyToNull(this.form.phone.value),
        job_title: this.emptyToNull(this.form.jobTitle.value),
      })
      .pipe(
        switchMap(() => this.userSession.refresh()),
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.savedProfile = this.currentProfileSnapshot();
          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.editing.set(false);
          this.feedback.set({
            kind: 'success',
            message: this.language.translations().profileSaveSuccess,
          });
        },
        error: (error: HttpErrorResponse) => {
          const t = this.language.translations();
          this.feedback.set({
            kind: 'error',
            message:
              error.status === 409 || error.status === 422
                ? t.profileEmailConflict
                : t.profileSaveError,
          });
        },
      });
  }

  userInitials(): string {
    const name = this.form.name.value.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/);
    return `${parts[0][0]}${parts.length > 1 ? parts.at(-1)?.[0] : ''}`.toUpperCase();
  }

  displayValue(value: string): string {
    return value.trim() || '—';
  }

  displayedProfileImageUrl(): string | null {
    const preview = this.profileImagePreviewUrl();
    if (preview) return preview;

    const url = this.profileImageUrl();
    if (
      !url ||
      url === 'https://profileimageurl.com' ||
      url === 'https://www.profileimageurl.com'
    ) {
      return null;
    }
    return url;
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (!file || this.imageOperation()) return;

    const t = this.language.translations();
    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      this.imageFeedback.set({ kind: 'error', message: t.profilePhotoTypeError });
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      this.imageFeedback.set({ kind: 'error', message: t.profilePhotoSizeError });
      return;
    }

    this.revokeProfileImagePreview();
    this.profileImagePreviewUrl.set(URL.createObjectURL(file));
    this.profileImageFailed.set(false);
    this.imageFeedback.set(null);
    this.imageOperation.set('uploading');

    const body = new FormData();
    body.append('image', file, file.name);
    this.profiles
      .uploadImage(body)
      .pipe(
        switchMap((response) => this.userSession.refresh().pipe(map(() => response))),
        finalize(() => this.imageOperation.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.profileImageUrl.set(response.profile_image_url);
          this.revokeProfileImagePreview();
          this.imageFeedback.set({
            kind: 'success',
            message: this.language.translations().profilePhotoUploadSuccess,
          });
        },
        error: (error: HttpErrorResponse) => {
          this.revokeProfileImagePreview();
          const copy = this.language.translations();
          const message =
            error.status === 413
              ? copy.profilePhotoSizeError
              : error.status === 415 || error.status === 422
                ? copy.profilePhotoTypeError
                : copy.profilePhotoUploadError;
          this.imageFeedback.set({ kind: 'error', message });
        },
      });
  }

  removeProfileImage(): void {
    if (this.imageOperation() || !this.displayedProfileImageUrl()) return;

    this.imageOperation.set('removing');
    this.imageFeedback.set(null);
    this.profiles
      .removeImage()
      .pipe(
        switchMap((response) => this.userSession.refresh().pipe(map(() => response))),
        finalize(() => this.imageOperation.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.revokeProfileImagePreview();
          this.profileImageUrl.set(null);
          this.profileImageFailed.set(false);
          this.imageFeedback.set({
            kind: 'success',
            message: this.language.translations().profilePhotoRemoveSuccess,
          });
        },
        error: () => {
          this.imageFeedback.set({
            kind: 'error',
            message: this.language.translations().profilePhotoRemoveError,
          });
        },
      });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.profiles
      .getCurrent()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.form.name.setValue(profile.name);
          this.form.username.setValue(profile.username);
          this.form.email.setValue(profile.email);
          this.form.notificationEmail.setValue(profile.notification_email ?? '');
          this.form.phone.setValue(profile.phone ?? '');
          this.form.jobTitle.setValue(profile.job_title ?? '');
          this.profileImageUrl.set(profile.profile_image_url);
          this.profileImageFailed.set(false);
          this.savedProfile = this.currentProfileSnapshot();
          this.form.markAsPristine();
          this.form.markAsUntouched();
        },
        error: () => {
          this.feedback.set({
            kind: 'error',
            message: this.language.translations().profileLoadError,
          });
        },
      });
  }

  private emptyToNull(value: string): string | null {
    const normalized = value.trim();
    return normalized || null;
  }

  private currentProfileSnapshot(): ProfileFormSnapshot {
    return {
      name: this.form.name.value,
      username: this.form.username.value,
      email: this.form.email.value,
      notificationEmail: this.form.notificationEmail.value,
      phone: this.form.phone.value,
      jobTitle: this.form.jobTitle.value,
    };
  }

  private applyProfileSnapshot(profile: ProfileFormSnapshot): void {
    this.form.name.setValue(profile.name);
    this.form.username.setValue(profile.username);
    this.form.email.setValue(profile.email);
    this.form.notificationEmail.setValue(profile.notificationEmail);
    this.form.phone.setValue(profile.phone);
    this.form.jobTitle.setValue(profile.jobTitle);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private revokeProfileImagePreview(): void {
    const preview = this.profileImagePreviewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.profileImagePreviewUrl.set(null);
  }
}
