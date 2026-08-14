export const DEFAULT_ACADEMIC_CLASSES = Object.freeze([
  { id: 'entra21', name: 'Entra21', nameKey: 'entra21', builtin: true, active: true },
  { id: 'jovemprogramador', name: 'JovemProgramador', nameKey: 'jovemprogramador', builtin: true, active: true }
]);

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeAcademicKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function validateAcademicEntityName(value, label = 'Nome') {
  const name = normalizeText(value);
  if (name.length < 2 || name.length > 80) {
    throw new Error(`${label} deve ter entre 2 e 80 caracteres.`);
  }
  return { name, nameKey: normalizeAcademicKey(name) };
}

export function mergeAcademicClasses(records = []) {
  const byKey = new Map(DEFAULT_ACADEMIC_CLASSES.map(item => [item.nameKey, { ...item }]));
  records
    .filter(item => item && item.deleted !== true && item.active !== false)
    .forEach(item => {
      const name = normalizeText(item.name);
      const nameKey = item.nameKey || normalizeAcademicKey(name);
      if (name && nameKey) byKey.set(nameKey, { ...item, name, nameKey, active: true });
    });
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function getProfileClassId(profile = {}, classes = DEFAULT_ACADEMIC_CLASSES) {
  if (profile.classId) return String(profile.classId);
  const profileKey = normalizeAcademicKey(profile.className);
  return classes.find(item => item.nameKey === profileKey)?.id || '';
}

function findActive(items, id, label) {
  const item = (items || []).find(candidate => candidate.id === String(id || '')
    && candidate.deleted !== true
    && candidate.active !== false);
  if (!item) throw new Error(`Selecione ${label}.`);
  return item;
}

export function getSubjectsForClass(subjects = [], classId = '') {
  return subjects.filter(subject => subject.classId === String(classId || '')
    && subject.deleted !== true
    && subject.active !== false);
}

export function validateAcademicSelection(data = {}, classes = [], subjects = []) {
  const academicClass = findActive(classes, data.classId, 'uma turma válida');
  const subject = findActive(subjects, data.subjectId, 'uma matéria válida');
  if (subject.classId !== academicClass.id) {
    throw new Error('A matéria selecionada não pertence à turma informada.');
  }
  return {
    classId: academicClass.id,
    className: academicClass.name,
    subjectId: subject.id,
    subjectName: subject.name
  };
}

export function validateStudyReference(data = {}, classes = [], subjects = []) {
  const title = normalizeText(data.title);
  if (title.length < 3 || title.length > 160) {
    throw new Error('Título deve ter entre 3 e 160 caracteres.');
  }
  const description = normalizeText(data.description);
  if (description.length > 1000) throw new Error('Descrição deve ter no máximo 1.000 caracteres.');
  const url = normalizeText(data.url);
  if (url.length > 2048) throw new Error('O link da referência é muito longo.');
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Informe um link válido para a referência.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('O link deve usar http ou https.');
  }
  return {
    title,
    description,
    url: parsedUrl.toString(),
    ...validateAcademicSelection(data, classes, subjects)
  };
}
