import { validateNickname } from './gameServices.js';

export const STUDENT_CLASSES = ['Entra21', 'JovemProgramador'];

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function validateLength(value, field, min, max) {
  const normalized = normalizeText(value);
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return normalized;
}

export function validateStudentProfile(data = {}) {
  const fullName = validateLength(data.fullName, 'Nome do aluno', 3, 120);
  if (fullName.split(' ').filter(Boolean).length < 2) {
    throw new Error('Informe o nome e o sobrenome do aluno.');
  }

  const nicknameValidation = validateNickname(data.nickname);
  if (!nicknameValidation.isValid) {
    throw new Error(nicknameValidation.message);
  }

  const className = normalizeText(data.className);
  if (!STUDENT_CLASSES.includes(className)) {
    throw new Error('Selecione uma turma válida.');
  }

  const courseGoal = validateLength(data.courseGoal, 'Objetivo com o curso', 10, 1000);
  const email = normalizeText(data.email).toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe um e-mail válido.');
  }

  return {
    fullName,
    nickname: nicknameValidation.nickname,
    nicknameKey: nicknameValidation.nicknameKey,
    className,
    courseGoal,
    email
  };
}

export function isStudentProfileComplete(profile) {
  try {
    validateStudentProfile(profile);
    return true;
  } catch {
    return false;
  }
}

export function splitStudentFullName(fullName) {
  const parts = normalizeText(fullName).split(' ').filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ')
  };
}
