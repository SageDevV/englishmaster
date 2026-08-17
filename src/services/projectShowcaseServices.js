export const MAX_PROJECT_TITLE_LENGTH = 120;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 1200;
export const MAX_PROJECT_URL_LENGTH = 2048;
export const MAX_PROJECT_TECHNOLOGIES = 8;
export const MAX_PROJECT_TECHNOLOGY_LENGTH = 30;

function normalizeSingleLine(value) {
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

function normalizeSearchText(value) {
  return normalizeSingleLine(value)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function validateProjectUrl(value, label, required = false) {
  const url = normalizeSingleLine(value);
  if (!url) {
    if (required) throw new Error(`Informe ${label}.`);
    return '';
  }
  if (url.length > MAX_PROJECT_URL_LENGTH) throw new Error(`${label} é muito longo.`);
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Informe ${label} válido.`);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`${label} deve usar http ou https.`);
  }
  return parsedUrl.toString();
}

export function normalizeProjectTechnologies(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  const technologies = [];
  values.forEach(item => {
    const technology = normalizeSingleLine(item);
    if (!technology) return;
    if (technology.length > MAX_PROJECT_TECHNOLOGY_LENGTH) {
      throw new Error(`Cada tecnologia deve ter no máximo ${MAX_PROJECT_TECHNOLOGY_LENGTH} caracteres.`);
    }
    if (!technologies.some(current => current.toLocaleLowerCase('pt-BR') === technology.toLocaleLowerCase('pt-BR'))) {
      technologies.push(technology);
    }
  });
  if (!technologies.length) throw new Error('Informe pelo menos uma tecnologia utilizada.');
  if (technologies.length > MAX_PROJECT_TECHNOLOGIES) {
    throw new Error(`Informe no máximo ${MAX_PROJECT_TECHNOLOGIES} tecnologias.`);
  }
  return technologies;
}

export function validateProjectSubmission(data = {}) {
  const title = normalizeSingleLine(data.title);
  if (title.length < 3 || title.length > MAX_PROJECT_TITLE_LENGTH) {
    throw new Error(`O título deve ter entre 3 e ${MAX_PROJECT_TITLE_LENGTH} caracteres.`);
  }
  const description = normalizeMultiline(data.description);
  if (description.length < 20 || description.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
    throw new Error(`A descrição deve ter entre 20 e ${MAX_PROJECT_DESCRIPTION_LENGTH.toLocaleString('pt-BR')} caracteres.`);
  }
  const projectUrl = validateProjectUrl(data.projectUrl, 'o link do projeto');
  const repositoryUrl = validateProjectUrl(data.repositoryUrl, 'o link do repositório');
  if (!projectUrl && !repositoryUrl) {
    throw new Error('Informe o link do projeto ou do repositório.');
  }
  return {
    title,
    description,
    projectUrl,
    repositoryUrl,
    technologies: normalizeProjectTechnologies(data.technologies)
  };
}

export function filterProjectShowcase(projects = [], { search = '', technology = 'Todos', sort = 'recent' } = {}) {
  const searchKey = normalizeSearchText(search);
  return projects
    .filter(project => {
      if (project.active === false || project.deleted === true) return false;
      if (technology !== 'Todos' && !(project.technologies || []).includes(technology)) return false;
      if (!searchKey) return true;
      const haystack = normalizeSearchText([
        project.title,
        project.description,
        project.authorName,
        project.authorClassName,
        ...(project.technologies || [])
      ].join(' '));
      return haystack.includes(searchKey);
    })
    .sort((a, b) => sort === 'title'
      ? String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
      : Number(b.createdAtMillis || b.updatedAtMillis || 0) - Number(a.createdAtMillis || a.updatedAtMillis || 0));
}

export function getProjectTechnologyOptions(projects = []) {
  return [...new Set(projects
    .filter(project => project.active !== false && project.deleted !== true)
    .flatMap(project => project.technologies || []))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
