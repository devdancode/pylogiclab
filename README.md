# LógicaLab

Ambiente gratuito de lógica de programação e Python para uma atividade extensionista de Engenharia da Computação em Pirassununga, SP. A trilha inicial reúne dez módulos, vinte aulas, vinte exercícios e quarenta questões. Há 234 minutos de conteúdo estimado, além do tempo de prática.

## Rodar localmente

Requisitos: Node.js 22.13 ou posterior e pnpm 11.25. O aplicativo usa React, TypeScript, HTML e CSS, Vinext, Cloudflare Workers e D1 (SQLite relacional). O participante cria sua conta e entra com e-mail e senha pelo Supabase Auth.

```sh
pnpm install --frozen-lockfile
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_needy_moira_mactaggert.sql
pnpm run dev
```

Abra a URL informada pelo servidor. Aplique também as migrações posteriores de `drizzle/` na ordem do diário. Use um projeto Supabase de desenvolvimento e configure `ADMIN_EMAIL` com o e-mail verificado da conta de teste administrativa.

## Configuração do ambiente

Em produção, configure valores no ambiente do Site. Em desenvolvimento, use um arquivo `.dev.vars` não versionado. Reinicie a prévia ou implante nova versão após alterações.

| Nome | Uso |
| --- | --- |
| `DB` | Binding obrigatório de Cloudflare D1 declarado em `.openai/hosting.json`. |
| `SITE_URL` | Origem HTTPS canônica para os redirecionamentos de autenticação. |
| `VERCEL_SITE_URL` | Origem HTTPS de produção na Vercel, usada nos links de confirmação e recuperação iniciados nesse domínio. |
| `ADMIN_EMAIL` | E-mail verificado da pessoa responsável. A função administrativa é atribuída ao matricular essa identidade. |
| `COLAB_GITHUB_BASE` | Opcional. Endereço dos cadernos já publicados no Colab a partir de um repositório público. Só ative depois de verificar os notebooks no GitHub. |
| `SUPABASE_URL` | URL do projeto Supabase dedicado à autenticação por e-mail. |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do mesmo projeto. Deve ser usada com a URL acima. |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional. Permite excluir a identidade na exclusão da matrícula. Quando ausente, instale a função limitada a exclusão da própria conta em `deploy/supabase-auth.sql`. |

### E-mail, confirmação e recuperação

Configure as URLs de redirecionamento em cada domínio publicado. Nos modelos personalizados, use `{{ .RedirectTo }}` para retornar ao domínio onde o pedido começou. No projeto Supabase, habilite o provedor de e-mail e a confirmação obrigatória nas configurações de Auth. Defina a URL do site e adicione `/login`, `/confirmar` e `/nova-senha` às URLs de redirecionamento permitidas na origem da aplicação. Configure o SMTP do projeto para atender os endereços dos participantes. Os modelos podem usar `{{ .ConfirmationURL }}` ou `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup` para confirmação e `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` para recuperação. O aplicativo também aceita a resposta de sessão no fragmento dos redirecionamentos padrão do provedor. A senha exige oito caracteres, uma letra e um número e é tratada pelo Supabase Auth. O servidor confere o usuário confirmado junto ao provedor e guarda as credenciais de sessão em cookies HttpOnly com Secure e SameSite=Lax.

Quem já estudou usando o acesso anterior cria uma senha em **Criar conta** com o mesmo e-mail. Após a confirmação desse endereço, o vínculo é registrado uma única vez e o participante volta ao perfil, às notas e ao progresso existentes. Um novo participante completa os dados de matrícula após confirmar o e-mail. A confirmação de propriedade do e-mail deve permanecer habilitada no Supabase, também para a conta administrativa.

## Entradas do sistema

- `/` apresenta a formação. Em `/trilha` é possível pesquisar, filtrar módulos e conhecer suas aulas antes de se matricular.
- `/cadastro`, `/matricula`, `/login`, `/recuperar-senha`, `/confirmar` e `/nova-senha` cuidam da conta. `/boas-vindas` registra a preparação inicial.
- `/dashboard`, `/curso`, `/curso/modulo/{id}`, `/aula/{id}`, `/exercicio/{id}` e `/quiz/{id}` formam o percurso de estudo.
- `/progresso`, `/perfil`, `/feedback` e `/notificacoes` exibem histórico, conquistas e preferências.
- `/admin`, `/admin/usuarios`, `/admin/conteudos` e `/admin/relatorios` exigem função administrativa ativa. O papel de instrutor está reservado para a futura delegação de edição de conteúdo.

## Estrutura do código

| Pasta | Responsabilidade |
| --- | --- |
| `app/` | Layout, estilos, rotas de páginas e API. |
| `ui/` | Página inicial, componentes React, formulários, área do aluno e administração. |
| `server/account.ts` | Matrícula, identidade, papéis, sessão, edição de perfil e exclusão. |
| `server/study.ts` | Aulas, cadernos, tentativas, correção de quizzes, feedback e conquistas. |
| `server/admin.ts` | Edição de conteúdos, gestão de usuários e indicadores acadêmicos. |
| `db/schema.ts`, `drizzle/` | Esquema relacional, chaves estrangeiras e migrações. |
| `server/db.ts`, `content/curriculum.json` | Carga inicial transacional e conteúdo pedagógico original. |
| `public/media/` | Ilustração e fontes hospedadas com o site. |

As alterações de conteúdo feitas no painel são persistidas no banco. A carga inicial ocorre uma única vez por banco. Novas migrações devem ser geradas com `pnpm run db:generate`. Preserve as migrações já aplicadas. Para revisar o código, execute `pnpm exec tsc --noEmit`. Os testes de notas podem ser executados com `node --experimental-strip-types --test tests/grades.test.mjs`.

A pasta `cadernos/` contém os vinte notebooks iniciais, gerados com `node scripts/gerar-cadernos.mjs`. Cada exercício também gera um arquivo Jupyter atualizado pelo servidor. O aluno baixa o arquivo, abre o Google Colab e seleciona **Arquivo → Fazer upload de notebook**. Também é possível cadastrar um link direto para um caderno do Colab no editor de aulas. A abertura de um exercício e sua conclusão são registradas separadamente. A conclusão prática é autodeclarada pelo participante. As respostas dos quizzes são corrigidas no servidor com um registro das perguntas e alternativas da tentativa.

Em **Administração → Relatórios → Notas dos participantes**, a coordenação pode consultar a nota por quiz, as tentativas e a nota geral de cada inscrito. Cada tentativa concluída vale de 0 a 10 e usa a quantidade de questões daquela tentativa. A nota geral é a média das melhores notas de cada quiz respondido e tem status parcial até que todos os quizzes publicados estejam concluídos. Sem tentativa concluída, a nota fica em branco. A média da turma considera uma nota geral por participante avaliado.

O painel administrativo exporta um CSV em UTF-8 com indicadores agregados para o relatório acadêmico, incluindo a média da turma e o total de participantes avaliados. Comentários abertos e dados de identificação permanecem na área administrativa. O tempo de estudo é aproximado e contabiliza intervalos com a aula ativa. Inatividade por módulo considera 14 dias sem acesso após o início e antes da conclusão.

## Publicação

O projeto é servido como Worker com assets estáticos e D1. A hospedagem Sites aplica a migração versionada antes do deploy. O controle de público do Site é independente dos papéis dentro da LógicaLab. Para um piloto com participantes, configure o público autorizado na hospedagem. Em outro ambiente, use um banco e credenciais próprios. Confira a matrícula, a confirmação e a recuperação com uma caixa de entrada de teste antes de abrir as inscrições por e-mail.


### Vercel

Importe a raiz deste repositório. O arquivo `vercel.json` seleciona a compilação da interface React e publica as rotas do curso, das contas e da administração. A função `api/service.mjs` encaminha as operações para a API da LógicaLab, que mantém os mesmos registros de alunos e notas em D1. Depois de receber o domínio de produção, configure `VERCEL_SITE_URL` no backend e autorize os retornos `/confirmar` e `/nova-senha` desse domínio no Supabase.
