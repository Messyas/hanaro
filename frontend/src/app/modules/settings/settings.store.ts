import { Injectable, signal } from '@angular/core';

export type SettingsTab = 'preferences' | 'classifications' | 'system' | 'targets' | 'production';

@Injectable()
export class SettingsStore {
  readonly activeTab = signal<SettingsTab>('preferences');

  selectTab(tab: SettingsTab, isAuthenticated: boolean): boolean {
    if (tab !== 'preferences' && !isAuthenticated) return false;
    this.activeTab.set(tab);
    return true;
  }
}
