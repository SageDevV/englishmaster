import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStudentProfileComplete,
  splitStudentFullName,
  STUDENT_CLASSES,
  validateStudentProfile
} from './studentProfileServices.js';

const validProfile = {
  fullName: '  Ana   Maria Silva ',
  nickname: ' Ana_dev ',
  className: 'Entra21',
  courseGoal: 'Conseguir meu primeiro trabalho em tecnologia.',
  email: ' ANA@EXAMPLE.COM '
};

describe('student profile validation', () => {
  it('normalizes a complete profile and migrates its class ID', () => {
    const profile = validateStudentProfile(validProfile);

    assert.equal(profile.fullName, 'Ana Maria Silva');
    assert.equal(profile.nickname, 'Ana_dev');
    assert.equal(profile.nicknameKey, 'ana_dev');
    assert.equal(profile.email, 'ana@example.com');
    assert.equal(profile.className, STUDENT_CLASSES[0]);
    assert.equal(profile.classId, 'entra21');
    assert.equal(isStudentProfileComplete(profile), true);
  });

  it('preserves a dynamic class ID', () => {
    const profile = validateStudentProfile({
      ...validProfile,
      classId: 'custom-class',
      className: 'Turma Noturna'
    });
    assert.equal(profile.classId, 'custom-class');
    assert.equal(profile.className, 'Turma Noturna');
  });

  it('rejects incomplete names, missing classes, short goals and invalid emails', () => {
    assert.throws(() => validateStudentProfile({ ...validProfile, fullName: 'Ana' }), /nome e o sobrenome/);
    assert.throws(() => validateStudentProfile({ ...validProfile, className: '' }), /Turma deve ter/);
    assert.throws(() => validateStudentProfile({ ...validProfile, courseGoal: 'Aprender' }), /entre 10 e 1000/);
    assert.throws(() => validateStudentProfile({ ...validProfile, email: 'invalid' }), /e-mail válido/);
    assert.equal(isStudentProfileComplete({}), false);
  });

  it('splits the full name for exam identification', () => {
    assert.deepEqual(splitStudentFullName('Ana Maria Silva'), {
      firstName: 'Ana',
      lastName: 'Maria Silva'
    });
  });
});
