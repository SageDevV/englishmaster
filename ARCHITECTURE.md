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
| `#/prova` | `exam` | Avaliação do aluno |
| `#/professor/criacao-de-prova` | `teacher-create` | Criação de avaliações |
| `#/professor/provas-cadastradas` | `teacher-exams` | Gestão e ativação de provas |
| `#/professor/resultados` | `teacher-results` | Resultados dos alunos |

As rotas ficam no objeto `viewRoutes`, em `main.js`. `getAuthorizedViewFromHash()` aplica as restrições de professor e aluno.

## Renderizadores

- `renderHubHome()`: dashboard e cartões dos módulos disponíveis.
- `renderHubModuleCard()`: unidade visual reutilizável do menu do Hub.
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

## Compatibilidade

Os dados, Firebase Auth, Firestore, progresso, ranking e avaliações não mudaram de projeto. A refatoração altera apenas a hierarquia de navegação, renderização e identidade visual, permanecendo compatível com o Firebase Spark.
