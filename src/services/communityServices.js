import { validateAcademicSelection } from './academicServices.js';

export const MAX_COMMUNITY_POST_TITLE_LENGTH = 160;
export const MAX_COMMUNITY_POST_CONTENT_LENGTH = 5000;
export const MAX_COMMUNITY_POST_URL_LENGTH = 2048;

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeMultiline(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .trim();
}

function validateOptionalUrl(value) {
  const url = normalizeText(value);
  if (!url) return '';
  if (url.length > MAX_COMMUNITY_POST_URL_LENGTH) {
    throw new Error('O link do post é muito longo.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Informe um link válido para o post.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('O link deve usar http ou https.');
  }
  return parsedUrl.toString();
}

export function validateCommunityPost(data = {}, classes = [], subjects = []) {
  const title = normalizeText(data.title);
  if (title.length < 3 || title.length > MAX_COMMUNITY_POST_TITLE_LENGTH) {
    throw new Error(`O título deve ter entre 3 e ${MAX_COMMUNITY_POST_TITLE_LENGTH} caracteres.`);
  }
  const content = normalizeMultiline(data.content);
  if (content.length < 3 || content.length > MAX_COMMUNITY_POST_CONTENT_LENGTH) {
    throw new Error(`O conteúdo deve ter entre 3 e ${MAX_COMMUNITY_POST_CONTENT_LENGTH.toLocaleString('pt-BR')} caracteres.`);
  }
  return {
    title,
    content,
    url: validateOptionalUrl(data.url),
    ...validateAcademicSelection(data, classes, subjects)
  };
}

export function filterCommunityPosts(posts = [], { classId = '', subjectId = '' } = {}) {
  return posts.filter(post => {
    if (classId && post.classId !== classId) return false;
    if (subjectId && post.subjectId !== subjectId) return false;
    return post.active !== false && post.deleted !== true;
  });
}
