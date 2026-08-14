import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACADEMIC_CLASSES,
  getProfileClassId,
  getSubjectsForClass,
  mergeAcademicClasses,
  normalizeAcademicKey,
  validateAcademicEntityName,
  validateAcademicSelection,
  validateStudyReference
} from './academicServices.js';

const subjects = [{
  id: 'subject-1',
  name: 'Desenvolvimento Web',
  classId: 'entra21',
  className: 'Entra21',
  active: true
}];

describe('academic model', () => {
  it('normalizes names and preserves default classes', () => {
    assert.equal(normalizeAcademicKey('  Programação   Web '), 'programacao web');
    assert.deepEqual(validateAcademicEntityName('  Turma Noturna ', 'Turma'), {
      name: 'Turma Noturna',
      nameKey: 'turma noturna'
    });
    const classes = mergeAcademicClasses([{ id: 'custom', name: 'Turma Noturna', active: true }]);
    assert.equal(classes.some(item => item.id === 'entra21'), true);
    assert.equal(classes.some(item => item.id === 'jovemprogramador'), true);
    assert.equal(classes.some(item => item.id === 'custom'), true);
  });

  it('maps legacy profiles to their default class IDs', () => {
    assert.equal(getProfileClassId({ className: 'Entra21' }), 'entra21');
    assert.equal(getProfileClassId({ classId: 'custom', className: 'Outra' }), 'custom');
  });

  it('validates class and subject selections', () => {
    const result = validateAcademicSelection(
      { classId: 'entra21', subjectId: 'subject-1' },
      DEFAULT_ACADEMIC_CLASSES,
      subjects
    );
    assert.equal(result.className, 'Entra21');
    assert.equal(result.subjectName, 'Desenvolvimento Web');
    assert.deepEqual(getSubjectsForClass(subjects, 'entra21').map(item => item.id), ['subject-1']);
    assert.equal(getSubjectsForClass(subjects, 'jovemprogramador').length, 0);
    assert.throws(
      () => validateAcademicSelection(
        { classId: 'jovemprogramador', subjectId: 'subject-1' },
        DEFAULT_ACADEMIC_CLASSES,
        subjects
      ),
      /não pertence à turma/
    );
    assert.throws(
      () => validateAcademicSelection({ classId: 'missing', subjectId: 'subject-1' }, DEFAULT_ACADEMIC_CLASSES, subjects),
      /turma válida/
    );
  });

  it('validates and normalizes study references', () => {
    const reference = validateStudyReference({
      title: '  Guia de JavaScript ',
      description: ' Material de revisão ',
      url: 'https://developer.mozilla.org/pt-BR/docs/Web/JavaScript',
      classId: 'entra21',
      subjectId: 'subject-1'
    }, DEFAULT_ACADEMIC_CLASSES, subjects);
    assert.equal(reference.title, 'Guia de JavaScript');
    assert.equal(reference.className, 'Entra21');
    assert.equal(reference.subjectName, 'Desenvolvimento Web');
    assert.throws(
      () => validateStudyReference({ ...reference, url: 'javascript:alert(1)' }, DEFAULT_ACADEMIC_CLASSES, subjects),
      /http ou https/
    );
  });
});
