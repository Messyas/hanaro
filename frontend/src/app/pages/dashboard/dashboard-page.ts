import { Component, computed, inject } from '@angular/core';
import { UiIcon, IconName } from '../../ui-icon';
import { LanguageService } from '../../i18n/language.service';
import { DashboardPerformanceChart } from './components/dashboard-performance-chart';

interface SummaryCard {
  label: string;
  value: string;
  trend: string;
  icon: IconName;
  tone: string;
}
interface ActivityItem {
  initials: string;
  name: string;
  action: string;
  time: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [UiIcon, DashboardPerformanceChart],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly language = inject(LanguageService);
  readonly summaryCards = computed<readonly SummaryCard[]>(() => {
    this.language.currentLanguage();
    return [
      {
        label: $localize`:@@summary.activeUsers:Usuários ativos`,
        value: '1.284',
        trend: '+12,5%',
        icon: 'users',
        tone: 'violet',
      },
      {
        label: $localize`:@@summary.newRegistrations:Novos cadastros`,
        value: '164',
        trend: '+8,2%',
        icon: 'user-plus',
        tone: 'blue',
      },
      {
        label: $localize`:@@summary.monthlyRevenue:Receita mensal`,
        value: 'R$ 48,2 mil',
        trend: '+5,7%',
        icon: 'chart-line',
        tone: 'green',
      },
      {
        label: $localize`:@@summary.pendingTasks:Pendências`,
        value: '23',
        trend: '-4,1%',
        icon: 'clock',
        tone: 'orange',
      },
    ];
  });
  readonly recentActivity = computed<readonly ActivityItem[]>(() => {
    this.language.currentLanguage();
    return [
      {
        initials: 'MC',
        name: 'Marina Costa',
        action: $localize`:@@activity.addUser:adicionou um novo usuário`,
        time: $localize`:@@activity.time8m:há 8 min`,
      },
      {
        initials: 'RA',
        name: 'Rafael Alves',
        action: $localize`:@@activity.generateReport:gerou o relatório mensal`,
        time: $localize`:@@activity.time32m:há 32 min`,
      },
      {
        initials: 'LS',
        name: 'Larissa Souza',
        action: $localize`:@@activity.updateSettings:atualizou as configurações`,
        time: $localize`:@@activity.time1h:há 1 h`,
      },
    ];
  });
}
