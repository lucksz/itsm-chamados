# Nexo — central de atendimento ITSM

Aplicação demonstrativa para abrir e acompanhar chamados de suporte, operar a fila de consultoria e acompanhar a carga e os SLAs da equipe. A experiência é organizada por três perfis, usando o dataset fornecido em `src/mocks/data/dados.json`.

## Stack

- React 19 e Vite 8
- JavaScript / JSX
- Tailwind CSS v4 e Material UI, incluindo MUI X Charts e Data Grid
- React Router 8
- TanStack Query para estado remoto e cache
- Zustand para a sessão demonstrativa
- MSW 3 para simular a API REST no navegador
- date-fns e date-fns-tz para datas, locale e fusos horários
- React Hook Form e Zod para validação de formulários
- Vitest, jsdom e React Testing Library

## Pré-requisitos e execução

Requer Node.js compatível com Vite 8 e npm.

```bash
npm install
npm run dev
```

O MSW inicia uma API REST no navegador; não há servidor de aplicação ou banco real. O primeiro carregamento busca o arquivo JSON oficial como um recurso estático separado do bundle JavaScript.

```bash
npm test
npm run lint
npm run build
npm run preview
```

## Perfis de demonstração

O seletor no cabeçalho alterna entre:

- **Marina Almeida — consultora:** “Meus chamados”, fila sem responsável do grupo, filtros, ordenação por SLA/atividade/prioridade, assumir chamado, conversa, notas internas, histórico e alteração de status com justificativa.
- **Ricardo Monteiro — gestor:** indicadores por status/prioridade, risco e violação de SLA, fila paginada, filtros por grupo/consultor, distribuição de carga e atribuição/redistribuição. Pode simular eventos e restaurar os dados da demonstração.
- **Helena Fernandes — cliente:** pedidos próprios, criação de chamado, acompanhamento simplificado, mensagens públicas, sugestões de pedidos anteriores semelhantes e reabertura de chamados fechados mediante justificativa.

Não há login. O perfil é um seletor de demonstração salvo no navegador; cada perfil usa identificadores UUID do próprio dataset. A troca remove do cache TanStack Query as listas e detalhes de outros usuários.

## Arquitetura

```text
src/
  app/                 # composição da aplicação (providers em main.jsx)
  components/          # shell, conversa, status, indicadores compartilhados
  domain/               # SLA, formatação, filtros e operações puras de chamados
  features/
    consultant/         # fila operacional da consultora
    manager/             # painel, Data Grid e simulador de eventos
    customer/            # portal simplificado do cliente
    tickets/             # detalhe, conversa, atribuição e histórico
  hooks/                 # queries de lista e detalhe
  mocks/                 # MSW, armazenamento delta, relógio, permissões e eventos
  services/              # cliente REST
  store/                 # sessão demonstrativa (Zustand)
  tests/                 # setup de testes
```

TanStack Query é a única fonte de cache para dados remotos. Zustand guarda somente o identificador do perfil demonstrativo. Os componentes chamam a camada REST em `src/services/api.js`; somente a camada MSW lê e altera o dataset.

`StyledEngineProvider` usa `enableCssLayer`, e `src/index.css` declara explicitamente a ordem de camadas `theme`, `base`, `mui`, `components` e `utilities`: regras utilitárias do Tailwind podem prevalecer sobre os estilos MUI sem remover o isolamento em cascata.

## API simulada e persistência

Rotas MSW:

- `GET /api/session`, `GET /api/tickets`, `GET /api/tickets/:id`
- `POST /api/tickets`, `POST /api/tickets/:id/messages`
- `POST /api/tickets/:id/assign`, `POST /api/tickets/:id/status`
- `GET /api/consultants`, `GET /api/analytics`
- `POST /api/demo/events`, `POST /api/demo/reset`

As alterações persistidas são apenas deltas de chamados, mensagens e histórico em `localStorage`; os 620 chamados, 3.381 mensagens e 1.558 itens de histórico originais não são copiados para lá. O dataset é carregado novamente ao iniciar o app. **Restaurar dados** limpa esses deltas.

Os handlers verificam perfil e escopo antes de responder: consultores acessam chamados do próprio grupo, gestores acessam os grupos da equipe e clientes só acessam chamados cujo `solicitante_id` corresponde ao próprio UUID. O cliente recebe mensagens públicas e campos de apresentação reduzidos; anotações internas, grupos, categoria técnica, prioridade, e-mails de terceiros e dados de outros solicitantes não são expostos nos endpoints de chamados. A UI também não oferece essas operações.

> **Limitação importante:** a seleção de perfil e as verificações de autorização rodam no mesmo navegador que a aplicação. São guardrails da simulação, não autenticação nem segurança real de backend. Um produto real deve repetir autorização e isolamento de tenant em um servidor confiável.

## Eventos em tempo real

O simulador tem interface `subscribe`/`unsubscribe` e publica `chamado.aberto`, `chamado.atribuido`, `mensagem.adicionada` e `status.alterado`. As mutações REST locais publicam os mesmos eventos. O painel do gestor permite emitir cada tipo e repetir o último evento para demonstrar deduplicação. `BroadcastChannel` propaga eventos entre abas quando o navegador oferece suporte; `storage` recarrega os deltas alterados.

Eventos com UUID já processado são ignorados nesta sessão. Mensagens também são únicas por UUID. No transporte entre abas, payloads de mensagem são reduzidos a metadados para permitir invalidação sem compartilhar o texto da conversa. Os eventos invalidam listas e detalhes TanStack Query correspondentes; rascunhos ficam em estado de UI por perfil e chamado, e são limpos quando o perfil muda. A conversa não rola sozinha: mensagens novas no chamado aberto são sinalizadas, e mensagens recebidas em outros chamados aparecem na fila da consultora e como novidade no portal do cliente.

## SLA e tempo

O relógio da demonstração parte de `meta.agora` no JSON e avança pelo tempo transcorrido na sessão; não substitui essa referência pelo horário atual do computador como instante inicial. Os prazos de primeira resposta e resolução são calculados separadamente. A exibição converte UTC usando `locale` e `zoneinfo` do usuário (por exemplo, Lisboa e São Paulo).

Chamados ativos pausados mostram “SLA pausado” e não têm contagem regressiva. Chamados resolvidos/fechados são avaliados pelo instante de resolução/fechamento registrado, não pelo relógio corrente. Um prazo com até duas horas restantes é sinalizado como próximo do vencimento; o corte é uma decisão operacional da demonstração.

## Decisões de produto e limites

- **Gestor:** concentra indicadores e carga em uma visão de equipe; detalhes são acessados pela fila somente quando necessário.
- **Consultora:** a fila coloca risco de SLA e mensagens novas no caminho operacional, com conversa e contexto no mesmo fluxo.
- **Cliente:** acompanha apenas andamento, responsável, previsão de primeira resposta e próximo passo, sem precisar conhecer prioridade técnica, categoria interna ou grupo.
- **Ociosidade histórica:** o dashboard mostra a quantidade de chamados ativos por consultor, não “tempo sem chamados”. Embora haja registros de histórico de status/atribuição, os registros de atribuição não fornecem um intervalo completo e confiável de início/fim de cada período sem carga. Não inventamos uma métrica semanal a partir deles.
- **Atribuição e sobrecarga:** a contagem exibida é a carga ativa atual. “Poucos” (até 5) e “carga alta” (mais de 40) são faixas de leitura indicativas, não regras contratuais.
- **Reabertura:** o cliente pode reabrir um chamado fechado próprio informando justificativa; o registro fica no histórico. A API simulada bloqueia novas mensagens após fechamento até a reabertura.
- **Atualizações entre abas:** deltas locais são compartilhados via `localStorage` e eventos via `BroadcastChannel`. Não há resolução de conflitos distribuídos nem garantia de entrega offline como haveria numa API real.

## Testes

A suíte cobre cálculo separado dos SLAs, SLA pausado e concluído, fusos de Lisboa/São Paulo, filtros e ordenação, autorização por titular, visibilidade de notas internas, alteração justificada/reabertura, atribuição, deduplicação de eventos e mensagens, e preservação do rascunho durante atualização.

## Próximos passos para produção

- Implementar autenticação, autorização no servidor e isolamento de tenant em cada consulta.
- Substituir MSW e `localStorage` por API/banco com transações, auditoria e estratégia de conflito.
- Usar WebSocket/SSE autenticado com reconexão, replay/cursor e idempotência persistente.
- Definir contratos e política de pausa de SLA com a operação; persistir intervalos de pausa para cálculo histórico.
- Instrumentar métricas confiáveis de carga e tempo sem atribuição a partir de eventos completos de alocação.
- Adicionar paginação/virtualização de mensagens, testes de integração de API e testes de navegador em múltiplas abas para o ambiente de produção.
