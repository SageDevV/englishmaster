# Arquitetura do Magister Hub

## Hierarquia

O projeto continua sendo uma SPA em JavaScript/Vite, organizada em duas camadas:

1. **Magister Hub**: camada superior, dashboard e ferramentas educacionais.
2. **Submódulos**: experiências independentes acessadas pelo menu do Hub.

O antigo aplicativo principal foi preservado como o submódulo **English Master**.

## Rotas

| Rota | View | Responsabilidade |
| --- | --- | --- |
| `#/` | `hub` | Dashboard principal do Magister Hub |
| `#/english-master` | `english-master` | Submódulo de aprendizagem de inglês |
| `#/cadastro-do-aluno` | `student-registration` | Cadastro global, disponível somente para alunos |
| `#/referencias-de-estudo` | `student-references` | Referências publicadas para a turma do aluno |
| `https://codeescape-c9e1b.web.app/` | externo | CodeScape, escape room de algoritmos, aberto em nova guia |
| `#/prova` | `exam` | Avaliação do aluno |
| `#/professor/turmas-e-materias` | `teacher-academics` | Cadastro e arquivamento de turmas e matérias |
| `#/professor/referencias-de-estudo` | `teacher-references` | Publicação e gestão de referências por turma/matéria |
| `#/professor/criacao-de-prova` | `teacher-create` | Criação de avaliações |
| `#/professor/provas-cadastradas` | `teacher-exams` | Gestão e ativação de provas |
| `#/professor/resultados` | `teacher-results` | Resultados dos alunos |

As rotas ficam no objeto `viewRoutes`, em `main.js`. `getAuthorizedViewFromHash()` aplica as restrições de professor e aluno.

O CodeScape é um submódulo hospedado externamente. Seu link fica em `updateHeader()` com `target="_blank"` e `rel="noopener noreferrer"`; portanto, não precisa de view em `renderApp()`.


## Renderizadores

- `renderHubHome()`: dashboard e cartões dos módulos disponíveis.
- `renderHubModuleCard()`: unidade visual reutilizável do menu do Hub.
- `renderStudentRegistration()`: formulário do perfil global exclusivo do aluno.
- `renderStudentReferences()`: biblioteca filtrada pela turma do aluno.
- `renderTeacherAcademics()`: gestão de turmas e matérias.
- `renderTeacherReferences()`: publicação e arquivamento de materiais de estudo.
- `renderEnglishMaster()`: página inicial do submódulo English Master.
- `renderApp()`: resolve a view atual e chama o renderizador correspondente.
- `updateHeader()`: navegação compartilhada entre Hub, submódulos e ferramentas.

Para adicionar um submódulo:

1. Adicione sua rota em `viewRoutes`.
2. Crie um renderizador dedicado.
3. Registre a view em `renderApp()`.
4. Adicione um cartão ao array `modules` de `renderHubHome()`.
5. Defina um tema próprio, se necessário, usando `body[data-module="nome"]`.

## Temas

`applyViewTheme()` escreve o módulo atual em `body.dataset.module`.

- `body[data-module="hub"]`: roxo escuro, usado pelo Magister Hub e ferramentas de avaliação.
- `body[data-module="english-master"]`: azul-petróleo, ciano e verde-água.

As duas paletas sobrescrevem as mesmas variáveis sem duplicar os componentes:

```css
--primary
--primary-dark
--secondary
--accent
--bg-dark
--glass
--glass-border
--text-main
--text-muted
```

Novos componentes devem consumir essas variáveis em vez de cores fixas. Cores semânticas, como erro e sucesso, podem continuar específicas.

## Organização acadêmica

O professor administra o catálogo compartilhado usando duas coleções com arquivamento lógico:

- `academicClasses`: turmas adicionais; `Entra21` (`entra21`) e `JovemProgramador` (`jovemprogramador`) permanecem disponíveis como defaults da aplicação.
- `academicSubjects`: matérias utilizadas nas referências e avaliações.

Cada item armazena `name`, `nameKey`, `active`, `deleted`, autoria e timestamps. Somente o professor pode criar ou atualizar; usuários autenticados podem ler o catálogo para preencher seus formulários.

As referências ficam em `studyReferences` e contêm título, descrição, URL, `classId/className` e `subjectId/subjectName`. O aluno consulta apenas documentos ativos da própria `studentProfile.classId`; perfis antigos sem `classId` são migrados por correspondência normalizada de `className`.

Novas provas exigem turma e matéria. O documento da prova preserva os quatro campos acadêmicos e a aplicação mantém uma prova ativa independente por turma. A regra de criação da tentativa confirma que a turma do perfil corresponde à turma da prova, mantendo compatibilidade com avaliações legadas sem `classId`.

## Perfil global do aluno

O cadastro do aluno usa o documento canônico `users/{uid}`, no mesmo projeto Firebase do Hub. Os campos específicos ficam em `studentProfile`:

```js
{
  fullName: string,
  nickname: string,
  nicknameKey: string,
  classId: string,
  className: string,
  courseGoal: string,
  email: string,
  completed: true,
  version: 2,
  updatedAt: string
}
```

O `nickname` e o `nicknameKey` também permanecem no topo de `users/{uid}` para compatibilidade com ranking e jogos. Alterações feitas no formulário global ou no editor legado de nickname mantêm as duas representações sincronizadas. A identificação da prova usa `studentProfile.fullName` como preenchimento inicial, mas continua editável antes do início da tentativa.

Submódulos internos acessam o perfil pelo estado carregado de `users/{uid}`. Um módulo hospedado em outro projeto, como o CodeScape atual, só poderá refletir esse cadastro quando for configurado para autenticar o mesmo usuário e ler o documento canônico no projeto `englishmaster-ea9b9`; não há compartilhamento de sessão ou `localStorage` entre origens diferentes.

## Anexos ZIP nas avaliações

Perguntas de prova aceitam dois tipos:

- `multiple_choice`: correção automática por hash SHA-256, incluindo questões legadas sem `type` explícito.
- `zip_attachment`: entrega de repositório/projeto em `.zip`, encaminhada para revisão manual.

Como o projeto deve permanecer no Firebase Spark e não usa Cloud Storage, cada arquivo ZIP é limitado a **5 MB** e armazenado no Firestore em blocos binários de **640 KB**:

```text
examAttachments/{attemptId}__{questionId}__{a|b} # metadados, SHA-256 e status
examAttachments/{attachmentId}/chunks/{0..7}    # conteúdo binário
```

O cliente valida extensão, assinatura `PK`, tamanho e SHA-256. Cada questão usa dois slots determinísticos (`a`/`b`): ao substituir um arquivo, o anterior permanece válido até o novo ZIP ficar completo e sua referência ser salva na tentativa; depois, as partes antigas são removidas para recuperar a cota. O download do professor reconstrói as partes e confirma tamanho, assinatura e hash antes de disponibilizar o arquivo. As regras permitem escrita somente pelo aluno proprietário, durante a tentativa ativa e apenas para uma questão `zip_attachment` presente no snapshot da prova. Após o envio da prova, anexos e partes ficam imutáveis.

Questões ZIP não entram no denominador da nota automática. Provas mistas mostram a pontuação das questões objetivas e o status **Revisão manual**; provas compostas somente por anexos não exibem uma porcentagem automática.

Para preservar a cota gratuita, os alunos devem excluir `node_modules`, artefatos de build e dependências antes de compactar o repositório.

## Compatibilidade

Os dados, Firebase Auth, Firestore, progresso, ranking e avaliações permanecem no projeto `englishmaster-ea9b9`. O cadastro global e os anexos ZIP usam apenas Auth e Firestore, permanecendo compatíveis com o Firebase Spark.
