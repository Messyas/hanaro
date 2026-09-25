import { Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { ScrapListItem } from '../../list/scrap-base.models';
import { ScrapReview, ScrapReviewFormModel } from '../scrap-review.models';

function parseMarkdown(md: string): string {
  if (!md || !md.trim()) return '';

  // 1. Escapar entidades HTML básicas para segurança contra XSS
  let text = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 2. Blocos de código ```code```
  const codeBlocks: string[] = [];
  text = text.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_, code) => {
    const placeholder = `@@@CODEBLOCK_${codeBlocks.length}@@@`;
    codeBlocks.push(`<pre class="md-code-block"><code>${code.trim()}</code></pre>`);
    return placeholder;
  });

  // 3. Código inline `code`
  text = text.replace(/`([^`\n]+)`/g, '<code class="md-inline-code">$1</code>');

  // 4. Cabeçalhos de seção (###, ##, #)
  text = text.replace(/^### (.*)$/gim, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^## (.*)$/gim, '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^# (.*)$/gim, '<h2 class="md-h1-inline">$1</h2>');

  // 5. Citações / Observações (> quote)
  text = text.replace(
    /^(?:&gt;|>)\s?(.*)$/gim,
    '<blockquote class="md-quote"><p>$1</p></blockquote>',
  );
  text = text.replace(/<\/blockquote>\s*<blockquote class="md-quote">/gim, '');

  // 6. Linhas divisórias (--- ou ***)
  text = text.replace(/^(\s*[-*_]\s*){3,}$/gim, '<hr class="md-hr" />');

  // 7. Destaque (negrito e itálico)
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');

  // 8. Listas ordenadas e não ordenadas
  const lines = text.split('\n');
  const resultLines: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (ulMatch) {
      if (inOl) {
        resultLines.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        resultLines.push('<ul class="md-ul">');
        inUl = true;
      }
      resultLines.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) {
        resultLines.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        resultLines.push('<ol class="md-ol">');
        inOl = true;
      }
      resultLines.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) {
        resultLines.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        resultLines.push('</ol>');
        inOl = false;
      }
      resultLines.push(line);
    }
  }
  if (inUl) resultLines.push('</ul>');
  if (inOl) resultLines.push('</ol>');

  text = resultLines.join('\n');

  // 9. Parágrafos separados por linhas em branco
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('@@@CODEBLOCK_')
    ) {
      return trimmed;
    }
    const withBr = trimmed.replace(/\n/g, '<br />');
    return `<p class="md-p">${withBr}</p>`;
  });

  let html = formattedBlocks.filter(Boolean).join('\n');

  // 10. Restaurar blocos de código
  codeBlocks.forEach((codeHtml, index) => {
    html = html.replace(`@@@CODEBLOCK_${index}@@@`, codeHtml);
  });

  return html;
}

@Component({
  selector: 'app-scrap-review-preview',
  imports: [UiIcon],
  templateUrl: './scrap-review-preview.html',
  styleUrl: './scrap-review-preview.css',
})
export class ScrapReviewPreview {
  private readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());

  readonly review = input<ScrapReview | null>(null);
  readonly occurrence = input<ScrapListItem | null>(null);
  readonly draftForm = input<ScrapReviewFormModel | null>(null);
  readonly draftAttachments = input<
    Array<{ url: string; name?: string; original_filename?: string }>
  >([]);
  readonly isDraft = input<boolean>(false);
  readonly defectTypeName = input<string | null>(null);

  readonly lightboxItem = signal<{ url: string; name: string } | null>(null);

  readonly displayTitle = computed(() => {
    return this.review()?.title || this.draftForm()?.title || 'Relatório de Scrap';
  });

  readonly displayDescription = computed(() => {
    return this.review()?.description || this.draftForm()?.description || '';
  });

  readonly renderedDescriptionHtml = computed(() => {
    return parseMarkdown(this.displayDescription());
  });

  readonly displayDefectType = computed(() => {
    return (
      this.review()?.defect_type?.name ||
      this.defectTypeName() ||
      this.occurrence()?.defect_type_name ||
      '—'
    );
  });

  readonly displayResponsible = computed(() => {
    return this.review()?.responsible_name || this.occurrence()?.responsible_name || '—';
  });

  readonly displayDate = computed(() => {
    const d = this.review()?.reviewed_at || this.occurrence()?.reviewed_at;
    if (!d) return null;
    return new Date(d).toLocaleDateString(this.calendarLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  readonly isReviewed = computed(() => this.review()?.status === 'REVIEWED');

  readonly allImages = computed(() => {
    const list: Array<{ url: string; name: string }> = [];
    if (this.review()?.attachments?.length) {
      for (const a of this.review()!.attachments) {
        list.push({
          url: a.url,
          name: a.original_filename,
        });
      }
    }
    if (this.draftAttachments()?.length) {
      for (const da of this.draftAttachments()) {
        if (!list.some((existing) => existing.url === da.url)) {
          list.push({
            url: da.url,
            name: da.original_filename || da.name || 'Foto de evidência',
          });
        }
      }
    }
    return list;
  });

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.lightboxItem()) {
      event.stopPropagation();
      this.closeLightbox();
    }
  }

  openLightbox(url: string, name: string): void {
    this.lightboxItem.set({ url, name });
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
  }

  formatCurrency(value: string | undefined): string {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(
      Number(value),
    );
  }

  formatTransactionDate(value: string | undefined): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private calendarLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }
}
