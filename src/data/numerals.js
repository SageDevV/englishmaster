// Trilha: Numerals, Quantities and Units of Measurement in IT
// Perguntas (bronze/prata/ouro) para o topico, Modo Sobrevivente e Speedrun.
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
