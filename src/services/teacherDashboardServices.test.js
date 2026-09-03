import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeacherActivityGroups,
  buildTeacherExamResultGroups,
  buildTeacherPerformanceDashboard,
  buildTeacherStudentGroups,
  filterTeacherResults,
  getTeacherPerformanceFilterOptions,
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



describe('teacher performance dashboard', () => {
  const studentRecords = [
    {
      id: 'student-1',
      studentProfile: {
        fullName: 'Ana Silva',
        classId: 'entra21',
        className: 'Entra21',
        email: 'ana@example.com'
      }
    },
    {
      id: 'student-2',
      studentProfile: {
        fullName: 'Bruno Souza',
        classId: 'entra21',
        className: 'Entra21',
        email: 'bruno@example.com'
      }
    }
  ];
  const performanceResults = [
    {
      id: 'result-1',
      examId: 'exam-1',
      examTitle: 'Avaliação inicial',
      userId: 'student-1',
      firstName: 'Ana',
      lastName: 'Silva',
      classId: 'entra21',
      className: 'Entra21',
      subjectId: 'web',
      subjectName: 'Desenvolvimento Web',
      finalPercentage: 50,
      finalGradeReady: true,
      submittedAtMillis: 1000,
      feedback: [
        { questionId: 'q1', prompt: 'O que é HTTP?', isCorrect: false },
        { questionId: 'q2', prompt: 'O que é CSS?', isCorrect: true }
      ]
    },
    {
      id: 'result-2',
      examId: 'exam-2',
      examTitle: 'Avaliação final',
      userId: 'student-1',
      firstName: 'Ana',
      lastName: 'Silva',
      classId: 'entra21',
      className: 'Entra21',
      subjectId: 'web',
      subjectName: 'Desenvolvimento Web',
      finalPercentage: 100,
      finalGradeReady: true,
      submittedAtMillis: 3000,
      feedback: [{ questionId: 'q3', prompt: 'Explique uma API REST.', isCorrect: true }]
    },
    {
      id: 'result-3',
      examId: 'exam-1',
      examTitle: 'Avaliação inicial',
      userId: 'student-2',
      firstName: 'Bruno',
      lastName: 'Souza',
      classId: 'entra21',
      className: 'Entra21',
      subjectId: 'web',
      subjectName: 'Desenvolvimento Web',
      finalPercentage: 0,
      finalGradeReady: true,
      submittedAtMillis: 2000,
      feedback: [
        { questionId: 'q1', prompt: 'O que é HTTP?', isCorrect: false },
        { questionId: 'q2', prompt: 'O que é CSS?', isCorrect: false },
        { questionId: 'zip', prompt: 'Envie o projeto.', isCorrect: null }
      ]
    },
    {
      id: 'pending-review',
      examId: 'exam-3',
      examTitle: 'Dissertativa',
      userId: 'student-2',
      classId: 'entra21',
      className: 'Entra21',
      subjectId: 'web',
      subjectName: 'Desenvolvimento Web',
      percentage: 100,
      essayQuestionCount: 1,
      finalGradeReady: false,
      submittedAtMillis: 4000,
      feedback: [{ questionId: 'essay', prompt: 'Explique HTTP.', isCorrect: null }]
    }
  ];
  const activities = [
    {
      id: 'activity-1',
      title: 'Projeto HTTP',
      classId: 'entra21',
      className: 'Entra21',
      subjectId: 'web',
      subjectName: 'Desenvolvimento Web',
      active: true,
      deleted: false,
      submissions: [{ userId: 'student-1', userEmail: 'ana@example.com' }]
    },
    {
      id: 'archived',
      title: 'Atividade antiga',
      classId: 'entra21',
      className: 'Entra21',
      subjectId: 'web',
      subjectName: 'Desenvolvimento Web',
      active: false,
      deleted: true,
      submissions: []
    }
  ];

  it('calculates evolution, academic averages, error topics, pending work and exam comparison', () => {
    const dashboard = buildTeacherPerformanceDashboard({
      results: performanceResults,
      studentRecords,
      classes,
      activities
    });

    assert.equal(dashboard.summary.average, 50);
    assert.equal(dashboard.summary.gradedAttempts, 3);
    assert.equal(dashboard.summary.studentsWithResults, 2);
    assert.equal(dashboard.summary.pendingDeliveries, 1);

    const ana = dashboard.studentEvolution.find(student => student.studentName === 'Ana Silva');
    assert.equal(ana.firstPercentage, 50);
    assert.equal(ana.latestPercentage, 100);
    assert.equal(ana.delta, 50);
    assert.equal(ana.trend, 'up');

    assert.equal(dashboard.classSubjectAverages[0].average, 50);
    assert.equal(dashboard.classSubjectAverages[0].attempts, 3);
    assert.equal(dashboard.errorTopics[0].prompt, 'O que é HTTP?');
    assert.equal(dashboard.errorTopics[0].errorRate, 100);
    assert.equal(dashboard.pendingActivities[0].pendingCount, 1);
    assert.deepEqual(dashboard.pendingActivities[0].pendingStudents, ['Bruno Souza']);
    assert.deepEqual(dashboard.examComparison.map(exam => exam.average), [25, 100]);
  });

  it('filters all indicators by class and subject and exposes matching options', () => {
    const options = getTeacherPerformanceFilterOptions(performanceResults, activities, {
      classKey: 'id:entra21'
    });
    assert.deepEqual(options.classes.map(option => option.label), ['Entra21']);
    assert.deepEqual(options.subjects.map(option => option.label), ['Desenvolvimento Web']);

    const dashboard = buildTeacherPerformanceDashboard({
      results: performanceResults,
      studentRecords,
      classes,
      activities,
      filters: { classKey: 'id:noturna', subjectKey: '' }
    });
    assert.equal(dashboard.summary.gradedAttempts, 0);
    assert.equal(dashboard.pendingActivities.length, 0);
    assert.equal(dashboard.errorTopics.length, 0);
  });
});


describe('grouped teacher views', () => {
  const studentRecords = [
    { id: 'student-1', studentProfile: { fullName: 'Ana Silva', nickname: 'ana_dev', classId: 'entra21', className: 'Entra21', courseGoal: 'Aprender desenvolvimento.', email: 'ana@example.com', completed: true, approvalStatus: 'approved' } },
    { id: 'student-2', studentProfile: { fullName: 'Bruno Souza', nickname: 'bruno_dev', classId: 'entra21', className: 'Entra21', courseGoal: 'Aprender desenvolvimento.', email: 'bruno@example.com', completed: true, approvalStatus: 'approved' } },
    { id: 'pending', studentProfile: { fullName: 'Pendente Teste', nickname: 'pending_dev', classId: 'entra21', className: 'Entra21', courseGoal: 'Aprender desenvolvimento.', email: 'pending@example.com', completed: true, approvalStatus: 'pending' } }
  ];

  it('groups results by exam and marks approved students who did not take it', () => {
    const groups = buildTeacherExamResultGroups({
      exams: [{ id: 'exam-1', title: 'Prova Web', classId: 'entra21', className: 'Entra21', subjectId: 'web', subjectName: 'Web' }],
      results: [{ id: 'result-1', examId: 'exam-1', examTitle: 'Prova Web', userId: 'student-1', firstName: 'Ana', lastName: 'Silva', classId: 'entra21', className: 'Entra21', subjectId: 'web', subjectName: 'Web' }],
      studentRecords,
      classes
    });
    assert.equal(groups.length, 1);
    assert.equal(groups[0].completedCount, 1);
    assert.equal(groups[0].pendingCount, 1);
    assert.equal(groups[0].students.find(student => student.studentId === 'student-2').observation, 'Não realizou a prova.');
    assert.equal(groups[0].students.some(student => student.studentId === 'pending'), false);
  });

  it('groups activity submissions and marks missing approved students', () => {
    const groups = buildTeacherActivityGroups([{ id: 'activity-1', title: 'Projeto', classId: 'entra21', className: 'Entra21', submissions: [{ id: 'submission-1', userId: 'student-1', userEmail: 'ana@example.com' }] }], studentRecords, classes);
    assert.equal(groups[0].completedCount, 1);
    assert.equal(groups[0].pendingCount, 1);
    assert.equal(groups[0].students.find(student => student.studentId === 'student-2').observation, 'Não realizou a atividade.');
  });
});
