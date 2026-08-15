export const NEWSLETTER_SOURCES = [
  {
    id: 'devto',
    name: 'DEV Community',
    kind: 'Comunidade de artigos',
    description: 'Conteúdo escrito por desenvolvedores sobre linguagens, carreira e boas práticas.',
    url: 'https://dev.to/'
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    kind: 'Fórum de tecnologia',
    description: 'Discussões da comunidade sobre engenharia, startups e o ecossistema de software.',
    url: 'https://news.ycombinator.com/'
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    kind: 'Fórum técnico',
    description: 'Perguntas em destaque e soluções práticas compartilhadas entre desenvolvedores.',
    url: 'https://stackoverflow.com/questions'
  }
];

export const NEWSLETTER_CATEGORIES = ['Todos', 'Web', 'IA', 'DevOps', 'Mobile', 'Segurança', 'Dados', 'Carreira', 'Geral'];

const CATEGORY_TERMS = [
  ['IA', ['artificial intelligence', 'machine learning', 'machine-learning', 'deep learning', 'llm', 'generative ai', 'openai', 'chatgpt', 'tensorflow', 'pytorch']],
  ['Segurança', ['security', 'cybersecurity', 'vulnerability', 'malware', 'privacy', 'authentication', 'oauth', 'cryptography']],
  ['DevOps', ['devops', 'docker', 'kubernetes', 'cloud', 'aws', 'azure', 'gcp', 'terraform', 'linux', 'ci/cd', 'sre']],
  ['Mobile', ['mobile', 'android', 'ios', 'flutter', 'react native', 'react-native', 'swift', 'kotlin']],
  ['Dados', ['database', 'data engineering', 'data science', 'sql', 'postgres', 'mysql', 'mongodb', 'redis', 'analytics']],
  ['Web', ['web', 'javascript', 'typescript', 'react', 'vue', 'angular', 'css', 'html', 'frontend', 'backend', 'node.js', 'nodejs', 'deno', 'bun']],
  ['Carreira', ['career', 'jobs', 'hiring', 'interview', 'productivity', 'leadership', 'developer experience', 'open source']]
];

function decodeHtml(value = '') {
  const namedEntities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+|#39);/gi, (entity, name) => namedEntities[name.toLowerCase()] ?? entity);
}

function normalizeText(value = '') {
  return String(value)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(tag => String(tag).trim()).filter(Boolean);
  return String(tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
}

export function inferNewsletterCategory({ title = '', summary = '', tags = [] } = {}) {
  const haystack = normalizeText([title, summary, ...normalizeTags(tags)].join(' '));
  const category = CATEGORY_TERMS.find(([, terms]) => terms.some(term => haystack.includes(normalizeText(term))));
  return category?.[0] || 'Geral';
}

function createNewsletterItem({ id, sourceId, sourceName, title, summary, url, author, publishedAt, tags, score, comments }) {
  const normalizedTags = normalizeTags(tags).slice(0, 5);
  const item = {
    id: `${sourceId}-${id}`,
    sourceId,
    sourceName,
    title: decodeHtml(title).trim(),
    summary: decodeHtml(summary).replace(/<[^>]*>/g, '').trim(),
    url: String(url || ''),
    author: decodeHtml(author || 'Comunidade').trim(),
    publishedAt: new Date(publishedAt).toISOString(),
    tags: normalizedTags,
    score: Math.max(0, Number(score || 0)),
    comments: Math.max(0, Number(comments || 0))
  };
  item.category = inferNewsletterCategory(item);
  return item;
}

export function normalizeDevToArticle(article) {
  return createNewsletterItem({
    id: article.id,
    sourceId: 'devto',
    sourceName: 'DEV Community',
    title: article.title,
    summary: article.description || 'Artigo publicado pela comunidade DEV.',
    url: article.url,
    author: article.user?.name || article.user?.username,
    publishedAt: article.published_at || article.created_at,
    tags: article.tag_list,
    score: article.public_reactions_count,
    comments: article.comments_count
  });
}

export function normalizeHackerNewsStory(story) {
  const storyUrl = story.url || `https://news.ycombinator.com/item?id=${encodeURIComponent(story.objectID)}`;
  return createNewsletterItem({
    id: story.objectID,
    sourceId: 'hackernews',
    sourceName: 'Hacker News',
    title: story.title || story.story_title,
    summary: 'Notícia em discussão pela comunidade do Hacker News.',
    url: storyUrl,
    author: story.author,
    publishedAt: story.created_at,
    tags: ['technology', 'community'],
    score: story.points,
    comments: story.num_comments
  });
}

export function normalizeStackOverflowQuestion(question) {
  return createNewsletterItem({
    id: question.question_id,
    sourceId: 'stackoverflow',
    sourceName: 'Stack Overflow',
    title: question.title,
    summary: question.is_answered
      ? 'Pergunta em destaque com resposta aceita ou validada pela comunidade.'
      : 'Pergunta técnica em destaque aguardando novas contribuições.',
    url: question.link,
    author: question.owner?.display_name,
    publishedAt: Number(question.creation_date) * 1000,
    tags: question.tags,
    score: question.score,
    comments: question.answer_count
  });
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function loadDeveloperNews({ fetchImpl = globalThis.fetch, perSource = 8, timeoutMs = 8000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Cliente HTTP indisponível.');
  const pageSize = Math.max(1, Math.min(20, Number(perSource) || 8));
  const requests = [
    {
      source: NEWSLETTER_SOURCES[0],
      load: async () => {
        const data = await fetchJson(`https://dev.to/api/articles?per_page=${pageSize}&top=7`, fetchImpl, timeoutMs);
        return data.map(normalizeDevToArticle);
      }
    },
    {
      source: NEWSLETTER_SOURCES[1],
      load: async () => {
        const data = await fetchJson(`https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${pageSize}`, fetchImpl, timeoutMs);
        return (data.hits || []).filter(item => item.title || item.story_title).map(normalizeHackerNewsStory);
      }
    },
    {
      source: NEWSLETTER_SOURCES[2],
      load: async () => {
        const data = await fetchJson(`https://api.stackexchange.com/2.3/questions?pagesize=${pageSize}&order=desc&sort=hot&site=stackoverflow&filter=default`, fetchImpl, timeoutMs);
        return (data.items || []).map(normalizeStackOverflowQuestion);
      }
    }
  ];
  const settled = await Promise.allSettled(requests.map(request => request.load()));
  const errors = [];
  const items = settled.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    errors.push({ sourceId: requests[index].source.id, sourceName: requests[index].source.name });
    return [];
  });
  return {
    items: items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    errors,
    loadedAt: new Date().toISOString()
  };
}

export function filterNewsletterItems(items, { search = '', source = 'all', category = 'Todos', sort = 'recent' } = {}) {
  const searchKey = normalizeText(search);
  const filtered = (items || []).filter(item => {
    const matchesSource = source === 'all' || item.sourceId === source;
    const matchesCategory = category === 'Todos' || item.category === category;
    const haystack = normalizeText([item.title, item.summary, item.author, ...(item.tags || [])].join(' '));
    return matchesSource && matchesCategory && (!searchKey || haystack.includes(searchKey));
  });
  return filtered.sort((a, b) => sort === 'popular'
    ? ((b.score + b.comments) - (a.score + a.comments))
    : (new Date(b.publishedAt) - new Date(a.publishedAt)));
}
