import { Component, input } from '@angular/core';

export type IconName =
  | 'arrow-left'
  | 'bell'
  | 'building'
  | 'calendar'
  | 'chart-bar'
  | 'chart-columns'
  | 'chart-line'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'cog'
  | 'credit-card'
  | 'ellipsis-v'
  | 'filter'
  | 'folder'
  | 'globe'
  | 'home'
  | 'eye'
  | 'eye-off'
  | 'life-buoy'
  | 'log-in'
  | 'mail'
  | 'plus'
  | 'sidebar'
  | 'shopping-bag'
  | 'store'
  | 'user-plus'
  | 'users'
  | 'x';

@Component({
  selector: 'ui-icon',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('arrow-left') {
          <path d="M19 12H5M12 19l-7-7 7-7" />
        }
        @case ('chevron-left') {
          <path d="m15 18-6-6 6-6" />
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6" />
        }
        @case ('filter') {
          <path d="M4 6h16M7 12h10M10 18h4" />
        }
        @case ('home') {
          <path d="m3.5 10.5 8.5-7 8.5 7" />
          <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
        }
        @case ('bell') {
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        }
        @case ('building') {
          <path d="M4 21V8l8-4 8 4v13M2 21h20M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" />
        }
        @case ('store') {
          <path d="M4 10v10h16V10M3 10l2-6h14l2 6" />
          <path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 20v-5h6v5" />
        }
        @case ('shopping-bag') {
          <path d="M5 8h14l-1 12H6L5 8Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        }
        @case ('chart-bar') {
          <path pathLength="1" d="M4 20V10h4v10" />
          <path pathLength="1" d="M10 20V4h4v16" />
          <path pathLength="1" d="M16 20v-7h4v7" />
          <path pathLength="1" d="M2 20h20" />
        }
        @case ('chart-columns') {
          <path
            pathLength="1"
            d="M4.25 13h2a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-.75.75h-2a.75.75 0 0 1-.75-.75v-5.5a.75.75 0 0 1 .75-.75Z"
          />
          <path
            pathLength="1"
            d="M11 8.5h2a.75.75 0 0 1 .75.75v10a.75.75 0 0 1-.75.75h-2a.75.75 0 0 1-.75-.75v-10A.75.75 0 0 1 11 8.5Z"
          />
          <path
            pathLength="1"
            d="M17.75 4h2a.75.75 0 0 1 .75.75v14.5a.75.75 0 0 1-.75.75h-2a.75.75 0 0 1-.75-.75V4.75a.75.75 0 0 1 .75-.75Z"
          />
        }
        @case ('chart-line') {
          <path d="M4 19V5M4 19h16" />
          <path d="m7 15 4-5 3 3 5-7" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19" />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M17 13.5a4.5 4.5 0 0 1 3.5 4.4V19" />
        }
        @case ('user-plus') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M18 7v6M15 10h6" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        }
        @case ('folder') {
          <path
            d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5Z"
          />
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18Z" />
        }
        @case ('life-buoy') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="m5.6 5.6 4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        }
        @case ('log-in') {
          <path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M3 12h12M10 7l5 5-5 5" />
        }
        @case ('eye') {
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        }
        @case ('eye-off') {
          <path
            d="m3 3 18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.8M6.3 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"
          />
        }
        @case ('credit-card') {
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 10h19M6 15h4" />
        }
        @case ('cog') {
          <!-- pathLength normaliza as duas partes para o line drawing da sidebar. -->
          <path
            pathLength="1"
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"
          />
          <path pathLength="1" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        }
        @case ('clock') {
          <path pathLength="1" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path pathLength="1" d="M12 7v5l3.5 2" />
        }
        @case ('sidebar') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M13 9h4M13 13h4" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('chevron-down') {
          <path d="m7 9.5 5 5 5-5" />
        }
        @case ('ellipsis-v') {
          <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        }
        @case ('x') {
          <path d="m6 6 12 12M18 6 6 18" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.15rem;
      height: 1.15rem;
      flex: 0 0 1.15rem;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class UiIcon {
  readonly name = input.required<IconName>();
}
