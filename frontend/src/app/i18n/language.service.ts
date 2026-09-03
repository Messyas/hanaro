import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type LanguageCode = 'pt' | 'en' | 'ko';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeName: string;
}

export interface AppTranslations {
  navDashboard: string;
  navExecutions: string;
  navScrapBase: string;
  navReports: string;
  navSettings: string;
  navProfile: string;
  helpSupport: string;
  mainNavigationLabel: string;
  breadcrumbNavigationLabel: string;
  closeSidebar: string;
  openSidebar: string;
  collapseSidebar: string;
  expandSidebar: string;
  profileMenuLabel: string;
  openProfileMenu: string;
  administratorRole: string;
  userRole: string;
  signOut: string;
  loginButton: string;
  loginHint: string;
  settingsTitle: string;
  settingsTabPreferences: string;
  settingsTabSystem: string;
  settingsTabTargets: string;
  targetYearPlanTitle: string;
  targetYearPlanSubtitle: string;
  targetSelectYear: string;
  targetAnnualTotal: string;
  targetMonthlyAverage: string;
  targetComparisonPreviousYear: string;
  targetNoPreviousYear: string;
  targetReductionVsPrevious: string;
  targetIncreaseVsPrevious: string;
  prefillAssistantTitle: string;
  prefillAssistantDesc: string;
  prefillModeLinear: string;
  prefillModeCurve: string;
  prefillAnnualTotalLabel: string;
  prefillJanValueLabel: string;
  prefillDecValueLabel: string;
  prefillApplyBtn: string;
  targetMonthCol: string;
  targetValueCol: string;
  targetShareCol: string;
  targetCurveTrajectory: string;
  targetSavePlanBtn: string;
  targetSavingPlan: string;
  targetClearPlanBtn: string;
  targetPlanSavedSuccess: string;
  targetPlanClearedSuccess: string;
  targetPlanSaveError: string;
  targetLoginRequiredNotice: string;
  targetLoginAction: string;
  scrapDefectTypesTitle: string;
  scrapDefectTypesSubtitle: string;
  scrapDefectTypeNameLabel: string;
  scrapDefectTypeNamePlaceholder: string;
  scrapDefectTypeCodeLabel: string;
  scrapDefectTypeCodePlaceholder: string;
  scrapDefectTypeDescLabel: string;
  scrapDefectTypeDescPlaceholder: string;
  scrapDefectTypeAddButton: string;
  scrapDefectTypeStatusActive: string;
  scrapDefectTypeStatusInactive: string;
  scrapDefectTypeEmptyState: string;
  scrapDefectTypeSuccessCreate: string;
  scrapDefectTypeSuccessUpdate: string;
  scrapDefectTypeErrorCreate: string;
  scrapDefectTypeErrorUpdate: string;
  scrapDefectTypeEditAction: string;
  scrapDefectTypeDeleteAction: string;
  scrapDefectTypeDeleteConfirmTitle: string;
  scrapDefectTypeDeleteConfirmMessage: string;
  scrapDefectTypeSuccessDelete: string;
  scrapDefectTypeErrorDelete: string;
  scrapDefectTypeCancelAction: string;
  scrapDefectTypeSaveAction: string;
  scrapDefectTypeCountSummary: string;
  scrapDefectTypeActiveCountSummary: string;
  themeTitle: string;
  themeSubtitle: string;
  themeGroupLabel: string;
  themeLight: string;
  themeLightDesc: string;
  themeDark: string;
  themeDarkDesc: string;
  darkToggle: string;
  darkToggleDesc: string;
  darkToggleAria: string;
  systemToggle: string;
  systemToggleDesc: string;
  systemToggleAria: string;
  languageTitle: string;
  languageSubtitle: string;
  languageGroupLabel: string;
  portugueseLanguage: string;
  englishLanguage: string;
  koreanLanguage: string;
  profileTitle: string;
  profileEdit: string;
  profilePhotoTitle: string;
  profilePhotoDescription: string;
  profilePhotoAlt: string;
  profilePhotoAdd: string;
  profilePhotoChange: string;
  profilePhotoRemove: string;
  profilePhotoUploading: string;
  profilePhotoRemoving: string;
  profilePhotoUploadSuccess: string;
  profilePhotoRemoveSuccess: string;
  profilePhotoTypeError: string;
  profilePhotoSizeError: string;
  profilePhotoUploadError: string;
  profilePhotoRemoveError: string;
  profilePersonalTitle: string;
  profilePersonalDescription: string;
  profileContactTitle: string;
  profileContactDescription: string;
  profileNameLabel: string;
  profileUsernameLabel: string;
  profileUsernameHint: string;
  profileEmailLabel: string;
  profileNotificationEmailLabel: string;
  profileNotificationEmailHint: string;
  profilePhoneLabel: string;
  profilePhonePlaceholder: string;
  profileJobTitleLabel: string;
  profileJobTitlePlaceholder: string;
  profileRequiredError: string;
  profileEmailError: string;
  profileLoadError: string;
  profileSaveError: string;
  profileEmailConflict: string;
  profileSaveSuccess: string;
  profileSave: string;
  profileSaving: string;
  logoutTitle: string;
  logoutDescription: string;
  back: string;
  close: string;
  cancel: string;
  confirmSignOut: string;

  // Execuções
  executionsTitle: string;
  executionsDateFrom: string;
  executionsDateTo: string;
  executionsStatus: string;
  executionsAllStatus: string;
  executionsSearchId: string;
  executionsSearchPlaceholder: string;
  executionsSearchLabel: string;
  executionsFilterBtn: string;
  executionsFilterPopoverTitle: string;
  executionsActiveFilters: string;
  executionsClearAll: string;
  executionsApplyFilters: string;
  executionsClearFilters: string;
  executionsDateRangeError: string;
  calendarToday: string;
  calendarClear: string;
  executionsHistoryTitle: string;
  executionsTotalLabel: string;
  executionsColProcess: string;
  executionsColOrigin: string;
  executionsColTrigger: string;
  executionsColStart: string;
  executionsColEnd: string;
  executionsColDuration: string;
  executionsColReceived: string;
  executionsColValid: string;
  executionsColRejected: string;
  executionsColSnapshot: string;
  executionsColStatus: string;
  executionsStatusCompleted: string;
  executionsStatusFailed: string;
  executionsStatusRunning: string;
  executionsStatusQueued: string;
  executionsStatusCancelled: string;
  executionsSnapshotPublished: string;
  executionsSnapshotUnchangedReplay: string;
  executionsSnapshotPreservedPrevious: string;
  executionsSnapshotNotPublished: string;
  executionsTriggerScheduled: string;
  executionsTriggerManual: string;
  executionsTriggerAutomatic: string;
  executionsDetailTitle: string;
  executionsCloseDetail: string;
  executionsMetaGeneral: string;
  executionsMetaTechnical: string;
  executionsMetaExecutionId: string;
  executionsMetaCorrelationId: string;
  executionsMetaGerpRequestId: string;
  executionsMetaReport: string;
  executionsMetaSourceFile: string;
  executionsMetaSha256: string;
  executionsTimelineTitle: string;
  executionsTimelineDesc: string;
  executionsFailureTitle: string;
  executionsPaginationPage: string;
  executionsPaginationOf: string;
  executionsPaginationPerPage: string;
  executionsLoading: string;
  executionsEmptyTitle: string;
  executionsEmptyDesc: string;
  executionsErrorTitle: string;
  executionsRetry: string;
  executionsStepGerpRequest: string;
  executionsStepGerpReportGeneration: string;
  executionsStepFileDownload: string;
  executionsStepFileValidation: string;
  executionsStepDataNormalization: string;
  executionsStepExchangeRate: string;
  executionsStepJsonValidation: string;
  executionsStepSnapshotPublication: string;
  executionsStepPending: string;
  executionsStepSkipped: string;
  scrapBaseTitle: string;
  scrapOccurrencesTitle: string;
  scrapTotalLabel: string;
  scrapFilterButton: string;
  scrapFilterTitle: string;
  scrapClearFilters: string;
  scrapApplyFilters: string;
  scrapSearchLabel: string;
  scrapSearchPlaceholder: string;
  scrapDateFrom: string;
  scrapDateTo: string;
  scrapOrganizations: string;
  scrapOrganizationsPlaceholder: string;
  scrapDateRangeError: string;
  scrapSortBy: string;
  scrapSortAriaLabel: string;
  scrapSortTransactionDate: string;
  scrapSortOrganization: string;
  scrapSortItemCode: string;
  scrapSortQuantity: string;
  scrapSortAmountBrl: string;
  scrapSortAmountUsd: string;
  scrapSortDescending: string;
  scrapSortAscending: string;
  scrapLoading: string;
  scrapErrorTitle: string;
  scrapRetry: string;
  scrapEmptyTitle: string;
  scrapEmptyDesc: string;
  scrapSelectionEmptyTitle: string;
  scrapSelectionEmptyDesc: string;
  scrapColDate: string;
  scrapColOrganization: string;
  scrapColItem: string;
  scrapColDescription: string;
  scrapColOrder: string;
  scrapColQuantity: string;
  scrapColAmountBrl: string;
  scrapColAmountUsd: string;
  scrapColOccurrence: string;
  scrapOccurrenceActive: string;

  // Scrap Review & Bulk & Reports
  scrapReviewStatusAll: string;
  scrapReviewStatusUnreviewed: string;
  scrapReviewStatusDraft: string;
  scrapReviewStatusReviewed: string;

  scrapColDefectType: string;
  scrapColReviewStatus: string;
  scrapColResponsible: string;
  scrapColAction: string;

  scrapSelectMode: string;
  scrapCancelSelection: string;
  scrapSelectedCount: string;
  scrapClearSelection: string;
  scrapSelectAllPage: string;
  scrapApplyReference: string;
  scrapCreateReview: string;
  scrapActionOpen: string;
  scrapActionView: string;
  scrapNoOccurrenceIdTooltip: string;

  scrapFilterReviewStatus: string;
  scrapFilterDefectType: string;
  scrapFilterDefectTypeAll: string;
  scrapFilterResponsible: string;
  scrapFilterResponsibleAll: string;
  scrapFilterResponsibleMine: string;

  scrapDrawerContext: string;
  scrapDrawerSummaryTitle: string;
  scrapDrawerFormTitle: string;
  scrapFieldDefectType: string;
  scrapFieldDefectTypePlaceholder: string;
  scrapFieldResponsible: string;
  scrapFieldTitle: string;
  scrapFieldTitlePlaceholder: string;
  scrapFieldDescription: string;
  scrapFieldDescriptionPlaceholder: string;
  scrapCharCount: string;
  scrapNoDefectTypes: string;

  scrapActionSaveDraft: string;
  scrapActionSaving: string;
  scrapActionFinalize: string;
  scrapActionFinalizing: string;
  scrapActionPreview: string;
  scrapActionEdit: string;
  scrapActionEditReview: string;
  scrapActionCancelEdit: string;
  scrapActionSaveEdit: string;
  scrapActionUseReference: string;
  scrapDiscardChangesConfirm: string;
  scrapFinalizeConfirmTitle: string;
  scrapFinalizeConfirmMessage: string;
  scrapConflictError: string;
  scrapReloadReview: string;
  scrapReadOnlyNotice: string;
  scrapDraftNotice: string;
  scrapPreviewNotice: string;
  scrapCreatedFromReference: string;
  scrapReferenceSelectedBanner: string;
  scrapTemplateSelectedBanner: string;
  scrapRemoveReference: string;
  scrapSelectReferenceMode: string;

  scrapTemplatesButton: string;
  scrapTemplatesCount: string;
  scrapTemplatesEmptyTitle: string;
  scrapTemplatesEmptyHint: string;
  scrapActionSaveAsTemplate: string;
  scrapActionRemoveTemplate: string;
  scrapTemplateNameLabel: string;
  scrapTemplateNamePlaceholder: string;
  scrapTemplateCreatedSuccess: string;
  scrapTemplateRemovedSuccess: string;
  scrapApplyTemplate: string;
  scrapUseThisTemplate: string;
  scrapSaveAsTemplateCheckbox: string;
  scrapTemplatesLibraryHint: string;
  scrapTemplatesLoading: string;
  scrapTemplateFieldName: string;
  scrapTemplateSelectType: string;
  scrapTemplateTypeRequired: string;
  scrapTemplateSaveChanges: string;
  scrapTemplateEdit: string;
  scrapTemplateDelete: string;
  scrapTemplateDeleteConfirm: string;
  scrapTemplateNoType: string;
  scrapTemplateUpdated: string;
  scrapTemplateUpdatedSuccess: string;
  scrapTemplateUpdateError: string;
  scrapTemplateDeleteError: string;
  scrapTemplateValidationName: string;
  scrapTemplateValidationTitle: string;
  scrapTemplateValidationDescription: string;
  scrapTemplateValidationMaxLength: string;
  scrapTemplateConfirmConnector: string;
  scrapTemplateSkipNotice: string;
  scrapSaveStatusSaving: string;
  scrapSaveStatusUnsaved: string;
  scrapSaveStatusSaved: string;

  scrapAttachmentsTitle: string;
  scrapAttachmentsHint: string;
  scrapAttachmentUploadError: string;
  scrapAttachmentTypeError: string;
  scrapAttachmentSizeError: string;
  scrapAttachmentMaxError: string;
  scrapAttachmentDeleteConfirm: string;
  scrapAttachmentRetry: string;
  scrapAttachmentRemove: string;
  scrapAttachmentView: string;

  scrapBulkTitle: string;
  scrapBulkItemsSelected: string;
  scrapBulkSelectReference: string;
  scrapBulkSearchPlaceholder: string;
  scrapBulkCopyAttachments: string;
  scrapBulkCopyAttachmentsWarning: string;
  scrapBulkApplyButton: string;
  scrapBulkApplying: string;
  scrapBulkSuccessSummary: string;
  scrapBulkSkippedSummary: string;
  scrapBulkReasonNotActive: string;
  scrapBulkReasonAlreadyReviewed: string;

  scrapQueueTitle: string;
  scrapQueueProgress: string;
  scrapQueuePrevious: string;
  scrapQueueNext: string;
  scrapQueueSkip: string;
  scrapQueueFinalizeAndNext: string;
  scrapQueueFinalizeAndFinish: string;
  scrapQueueSaveDraftAndNext: string;
  scrapStartQueue: string;
  scrapCreateSingleReport: string;
  scrapItemsSelected: string;
  scrapTemplateChecklistTitle: string;
  scrapTemplateChecklistHint: string;
  scrapTemplateChecklistApply: string;
  scrapTemplateChecklistSelectAll: string;

  reportsTitle: string;
  reportsSubtitle: string;
  reportsEmptyTitle: string;
  reportsEmptyDesc: string;
  reportsSearchPlaceholder: string;
}

const TRANSLATIONS: Record<LanguageCode, AppTranslations> = {
  pt: {
    navDashboard: 'Dashboard',
    navExecutions: 'Execuções',
    navScrapBase: 'Base de Scrap',
    navReports: 'Relatórios',
    navSettings: 'Configurações',
    navProfile: 'Perfil',
    helpSupport: 'Ajuda e suporte',
    mainNavigationLabel: 'Navegação principal',
    breadcrumbNavigationLabel: 'Navegação estrutural',
    closeSidebar: 'Fechar menu lateral',
    openSidebar: 'Abrir menu lateral',
    collapseSidebar: 'Recolher menu lateral',
    expandSidebar: 'Expandir menu lateral',
    profileMenuLabel: 'Menu do perfil',
    openProfileMenu: 'Abrir menu do perfil',
    administratorRole: 'Administrador',
    userRole: 'Usuário',
    signOut: 'Sair',
    loginButton: 'Entrar',
    loginHint: 'Acessar sua conta',
    settingsTitle: 'Configurações',
    settingsTabPreferences: 'Preferências',
    settingsTabSystem: 'Sistema',
    settingsTabTargets: 'Metas de IF Cost',
    targetYearPlanTitle: 'Plano Anual de Metas (IF Cost)',
    targetYearPlanSubtitle:
      'Defina as metas mensais de custo de refugo para guiar os indicadores de desempenho e o gráfico de evolução no Dashboard.',
    targetSelectYear: 'Ano de Referência',
    targetAnnualTotal: 'Total Anual Planejado',
    targetMonthlyAverage: 'Média Mensal',
    targetComparisonPreviousYear: 'Comparativo Ano Anterior',
    targetNoPreviousYear: 'Sem meta cadastrada no ano anterior',
    targetReductionVsPrevious: 'de redução em relação a',
    targetIncreaseVsPrevious: 'de aumento em relação a',
    prefillAssistantTitle: 'Assistente de Pré-preenchimento',
    prefillAssistantDesc:
      'Acelere o planejamento distribuindo uma meta uniforme ou traçando uma trajetória decrescente de Janeiro até Dezembro.',
    prefillModeLinear: 'Distribuição Uniforme',
    prefillModeCurve: 'Curva Gradual (Jan → Dez)',
    prefillAnnualTotalLabel: 'Meta Total do Ano (USD)',
    prefillJanValueLabel: 'Meta Inicial (Janeiro)',
    prefillDecValueLabel: 'Meta Final (Dezembro)',
    prefillApplyBtn: 'Aplicar Pré-preenchimento',
    targetMonthCol: 'Mês',
    targetValueCol: 'Meta IF Cost (USD)',
    targetShareCol: 'Participação Anual',
    targetCurveTrajectory: 'Trajetória da Meta no Ano',
    targetSavePlanBtn: 'Salvar Plano Anual',
    targetSavingPlan: 'Salvando plano...',
    targetClearPlanBtn: 'Excluir Metas do Ano',
    targetPlanSavedSuccess: 'Plano anual de metas salvo com sucesso!',
    targetPlanClearedSuccess: 'Metas do ano removidas com sucesso.',
    targetPlanSaveError: 'Erro ao salvar plano de metas. Tente novamente.',
    targetLoginRequiredNotice:
      'Apenas usuários autenticados podem cadastrar ou editar metas de IF Cost. Você está visualizando em modo somente leitura.',
    targetLoginAction: 'Fazer Login',
    scrapDefectTypesTitle: 'Tipos de Scrap',
    scrapDefectTypesSubtitle:
      'Categorias compartilhadas do sistema para classificação e análise de refugo pela equipe.',
    scrapDefectTypeNameLabel: 'Nome da categoria',
    scrapDefectTypeNamePlaceholder: 'Ex: Oxidação, Avaria de Transporte, Trinca...',
    scrapDefectTypeCodeLabel: 'Código identificador',
    scrapDefectTypeCodePlaceholder: 'Ex: OXIDACAO, AVARIA_TRANSPORTE',
    scrapDefectTypeDescLabel: 'Descrição (opcional)',
    scrapDefectTypeDescPlaceholder:
      'Descreva os critérios e características deste tipo de refugo...',
    scrapDefectTypeAddButton: 'Cadastrar Tipo de Scrap',
    scrapDefectTypeStatusActive: 'Ativo',
    scrapDefectTypeStatusInactive: 'Inativo',
    scrapDefectTypeEmptyState:
      'Nenhum tipo de scrap cadastrado ainda. Preencha o formulário acima para criar o primeiro e disponibilizá-lo para toda a equipe.',
    scrapDefectTypeSuccessCreate: 'Tipo de scrap cadastrado com sucesso!',
    scrapDefectTypeSuccessUpdate: 'Tipo de scrap atualizado com sucesso!',
    scrapDefectTypeErrorCreate: 'Erro ao cadastrar tipo de scrap. Verifique se o código já existe.',
    scrapDefectTypeErrorUpdate: 'Erro ao atualizar tipo de scrap.',
    scrapDefectTypeEditAction: 'Editar',
    scrapDefectTypeDeleteAction: 'Excluir',
    scrapDefectTypeDeleteConfirmTitle: 'Excluir Tipo de Scrap',
    scrapDefectTypeDeleteConfirmMessage: 'Tem certeza que deseja excluir o tipo de scrap',
    scrapDefectTypeSuccessDelete: 'Tipo de scrap excluído com sucesso!',
    scrapDefectTypeErrorDelete: 'Erro ao excluir tipo de scrap.',
    scrapDefectTypeCancelAction: 'Cancelar',
    scrapDefectTypeSaveAction: 'Salvar alterações',
    scrapDefectTypeCountSummary: 'tipos cadastrados',
    scrapDefectTypeActiveCountSummary: 'ativos',
    themeTitle: 'Tema da interface',
    themeSubtitle: 'Escolha como o painel deve ser exibido.',
    themeGroupLabel: 'Escolha de tema',
    themeLight: 'Claro',
    themeLightDesc: 'Visual limpo para ambientes iluminados',
    themeDark: 'Escuro',
    themeDarkDesc: 'Mais confortável em ambientes com pouca luz',
    darkToggle: 'Tema escuro',
    darkToggleDesc: 'Alterne diretamente entre a aparência clara e escura.',
    darkToggleAria: 'Ativar tema escuro',
    systemToggle: 'Usar configuração do sistema',
    systemToggleDesc: 'Acompanha automaticamente o tema do sistema operacional.',
    systemToggleAria: 'Usar tema do sistema operacional',
    languageTitle: 'Idioma do sistema',
    languageSubtitle: 'Selecione o idioma de preferência para a interface.',
    languageGroupLabel: 'Escolha de idioma',
    portugueseLanguage: 'Português',
    englishLanguage: 'Inglês',
    koreanLanguage: 'Coreano',
    profileTitle: 'Configurações do perfil',
    profileEdit: 'Editar perfil',
    profilePhotoTitle: 'Foto do perfil',
    profilePhotoDescription: 'Use uma imagem JPEG, PNG ou WebP de até 5 MB.',
    profilePhotoAlt: 'Foto do perfil',
    profilePhotoAdd: 'Adicionar foto',
    profilePhotoChange: 'Alterar foto',
    profilePhotoRemove: 'Remover foto',
    profilePhotoUploading: 'Enviando…',
    profilePhotoRemoving: 'Removendo…',
    profilePhotoUploadSuccess: 'Foto atualizada com sucesso.',
    profilePhotoRemoveSuccess: 'Foto removida com sucesso.',
    profilePhotoTypeError: 'Escolha uma imagem JPEG, PNG ou WebP.',
    profilePhotoSizeError: 'A imagem deve ter no máximo 5 MB.',
    profilePhotoUploadError: 'Não foi possível atualizar a foto. Tente novamente.',
    profilePhotoRemoveError: 'Não foi possível remover a foto. Tente novamente.',
    profilePersonalTitle: 'Dados pessoais',
    profilePersonalDescription: 'Informações usadas para identificar você no sistema.',
    profileContactTitle: 'Contato e trabalho',
    profileContactDescription: 'Defina os canais de contato e sua função na operação.',
    profileNameLabel: 'Nome completo',
    profileUsernameLabel: 'Usuário',
    profileUsernameHint: 'O nome de usuário é usado no login e não pode ser alterado aqui.',
    profileEmailLabel: 'E-mail da conta',
    profileNotificationEmailLabel: 'E-mail para notificações',
    profileNotificationEmailHint:
      'Se ficar vazio, as notificações serão enviadas ao e-mail da conta.',
    profilePhoneLabel: 'Telefone',
    profilePhonePlaceholder: '(00) 00000-0000',
    profileJobTitleLabel: 'Cargo',
    profileJobTitlePlaceholder: 'Ex.: Operador de produção',
    profileRequiredError: 'Preencha este campo.',
    profileEmailError: 'Informe um e-mail válido.',
    profileLoadError: 'Não foi possível carregar os dados do perfil.',
    profileSaveError: 'Não foi possível salvar as alterações. Tente novamente.',
    profileEmailConflict: 'Este e-mail já está em uso por outra conta.',
    profileSaveSuccess: 'Perfil atualizado com sucesso.',
    profileSave: 'Salvar alterações',
    profileSaving: 'Salvando…',
    logoutTitle: 'Confirmar logoff',
    logoutDescription: 'Tem certeza que deseja sair da conta?',
    back: 'Voltar',
    close: 'Fechar',
    cancel: 'Cancelar',
    confirmSignOut: 'Sim, sair.',

    executionsTitle: 'Execuções e atualização',
    executionsDateFrom: 'Data inicial',
    executionsDateTo: 'Data final',
    executionsStatus: 'Status',
    executionsAllStatus: 'Todos os status',
    executionsSearchId: 'Buscar Execution ID',
    executionsSearchPlaceholder: 'Ex: 550e8400...',
    executionsSearchLabel: 'Buscar por ID ou processo',
    executionsFilterBtn: 'Filtrar',
    executionsFilterPopoverTitle: 'Filtrar rotinas',
    executionsActiveFilters: 'Filtros ativos',
    executionsClearAll: 'Limpar tudo',
    executionsApplyFilters: 'Aplicar',
    executionsClearFilters: 'Limpar filtros',
    executionsDateRangeError: 'A data final não pode ser anterior à data inicial.',
    calendarToday: 'Hoje',
    calendarClear: 'Limpar',
    executionsHistoryTitle: 'Histórico de rotinas',
    executionsTotalLabel: 'TOTAL:',
    executionsColProcess: 'EXECUTION ID / PROCESSO',
    executionsColOrigin: 'ORIGEM',
    executionsColTrigger: 'GATILHO',
    executionsColStart: 'INÍCIO',
    executionsColEnd: 'FIM',
    executionsColDuration: 'DURAÇÃO',
    executionsColReceived: 'RECEBIDOS',
    executionsColValid: 'VÁLIDOS',
    executionsColRejected: 'REJEITADOS',
    executionsColSnapshot: 'SNAPSHOT',
    executionsColStatus: 'STATUS',
    executionsStatusCompleted: 'Concluído',
    executionsStatusFailed: 'Falha',
    executionsStatusRunning: 'Em andamento',
    executionsStatusQueued: 'Na fila',
    executionsStatusCancelled: 'Cancelado',
    executionsSnapshotPublished: 'Publicado',
    executionsSnapshotUnchangedReplay: 'Replay idêntico',
    executionsSnapshotPreservedPrevious: 'Preservado anterior',
    executionsSnapshotNotPublished: 'Não publicado',
    executionsTriggerScheduled: 'Agendado',
    executionsTriggerManual: 'Manual',
    executionsTriggerAutomatic: 'Automático',
    executionsDetailTitle: 'Detalhes da Execução',
    executionsCloseDetail: 'Fechar detalhes',
    executionsMetaGeneral: 'Informações Gerais',
    executionsMetaTechnical: 'Metadados Técnicos',
    executionsMetaExecutionId: 'Execution ID',
    executionsMetaCorrelationId: 'Correlation ID',
    executionsMetaGerpRequestId: 'GERP Request ID',
    executionsMetaReport: 'Relatório',
    executionsMetaSourceFile: 'Arquivo Origem',
    executionsMetaSha256: 'SHA-256',
    executionsTimelineTitle: 'Timeline das 8 etapas do robô',
    executionsTimelineDesc: 'Rastreabilidade de cada fase executada pela automação',
    executionsFailureTitle: 'Detalhes da Falha',
    executionsPaginationPage: 'Página',
    executionsPaginationOf: 'de',
    executionsPaginationPerPage: 'POR PÁGINA:',
    executionsLoading: 'Carregando histórico de execuções...',
    executionsEmptyTitle: 'Nenhuma execução encontrada',
    executionsEmptyDesc: 'Nenhuma execução de automação corresponde aos filtros selecionados.',
    executionsErrorTitle: 'Não foi possível carregar as execuções',
    executionsRetry: 'Tentar novamente',
    executionsStepGerpRequest: 'Solicitação no GERP',
    executionsStepGerpReportGeneration: 'Geração do Relatório GERP',
    executionsStepFileDownload: 'Download do Arquivo TSV',
    executionsStepFileValidation: 'Validação do Arquivo TSV',
    executionsStepDataNormalization: 'Normalização dos Dados',
    executionsStepExchangeRate: 'Obtenção da Taxa de Câmbio',
    executionsStepJsonValidation: 'Validação do JSON Canônico',
    executionsStepSnapshotPublication: 'Publicação do Snapshot',
    executionsStepPending: 'Pendente',
    executionsStepSkipped: 'Ignorado',
    scrapBaseTitle: 'Base de Scrap',
    scrapOccurrencesTitle: 'Ocorrências de scrap',
    scrapTotalLabel: 'TOTAL:',
    scrapFilterButton: 'Filtrar',
    scrapFilterTitle: 'Filtros da base',
    scrapClearFilters: 'Limpar filtros',
    scrapApplyFilters: 'Aplicar',
    scrapSearchLabel: 'Buscar',
    scrapSearchPlaceholder: 'Item, descrição, ordem ou ocorrência',
    scrapDateFrom: 'Data inicial',
    scrapDateTo: 'Data final',
    scrapOrganizations: 'Organizações',
    scrapOrganizationsPlaceholder: 'Ex.: NWK, NW1',
    scrapDateRangeError: 'A data final não pode ser anterior à data inicial.',
    scrapSortBy: 'Ordenar por',
    scrapSortAriaLabel: 'Ordenar base de scrap',
    scrapSortTransactionDate: 'Data da transação',
    scrapSortOrganization: 'Organização',
    scrapSortItemCode: 'Código do item',
    scrapSortQuantity: 'Quantidade',
    scrapSortAmountBrl: 'Valor (BRL)',
    scrapSortAmountUsd: 'Valor (USD)',
    scrapSortDescending: 'Decrescente',
    scrapSortAscending: 'Crescente',
    scrapLoading: 'Carregando ocorrências de scrap',
    scrapErrorTitle: 'Não foi possível carregar a base',
    scrapRetry: 'Tentar novamente',
    scrapEmptyTitle: 'Nenhuma ocorrência encontrada',
    scrapEmptyDesc: 'Ajuste os filtros ou aguarde a publicação de uma nova execução.',
    scrapSelectionEmptyTitle: 'Nenhuma ocorrência pendente para revisar',
    scrapSelectionEmptyDesc: 'Todas as ocorrências deste período já foram revisadas.',
    scrapColDate: 'DATA',
    scrapColOrganization: 'ORGANIZAÇÃO',
    scrapColItem: 'ITEM',
    scrapColDescription: 'DESCRIÇÃO',
    scrapColOrder: 'ORDEM',
    scrapColQuantity: 'QUANTIDADE',
    scrapColAmountBrl: 'VALOR BRL',
    scrapColAmountUsd: 'VALOR USD',
    scrapColOccurrence: 'OCORRÊNCIA',
    scrapOccurrenceActive: 'Ativa',

    scrapReviewStatusAll: 'Todos',
    scrapReviewStatusUnreviewed: 'Não analisado',
    scrapReviewStatusDraft: 'Rascunho',
    scrapReviewStatusReviewed: 'Revisado',

    scrapColDefectType: 'TIPO DE SCRAP',
    scrapColReviewStatus: 'STATUS ANÁLISE',
    scrapColResponsible: 'RESPONSÁVEL / DATA',
    scrapColAction: 'AÇÃO',

    scrapSelectMode: 'Selecionar itens',
    scrapCancelSelection: 'Cancelar seleção',
    scrapSelectedCount: 'selecionados',
    scrapClearSelection: 'Limpar seleção',
    scrapSelectAllPage: 'Selecionar visíveis',
    scrapApplyReference: 'Aplicar relatório de referência',
    scrapCreateReview: 'Criar análise',
    scrapActionOpen: 'Abrir análise',
    scrapActionView: 'Ver relatório',
    scrapNoOccurrenceIdTooltip: 'Ocorrência sem identificador estável para análise',

    scrapFilterReviewStatus: 'Status da análise',
    scrapFilterDefectType: 'Tipo de scrap',
    scrapFilterDefectTypeAll: 'Todos os tipos',
    scrapFilterResponsible: 'Responsável',
    scrapFilterResponsibleAll: 'Todos os responsáveis',
    scrapFilterResponsibleMine: 'Meus relatórios',

    scrapDrawerContext: 'Análise de scrap',
    scrapDrawerSummaryTitle: 'Resumo da ocorrência',
    scrapDrawerFormTitle: 'Formulário de análise',
    scrapFieldDefectType: 'Tipo de scrap',
    scrapFieldDefectTypePlaceholder: 'Selecione o tipo de scrap',
    scrapFieldResponsible: 'Responsável',
    scrapFieldTitle: 'Título da análise',
    scrapFieldTitlePlaceholder: 'Resumo breve do defeito ou causa',
    scrapFieldDescription: 'Descrição e causa raiz',
    scrapFieldDescriptionPlaceholder:
      'Descreva a ocorrência, causas identificadas e ações tomadas...',
    scrapCharCount: 'caracteres',
    scrapNoDefectTypes: 'Nenhum tipo de scrap ativo foi cadastrado. Procure um administrador.',

    scrapActionSaveDraft: 'Salvar rascunho',
    scrapActionSaving: 'Salvando...',
    scrapActionFinalize: 'Finalizar relatório',
    scrapActionFinalizing: 'Finalizando...',
    scrapActionPreview: 'Visualizar relatório',
    scrapActionEdit: 'Voltar para edição',
    scrapActionEditReview: 'Editar relatório',
    scrapActionCancelEdit: 'Cancelar edição',
    scrapActionSaveEdit: 'Salvar alterações',
    scrapActionUseReference: 'Usar como referência',
    scrapDiscardChangesConfirm:
      'Existem alterações não salvas. Deseja realmente fechar e descartar as alterações?',
    scrapFinalizeConfirmTitle: 'Finalizar análise',
    scrapFinalizeConfirmMessage:
      'O relatório será finalizado e continuará editável apenas por quem o criou. Deseja continuar?',
    scrapConflictError:
      'Este relatório foi alterado em outra sessão. Recarregue a versão mais recente antes de continuar.',
    scrapReloadReview: 'Recarregar relatório',
    scrapReadOnlyNotice: 'Relatório finalizado em',
    scrapDraftNotice: 'Rascunho — não finalizado',
    scrapPreviewNotice: 'Pré-visualização — ainda não finalizado',
    scrapCreatedFromReference: 'Criado a partir de outro relatório',
    scrapReferenceSelectedBanner: 'Referência selecionada:',
    scrapTemplateSelectedBanner: 'Modelo selecionado:',
    scrapRemoveReference: 'Remover referência',
    scrapSelectReferenceMode:
      'Modo de aplicação em lote ativo. Selecione as ocorrências na tabela abaixo e clique em Aplicar referência.',

    scrapTemplatesButton: 'Modelos Salvos',
    scrapTemplatesCount: 'Modelos Salvos',
    scrapTemplatesEmptyTitle: 'Nenhum modelo salvo ainda',
    scrapTemplatesEmptyHint:
      'Finalize uma análise com boa justificativa e clique no coração ❤️ para salvá-la como modelo reutilizável.',
    scrapActionSaveAsTemplate: 'Salvar como modelo favorito',
    scrapActionRemoveTemplate: 'Remover modelo dos favoritos',
    scrapTemplateNameLabel: 'Nome do Modelo',
    scrapTemplateNamePlaceholder: 'Ex: Oxidação em placa SMT',
    scrapTemplateCreatedSuccess: 'Modelo salvo com sucesso!',
    scrapTemplateRemovedSuccess: 'Modelo removido dos favoritos.',
    scrapApplyTemplate: 'Aplicar Modelo',
    scrapUseThisTemplate: 'Usar este modelo',
    scrapSaveAsTemplateCheckbox: 'Salvar esta análise como modelo favorito (❤️) para o futuro',
    scrapTemplatesLibraryHint: 'Escolha um modelo para aplicar ou edite seus campos nesta lista.',
    scrapTemplatesLoading: 'Carregando modelos...',
    scrapTemplateFieldName: 'Nome do modelo',
    scrapTemplateSelectType: 'Selecione o tipo de scrap',
    scrapTemplateTypeRequired: 'Selecione o tipo de scrap.',
    scrapTemplateSaveChanges: 'Salvar alterações',
    scrapTemplateEdit: 'Editar modelo',
    scrapTemplateDelete: 'Excluir',
    scrapTemplateDeleteConfirm: 'Excluir este modelo?',
    scrapTemplateNoType: 'Sem tipo',
    scrapTemplateUpdated: 'Atualizado em',
    scrapTemplateUpdatedSuccess: 'Modelo atualizado.',
    scrapTemplateUpdateError: 'Não foi possível atualizar o modelo. Tente novamente.',
    scrapTemplateDeleteError: 'Não foi possível excluir o modelo. Tente novamente.',
    scrapTemplateValidationName: 'Informe um nome para o modelo.',
    scrapTemplateValidationTitle: 'Informe o título do relatório.',
    scrapTemplateValidationDescription: 'Informe a descrição do relatório.',
    scrapTemplateValidationMaxLength: 'O texto ultrapassa o limite permitido.',
    scrapTemplateConfirmConnector: 'em',
    scrapTemplateSkipNotice: 'Ocorrências inativas ou que já possuem relatório serão ignoradas.',
    scrapSaveStatusSaving: 'Salvando alterações...',
    scrapSaveStatusUnsaved: 'Alterações não salvas',
    scrapSaveStatusSaved: 'Salvo às',

    scrapAttachmentsTitle: 'Evidências e fotos',
    scrapAttachmentsHint:
      'Arraste imagens ou clique para selecionar. Aceita JPEG, PNG e WebP (máx. 10MB por foto, limite de 8 fotos).',
    scrapAttachmentUploadError: 'Erro no envio da imagem',
    scrapAttachmentTypeError: 'Formato não suportado. Utilize apenas JPEG, PNG ou WebP.',
    scrapAttachmentSizeError: 'A imagem excede o limite máximo de 10 MB.',
    scrapAttachmentMaxError: 'Limite de 8 imagens atingido para esta análise.',
    scrapAttachmentDeleteConfirm: 'Deseja excluir esta foto da análise?',
    scrapAttachmentRetry: 'Tentar novamente',
    scrapAttachmentRemove: 'Remover foto',
    scrapAttachmentView: 'Visualizar foto',

    scrapBulkTitle: 'Criar relatórios em massa',
    scrapBulkItemsSelected: 'ocorrência(s) selecionada(s) para aplicação.',
    scrapBulkSelectReference: 'Selecione um relatório finalizado como referência:',
    scrapBulkSearchPlaceholder: 'Buscar por item, título ou descrição...',
    scrapBulkCopyAttachments: 'Copiar imagens da referência',
    scrapBulkCopyAttachmentsWarning:
      'Atenção: Copiar fotos replica as mesmas evidências visuais para todos os itens selecionados.',
    scrapBulkApplyButton: 'Criar relatórios',
    scrapBulkApplying: 'Processando lote...',
    scrapBulkSuccessSummary: 'Relatórios criados com sucesso:',
    scrapBulkSkippedSummary: 'Itens ignorados:',
    scrapBulkReasonNotActive: 'Item inativo no período',
    scrapBulkReasonAlreadyReviewed: 'Item já possui análise prévia',

    scrapQueueTitle: 'Fila de Relatórios',
    scrapQueueProgress: 'Item {current} de {total}',
    scrapQueuePrevious: 'Anterior',
    scrapQueueNext: 'Próximo',
    scrapQueueSkip: 'Pular',
    scrapQueueFinalizeAndNext: 'Finalizar e ir para o próximo',
    scrapQueueFinalizeAndFinish: 'Finalizar e concluir fila',
    scrapQueueSaveDraftAndNext: 'Salvar rascunho e avançar',
    scrapStartQueue: 'Iniciar fila de relatórios',
    scrapCreateSingleReport: 'Criar relatório',
    scrapItemsSelected: 'item(ns) selecionado(s)',
    scrapTemplateChecklistTitle: 'Aplicar Modelo em Lote',
    scrapTemplateChecklistHint:
      'Marque no checklist as ocorrências pendentes que receberão este modelo:',
    scrapTemplateChecklistApply: 'Aplicar modelo aos itens selecionados',
    scrapTemplateChecklistSelectAll: 'Marcar todos os pendentes',

    reportsTitle: 'Relatórios de Scrap',
    reportsSubtitle: 'Catálogo de ocorrências revisadas e análises de causa raiz finalizadas.',
    reportsEmptyTitle: 'Nenhum relatório finalizado encontrado',
    reportsEmptyDesc:
      'Quando as ocorrências da Base de Scrap forem finalizadas, seus relatórios aparecerão aqui.',
    reportsSearchPlaceholder: 'Buscar relatórios por item, código ou descrição...',
  },
  en: {
    navDashboard: 'Dashboard',
    navExecutions: 'Executions',
    navScrapBase: 'Scrap Base',
    navReports: 'Reports',
    navSettings: 'Settings',
    navProfile: 'Profile',
    helpSupport: 'Help and support',
    mainNavigationLabel: 'Main navigation',
    breadcrumbNavigationLabel: 'Breadcrumb navigation',
    closeSidebar: 'Close sidebar',
    openSidebar: 'Open sidebar',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    profileMenuLabel: 'Profile menu',
    openProfileMenu: 'Open profile menu',
    administratorRole: 'Administrator',
    userRole: 'User',
    signOut: 'Sign out',
    loginButton: 'Sign in',
    loginHint: 'Access your account',
    settingsTitle: 'Settings',
    settingsTabPreferences: 'Preferences',
    settingsTabSystem: 'System',
    settingsTabTargets: 'IF Cost Targets',
    targetYearPlanTitle: 'Annual Target Plan (IF Cost)',
    targetYearPlanSubtitle:
      'Set monthly scrap cost targets to drive performance indicators and the evolution chart on the Dashboard.',
    targetSelectYear: 'Reference Year',
    targetAnnualTotal: 'Planned Annual Total',
    targetMonthlyAverage: 'Monthly Average',
    targetComparisonPreviousYear: 'Previous Year Comparison',
    targetNoPreviousYear: 'No target registered for previous year',
    targetReductionVsPrevious: 'reduction compared to',
    targetIncreaseVsPrevious: 'increase compared to',
    prefillAssistantTitle: 'Pre-fill Assistant',
    prefillAssistantDesc:
      'Speed up planning by distributing an even target or sketching a declining curve from January to December.',
    prefillModeLinear: 'Uniform Distribution',
    prefillModeCurve: 'Gradual Curve (Jan → Dec)',
    prefillAnnualTotalLabel: 'Annual Total Target (USD)',
    prefillJanValueLabel: 'Initial Target (January)',
    prefillDecValueLabel: 'Final Target (December)',
    prefillApplyBtn: 'Apply Pre-fill',
    targetMonthCol: 'Month',
    targetValueCol: 'Target IF Cost (USD)',
    targetShareCol: 'Annual Share',
    targetCurveTrajectory: 'Target Trajectory Across Year',
    targetSavePlanBtn: 'Save Annual Plan',
    targetSavingPlan: 'Saving plan...',
    targetClearPlanBtn: 'Delete Year Targets',
    targetPlanSavedSuccess: 'Annual target plan saved successfully!',
    targetPlanClearedSuccess: 'Year targets removed successfully.',
    targetPlanSaveError: 'Error saving target plan. Please try again.',
    targetLoginRequiredNotice:
      'Only authenticated users can register or edit IF Cost targets. You are viewing in read-only mode.',
    targetLoginAction: 'Sign In',
    scrapDefectTypesTitle: 'Scrap Defect Types',
    scrapDefectTypesSubtitle:
      'Shared system categories for team scrap classification and analysis.',
    scrapDefectTypeNameLabel: 'Category Name',
    scrapDefectTypeNamePlaceholder: 'E.g., Oxidation, Transport Damage, Crack...',
    scrapDefectTypeCodeLabel: 'Identifier Code',
    scrapDefectTypeCodePlaceholder: 'E.g., OXIDATION, TRANSPORT_DAMAGE',
    scrapDefectTypeDescLabel: 'Description (optional)',
    scrapDefectTypeDescPlaceholder:
      'Describe the criteria and characteristics of this scrap type...',
    scrapDefectTypeAddButton: 'Register Scrap Type',
    scrapDefectTypeStatusActive: 'Active',
    scrapDefectTypeStatusInactive: 'Inactive',
    scrapDefectTypeEmptyState:
      'No scrap defect types registered yet. Fill in the form above to create the first one for the team.',
    scrapDefectTypeSuccessCreate: 'Scrap defect type registered successfully!',
    scrapDefectTypeSuccessUpdate: 'Scrap defect type updated successfully!',
    scrapDefectTypeErrorCreate:
      'Error registering scrap defect type. Check if the code already exists.',
    scrapDefectTypeErrorUpdate: 'Error updating scrap defect type.',
    scrapDefectTypeEditAction: 'Edit',
    scrapDefectTypeDeleteAction: 'Delete',
    scrapDefectTypeDeleteConfirmTitle: 'Delete Scrap Type',
    scrapDefectTypeDeleteConfirmMessage: 'Are you sure you want to delete the scrap type',
    scrapDefectTypeSuccessDelete: 'Scrap type deleted successfully!',
    scrapDefectTypeErrorDelete: 'Error deleting scrap type.',
    scrapDefectTypeCancelAction: 'Cancel',
    scrapDefectTypeSaveAction: 'Save changes',
    scrapDefectTypeCountSummary: 'registered types',
    scrapDefectTypeActiveCountSummary: 'active',
    themeTitle: 'Interface theme',
    themeSubtitle: 'Choose how the dashboard should be displayed.',
    themeGroupLabel: 'Theme selection',
    themeLight: 'Light',
    themeLightDesc: 'Clean look for well-lit environments',
    themeDark: 'Dark',
    themeDarkDesc: 'Easier on the eyes in low-light environments',
    darkToggle: 'Dark theme',
    darkToggleDesc: 'Switch directly between the light and dark appearance.',
    darkToggleAria: 'Enable dark theme',
    systemToggle: 'Use system setting',
    systemToggleDesc: 'Automatically follows your operating system theme.',
    systemToggleAria: 'Use operating system theme',
    languageTitle: 'System language',
    languageSubtitle: 'Select your preferred language for the interface.',
    languageGroupLabel: 'Language selection',
    portugueseLanguage: 'Portuguese',
    englishLanguage: 'English',
    koreanLanguage: 'Korean',
    profileTitle: 'Profile settings',
    profileEdit: 'Edit profile',
    profilePhotoTitle: 'Profile photo',
    profilePhotoDescription: 'Use a JPEG, PNG or WebP image up to 5 MB.',
    profilePhotoAlt: 'Profile photo',
    profilePhotoAdd: 'Add photo',
    profilePhotoChange: 'Change photo',
    profilePhotoRemove: 'Remove photo',
    profilePhotoUploading: 'Uploading…',
    profilePhotoRemoving: 'Removing…',
    profilePhotoUploadSuccess: 'Photo updated successfully.',
    profilePhotoRemoveSuccess: 'Photo removed successfully.',
    profilePhotoTypeError: 'Choose a JPEG, PNG or WebP image.',
    profilePhotoSizeError: 'The image must be no larger than 5 MB.',
    profilePhotoUploadError: 'We could not update the photo. Please try again.',
    profilePhotoRemoveError: 'We could not remove the photo. Please try again.',
    profilePersonalTitle: 'Personal information',
    profilePersonalDescription: 'Information used to identify you in the system.',
    profileContactTitle: 'Contact and work',
    profileContactDescription: 'Set your contact channels and role in the operation.',
    profileNameLabel: 'Full name',
    profileUsernameLabel: 'Username',
    profileUsernameHint: 'The username is used to sign in and cannot be changed here.',
    profileEmailLabel: 'Account email',
    profileNotificationEmailLabel: 'Notification email',
    profileNotificationEmailHint: 'When empty, notifications are sent to the account email.',
    profilePhoneLabel: 'Phone number',
    profilePhonePlaceholder: '+1 555 000 0000',
    profileJobTitleLabel: 'Job title',
    profileJobTitlePlaceholder: 'E.g. Production operator',
    profileRequiredError: 'This field is required.',
    profileEmailError: 'Enter a valid email address.',
    profileLoadError: 'We could not load your profile information.',
    profileSaveError: 'We could not save your changes. Please try again.',
    profileEmailConflict: 'This email is already used by another account.',
    profileSaveSuccess: 'Profile updated successfully.',
    profileSave: 'Save changes',
    profileSaving: 'Saving…',
    logoutTitle: 'Confirm sign out',
    logoutDescription: 'Are you sure you want to sign out of your account?',
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    confirmSignOut: 'Yes, sign out.',

    executionsTitle: 'Executions and Sync',
    executionsDateFrom: 'Start date',
    executionsDateTo: 'End date',
    executionsStatus: 'Status',
    executionsAllStatus: 'All statuses',
    executionsSearchId: 'Search Execution ID',
    executionsSearchPlaceholder: 'E.g. 550e8400...',
    executionsSearchLabel: 'Search by ID or process',
    executionsFilterBtn: 'Filter',
    executionsFilterPopoverTitle: 'Filter routines',
    executionsActiveFilters: 'Active filters',
    executionsClearAll: 'Clear all',
    executionsApplyFilters: 'Apply',
    executionsClearFilters: 'Clear filters',
    executionsDateRangeError: 'End date cannot be before start date.',
    calendarToday: 'Today',
    calendarClear: 'Clear',
    executionsHistoryTitle: 'Routine history',
    executionsTotalLabel: 'TOTAL:',
    executionsColProcess: 'EXECUTION ID / PROCESS',
    executionsColOrigin: 'ORIGIN',
    executionsColTrigger: 'TRIGGER',
    executionsColStart: 'START',
    executionsColEnd: 'END',
    executionsColDuration: 'DURATION',
    executionsColReceived: 'RECEIVED',
    executionsColValid: 'VALID',
    executionsColRejected: 'REJECTED',
    executionsColSnapshot: 'SNAPSHOT',
    executionsColStatus: 'STATUS',
    executionsStatusCompleted: 'Completed',
    executionsStatusFailed: 'Failed',
    executionsStatusRunning: 'Running',
    executionsStatusQueued: 'Queued',
    executionsStatusCancelled: 'Cancelled',
    executionsSnapshotPublished: 'Published',
    executionsSnapshotUnchangedReplay: 'Identical Replay',
    executionsSnapshotPreservedPrevious: 'Preserved Previous',
    executionsSnapshotNotPublished: 'Not published',
    executionsTriggerScheduled: 'Scheduled',
    executionsTriggerManual: 'Manual',
    executionsTriggerAutomatic: 'Automatic',
    executionsDetailTitle: 'Execution Details',
    executionsCloseDetail: 'Close details',
    executionsMetaGeneral: 'General Information',
    executionsMetaTechnical: 'Technical Metadata',
    executionsMetaExecutionId: 'Execution ID',
    executionsMetaCorrelationId: 'Correlation ID',
    executionsMetaGerpRequestId: 'GERP Request ID',
    executionsMetaReport: 'Report',
    executionsMetaSourceFile: 'Source File',
    executionsMetaSha256: 'SHA-256',
    executionsTimelineTitle: 'Robot 8-step Timeline',
    executionsTimelineDesc: 'Traceability for each phase executed by the automation',
    executionsFailureTitle: 'Failure Details',
    executionsPaginationPage: 'Page',
    executionsPaginationOf: 'of',
    executionsPaginationPerPage: 'PER PAGE:',
    executionsLoading: 'Loading execution history...',
    executionsEmptyTitle: 'No executions found',
    executionsEmptyDesc: 'No automation executions match the selected filters.',
    executionsErrorTitle: 'Unable to load executions',
    executionsRetry: 'Try again',
    executionsStepGerpRequest: 'GERP Request',
    executionsStepGerpReportGeneration: 'GERP Report Generation',
    executionsStepFileDownload: 'TSV File Download',
    executionsStepFileValidation: 'TSV File Validation',
    executionsStepDataNormalization: 'Data Normalization',
    executionsStepExchangeRate: 'Exchange Rate Fetch',
    executionsStepJsonValidation: 'Canonical JSON Validation',
    executionsStepSnapshotPublication: 'Snapshot Publication',
    executionsStepPending: 'Pending',
    executionsStepSkipped: 'Skipped',
    scrapBaseTitle: 'Scrap Base',
    scrapOccurrencesTitle: 'Scrap occurrences',
    scrapTotalLabel: 'TOTAL:',
    scrapFilterButton: 'Filter',
    scrapFilterTitle: 'Scrap filters',
    scrapClearFilters: 'Clear filters',
    scrapApplyFilters: 'Apply',
    scrapSearchLabel: 'Search',
    scrapSearchPlaceholder: 'Item, description, order or occurrence',
    scrapDateFrom: 'Start date',
    scrapDateTo: 'End date',
    scrapOrganizations: 'Organizations',
    scrapOrganizationsPlaceholder: 'E.g. NWK, NW1',
    scrapDateRangeError: 'End date cannot be before start date.',
    scrapSortBy: 'Sort by',
    scrapSortAriaLabel: 'Sort scrap base',
    scrapSortTransactionDate: 'Transaction date',
    scrapSortOrganization: 'Organization',
    scrapSortItemCode: 'Item code',
    scrapSortQuantity: 'Quantity',
    scrapSortAmountBrl: 'Amount (BRL)',
    scrapSortAmountUsd: 'Amount (USD)',
    scrapSortDescending: 'Descending',
    scrapSortAscending: 'Ascending',
    scrapLoading: 'Loading scrap occurrences',
    scrapErrorTitle: 'Unable to load scrap base',
    scrapRetry: 'Try again',
    scrapEmptyTitle: 'No occurrences found',
    scrapEmptyDesc: 'Adjust the filters or wait for a new execution to be published.',
    scrapSelectionEmptyTitle: 'No occurrences pending review',
    scrapSelectionEmptyDesc: 'All occurrences for this period have already been reviewed.',
    scrapColDate: 'DATE',
    scrapColOrganization: 'ORGANIZATION',
    scrapColItem: 'ITEM',
    scrapColDescription: 'DESCRIPTION',
    scrapColOrder: 'ORDER',
    scrapColQuantity: 'QUANTITY',
    scrapColAmountBrl: 'AMOUNT BRL',
    scrapColAmountUsd: 'AMOUNT USD',
    scrapColOccurrence: 'OCCURRENCE',
    scrapOccurrenceActive: 'Active',

    scrapReviewStatusAll: 'All',
    scrapReviewStatusUnreviewed: 'Unreviewed',
    scrapReviewStatusDraft: 'Draft',
    scrapReviewStatusReviewed: 'Reviewed',

    scrapColDefectType: 'SCRAP TYPE',
    scrapColReviewStatus: 'REVIEW STATUS',
    scrapColResponsible: 'RESPONSIBLE / DATE',
    scrapColAction: 'ACTION',

    scrapSelectMode: 'Select items',
    scrapCancelSelection: 'Cancel selection',
    scrapSelectedCount: 'selected',
    scrapClearSelection: 'Clear selection',
    scrapSelectAllPage: 'Select visible',
    scrapApplyReference: 'Apply reference report',
    scrapCreateReview: 'Create review',
    scrapActionOpen: 'Open review',
    scrapActionView: 'View report',
    scrapNoOccurrenceIdTooltip: 'Occurrence has no stable identifier for review',

    scrapFilterReviewStatus: 'Review status',
    scrapFilterDefectType: 'Scrap type',
    scrapFilterDefectTypeAll: 'All types',
    scrapFilterResponsible: 'Responsible',
    scrapFilterResponsibleAll: 'All users',
    scrapFilterResponsibleMine: 'My reports',

    scrapDrawerContext: 'Scrap review',
    scrapDrawerSummaryTitle: 'Occurrence summary',
    scrapDrawerFormTitle: 'Review form',
    scrapFieldDefectType: 'Scrap type',
    scrapFieldDefectTypePlaceholder: 'Select scrap type',
    scrapFieldResponsible: 'Responsible',
    scrapFieldTitle: 'Review title',
    scrapFieldTitlePlaceholder: 'Brief defect or cause summary',
    scrapFieldDescription: 'Description and root cause',
    scrapFieldDescriptionPlaceholder:
      'Describe the occurrence, identified causes and corrective actions...',
    scrapCharCount: 'characters',
    scrapNoDefectTypes: 'No active scrap types registered. Please contact an administrator.',

    scrapActionSaveDraft: 'Save draft',
    scrapActionSaving: 'Saving...',
    scrapActionFinalize: 'Finalize report',
    scrapActionFinalizing: 'Finalizing...',
    scrapActionPreview: 'Preview report',
    scrapActionEdit: 'Back to edit',
    scrapActionEditReview: 'Edit report',
    scrapActionCancelEdit: 'Cancel edit',
    scrapActionSaveEdit: 'Save changes',
    scrapActionUseReference: 'Use as reference',
    scrapDiscardChangesConfirm:
      'There are unsaved changes. Do you really want to close and discard your changes?',
    scrapFinalizeConfirmTitle: 'Finalize review',
    scrapFinalizeConfirmMessage:
      'The report will be finalized and will remain editable only by its author. Do you want to proceed?',
    scrapConflictError:
      'This report was modified in another session. Please reload the latest version before continuing.',
    scrapReloadReview: 'Reload report',
    scrapReadOnlyNotice: 'Report finalized on',
    scrapDraftNotice: 'Draft — not finalized',
    scrapPreviewNotice: 'Preview — not finalized',
    scrapCreatedFromReference: 'Created from another report',
    scrapReferenceSelectedBanner: 'Selected reference:',
    scrapTemplateSelectedBanner: 'Selected template:',
    scrapRemoveReference: 'Remove reference',
    scrapSelectReferenceMode:
      'Bulk mode active. Select occurrences in the table below and click Apply reference.',

    scrapTemplatesButton: 'Saved Templates',
    scrapTemplatesCount: 'Saved Templates',
    scrapTemplatesEmptyTitle: 'No saved templates yet',
    scrapTemplatesEmptyHint:
      'Finalize a review and click the heart ❤️ icon to save it as a reusable template.',
    scrapActionSaveAsTemplate: 'Save as favorite template',
    scrapActionRemoveTemplate: 'Remove template from favorites',
    scrapTemplateNameLabel: 'Template Name',
    scrapTemplateNamePlaceholder: 'E.g., SMT board oxidation',
    scrapTemplateCreatedSuccess: 'Template saved successfully!',
    scrapTemplateRemovedSuccess: 'Template removed from favorites.',
    scrapApplyTemplate: 'Apply Template',
    scrapUseThisTemplate: 'Use this template',
    scrapSaveAsTemplateCheckbox: 'Save this review as a favorite template (❤️) for the future',
    scrapTemplatesLibraryHint: 'Choose a template to apply or edit its fields in this list.',
    scrapTemplatesLoading: 'Loading templates...',
    scrapTemplateFieldName: 'Template name',
    scrapTemplateSelectType: 'Select scrap type',
    scrapTemplateTypeRequired: 'Select the scrap type.',
    scrapTemplateSaveChanges: 'Save changes',
    scrapTemplateEdit: 'Edit template',
    scrapTemplateDelete: 'Delete',
    scrapTemplateDeleteConfirm: 'Delete this template?',
    scrapTemplateNoType: 'No type',
    scrapTemplateUpdated: 'Updated',
    scrapTemplateUpdatedSuccess: 'Template updated.',
    scrapTemplateUpdateError: 'Could not update the template. Try again.',
    scrapTemplateDeleteError: 'Could not delete the template. Try again.',
    scrapTemplateValidationName: 'Enter a name for the template.',
    scrapTemplateValidationTitle: 'Enter the report title.',
    scrapTemplateValidationDescription: 'Enter the report description.',
    scrapTemplateValidationMaxLength: 'The text exceeds the allowed limit.',
    scrapTemplateConfirmConnector: 'to',
    scrapTemplateSkipNotice:
      'Inactive occurrences or occurrences with an existing report will be skipped.',
    scrapSaveStatusSaving: 'Saving changes...',
    scrapSaveStatusUnsaved: 'Unsaved changes',
    scrapSaveStatusSaved: 'Saved at',

    scrapAttachmentsTitle: 'Evidence and photos',
    scrapAttachmentsHint:
      'Drag images or click to select. Accepts JPEG, PNG, and WebP (max 10MB per photo, limit of 8 photos).',
    scrapAttachmentUploadError: 'Failed to upload image',
    scrapAttachmentTypeError: 'Unsupported format. Use only JPEG, PNG, or WebP.',
    scrapAttachmentSizeError: 'Image exceeds the maximum 10 MB limit.',
    scrapAttachmentMaxError: 'Limit of 8 images reached for this review.',
    scrapAttachmentDeleteConfirm: 'Do you want to delete this photo from the review?',
    scrapAttachmentRetry: 'Retry',
    scrapAttachmentRemove: 'Remove photo',
    scrapAttachmentView: 'View photo',

    scrapBulkTitle: 'Bulk create reports',
    scrapBulkItemsSelected: 'occurrence(s) selected for application.',
    scrapBulkSelectReference: 'Select a finalized report as reference:',
    scrapBulkSearchPlaceholder: 'Search by item, title, or description...',
    scrapBulkCopyAttachments: 'Copy images from reference',
    scrapBulkCopyAttachmentsWarning:
      'Warning: Copying photos replicates the same visual evidence to all selected items.',
    scrapBulkApplyButton: 'Create reports',
    scrapBulkApplying: 'Processing bulk...',
    scrapBulkSuccessSummary: 'Reports created successfully:',
    scrapBulkSkippedSummary: 'Items skipped:',
    scrapBulkReasonNotActive: 'Item inactive during period',
    scrapBulkReasonAlreadyReviewed: 'Item already reviewed',

    scrapQueueTitle: 'Report Queue',
    scrapQueueProgress: 'Item {current} of {total}',
    scrapQueuePrevious: 'Previous',
    scrapQueueNext: 'Next',
    scrapQueueSkip: 'Skip',
    scrapQueueFinalizeAndNext: 'Finalize and go to next',
    scrapQueueFinalizeAndFinish: 'Finalize and finish queue',
    scrapQueueSaveDraftAndNext: 'Save draft and advance',
    scrapStartQueue: 'Start report queue',
    scrapCreateSingleReport: 'Create report',
    scrapItemsSelected: 'item(s) selected',
    scrapTemplateChecklistTitle: 'Apply Template in Bulk',
    scrapTemplateChecklistHint: 'Check the pending occurrences that should receive this template:',
    scrapTemplateChecklistApply: 'Apply template to selected items',
    scrapTemplateChecklistSelectAll: 'Select all pending',

    reportsTitle: 'Scrap Reports',
    reportsSubtitle: 'Catalog of reviewed occurrences and finalized root cause analyses.',
    reportsEmptyTitle: 'No finalized reports found',
    reportsEmptyDesc: 'When scrap occurrences are finalized, their reports will appear here.',
    reportsSearchPlaceholder: 'Search reports by item, code or description...',
  },
  ko: {
    navDashboard: '대시보드',
    navExecutions: '실행 내역',
    navScrapBase: '스크랩 데이터',
    navReports: '보고서',
    navSettings: '설정',
    navProfile: '프로필',
    helpSupport: '도움말 및 지원',
    mainNavigationLabel: '기본 탐색',
    breadcrumbNavigationLabel: '현재 위치 탐색',
    closeSidebar: '사이드바 닫기',
    openSidebar: '사이드바 열기',
    collapseSidebar: '사이드바 접기',
    expandSidebar: '사이드바 펼치기',
    profileMenuLabel: '프로필 메뉴',
    openProfileMenu: '프로필 메뉴 열기',
    administratorRole: '관리자',
    userRole: '사용자',
    signOut: '로그아웃',
    loginButton: '로그인',
    loginHint: '계정에 접속',
    settingsTitle: '설정',
    settingsTabPreferences: '환경설정',
    settingsTabSystem: '시스템',
    settingsTabTargets: 'IF Cost 목표',
    targetYearPlanTitle: '연간 목표 계획 (IF Cost)',
    targetYearPlanSubtitle:
      '대시보드의 성과 지표와 추세 그래프를 안내하기 위해 월별 스크랩 비용 목표를 설정합니다.',
    targetSelectYear: '기준 연도',
    targetAnnualTotal: '연간 총 계획',
    targetMonthlyAverage: '월평균',
    targetComparisonPreviousYear: '전년 대비 비교',
    targetNoPreviousYear: '전년도 등록된 목표 없음',
    targetReductionVsPrevious: '감소 대비',
    targetIncreaseVsPrevious: '증가 대비',
    prefillAssistantTitle: '사전 입력 도우미',
    prefillAssistantDesc:
      '균등한 목표를 분배하거나 1월부터 12월까지 감소하는 곡선을 그려 계획을 가속화합니다.',
    prefillModeLinear: '균등 분배',
    prefillModeCurve: '점진적 곡선 (1월 → 12월)',
    prefillAnnualTotalLabel: '연간 총 목표 (USD)',
    prefillJanValueLabel: '초기 목표 (1월)',
    prefillDecValueLabel: '최종 목표 (12월)',
    prefillApplyBtn: '사전 입력 적용',
    targetMonthCol: '월',
    targetValueCol: 'IF Cost 목표 (USD)',
    targetShareCol: '연간 점유율',
    targetCurveTrajectory: '연간 목표 궤적',
    targetSavePlanBtn: '연간 계획 저장',
    targetSavingPlan: '계획 저장 중...',
    targetClearPlanBtn: '연간 목표 삭제',
    targetPlanSavedSuccess: '연간 목표 계획이 성공적으로 저장되었습니다!',
    targetPlanClearedSuccess: '연간 목표가 삭제되었습니다.',
    targetPlanSaveError: '목표 계획 저장 중 오류가 발생했습니다. 다시 시도해 주세요.',
    targetLoginRequiredNotice:
      '인증된 사용자만 IF Cost 목표를 등록하거나 편집할 수 있습니다. 현재 읽기 전용 모드로 보고 있습니다.',
    targetLoginAction: '로그인',
    scrapDefectTypesTitle: '스크랩 불량 유형',
    scrapDefectTypesSubtitle: '팀 스크랩 분류 및 분석을 위한 공유 시스템 카테고리입니다.',
    scrapDefectTypeNameLabel: '카테고리 이름',
    scrapDefectTypeNamePlaceholder: '예: 산화, 운송 파손, 크랙...',
    scrapDefectTypeCodeLabel: '식별 코드',
    scrapDefectTypeCodePlaceholder: '예: OXIDATION, TRANSPORT_DAMAGE',
    scrapDefectTypeDescLabel: '설명 (선택사항)',
    scrapDefectTypeDescPlaceholder: '이 스크랩 유형의 기준과 특성을 설명하세요...',
    scrapDefectTypeAddButton: '스크랩 유형 등록',
    scrapDefectTypeStatusActive: '활성',
    scrapDefectTypeStatusInactive: '비활성',
    scrapDefectTypeEmptyState:
      '등록된 스크랩 불량 유형이 없습니다. 위 양식을 작성하여 팀을 위한 첫 번째 유형을 등록하세요.',
    scrapDefectTypeSuccessCreate: '스크랩 불량 유형이 성공적으로 등록되었습니다!',
    scrapDefectTypeSuccessUpdate: '스크랩 불량 유형이 성공적으로 업데이트되었습니다!',
    scrapDefectTypeErrorCreate:
      '스크랩 불량 유형 등록 중 오류가 발생했습니다. 코드가 이미 존재하는지 확인하세요.',
    scrapDefectTypeErrorUpdate: '스크랩 불량 유형 업데이트 중 오류가 발생했습니다.',
    scrapDefectTypeEditAction: '수정',
    scrapDefectTypeDeleteAction: '삭제',
    scrapDefectTypeDeleteConfirmTitle: '스크랩 유형 삭제',
    scrapDefectTypeDeleteConfirmMessage: '스크랩 유형을 삭제하시겠습니까:',
    scrapDefectTypeSuccessDelete: '스크랩 유형이 성공적으로 삭제되었습니다.',
    scrapDefectTypeErrorDelete: '스크랩 유형 삭제 중 오류가 발생했습니다.',
    scrapDefectTypeCancelAction: '취소',
    scrapDefectTypeSaveAction: '변경사항 저장',
    scrapDefectTypeCountSummary: '등록된 유형',
    scrapDefectTypeActiveCountSummary: '활성',
    themeTitle: '인터페이스 테마',
    themeSubtitle: '대시보드 표시 방식을 선택하세요.',
    themeGroupLabel: '테마 선택',
    themeLight: '라이트',
    themeLightDesc: '밝은 환경에 적합한 깔끔한 화면',
    themeDark: '다크',
    themeDarkDesc: '어두운 환경에서 눈이 편안한 화면',
    darkToggle: '다크 테마',
    darkToggleDesc: '라이트와 다크 화면을 직접 전환합니다.',
    darkToggleAria: '다크 테마 사용',
    systemToggle: '시스템 설정 사용',
    systemToggleDesc: '운영체제 테마를 자동으로 따릅니다.',
    systemToggleAria: '운영체제 테마 사용',
    languageTitle: '시스템 언어',
    languageSubtitle: '인터페이스에서 사용할 언어를 선택하세요.',
    languageGroupLabel: '언어 선택',
    portugueseLanguage: '포르투갈어',
    englishLanguage: '영어',
    koreanLanguage: '한국어',
    profileTitle: '프로필 설정',
    profileEdit: '프로필 편집',
    profilePhotoTitle: '프로필 사진',
    profilePhotoDescription: '5MB 이하의 JPEG, PNG 또는 WebP 이미지를 사용하세요.',
    profilePhotoAlt: '프로필 사진',
    profilePhotoAdd: '사진 추가',
    profilePhotoChange: '사진 변경',
    profilePhotoRemove: '사진 삭제',
    profilePhotoUploading: '업로드 중…',
    profilePhotoRemoving: '삭제 중…',
    profilePhotoUploadSuccess: '사진이 업데이트되었습니다.',
    profilePhotoRemoveSuccess: '사진이 삭제되었습니다.',
    profilePhotoTypeError: 'JPEG, PNG 또는 WebP 이미지를 선택하세요.',
    profilePhotoSizeError: '이미지는 5MB 이하여야 합니다.',
    profilePhotoUploadError: '사진을 업데이트할 수 없습니다. 다시 시도하세요.',
    profilePhotoRemoveError: '사진을 삭제할 수 없습니다. 다시 시도하세요.',
    profilePersonalTitle: '개인 정보',
    profilePersonalDescription: '시스템에서 본인을 식별하는 데 사용되는 정보입니다.',
    profileContactTitle: '연락처 및 업무',
    profileContactDescription: '연락 수단과 현장 업무 역할을 설정하세요.',
    profileNameLabel: '이름',
    profileUsernameLabel: '사용자 이름',
    profileUsernameHint: '사용자 이름은 로그인에 사용되며 여기에서 변경할 수 없습니다.',
    profileEmailLabel: '계정 이메일',
    profileNotificationEmailLabel: '알림 이메일',
    profileNotificationEmailHint: '비워 두면 계정 이메일로 알림이 전송됩니다.',
    profilePhoneLabel: '전화번호',
    profilePhonePlaceholder: '010-0000-0000',
    profileJobTitleLabel: '직책',
    profileJobTitlePlaceholder: '예: 생산 작업자',
    profileRequiredError: '필수 입력 항목입니다.',
    profileEmailError: '올바른 이메일 주소를 입력하세요.',
    profileLoadError: '프로필 정보를 불러올 수 없습니다.',
    profileSaveError: '변경 사항을 저장할 수 없습니다. 다시 시도하세요.',
    profileEmailConflict: '다른 계정에서 이미 사용 중인 이메일입니다.',
    profileSaveSuccess: '프로필이 업데이트되었습니다.',
    profileSave: '변경 사항 저장',
    profileSaving: '저장 중…',
    logoutTitle: '로그아웃 확인',
    logoutDescription: '계정에서 로그아웃하시겠습니까?',
    back: '뒤로',
    close: '닫기',
    cancel: '취소',
    confirmSignOut: '로그아웃',

    executionsTitle: '실행 및 동기화',
    executionsDateFrom: '시작일',
    executionsDateTo: '종료일',
    executionsStatus: '상태',
    executionsAllStatus: '전체 상태',
    executionsSearchId: '실행 ID 검색',
    executionsSearchPlaceholder: '예: 550e8400...',
    executionsSearchLabel: 'ID 또는 프로세스 검색',
    executionsFilterBtn: '필터',
    executionsFilterPopoverTitle: '작업 필터',
    executionsActiveFilters: '적용된 필터',
    executionsClearAll: '모두 초기화',
    executionsApplyFilters: '적용',
    executionsClearFilters: '필터 초기화',
    executionsDateRangeError: '종료일은 시작일보다 이전일 수 없습니다.',
    calendarToday: '오늘',
    calendarClear: '초기화',
    executionsHistoryTitle: '작업 이력',
    executionsTotalLabel: '총:',
    executionsColProcess: '실행 ID / 프로세스',
    executionsColOrigin: '출처',
    executionsColTrigger: '트리거',
    executionsColStart: '시작',
    executionsColEnd: '종료',
    executionsColDuration: '소요 시간',
    executionsColReceived: '수신',
    executionsColValid: '유효',
    executionsColRejected: '반려',
    executionsColSnapshot: '스냅샷',
    executionsColStatus: '상태',
    executionsStatusCompleted: '완료됨',
    executionsStatusFailed: '실패',
    executionsStatusRunning: '진행 중',
    executionsStatusQueued: '대기 중',
    executionsStatusCancelled: '취소됨',
    executionsSnapshotPublished: '게시됨',
    executionsSnapshotUnchangedReplay: '동일 재현',
    executionsSnapshotPreservedPrevious: '이전 유지',
    executionsSnapshotNotPublished: '미게시',
    executionsTriggerScheduled: '예약됨',
    executionsTriggerManual: '수동',
    executionsTriggerAutomatic: '자동',
    executionsDetailTitle: '실행 세부 정보',
    executionsCloseDetail: '세부 정보 닫기',
    executionsMetaGeneral: '일반 정보',
    executionsMetaTechnical: '기술 메타데이터',
    executionsMetaExecutionId: '실행 ID',
    executionsMetaCorrelationId: '상관 ID',
    executionsMetaGerpRequestId: 'GERP 요청 ID',
    executionsMetaReport: '보고서',
    executionsMetaSourceFile: '원본 파일',
    executionsMetaSha256: 'SHA-256',
    executionsTimelineTitle: '로봇 8단계 타임라인',
    executionsTimelineDesc: '자동화에서 실행된 각 단계별 추적 정보',
    executionsFailureTitle: '실패 세부 정보',
    executionsPaginationPage: '페이지',
    executionsPaginationOf: '/',
    executionsPaginationPerPage: '페이지당:',
    executionsLoading: '실행 이력을 불러오는 중…',
    executionsEmptyTitle: '실행 내역이 없습니다',
    executionsEmptyDesc: '선택한 필터와 일치하는 자동화 실행 내역이 없습니다.',
    executionsErrorTitle: '실행 내역을 불러올 수 없습니다',
    executionsRetry: '다시 시도',
    executionsStepGerpRequest: 'GERP 요청',
    executionsStepGerpReportGeneration: 'GERP 보고서 생성',
    executionsStepFileDownload: 'TSV 파일 다운로드',
    executionsStepFileValidation: 'TSV 파일 검증',
    executionsStepDataNormalization: '데이터 정규화',
    executionsStepExchangeRate: '환율 조회',
    executionsStepJsonValidation: '표준 JSON 검증',
    executionsStepSnapshotPublication: '스냅샷 게시',
    executionsStepPending: '대기 중',
    executionsStepSkipped: '건너뜀',
    scrapBaseTitle: '스크랩 데이터',
    scrapOccurrencesTitle: '스크랩 발생 내역',
    scrapTotalLabel: '총:',
    scrapFilterButton: '필터',
    scrapFilterTitle: '스크랩 필터',
    scrapClearFilters: '필터 지우기',
    scrapApplyFilters: '적용',
    scrapSearchLabel: '검색',
    scrapSearchPlaceholder: '품목, 설명, 작업 지시 또는 발생 내역',
    scrapDateFrom: '시작일',
    scrapDateTo: '종료일',
    scrapOrganizations: '조직',
    scrapOrganizationsPlaceholder: '예: NWK, NW1',
    scrapDateRangeError: '종료일은 시작일보다 이전일 수 없습니다.',
    scrapSortBy: '정렬 기준',
    scrapSortAriaLabel: '스크랩 데이터 정렬',
    scrapSortTransactionDate: '거래일',
    scrapSortOrganization: '조직',
    scrapSortItemCode: '품목 코드',
    scrapSortQuantity: '수량',
    scrapSortAmountBrl: '금액 (BRL)',
    scrapSortAmountUsd: '금액 (USD)',
    scrapSortDescending: '내림차순',
    scrapSortAscending: '오름차순',
    scrapLoading: '스크랩 발생 내역을 불러오는 중',
    scrapErrorTitle: '스크랩 데이터를 불러올 수 없습니다',
    scrapRetry: '다시 시도',
    scrapEmptyTitle: '발생 내역이 없습니다',
    scrapEmptyDesc: '필터를 조정하거나 새 실행이 게시될 때까지 기다리세요.',
    scrapSelectionEmptyTitle: '검토 대기 중인 발생 건이 없습니다',
    scrapSelectionEmptyDesc: '이 기간의 모든 발생 건이 이미 검토되었습니다.',
    scrapColDate: '날짜',
    scrapColOrganization: '조직',
    scrapColItem: '품목',
    scrapColDescription: '설명',
    scrapColOrder: '작업 지시',
    scrapColQuantity: '수량',
    scrapColAmountBrl: '금액 BRL',
    scrapColAmountUsd: '금액 USD',
    scrapColOccurrence: '발생',
    scrapOccurrenceActive: '활성',

    scrapReviewStatusAll: '전체',
    scrapReviewStatusUnreviewed: '미검토',
    scrapReviewStatusDraft: '초안',
    scrapReviewStatusReviewed: '검토 완료',

    scrapColDefectType: '스크랩 유형',
    scrapColReviewStatus: '검토 상태',
    scrapColResponsible: '담당자 / 일자',
    scrapColAction: '작업',

    scrapSelectMode: '항목 선택',
    scrapCancelSelection: '선택 취소',
    scrapSelectedCount: '선택됨',
    scrapClearSelection: '선택 해제',
    scrapSelectAllPage: '현재 페이지 전체 선택',
    scrapApplyReference: '기준 보고서 일괄 적용',
    scrapCreateReview: '검토 작성',
    scrapActionOpen: '검토 열기',
    scrapActionView: '보고서 보기',
    scrapNoOccurrenceIdTooltip: '검토용 식별자가 없는 항목입니다',

    scrapFilterReviewStatus: '검토 상태',
    scrapFilterDefectType: '스크랩 유형',
    scrapFilterDefectTypeAll: '모든 유형',
    scrapFilterResponsible: '담당자',
    scrapFilterResponsibleAll: '모든 사용자',
    scrapFilterResponsibleMine: '내 보고서',

    scrapDrawerContext: '스크랩 분석',
    scrapDrawerSummaryTitle: '발생 요약',
    scrapDrawerFormTitle: '분석 양식',
    scrapFieldDefectType: '스크랩 유형',
    scrapFieldDefectTypePlaceholder: '스크랩 유형을 선택하세요',
    scrapFieldResponsible: '담당자',
    scrapFieldTitle: '분석 제목',
    scrapFieldTitlePlaceholder: '불량 요약 제목',
    scrapFieldDescription: '원인 및 설명',
    scrapFieldDescriptionPlaceholder: '발생 경위, 확인된 원인 및 조치 사항을 작성하세요...',
    scrapCharCount: '자',
    scrapNoDefectTypes: '등록된 스크랩 유형이 없습니다. 관리자에게 문의하세요.',

    scrapActionSaveDraft: '초안 저장',
    scrapActionSaving: '저장 중...',
    scrapActionFinalize: '보고서 완료',
    scrapActionFinalizing: '완료 처리 중...',
    scrapActionPreview: '보고서 미리보기',
    scrapActionEdit: '편집으로 돌아가기',
    scrapActionEditReview: '보고서 수정',
    scrapActionCancelEdit: '수정 취소',
    scrapActionSaveEdit: '변경사항 저장',
    scrapActionUseReference: '기준 보고서로 사용',
    scrapDiscardChangesConfirm: '저장되지 않은 변경사항이 있습니다. 닫으시겠습니까?',
    scrapFinalizeConfirmTitle: '분석 완료 확정',
    scrapFinalizeConfirmMessage:
      '보고서가 완료되며 작성자만 계속 수정할 수 있습니다. 계속하시겠습니까?',
    scrapConflictError: '다른 세션에서 보고서가 수정되었습니다. 최신 버전을 다시 불러오세요.',
    scrapReloadReview: '보고서 다시 불러오기',
    scrapReadOnlyNotice: '보고서 완료 일시:',
    scrapDraftNotice: '초안 — 미완료',
    scrapPreviewNotice: '미리보기 — 아직 완료되지 않음',
    scrapCreatedFromReference: '다른 보고서를 기반으로 생성됨',
    scrapReferenceSelectedBanner: '선택된 기준 보고서:',
    scrapTemplateSelectedBanner: '선택된 템플릿:',
    scrapRemoveReference: '기준 해제',
    scrapSelectReferenceMode: '일괄 적용 모드 활성화됨. 아래 목록에서 대상을 선택 후 적용하세요.',

    scrapTemplatesButton: '저장된 템플릿',
    scrapTemplatesCount: '저장된 템플릿',
    scrapTemplatesEmptyTitle: '아직 저장된 템플릿이 없습니다',
    scrapTemplatesEmptyHint:
      '분석을 완료하고 하트 ❤️ 아이콘을 눌러 재사용 가능한 템플릿으로 저장하세요.',
    scrapActionSaveAsTemplate: '즐겨찾기 템플릿으로 저장',
    scrapActionRemoveTemplate: '즐겨찾기에서 템플릿 제거',
    scrapTemplateNameLabel: '템플릿 이름',
    scrapTemplateNamePlaceholder: '예: SMT 기판 산화 결함',
    scrapTemplateCreatedSuccess: '템플릿이 성공적으로 저장되었습니다!',
    scrapTemplateRemovedSuccess: '즐겨찾기에서 템플릿이 삭제되었습니다.',
    scrapApplyTemplate: '템플릿 적용',
    scrapUseThisTemplate: '이 템플릿 사용',
    scrapSaveAsTemplateCheckbox: '이 분석을 향후 사용을 위해 즐겨찾기 템플릿(❤️)으로 저장',
    scrapTemplatesLibraryHint: '적용할 템플릿을 선택하거나 이 목록에서 내용을 수정하세요.',
    scrapTemplatesLoading: '템플릿을 불러오는 중...',
    scrapTemplateFieldName: '템플릿 이름',
    scrapTemplateSelectType: '스크랩 유형 선택',
    scrapTemplateTypeRequired: '스크랩 유형을 선택하세요.',
    scrapTemplateSaveChanges: '변경사항 저장',
    scrapTemplateEdit: '템플릿 편집',
    scrapTemplateDelete: '삭제',
    scrapTemplateDeleteConfirm: '이 템플릿을 삭제하시겠습니까?',
    scrapTemplateNoType: '유형 없음',
    scrapTemplateUpdated: '업데이트',
    scrapTemplateUpdatedSuccess: '템플릿이 업데이트되었습니다.',
    scrapTemplateUpdateError: '템플릿을 업데이트할 수 없습니다. 다시 시도하세요.',
    scrapTemplateDeleteError: '템플릿을 삭제할 수 없습니다. 다시 시도하세요.',
    scrapTemplateValidationName: '템플릿 이름을 입력하세요.',
    scrapTemplateValidationTitle: '보고서 제목을 입력하세요.',
    scrapTemplateValidationDescription: '보고서 설명을 입력하세요.',
    scrapTemplateValidationMaxLength: '텍스트가 허용된 길이를 초과합니다.',
    scrapTemplateConfirmConnector: '적용 대상',
    scrapTemplateSkipNotice: '비활성 항목 또는 이미 보고서가 있는 항목은 제외됩니다.',
    scrapSaveStatusSaving: '변경사항 저장 중...',
    scrapSaveStatusUnsaved: '저장되지 않은 변경사항',
    scrapSaveStatusSaved: '저장 시간',

    scrapAttachmentsTitle: '증빙 사진 및 첨부파일',
    scrapAttachmentsHint:
      '이미지를 끌어다 놓거나 클릭하여 선택하세요. JPEG, PNG, WebP 지원 (장당 최대 10MB, 최대 8장).',
    scrapAttachmentUploadError: '이미지 업로드 실패',
    scrapAttachmentTypeError: '지원되지 않는 형식입니다. JPEG, PNG, WebP만 가능합니다.',
    scrapAttachmentSizeError: '이미지 용량이 10MB를 초과합니다.',
    scrapAttachmentMaxError: '최대 8장까지 등록할 수 있습니다.',
    scrapAttachmentDeleteConfirm: '이 사진을 삭제하시겠습니까?',
    scrapAttachmentRetry: '다시 시도',
    scrapAttachmentRemove: '사진 삭제',
    scrapAttachmentView: '사진 확대',

    scrapBulkTitle: '보고서 일괄 생성',
    scrapBulkItemsSelected: '건의 발생 항목이 선택되었습니다.',
    scrapBulkSelectReference: '기준으로 사용할 완료된 보고서를 선택하세요:',
    scrapBulkSearchPlaceholder: '품번, 제목 또는 설명으로 검색...',
    scrapBulkCopyAttachments: '기준 보고서의 이미지도 복사',
    scrapBulkCopyAttachmentsWarning:
      '주의: 사진을 복사하면 모든 선택 항목에 동일한 사진이 복제됩니다.',
    scrapBulkApplyButton: '보고서 생성',
    scrapBulkApplying: '일괄 처리 중...',
    scrapBulkSuccessSummary: '생성 성공:',
    scrapBulkSkippedSummary: '제외된 항목:',
    scrapBulkReasonNotActive: '비활성 상태 항목',
    scrapBulkReasonAlreadyReviewed: '이미 분석 완료된 항목',

    scrapQueueTitle: '보고서 대기열',
    scrapQueueProgress: '항목 {current} / {total}',
    scrapQueuePrevious: '이전',
    scrapQueueNext: '다음',
    scrapQueueSkip: '건너뛰기',
    scrapQueueFinalizeAndNext: '완료하고 다음으로 이동',
    scrapQueueFinalizeAndFinish: '완료하고 대기열 종료',
    scrapQueueSaveDraftAndNext: '임시저장 후 다음으로 이동',
    scrapStartQueue: '보고서 대기열 시작',
    scrapCreateSingleReport: '보고서 작성',
    scrapItemsSelected: '개 항목 선택됨',
    scrapTemplateChecklistTitle: '템플릿 일괄 적용',
    scrapTemplateChecklistHint: '이 템플릿을 적용할 미완료 발생 항목을 체크하세요:',
    scrapTemplateChecklistApply: '선택한 항목에 템플릿 적용',
    scrapTemplateChecklistSelectAll: '미완료 항목 전체 선택',

    reportsTitle: '스크랩 보고서',
    reportsSubtitle: '완료된 스크랩 불량 분석 및 원인 보고서 목록입니다.',
    reportsEmptyTitle: '완료된 보고서가 없습니다',
    reportsEmptyDesc: '스크랩 분석이 완료되면 이곳에 보고서가 등록됩니다.',
    reportsSearchPlaceholder: '품번, 코드 또는 설명으로 보고서 검색...',
  },
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storageKey = 'hanaro-language-preference';

  readonly currentLanguage = signal<LanguageCode>(this.readInitialLanguage());
  readonly isKorean = computed(() => this.currentLanguage() === 'ko');
  readonly translations = computed<AppTranslations>(() => TRANSLATIONS[this.currentLanguage()]);
  readonly availableLanguages = computed<readonly LanguageOption[]>(() => {
    const t = this.translations();
    return [
      { code: 'pt', label: t.portugueseLanguage, nativeName: 'Português (BR)' },
      { code: 'en', label: t.englishLanguage, nativeName: 'English' },
      { code: 'ko', label: t.koreanLanguage, nativeName: '한국어' },
    ];
  });

  constructor() {
    effect(() => {
      const language = this.currentLanguage();

      if (this.isBrowser) {
        this.document.documentElement.setAttribute('lang', language === 'pt' ? 'pt-BR' : language);

        try {
          localStorage.setItem(this.storageKey, language);
        } catch {
          // The language remains active for this session when storage is unavailable.
        }
      }
    });
  }

  setLanguage(code: LanguageCode): void {
    if (this.isValidLanguage(code)) this.currentLanguage.set(code);
  }

  private readInitialLanguage(): LanguageCode {
    if (!this.isBrowser) return 'pt';

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (this.isValidLanguage(stored)) return stored;
    } catch {
      // Fall back to the document or browser locale when storage is unavailable.
    }

    const documentLang = this.document.documentElement.getAttribute('lang')?.toLowerCase();
    if (documentLang?.startsWith('ko')) return 'ko';
    if (documentLang?.startsWith('en')) return 'en';
    if (documentLang?.startsWith('pt')) return 'pt';

    const browserLang = navigator.language?.toLowerCase().slice(0, 2);
    if (browserLang === 'ko') return 'ko';
    if (browserLang === 'en') return 'en';
    return 'pt';
  }

  private isValidLanguage(value: string | null | undefined): value is LanguageCode {
    return value === 'pt' || value === 'en' || value === 'ko';
  }
}
