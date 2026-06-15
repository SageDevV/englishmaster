// =============================================================
//  Trilha: Numerals, Quantities and Units of Measurement in IT
//  Para iniciantes em inglês que vão atuar com desenvolvimento
//  de software. Estrutura: etapas (stages) com aula curta,
//  exemplos práticos de TI, vocabulário técnico bilíngue e
//  exercícios interativos. No final, um quiz da trilha.
// =============================================================

export const numeralsTrack = {
  id: 'numerals-units',
  title: 'Numerals, Quantities & Units in IT',
  description: 'Números, quantidades e unidades de medida no mundo da tecnologia.',
  icon: '🔢',
  color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  intro:
    'Nesta trilha você vai aprender a ler e falar números, quantidades e unidades de medida em inglês, sempre com exemplos do dia a dia de quem trabalha com software.',
  stages: [
    // ---------------------------------------------------------
    {
      id: 'cardinal-numbers',
      title: 'Cardinal Numbers',
      subtitle: 'Os números do dia a dia',
      icon: '0️⃣',
      lesson: {
        intro:
          'Cardinal numbers ("números cardinais") são os números que usamos para contar: 0, 1, 2, 3... Na programação eles aparecem o tempo todo: contagem de itens, IDs, portas, status HTTP e versões.',
        points: [
          'zero = 0, one = 1, two = 2, ... ten = 10.',
          'Dezenas: twenty (20), thirty (30), forty (40), fifty (50).',
          'Centenas e milhares: one hundred (100), one thousand (1,000), one million (1,000,000).',
          'Em inglês, o separador de milhar é a vírgula: 1,000 e o decimal é o ponto: 3.14.'
        ],
        examples: [
          { en: 'The server returned status code two hundred (200).', pt: 'O servidor retornou o código de status duzentos (200).' },
          { en: 'There are twenty-four open issues in the repository.', pt: 'Há vinte e quatro issues abertas no repositório.' },
          { en: 'The loop runs one thousand times.', pt: 'O laço executa mil vezes.' }
        ]
      },
      vocabulary: [
        { en: 'number', pt: 'número', example: 'A port number identifies a service.' },
        { en: 'to count', pt: 'contar', example: 'The function counts the items in the list.' },
        { en: 'thousand', pt: 'mil', example: 'We handled ten thousand requests.' },
        { en: 'million', pt: 'milhão', example: 'The app has two million users.' },
        { en: 'digit', pt: 'dígito / algarismo', example: 'A PIN has four digits.' }
      ],
      exercises: [
        {
          question: 'How do you say "1,000" in English?',
          options: ['One hundred', 'One thousand', 'One million', 'Ten thousand'],
          answer: 'One thousand',
          explanation: '"1,000" = one thousand (mil). A vírgula separa o milhar.'
        },
        {
          question: 'The HTTP status "404" is read as:',
          options: ['Four hundred forty', 'Forty-four', 'Four oh four', 'Four thousand four'],
          answer: 'Four oh four',
          explanation: 'Códigos como 404 costumam ser lidos dígito a dígito: "four oh four".'
        },
        {
          question: 'Choose the correct number: "There are ____ files in the folder." (12)',
          options: ['twenty', 'twelve', 'two', 'twenty-one'],
          answer: 'twelve',
          explanation: '12 = twelve. Cuidado para não confundir com twenty (20).'
        }
      ]
    },
    // ---------------------------------------------------------
    {
      id: 'ordinal-versions',
      title: 'Ordinal Numbers & Versions',
      subtitle: 'Ordem, posições e versões de software',
      icon: '🥇',
      lesson: {
        intro:
          'Ordinal numbers ("números ordinais") indicam ordem ou posição: first, second, third... Em TI usamos para versões, etapas de um processo e itens de uma lista (lembre que arrays começam no índice zero!).',
        points: [
          'first (1º), second (2º), third (3º), fourth (4º), fifth (5º).',
          'A partir de fourth, geralmente é só número + "th": sixth, tenth, twentieth.',
          'Versões: "version one point two" para v1.2; "version two point zero" para v2.0.',
          'Index zero: "the first element is at index zero" (o primeiro elemento está no índice zero).'
        ],
        examples: [
          { en: 'This is the second release of the year.', pt: 'Este é o segundo lançamento do ano.' },
          { en: 'We are on version three point one (v3.1).', pt: 'Estamos na versão três ponto um (v3.1).' },
          { en: 'The first item in the array is at index zero.', pt: 'O primeiro item do array está no índice zero.' }
        ]
      },
      vocabulary: [
        { en: 'first', pt: 'primeiro', example: 'The first commit created the project.' },
        { en: 'release', pt: 'lançamento / versão', example: 'The new release fixes many bugs.' },
        { en: 'version', pt: 'versão', example: 'Update to the latest version.' },
        { en: 'index', pt: 'índice', example: 'Access the value by its index.' },
        { en: 'step', pt: 'etapa / passo', example: 'Follow each step of the tutorial.' }
      ],
      exercises: [
        {
          question: 'How do you read the version "v2.0"?',
          options: ['Version twenty', 'Version two point zero', 'Version two oh', 'Two version'],
          answer: 'Version two point zero',
          explanation: 'O ponto vira "point" e o 0 vira "zero": v2.0 = version two point zero.'
        },
        {
          question: 'In most languages, the first element of an array is at index ____.',
          options: ['one', 'zero', 'two', 'first'],
          answer: 'zero',
          explanation: 'A maioria das linguagens é "zero-based": o primeiro índice é 0 (zero).'
        },
        {
          question: 'Complete: "This is my ____ pull request." (3rd)',
          options: ['three', 'third', 'thirth', 'threeth'],
          answer: 'third',
          explanation: '3rd = third (terceiro).'
        }
      ]
    },
    // ---------------------------------------------------------
    {
      id: 'quantities',
      title: 'Quantities',
      subtitle: 'Contável, incontável e "quanto?"',
      icon: '⚖️',
      lesson: {
        intro:
          'Para falar de quantidades em inglês, primeiro veja se o substantivo é contável (countable) ou incontável (uncountable). Em TI, "files" e "users" são contáveis; "data", "memory" e "storage" são incontáveis.',
        points: [
          'Contáveis: many files, a few bugs, several requests.',
          'Incontáveis: much data, a little memory, a lot of storage.',
          '"a lot of" / "lots of" serve para os dois casos.',
          'Perguntas: "How many users?" (contável) e "How much memory?" (incontável).'
        ],
        examples: [
          { en: 'How much memory does the app use?', pt: 'Quanta memória o app usa?' },
          { en: 'How many requests per second can the server handle?', pt: 'Quantas requisições por segundo o servidor aguenta?' },
          { en: 'There is too much data to load at once.', pt: 'Há dados demais para carregar de uma vez.' }
        ]
      },
      vocabulary: [
        { en: 'data', pt: 'dados (incontável)', example: 'The data is stored in the cloud.' },
        { en: 'amount', pt: 'quantidade (incontável)', example: 'A large amount of data.' },
        { en: 'few', pt: 'poucos', example: 'Only a few users reported the bug.' },
        { en: 'several', pt: 'vários', example: 'Several tests are failing.' },
        { en: 'enough', pt: 'suficiente', example: 'We do not have enough memory.' }
      ],
      exercises: [
        {
          question: 'Which question is correct for "memory"?',
          options: ['How many memory?', 'How much memory?', 'How memory much?', 'How count memory?'],
          answer: 'How much memory?',
          explanation: '"Memory" é incontável, então usamos "how much".'
        },
        {
          question: 'Complete: "There are ____ bugs in this version."',
          options: ['much', 'a little', 'several', 'amount'],
          answer: 'several',
          explanation: '"Bugs" é contável; "several" (vários) combina com plural contável.'
        },
        {
          question: 'Choose the correct word: "We don\'t have ____ storage left."',
          options: ['many', 'much', 'few', 'several'],
          answer: 'much',
          explanation: '"Storage" é incontável, então usamos "much".'
        }
      ]
    },
    // ---------------------------------------------------------
    {
      id: 'storage-units',
      title: 'Units of Digital Storage',
      subtitle: 'bit, byte, KB, MB, GB, TB',
      icon: '💾',
      lesson: {
        intro:
          'As unidades de armazenamento medem a quantidade de informação. A menor é o bit; 8 bits formam 1 byte. A partir daí, cada unidade é cerca de 1.000 vezes maior que a anterior.',
        points: [
          'bit (b) → byte (B): 8 bits = 1 byte.',
          'kilobyte (KB), megabyte (MB), gigabyte (GB), terabyte (TB).',
          'Atenção: "b" minúsculo = bit; "B" maiúsculo = byte.',
          'Leitura: "512 MB" = "five hundred twelve megabytes".'
        ],
        examples: [
          { en: 'This file is two hundred megabytes (200 MB).', pt: 'Este arquivo tem duzentos megabytes (200 MB).' },
          { en: 'The disk has one terabyte of storage.', pt: 'O disco tem um terabyte de armazenamento.' },
          { en: 'One byte is made of eight bits.', pt: 'Um byte é formado por oito bits.' }
        ]
      },
      vocabulary: [
        { en: 'byte', pt: 'byte', example: 'A character usually takes one byte.' },
        { en: 'storage', pt: 'armazenamento', example: 'Cloud storage is scalable.' },
        { en: 'file size', pt: 'tamanho do arquivo', example: 'Check the file size before uploading.' },
        { en: 'disk', pt: 'disco', example: 'The disk is almost full.' },
        { en: 'to upload', pt: 'enviar / subir', example: 'Upload the file to the server.' }
      ],
      exercises: [
        {
          question: 'How many bits are in one byte?',
          options: ['Two', 'Four', 'Eight', 'Sixteen'],
          answer: 'Eight',
          explanation: '1 byte = 8 bits.'
        },
        {
          question: 'Which unit is the largest?',
          options: ['Kilobyte (KB)', 'Megabyte (MB)', 'Gigabyte (GB)', 'Terabyte (TB)'],
          answer: 'Terabyte (TB)',
          explanation: 'Ordem crescente: KB < MB < GB < TB.'
        },
        {
          question: 'What does the lowercase "b" mean in "100 Mb"?',
          options: ['byte', 'bit', 'block', 'binary'],
          answer: 'bit',
          explanation: '"b" minúsculo = bit; "B" maiúsculo = byte. Cuidado nessa diferença!'
        }
      ]
    },
    // ---------------------------------------------------------
    {
      id: 'speed-frequency',
      title: 'Speed, Frequency & Time',
      subtitle: 'Mbps, GHz, ms e latência',
      icon: '⚡',
      lesson: {
        intro:
          'Em TI medimos velocidade de rede, frequência de processadores e tempos de resposta. Saber dizer essas unidades ajuda a falar de performance.',
        points: [
          'Velocidade de internet: Mbps = "megabits per second" (megabits por segundo).',
          'Frequência: Hz, MHz, GHz = "gigahertz". Um CPU de 3.2 GHz = "three point two gigahertz".',
          'Tempo: ms = "milliseconds" (milissegundos); s = "seconds".',
          'Latência (latency) é o atraso; quanto menor, melhor.'
        ],
        examples: [
          { en: 'My connection is one hundred megabits per second (100 Mbps).', pt: 'Minha conexão é de cem megabits por segundo (100 Mbps).' },
          { en: 'The processor runs at three point five gigahertz (3.5 GHz).', pt: 'O processador roda a três ponto cinco gigahertz (3.5 GHz).' },
          { en: 'The API responds in fifty milliseconds (50 ms).', pt: 'A API responde em cinquenta milissegundos (50 ms).' }
        ]
      },
      vocabulary: [
        { en: 'speed', pt: 'velocidade', example: 'Download speed matters for large files.' },
        { en: 'latency', pt: 'latência / atraso', example: 'Low latency improves the experience.' },
        { en: 'bandwidth', pt: 'largura de banda', example: 'Video streaming needs high bandwidth.' },
        { en: 'per second', pt: 'por segundo', example: 'Frames per second (FPS) measure smoothness.' },
        { en: 'response time', pt: 'tempo de resposta', example: 'The response time is under 100 ms.' }
      ],
      exercises: [
        {
          question: '"Mbps" stands for:',
          options: ['Megabytes per second', 'Megabits per second', 'Megabits per system', 'Mega bandwidth per second'],
          answer: 'Megabits per second',
          explanation: 'Velocidade de rede costuma ser medida em megabits per second (Mbps).'
        },
        {
          question: 'A CPU at "3.2 GHz" is read as:',
          options: ['Three point two gigahertz', 'Thirty-two gigahertz', 'Three two gigahertz', 'Three point two gigabytes'],
          answer: 'Three point two gigahertz',
          explanation: 'GHz = gigahertz; 3.2 = "three point two".'
        },
        {
          question: 'Which value means lower latency (better)?',
          options: ['200 ms', '20 ms', '2000 ms', '500 ms'],
          answer: '20 ms',
          explanation: 'Latência menor é melhor: 20 ms é mais rápido que 200 ms.'
        }
      ]
    },
    // ---------------------------------------------------------
    {
      id: 'dimensions-specs',
      title: 'Dimensions, Specs & Percentages',
      subtitle: 'px, resolução, % e proporções',
      icon: '📐',
      lesson: {
        intro:
          'Ao falar de telas, imagens e métricas, usamos pixels, resoluções, porcentagens e proporções. Isso é essencial em front-end, design e relatórios.',
        points: [
          'pixel (px): "the button is forty pixels wide" (o botão tem quarenta pixels de largura).',
          'Resolução: "1920 by 1080" (1920 x 1080) — usamos "by" para o "x".',
          'Porcentagem: 50% = "fifty percent"; "test coverage is eighty percent".',
          'Proporção/ratio: "a 16 by 9 aspect ratio" (proporção 16:9).'
        ],
        examples: [
          { en: 'The screen resolution is 1920 by 1080.', pt: 'A resolução da tela é 1920 por 1080.' },
          { en: 'Test coverage increased to ninety percent (90%).', pt: 'A cobertura de testes subiu para noventa por cento (90%).' },
          { en: 'Set the margin to ten pixels.', pt: 'Defina a margem em dez pixels.' }
        ]
      },
      vocabulary: [
        { en: 'width', pt: 'largura', example: 'Set the width to 100 pixels.' },
        { en: 'height', pt: 'altura', example: 'The height is fixed at 50px.' },
        { en: 'resolution', pt: 'resolução', example: 'A higher resolution shows more detail.' },
        { en: 'percentage', pt: 'porcentagem', example: 'The progress bar shows the percentage.' },
        { en: 'ratio', pt: 'proporção / razão', example: 'Keep the aspect ratio when resizing.' }
      ],
      exercises: [
        {
          question: 'How do you read a resolution of "1280 x 720"?',
          options: ['Twelve eighty times seven twenty', 'One thousand two hundred eighty seven twenty', '1280 by 720', 'Twelve eighty over seven twenty'],
          answer: '1280 by 720',
          explanation: 'O "x" entre dimensões é lido como "by": "1280 by 720".'
        },
        {
          question: 'How do you say "75%"?',
          options: ['Seventy-five percent', 'Seventy-five percentage', 'Seventy-five parts', 'Seventy-five per cents'],
          answer: 'Seventy-five percent',
          explanation: '% = "percent" (sempre singular após o número).'
        },
        {
          question: 'Complete: "The logo is 64 pixels in ____." (largura)',
          options: ['height', 'width', 'depth', 'length'],
          answer: 'width',
          explanation: 'width = largura; height = altura.'
        }
      ]
    }
  ],

  // Quiz final da trilha (revisão geral)
  finalQuiz: [
    {
      question: 'How do you read "v1.2"?',
      options: ['Version one two', 'Version one point two', 'Version twelve', 'Version one dot two hundred'],
      answer: 'Version one point two',
      difficulty: 'bronze',
      explanation: 'v1.2 = version one point two.'
    },
    {
      question: 'How many bits are there in 1 byte?',
      options: ['4', '8', '16', '1024'],
      answer: '8',
      difficulty: 'bronze',
      explanation: '1 byte = 8 bits.'
    },
    {
      question: 'Which question fits "data"?',
      options: ['How many data?', 'How much data?', 'How data many?', 'How count data?'],
      answer: 'How much data?',
      difficulty: 'prata',
      explanation: '"Data" é incontável → "how much".'
    },
    {
      question: '"Mbps" means:',
      options: ['Megabytes per second', 'Megabits per second', 'Megabits per system', 'Megabytes per system'],
      answer: 'Megabits per second',
      difficulty: 'prata',
      explanation: 'Mbps = megabits per second.'
    },
    {
      question: 'Read the resolution "1920 x 1080":',
      options: ['1920 times 1080', '1920 by 1080', '1920 over 1080', '1920 plus 1080'],
      answer: '1920 by 1080',
      difficulty: 'prata',
      explanation: 'O "x" de dimensões é lido como "by".'
    },
    {
      question: 'In a zero-based array, the first element has index:',
      options: ['1', '0', '-1', 'first'],
      answer: '0',
      difficulty: 'ouro',
      explanation: 'Arrays zero-based começam no índice 0.'
    },
    {
      question: 'A CPU at "3.5 GHz" is read as:',
      options: ['Three point five gigahertz', 'Thirty-five gigahertz', 'Three five gigahertz', 'Three point five gigabytes'],
      answer: 'Three point five gigahertz',
      difficulty: 'ouro',
      explanation: '3.5 GHz = three point five gigahertz.'
    }
  ]
};

// =============================================================
//  numeralsData: perguntas no formato dos quizzes (bronze/prata/
//  ouro) usadas pelo tópico, pelo Modo Sobrevivente e pelo
//  Speedrun. Mantém o mesmo formato dos demais data files.
// =============================================================
export const numeralsData = [
  // --- BRONZE (Fácil) ---
  {
    question: 'How do you say "1,000" in English?',
    options: ['One hundred', 'One thousand', 'One million', 'Ten thousand'],
    answer: 'One thousand',
    difficulty: 'bronze',
    explanation: '"1,000" = one thousand (mil).'
  },
  {
    question: 'How many bits are in 1 byte?',
    options: ['2', '4', '8', '16'],
    answer: '8',
    difficulty: 'bronze',
    explanation: '1 byte = 8 bits.'
  },
  {
    question: 'Which is an ordinal number?',
    options: ['Five', 'Fifth', 'Fifteen', 'Fifty'],
    answer: 'Fifth',
    difficulty: 'bronze',
    explanation: 'Ordinais indicam ordem: fifth (quinto).'
  },
  {
    question: 'How do you read the number "12"?',
    options: ['Twenty', 'Twelve', 'Two', 'Twenty-one'],
    answer: 'Twelve',
    difficulty: 'bronze',
    explanation: '12 = twelve.'
  },
  {
    question: 'Which unit measures digital storage?',
    options: ['Gigabyte', 'Gigahertz', 'Pixel', 'Percent'],
    answer: 'Gigabyte',
    difficulty: 'bronze',
    explanation: 'Gigabyte (GB) mede armazenamento.'
  },
  {
    question: 'What is the first index in a zero-based array?',
    options: ['1', '0', '2', '-1'],
    answer: '0',
    difficulty: 'bronze',
    explanation: 'O primeiro índice é 0 (zero).'
  },
  {
    question: '"50%" is read as:',
    options: ['Fifty percent', 'Five percent', 'Fifty parts', 'Half percent'],
    answer: 'Fifty percent',
    difficulty: 'bronze',
    explanation: '% = percent.'
  },
  {
    question: 'Which word means "milhão"?',
    options: ['Thousand', 'Million', 'Hundred', 'Billion'],
    answer: 'Million',
    difficulty: 'bronze',
    explanation: 'million = milhão.'
  },

  // --- PRATA (Médio) ---
  {
    question: 'How do you read the version "v2.0"?',
    options: ['Version twenty', 'Version two point zero', 'Version two oh', 'Two version'],
    answer: 'Version two point zero',
    difficulty: 'prata',
    explanation: 'v2.0 = version two point zero.'
  },
  {
    question: 'Which question fits the noun "memory"?',
    options: ['How many memory?', 'How much memory?', 'How memory much?', 'How count memory?'],
    answer: 'How much memory?',
    difficulty: 'prata',
    explanation: '"Memory" é incontável → "how much".'
  },
  {
    question: '"Mbps" stands for:',
    options: ['Megabytes per second', 'Megabits per second', 'Megabits per system', 'Mega bandwidth per second'],
    answer: 'Megabits per second',
    difficulty: 'prata',
    explanation: 'Mbps = megabits per second.'
  },
  {
    question: 'How do you read the resolution "1280 x 720"?',
    options: ['1280 times 720', '1280 by 720', '1280 over 720', '1280 plus 720'],
    answer: '1280 by 720',
    difficulty: 'prata',
    explanation: 'O "x" de dimensões é lido como "by".'
  },
  {
    question: 'Which sentence is correct?',
    options: ['There are much bugs.', 'There are several bugs.', 'There is several bugs.', 'There are much bug.'],
    answer: 'There are several bugs.',
    difficulty: 'prata',
    explanation: '"Bugs" é contável → "several" + plural.'
  },
  {
    question: 'The status code "404" is usually read as:',
    options: ['Four hundred forty', 'Forty-four', 'Four oh four', 'Four thousand four'],
    answer: 'Four oh four',
    difficulty: 'prata',
    explanation: 'Códigos são lidos dígito a dígito: "four oh four".'
  },
  {
    question: 'Order from smallest to largest:',
    options: ['GB, MB, KB, TB', 'KB, MB, GB, TB', 'TB, GB, MB, KB', 'MB, KB, GB, TB'],
    answer: 'KB, MB, GB, TB',
    difficulty: 'prata',
    explanation: 'KB < MB < GB < TB.'
  },
  {
    question: 'What does the lowercase "b" mean in "100 Mb"?',
    options: ['byte', 'bit', 'block', 'binary'],
    answer: 'bit',
    difficulty: 'prata',
    explanation: '"b" minúsculo = bit; "B" maiúsculo = byte.'
  },

  // --- OURO (Difícil) ---
  {
    question: 'A CPU at "3.2 GHz" is read as:',
    options: ['Three point two gigahertz', 'Thirty-two gigahertz', 'Three two gigahertz', 'Three point two gigabytes'],
    answer: 'Three point two gigahertz',
    difficulty: 'ouro',
    explanation: '3.2 GHz = three point two gigahertz.'
  },
  {
    question: 'Which value represents the lowest (best) latency?',
    options: ['200 ms', '20 ms', '2000 ms', '500 ms'],
    answer: '20 ms',
    difficulty: 'ouro',
    explanation: 'Latência menor é melhor: 20 ms.'
  },
  {
    question: 'Complete: "We don\'t have ____ storage left."',
    options: ['many', 'much', 'few', 'several'],
    answer: 'much',
    difficulty: 'ouro',
    explanation: '"Storage" é incontável → "much".'
  },
  {
    question: 'How do you correctly say a "16:9 aspect ratio"?',
    options: ['Sixteen nine ratio', 'A sixteen by nine aspect ratio', 'Sixteen over nine percent', 'Sixteen point nine ratio'],
    answer: 'A sixteen by nine aspect ratio',
    difficulty: 'ouro',
    explanation: 'Proporções usam "by": 16:9 = sixteen by nine.'
  },
  {
    question: 'How do you read "3.14"?',
    options: ['Three comma fourteen', 'Three point one four', 'Three point fourteen', 'Three dot fourteen'],
    answer: 'Three point one four',
    difficulty: 'ouro',
    explanation: 'Decimais: lê-se o ponto como "point" e os dígitos: "three point one four".'
  },
  {
    question: 'Which phrase fits an uncountable noun?',
    options: ['a few data', 'many data', 'a large amount of data', 'several data'],
    answer: 'a large amount of data',
    difficulty: 'ouro',
    explanation: '"Data" é incontável → "amount of", não "number of".'
  },
  {
    question: '"1,000,000" in English is:',
    options: ['One hundred thousand', 'One million', 'Ten thousand', 'One billion'],
    answer: 'One million',
    difficulty: 'ouro',
    explanation: '1,000,000 = one million.'
  }
];
