import { validateAcademicSelection } from './academicServices.js';
import { validateZipFileDescriptor } from './examServices.js';

export const MAX_ACTIVITY_TITLE_LENGTH = 160;
export const MAX_ACTIVITY_INSTRUCTIONS_LENGTH = 5000;

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function validateActivityDueAt(value, now = Date.now()) {
  const rawValue = value instanceof Date ? value : String(value ?? '').trim();
  if (!rawValue) throw new Error('Informe a data de entrega da atividade.');
  const dueAtMillis = rawValue instanceof Date ? rawValue.getTime() : new Date(rawValue).getTime();
  if (!Number.isFinite(dueAtMillis)) throw new Error('Informe uma data de entrega válida.');
  if (dueAtMillis <= Number(now)) throw new Error('A data de entrega deve estar no futuro.');
  return new Date(dueAtMillis).toISOString();
}

export function isActivityPastDue(activity = {}, now = Date.now()) {
  const dueAtMillis = Number(activity.dueAtMillis || 0);
  return dueAtMillis > 0 && Number(now) > dueAtMillis;
}

export function canSubmitActivity(activity = {}, now = Date.now()) {
  return activity.active === true && activity.deleted !== true && !isActivityPastDue(activity, now);
}

export function validateActivity(data = {}, classes = [], subjects = [], now = Date.now()) {
  const title = normalizeText(data.title);
  if (title.length < 3 || title.length > MAX_ACTIVITY_TITLE_LENGTH) {
    throw new Error(`O título da atividade deve ter entre 3 e ${MAX_ACTIVITY_TITLE_LENGTH} caracteres.`);
  }
  const instructions = String(data.instructions ?? '').trim();
  if (!instructions) throw new Error('Informe as orientações da atividade.');
  if (instructions.length > MAX_ACTIVITY_INSTRUCTIONS_LENGTH) {
    throw new Error(`As orientações devem ter no máximo ${MAX_ACTIVITY_INSTRUCTIONS_LENGTH.toLocaleString('pt-BR')} caracteres.`);
  }
  const academicSelection = validateAcademicSelection(data, classes, subjects);
  return {
    title,
    instructions,
    ...academicSelection,
    dueAt: validateActivityDueAt(data.dueAt, now)
  };
}



export function validateActivityResourceFile(file = {}) {
  const descriptor = validateZipFileDescriptor(file);
  return {
    ...descriptor,
    contentType: 'application/zip'
  };
}



export const ACTIVITY_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived'
});

export function getActivityStatus(activity = {}) {
  if (activity.deleted === true) return ACTIVITY_STATUSES.ARCHIVED;
  return activity.active === true ? ACTIVITY_STATUSES.ACTIVE : ACTIVITY_STATUSES.INACTIVE;
}
