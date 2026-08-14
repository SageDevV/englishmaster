import { getProfileClassId, normalizeAcademicKey } from './academicServices.js';

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function compareLabels(left, right) {
  return normalizeText(left).localeCompare(normalizeText(right), 'pt-BR', { sensitivity: 'base' });
}

function toMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAcademicFilterKey(id, name) {
  const normalizedId = normalizeText(id);
  if (normalizedId) return `id:${normalizedId}`;
  const normalizedName = normalizeAcademicKey(name);
  return normalizedName ? `name:${normalizedName}` : '';
}

function matchesAcademicFilter(result, filterValue, idField, nameField) {
  if (!filterValue) return true;
  return getAcademicFilterKey(result?.[idField], result?.[nameField]) === filterValue;
}

function uniqueOptions(items, getValue, getLabel) {
  const options = new Map();
  items.forEach(item => {
    const value = getValue(item);
    const label = normalizeText(getLabel(item));
    if (value && label && !options.has(value)) options.set(value, { value, label });
  });
  return [...options.values()].sort((a, b) => compareLabels(a.label, b.label));
}

export function getTeacherResultStudentKey(result = {}) {
  const userId = normalizeText(result.userId);
  if (userId) return `uid:${userId}`;
  const email = normalizeText(result.userEmail).toLowerCase();
  if (email) return `email:${email}`;
  const fullName = normalizeAcademicKey(`${result.firstName || ''} ${result.lastName || ''}`);
  return fullName ? `name:${fullName}` : '';
}

export function filterTeacherResults(results = [], filters = {}) {
  return results.filter(result => {
    if (!matchesAcademicFilter(result, filters.classKey, 'classId', 'className')) return false;
    if (!matchesAcademicFilter(result, filters.subjectKey, 'subjectId', 'subjectName')) return false;
    if (filters.studentKey && getTeacherResultStudentKey(result) !== filters.studentKey) return false;
    return true;
  });
}

export function getTeacherResultFilterOptions(results = [], filters = {}) {
  const classes = uniqueOptions(
    results,
    result => getAcademicFilterKey(result.classId, result.className),
    result => result.className || 'Turma não informada'
  );
  const classScoped = filterTeacherResults(results, {
    classKey: filters.classKey,
    subjectKey: '',
    studentKey: ''
  });
  const subjects = uniqueOptions(
    classScoped,
    result => getAcademicFilterKey(result.subjectId, result.subjectName),
    result => result.subjectName || 'Matéria não informada'
  );
  const subjectScoped = filterTeacherResults(classScoped, {
    classKey: '',
    subjectKey: filters.subjectKey,
    studentKey: ''
  });
  const students = uniqueOptions(
    subjectScoped,
    getTeacherResultStudentKey,
    result => normalizeText(`${result.firstName || ''} ${result.lastName || ''}`) || result.userEmail || 'Aluno não identificado'
  );
  return { classes, subjects, students };
}

export function buildTeacherStudentGroups(records = [], classes = []) {
  const classesById = new Map((classes || []).map(item => [String(item.id || ''), item]));
  const groups = new Map();

  records.forEach(record => {
    const profile = record?.studentProfile;
    if (!profile || typeof profile !== 'object') return;

    const fullName = normalizeText(profile.fullName);
    const classId = getProfileClassId(profile, classes);
    const classRecord = classesById.get(classId);
    const className = normalizeText(profile.className || classRecord?.name);
    if (!fullName || (!classId && !className)) return;

    const groupKey = classId || `legacy:${normalizeAcademicKey(className)}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        classId,
        className: className || 'Turma não informada',
        students: []
      });
    }

    groups.get(groupKey).students.push({
      id: normalizeText(record.id),
      fullName,
      nickname: normalizeText(profile.nickname || record.nickname),
      classId,
      className: className || 'Turma não informada',
      courseGoal: normalizeText(profile.courseGoal),
      email: normalizeText(profile.email || record.email).toLowerCase(),
      updatedAtMillis: toMillis(profile.updatedAt) || toMillis(record.updatedAt)
    });
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      students: group.students.sort((a, b) => compareLabels(a.fullName, b.fullName))
    }))
    .sort((a, b) => compareLabels(a.className, b.className));
}
