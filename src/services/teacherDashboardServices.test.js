import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeacherStudentGroups,
  filterTeacherResults,
  getTeacherResultFilterOptions,
  getTeacherResultStudentKey
} from './teacherDashboardServices.js';

const classes = [
  { id: 'entra21', name: 'Entra21', nameKey: 'entra21' },
  { id: 'noturna', name: 'Turma Noturna', nameKey: 'turma noturna' }
];

const results = [
  {
    id: 'result-1',
    userId: 'student-1',
    firstName: 'Ana',
    lastName: 'Silva',
    userEmail: 'ana@example.com',
    classId: 'entra21',
    className: 'Entra21',
    subjectId: 'web',
    subjectName: 'Desenvolvimento Web'
  },
  {
    id: 'result-2',
    userId: 'student-2',
    firstName: 'Bruno',
    lastName: 'Souza',
    userEmail: 'bruno@example.com',
    classId: 'entra21',
    className: 'Entra21',
    subjectId: 'english',
    subjectName: 'Inglês'
  },
  {
    id: 'result-3',
    userId: 'student-3',
    firstName: 'Carla',
    lastName: 'Lima',
    userEmail: 'carla@example.com',
    classId: 'noturna',
    className: 'Turma Noturna',
    subjectId: 'web-noturna',
    subjectName: 'Desenvolvimento Web'
  }
];

describe('teacher student directory', () => {
  it('groups filled student profiles by class and sorts students by name', () => {
    const groups = buildTeacherStudentGroups([
      {
        id: 'student-2',
        email: 'fallback@example.com',
        studentProfile: {
          fullName: 'Bruno Souza',
          nickname: 'bruno_dev',
          classId: 'entra21',
          className: 'Entra21',
          courseGoal: 'Conseguir uma vaga como desenvolvedor.',
          email: 'bruno@example.com'
        }
      },
      {
        id: 'student-1',
        studentProfile: {
          fullName: 'Ana Silva',
          nickname: 'ana_dev',
          className: 'Entra21',
          courseGoal: 'Aprender desenvolvimento web.',
          email: 'ana@example.com'
        }
      },
      { id: 'without-profile', email: 'ignored@example.com' }
    ], classes);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].classId, 'entra21');
    assert.equal(groups[0].className, 'Entra21');
    assert.deepEqual(groups[0].students.map(student => student.fullName), ['Ana Silva', 'Bruno Souza']);
    assert.equal(groups[0].students[0].courseGoal, 'Aprender desenvolvimento web.');
  });

  it('keeps dynamic and legacy classes separated', () => {
    const groups = buildTeacherStudentGroups([
      {
        id: 'student-1',
        studentProfile: { fullName: 'Ana Silva', classId: 'noturna', className: 'Turma Noturna' }
      },
      {
        id: 'student-2',
        studentProfile: { fullName: 'Bruno Souza', className: 'Turma Antiga' }
      }
    ], classes);

    assert.deepEqual(groups.map(group => group.className), ['Turma Antiga', 'Turma Noturna']);
  });
});

describe('teacher result filters', () => {
  it('combines class, subject and student filters locally', () => {
    const studentKey = getTeacherResultStudentKey(results[0]);
    const filtered = filterTeacherResults(results, {
      classKey: 'id:entra21',
      subjectKey: 'id:web',
      studentKey
    });

    assert.deepEqual(filtered.map(result => result.id), ['result-1']);
  });

  it('limits subject and student options according to preceding filters', () => {
    const options = getTeacherResultFilterOptions(results, {
      classKey: 'id:entra21',
      subjectKey: 'id:english',
      studentKey: ''
    });

    assert.deepEqual(options.classes.map(option => option.label), ['Entra21', 'Turma Noturna']);
    assert.deepEqual(options.subjects.map(option => option.label), ['Desenvolvimento Web', 'Inglês']);
    assert.deepEqual(options.students.map(option => option.label), ['Bruno Souza']);
  });

  it('falls back to email when a legacy result has no user ID', () => {
    assert.equal(getTeacherResultStudentKey({ userEmail: ' ALUNO@EXAMPLE.COM ' }), 'email:aluno@example.com');
  });
});
