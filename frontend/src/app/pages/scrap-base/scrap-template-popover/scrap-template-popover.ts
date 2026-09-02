import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { LanguageService } from '../../../i18n/language.service';
import { UiIcon } from '../../../ui-icon';
import { ScrapReviewTemplate } from '../scrap-template.models';

@Component({
  selector: 'app-scrap-template-popover',
  imports: [UiIcon],
  templateUrl: './scrap-template-popover.html',
  styleUrl: './scrap-template-popover.css',
})
export class ScrapTemplatePopover {
  private readonly language = inject(LanguageService);
  private readonly elementRef = inject(ElementRef);

  readonly t = computed(() => this.language.translations());

  readonly open = input<boolean>(false);
  readonly templates = input<ScrapReviewTemplate[]>([]);
  readonly loading = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly useTemplate = output<ScrapReviewTemplate>();
  readonly deleteTemplate = output<string>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  close(): void {
    this.openChange.emit(false);
  }

  onSelect(template: ScrapReviewTemplate): void {
    this.useTemplate.emit(template);
    this.close();
  }

  onDelete(templateId: string, event: Event): void {
    event.stopPropagation();
    this.deleteTemplate.emit(templateId);
  }
}
