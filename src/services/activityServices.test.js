import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ACADEMIC_CLASSES } from './academicServices.js';
import {
  ACTIVITY_STATUSES,
  canSubmitActivity,
  getActivityStatus,
  isActivityPastDue,
  MAX_ACTIVITY_INSTRUCTIONS_LENGTH,
  validateActivity,
  validateActivityDueAt,
  validateActivityResourceFile
} from './activityServices.js';

const subjects = [{
  id: 'subject-1',
  name: 'Desenvolvimento Web',
  classId: 'entra21',
  className: 'Entra21',
  active: true
}];

describe('activity validation', () => {
  it('normalizes and links an activity to its class and subject', () => {
    const now = new Date('2030-01-10T10:00:00.000Z').getTime();
    const activity = validateActivity({
      title: '  Projeto   final ',
      instructions: 'Compacte o repositório e envie em ZIP.',
      classId: 'entra21',
      subjectId: 'subject-1',
      dueAt: '2030-01-12T18:00:00.000Z'
    }, DEFAULT_ACADEMIC_CLASSES, subjects, now);
    assert.equal(activity.title, 'Projeto final');
    assert.equal(activity.className, 'Entra21');
    assert.equal(activity.subjectName, 'Desenvolvimento Web');
    assert.equal(activity.dueAt, '2030-01-12T18:00:00.000Z');
  });

  it('requires title, instructions and a subject from the selected class', () => {
    assert.throws(
      () => validateActivity({ title: 'A', instructions: 'Faça.', classId: 'entra21', subjectId: 'subject-1' }, DEFAULT_ACADEMIC_CLASSES, subjects),
      /título da atividade/
    );
    assert.throws(
      () => validateActivity({ title: 'Projeto', instructions: '', classId: 'entra21', subjectId: 'subject-1' }, DEFAULT_ACADEMIC_CLASSES, subjects),
      /orientações/
    );
    assert.throws(
      () => validateActivity({ title: 'Projeto', instructions: 'x'.repeat(MAX_ACTIVITY_INSTRUCTIONS_LENGTH + 1), classId: 'entra21', subjectId: 'subject-1' }, DEFAULT_ACADEMIC_CLASSES, subjects),
      /no máximo/
    );
    assert.throws(
      () => validateActivity({ title: 'Projeto', instructions: 'Faça.', classId: 'jovemprogramador', subjectId: 'subject-1' }, DEFAULT_ACADEMIC_CLASSES, subjects),
      /não pertence à turma/
    );
  });

  it('requires a valid future delivery date', () => {
    const now = new Date('2030-01-10T10:00:00.000Z').getTime();
    assert.throws(
      () => validateActivity({
        title: 'Projeto',
        instructions: 'Faça.',
        classId: 'entra21',
        subjectId: 'subject-1'
      }, DEFAULT_ACADEMIC_CLASSES, subjects, now),
      /data de entrega/
    );
    assert.throws(() => validateActivityDueAt('', now), /data de entrega/);
    assert.throws(() => validateActivityDueAt('invalid', now), /válida/);
    assert.throws(() => validateActivityDueAt('2030-01-10T09:59:59.000Z', now), /futuro/);
    assert.equal(validateActivityDueAt('2030-01-10T10:01:00.000Z', now), '2030-01-10T10:01:00.000Z');
  });
});



describe('activity support resource', () => {
  it('accepts a ZIP resource within the size limit', () => {
    assert.deepEqual(validateActivityResourceFile({ name: 'starter-kit.ZIP', size: 2048 }), {
      name: 'starter-kit.ZIP',
      size: 2048,
      contentType: 'application/zip'
    });
  });

  it('rejects empty, oversized and non-ZIP resources', () => {
    assert.throws(() => validateActivityResourceFile({ name: 'material.pdf', size: 2048 }), /extensão \.zip/);
    assert.throws(() => validateActivityResourceFile({ name: 'material.zip', size: 0 }), /vazio/);
    assert.throws(() => validateActivityResourceFile({ name: 'material.zip', size: 6 * 1024 * 1024 }), /máximo 5 MB/);
  });
});


describe('activity status', () => {
  it('distinguishes active and reversibly inactive activities', () => {
    assert.equal(getActivityStatus({ active: true, deleted: false }), ACTIVITY_STATUSES.ACTIVE);
    assert.equal(getActivityStatus({ active: false, deleted: false }), ACTIVITY_STATUSES.INACTIVE);
  });

  it('prioritizes the archived state over the active flag', () => {
    assert.equal(getActivityStatus({ active: true, deleted: true }), ACTIVITY_STATUSES.ARCHIVED);
    assert.equal(getActivityStatus({ active: false, deleted: true }), ACTIVITY_STATUSES.ARCHIVED);
  });
});

describe('activity delivery deadline', () => {
  const deadline = new Date('2030-01-12T18:00:00.000Z').getTime();

  it('accepts deliveries through the deadline and blocks them afterwards', () => {
    const activity = { active: true, deleted: false, dueAtMillis: deadline };
    assert.equal(isActivityPastDue(activity, deadline), false);
    assert.equal(canSubmitActivity(activity, deadline), true);
    assert.equal(isActivityPastDue(activity, deadline + 1), true);
    assert.equal(canSubmitActivity(activity, deadline + 1), false);
  });

  it('keeps legacy activities without a deadline compatible and respects activity status', () => {
    assert.equal(canSubmitActivity({ active: true, deleted: false }, deadline + 1), true);
    assert.equal(canSubmitActivity({ active: false, deleted: false, dueAtMillis: deadline }, deadline - 1), false);
    assert.equal(canSubmitActivity({ active: true, deleted: true, dueAtMillis: deadline }, deadline - 1), false);
  });
});
