export const collaborativeToolsData = [
  // --- BRONZE (Fácil) ---
  {
    question: "In Google Drive, what button do you click to give others access to a file?",
    options: ["Share", "Download", "Delete", "Move"],
    answer: "Share",
    difficulty: "bronze",
    explanation: "O botão 'Share' (Compartilhar) é usado para dar acesso a outras pessoas."
  },
  {
    question: "In Slack, how do you talk to one person directly in a private message?",
    options: ["Direct Message (DM)", "Channel", "Broadcast", "Forum"],
    answer: "Direct Message (DM)",
    difficulty: "bronze",
    explanation: "'Direct Message' ou 'DM' é uma mensagem privada enviada diretamente a um colega de equipe."
  },
  {
    question: "In Slack, what do we call the public space dedicated to a specific topic or project?",
    options: ["Channel", "Folder", "Drive", "Repository"],
    answer: "Channel",
    difficulty: "bronze",
    explanation: "Um 'channel' (canal) organiza discussões por tópicos ou projetos específicos."
  },
  {
    question: "Where is project code hosted and stored on GitHub?",
    options: ["Repository", "Channel", "Board", "Folder"],
    answer: "Repository",
    difficulty: "bronze",
    explanation: "Um 'repository' (repositório) é o local onde os arquivos e códigos de um projeto são armazenados no GitHub."
  },
  {
    question: "What option do you select to copy a file from your computer onto Google Drive?",
    options: ["Upload file", "Download file", "Delete file", "Print file"],
    answer: "Upload file",
    difficulty: "bronze",
    explanation: "'Upload file' envia um arquivo do seu computador para o Drive online."
  },
  {
    question: "When multiple people edit a Google Doc at the exact same time, what is this feature called?",
    options: ["Real-time collaboration", "Offline editing", "File compression", "Data backup"],
    answer: "Real-time collaboration",
    difficulty: "bronze",
    explanation: "'Real-time collaboration' (colaboração em tempo real) permite que várias pessoas editem o documento simultaneamente."
  },
  {
    question: "How do you mention someone directly in a Slack channel so they receive a notification?",
    options: ["Type @ followed by their username", "Type # followed by their username", "Type $ followed by their username", "Type * followed by their username"],
    answer: "Type @ followed by their username",
    difficulty: "bronze",
    explanation: "Usar o símbolo '@' é o padrão para marcar/mencionar alguém diretamente em ferramentas de colaboração."
  },
  {
    question: "What do you call the virtual space where your files are kept online, like in Google Drive?",
    options: ["Cloud storage", "Hard drive", "Local memory", "Flash drive"],
    answer: "Cloud storage",
    difficulty: "bronze",
    explanation: "'Cloud storage' significa armazenamento em nuvem, onde os dados ficam guardados em servidores online."
  },
  {
    question: "On GitHub, what tool is used to report a bug or suggest a new feature in a repository?",
    options: ["Issue", "Commit", "Branch", "Fork"],
    answer: "Issue",
    difficulty: "bronze",
    explanation: "Uma 'issue' (questão/problema) serve para registrar bugs, melhorias ou discussões sobre o projeto no GitHub."
  },

  // --- PRATA (Médio) ---
  {
    question: "What does 'commit' mean on GitHub?",
    options: ["Save changes with a message", "Delete a folder", "Download the code", "Invite a new member"],
    answer: "Save changes with a message",
    difficulty: "prata",
    explanation: "Um 'commit' grava as alterações que você fez nos arquivos, acompanhado de uma mensagem descritiva."
  },
  {
    question: "What permission level allows someone to view and suggest edits, but not change a Google Doc directly?",
    options: ["Commenter", "Viewer", "Editor", "Owner"],
    answer: "Commenter",
    difficulty: "prata",
    explanation: "O nível 'Commenter' (Comentador) permite que o usuário sugira edições e faça comentários, mas não altere o texto original de forma definitiva."
  },
  {
    question: "If you are busy and do not want to receive notifications in Slack, what should you turn on?",
    options: ["Do Not Disturb (DND)", "Set Status to active", "Forward messages", "Mention everyone"],
    answer: "Do Not Disturb (DND)",
    difficulty: "prata",
    explanation: "'Do Not Disturb' (DND / Não Perturbe) pausa as notificações temporariamente."
  },
  {
    question: "On GitHub, how do you submit changes to be reviewed and merged into the main project?",
    options: ["Pull Request (PR)", "Push Request", "Fork Project", "Clone Repository"],
    answer: "Pull Request (PR)",
    difficulty: "prata",
    explanation: "Um 'Pull Request' (PR) solicita que suas alterações de código sejam revisadas e integradas ao projeto principal."
  },
  {
    question: "Where do you look in Google Drive to find files that other people sent you access to?",
    options: ["Shared with me", "My Drive", "Recent", "Trash"],
    answer: "Shared with me",
    difficulty: "prata",
    explanation: "A seção 'Shared with me' (Compartilhados comigo) lista os arquivos que outros compartilharam com a sua conta."
  },
  {
    question: "In collaborative tools like Trello or Jira, what do we call the column where tasks are currently being worked on?",
    options: ["In Progress", "To Do", "Done", "Backlog"],
    answer: "In Progress",
    difficulty: "prata",
    explanation: "'In Progress' (Em progresso/andamento) é a coluna que mostra tarefas sendo executadas no momento."
  },
  {
    question: "What is the best practice in Slack to reply to a specific message without cluttering the main channel?",
    options: ["Reply in thread", "Send a new direct message", "Create a new channel", "Pin the message"],
    answer: "Reply in thread",
    difficulty: "prata",
    explanation: "'Reply in thread' (Responder no fio/discussão) mantém a conversa organizada e restrita àquela mensagem específica."
  },
  {
    question: "How can you view past edits and restore previous versions of a document in Google Drive?",
    options: ["Version History", "Activity Log", "Settings Menu", "Trash folder"],
    answer: "Version History",
    difficulty: "prata",
    explanation: "O 'Version History' (Histórico de versões) mostra o histórico de edições e permite restaurar versões passadas."
  },
  {
    question: "What does it mean to 'clone' a repository from GitHub?",
    options: ["Copy the remote repository to your local computer", "Delete the repository from GitHub", "Merge two different branches", "Change the repository name"],
    answer: "Copy the remote repository to your local computer",
    difficulty: "prata",
    explanation: "Clone significa baixar uma cópia do repositório remoto para a sua máquina local para trabalhar nele."
  },

  // --- OURO (Difícil) ---
  {
    question: "What is a 'merge conflict' on GitHub?",
    options: ["When two people edit the same lines of a file and Git cannot decide which to keep", "When the server goes offline during a push", "When a user deletes their GitHub account", "When a repository is marked as private"],
    answer: "When two people edit the same lines of a file and Git cannot decide which to keep",
    difficulty: "ouro",
    explanation: "Um 'merge conflict' (conflito de mesclagem) ocorre quando há alterações concorrentes na mesma parte de um arquivo, exigindo resolução manual."
  },
  {
    question: "What is a 'webhook' in tools like Slack or GitHub?",
    options: ["An automated message sent from one app to another when an event occurs", "A security password to log in", "A type of physical internet connector", "A group call feature"],
    answer: "An automated message sent from one app to another when an event occurs",
    difficulty: "ouro",
    explanation: "Webhooks são mensagens automáticas enviadas entre aplicações quando algo acontece (ex: notificar no Slack quando há um push no GitHub)."
  },
  {
    question: "Why do developers create a new 'branch' in a Git repository?",
    options: ["To work on a feature without affecting the main codebase", "To invite external users to read the code", "To back up the repository to Google Drive", "To delete old code history"],
    answer: "To work on a feature without affecting the main codebase",
    difficulty: "ouro",
    explanation: "Criar uma 'branch' (ramificação) permite trabalhar em uma tarefa isolada do código principal (main), mantendo o código estável."
  },
  {
    question: "What is the difference between a 'Fork' and a 'Clone' on GitHub?",
    options: ["A Fork copies a project to your personal GitHub account, while a Clone copies it to your computer", "A Fork deletes the project, while a Clone saves it", "A Fork is private, while a Clone is always public", "A Fork is for Google Drive, while a Clone is for GitHub"],
    answer: "A Fork copies a project to your personal GitHub account, while a Clone copies it to your computer",
    difficulty: "ouro",
    explanation: "O 'Fork' cria uma cópia do projeto sob sua conta no GitHub (remoto), enquanto o 'Clone' baixa o código para o seu computador (local)."
  },
  {
    question: "What is the key advantage of a 'Shared Drive' (Google Workspace) compared to a folder in 'My Drive'?",
    options: ["Files belong to the organization rather than a single individual", "Files can only be viewed offline", "It does not consume storage space", "It is automatically translated to English"],
    answer: "Files belong to the organization rather than a single individual",
    difficulty: "ouro",
    explanation: "Nos 'Shared Drives' (Drives compartilhados), a propriedade dos arquivos pertence à equipe/organização, impedindo perda de dados quando alguém sai da empresa."
  },
  {
    question: "What is a Slack 'Huddle'?",
    options: ["A quick, informal audio or video call inside a channel", "A feature to backup messages", "A folder to store PDF files", "A setting to change interface themes"],
    answer: "A quick, informal audio or video call inside a channel",
    difficulty: "ouro",
    explanation: "Um 'Huddle' é uma chamada rápida de áudio/vídeo feita diretamente em um canal ou DM para discussões ágeis."
  },
  {
    question: "What is the purpose of the 'README.md' file typically found in a GitHub repository?",
    options: ["To provide an overview, setup guide, and instructions for the project", "To store confidential user passwords", "To list the repository's programming bugs", "To host CSS files for styling the project"],
    answer: "To provide an overview, setup guide, and instructions for the project",
    difficulty: "ouro",
    explanation: "O arquivo 'README.md' é o cartão de visitas de um projeto, trazendo a descrição, guia de instalação e instruções de uso."
  },
  {
    question: "When a colleague requests a 'Review' on their Pull Request, what is expected of you?",
    options: ["Examine their code, suggest improvements, and approve it if correct", "Download their code and delete the main branch", "Copy their work into a Google Doc", "Merge the code without reading it"],
    answer: "Examine their code, suggest improvements, and approve it if correct",
    difficulty: "ouro",
    explanation: "Review é a revisão de código por pares (code review), onde você analisa, sugere melhorias e aprova ou solicita alterações."
  },
  {
    question: "What are 'GitHub Actions' used for?",
    options: ["Automating tasks like running tests, building applications, and deploying code", "Sending direct chat messages to team members", "Editing Google Docs directly from GitHub", "Designing logos and images for the project"],
    answer: "Automating tasks like running tests, building applications, and deploying code",
    difficulty: "ouro",
    explanation: "GitHub Actions é uma ferramenta de CI/CD que permite automatizar fluxos de trabalho como testes, compilação e deploy diretamente no repositório."
  }
];
