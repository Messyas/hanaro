# Documento V2, snapshot e exportação

[Índice](README.md) · [Backend](05-backend-servicos-e-metodos.md).

## Contrato do documento

`ReportDocumentV2` é a representação semântica comum à prévia, publicação e renderização. Não contém HTML arbitrário, opções ECharts ou objetos de biblioteca PowerPoint.

| Campo | Conteúdo |
| --- | --- |
| schema_version | 2 |
| identity | report_id, code, title, revision, author e publicação |
| scope | tipo, fábrica, filtros, período solicitado, comparação e corte efetivo |
| methodology | versões de métrica, moeda/câmbio, elegibilidade, arredondamento e atribuição |
| coverage | cobertura financeira, produção quando usada e classificação/revisão |
| datasets | KPIs, séries, paretos, ações, casos e medições tipados |
| sections | blocos ordenados com ID/kind, título, referência ao dataset e texto editorial |
| evidence | IDs de cópia preservada, legenda, papel, dimensão e hash |
| provenance | manifesto e vínculos de fonte, com revisões fixas |

`ReportVersion.content` guarda esse documento, com duplicação pequena de metadados necessária à leitura. Linhas financeiras completas ficam nas tabelas de snapshot; document.datasets guarda agregados derivados da mesma captura. Não recalcular agregado de uma edição usando registros correntes.

O hash canônico cobre documento, fontes, observações e metadados relevantes das evidências; exclui URLs temporárias e identidade do job. Definir ordenação de listas e serialização Decimal/datetime uma vez, reaproveitando `canonical_json` e versionando o algoritmo se necessário.

## Blocos

| Kind | Payload validado | Saída esperada |
| --- | --- | --- |
| CONTEXT | objetivo, escopo e responsáveis | Abertura e contexto |
| EXECUTIVE_SUMMARY | mensagem, destaques e ressalvas | Síntese revisada pelo autor |
| KPI | referências a métricas/unidades/status | Resultado, comparação e meta compatível |
| TREND | série, meta, referência e cobertura | Gráfico + tabela de apoio |
| PARETO | dimensão, ranking, demais e não classificados | Barras, acumulado e conclusão |
| ACTIONS | ações congeladas, prazos e responsáveis | Tabela/cronograma paginado |
| CASE | problema, causa, ação, evidências e estado do resultado | Ficha de melhoria; divide em slides se necessário |
| EVIDENCE | referências de imagens e legendas | Fotos de contexto/antes/depois |
| CONCLUSIONS | conclusões, próximos passos, decisões solicitadas | Encerramento gerencial |
| APPENDIX | detalhe e procedência | Auditoria dos dados apresentados |
| CAUSES / EFFECTIVENESS / CHARTER / RISKS | Contratos dos incrementos B–D | Conteúdo opcional quando suportado |

Validador rejeita kinds desconhecidos para aquele schema. Um relatório V2 pode omitir etapas ainda não disponíveis; capabilities informam quais kinds/templates o sistema suporta.

## Captura das fontes

Financeiro CURRENT e PREVIOUS são universos separados. Detalhes selecionados não limitam essas consultas. Documento armazena metas utilizadas e seus períodos, sem buscar a meta “mais recente” ao exportar.

Ações congelam título, descrição, estado, responsável, participantes, datas, bloqueio e versão. Caso congela análise publicada escolhida, vínculos, atribuição financeira e evidências. Resultados congelam medidas, unidades, janelas e fórmula, incluindo fontes/denominadores. Legendas são conteúdo da edição, não consulta dinâmica ao anexo.

Escopo e cobertura devem indicar seleção manual versus fechamento completo/provisório. CSV de detalhes e totais de fechamento podem ter universos diferentes: o contrato de exportação informa qual dataset foi solicitado. Não exigir que soma dos casos destacados seja igual ao custo total; exigir que o universo financeiro reconcilie e que a cobertura dos destaques seja identificada.

## Compatibilidade V1/V2

`Document` atual continua atendendo edições schema 1. Nova façade seleciona `LegacyDocumentAdapter` ou `ReportDocumentV2` conforme schema salvo, nunca conforme estado atual da aplicação apenas.

Template `1` continua disponível para V1; template `2` atende V2. Validar combinações em schemas, publish e request_export, hoje restritos a `1`. Renderizador não tenta enriquecer V1 consultando bases atuais. Reemissão da mesma edição preserva conteúdo; bytes podem depender do renderer, cuja versão fica registrada. Artefato já armazenado é retornado intacto.

Identidade V2 da exportação: versão publicada + hash do conteúdo + formato + template + renderer + opções canônicas. Não alterar chaves de jobs V1 já existentes. Opções de notificação não devem alterar o conteúdo binário; documentar separação entre preferência de entrega e identidade do artefato ao evoluir o fluxo.

## Implementação dos renderizadores

Arquivos propostos: `exports/document_v2.py`, `exports/renderers/pptx_v2.py`, `pdf_v2.py`. Métodos de responsabilidade: `render_context`, `render_kpis`, `render_trend`, `render_pareto`, `render_actions`, `render_case`, `render_evidence`, `render_appendix`. Cada método recebe bloco/dataset resolvido, sem acesso ao banco corrente.

O código atual usa bibliotecas Python de PPTX/PDF; primeiro realizar prova com gráficos editáveis, tabelas e fotos. Troca de biblioteca não é requisito do plano. A seleção da ferramenta de produção deve considerar fontes PT/EN/KO, tabelas longas, memória e implantação do worker.

PPTX deve usar texto editável, gráficos/tabelas nativos quando suportados, imagens incorporadas e notas com fonte/corte. PDF usa as mesmas afirmações e valores, com paginação própria. Não exportar screenshot de página Angular como documento completo.

Para imagens, `ReportEvidenceResolver` lê cópias privadas por ID validado, verifica hash e entrega bytes ao renderer. Não buscar URLs arbitrárias da narrativa. Preservar proporção, resolver orientação e gerar legendas com papel/contexto. “Incluir evidências” significa mostrar imagens, e não apenas nomes/hashes.

## Layout de conteúdo

Perfil EXECUTIVE prioriza resumo, evolução, Pareto, ações e poucos casos; COMPLETE inclui detalhes adicionais. Ambos mantêm mesmo universo e resultados. Paginar blocos longos e casos extensos automaticamente; nunca truncar silenciosamente.

Desabilitar valores monetários exige remover também eixos, rótulos, tabelas e notas monetárias estruturadas. Textos livres podem conter números: mostrar alerta de revisão editorial ou exigir revisão desse texto para perfil sem valores; não prometer que ocultar métricas elimina toda menção financeira escrita pelo autor.

Idioma altera rótulos e formatação. Não traduzir automaticamente a análise autoral como se fosse o texto aprovado; preservar idioma original ou usar versão traduzida revisada e congelada. A renderização deve indicar essa distinção quando necessária.

## Worker e artefatos

Manter Taskiq, outbox, lease/fencing, tentativas e armazenamento privado existentes. Processo carrega a edição, valida compatibilidade, resolve evidências, renderiza fora da transação de captura e grava artefato com hash/tamanho/MIME/template/renderer.

Falha por conteúdo não suportado ou imagem ausente é diagnosticável; não mascarar como exportação vazia bem-sucedida. Reinício do worker reutiliza job idempotente sem duplicar entrega. O frontend respeita capabilities quando `TASKIQ_ENABLED` estiver desabilitado.
