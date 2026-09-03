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
      approvalStatus: ['pending', 'approved', 'rejected'].includes(String(profile.approvalStatus || ''))
        ? String(profile.approvalStatus)
        : 'approved',
      approved: !['pending', 'rejected'].includes(String(profile.approvalStatus || '')),
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



function toPercentage(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function average(values) {
  const validValues = values.filter(value => Number.isFinite(value));
  if (!validValues.length) return null;
  return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function getResultPercentage(result = {}) {
  const finalPercentage = toPercentage(result.finalPercentage);
  if (finalPercentage !== null) return finalPercentage;
  if (Number(result.essayQuestionCount || 0) > 0 && result.finalGradeReady === false) return null;
  return toPercentage(result.percentage);
}

function getStudentAliases(student = {}) {
  return [
    student.id ? `uid:${normalizeText(student.id)}` : '',
    student.email ? `email:${normalizeText(student.email).toLowerCase()}` : '',
    student.fullName ? `name:${normalizeAcademicKey(student.fullName)}` : ''
  ].filter(Boolean);
}

function getSubmissionAliases(submission = {}) {
  return [
    submission.userId ? `uid:${normalizeText(submission.userId)}` : '',
    submission.userEmail ? `email:${normalizeText(submission.userEmail).toLowerCase()}` : ''
  ].filter(Boolean);
}

function matchesDashboardAcademicFilter(item, filters = {}) {
  return matchesAcademicFilter(item, filters.classKey, 'classId', 'className')
    && matchesAcademicFilter(item, filters.subjectKey, 'subjectId', 'subjectName');
}

export function getTeacherPerformanceFilterOptions(results = [], activities = [], filters = {}) {
  const items = [...(results || []), ...(activities || [])];
  const classes = uniqueOptions(
    items,
    item => getAcademicFilterKey(item.classId, item.className),
    item => item.className || 'Turma não informada'
  );
  const classScoped = items.filter(item => matchesAcademicFilter(item, filters.classKey, 'classId', 'className'));
  const subjects = uniqueOptions(
    classScoped,
    item => getAcademicFilterKey(item.subjectId, item.subjectName),
    item => item.subjectName || 'Matéria não informada'
  );
  return { classes, subjects };
}

export function buildTeacherPerformanceDashboard({
  results = [],
  studentRecords = [],
  classes = [],
  activities = [],
  filters = {}
} = {}) {
  const filteredResults = filterTeacherResults(results, filters);
  const filteredActivities = (activities || [])
    .filter(activity => activity.active !== false && activity.deleted !== true)
    .filter(activity => matchesDashboardAcademicFilter(activity, filters));
  const students = buildTeacherStudentGroups(studentRecords, classes).flatMap(group => group.students).filter(student => student.approved);
  const aliasesToStudent = new Map();
  students.forEach(student => {
    const canonicalKey = getStudentAliases(student)[0] || getStudentAliases(student)[1] || getStudentAliases(student)[2];
    getStudentAliases(student).forEach(alias => aliasesToStudent.set(alias, { canonicalKey, student }));
  });

  const gradedResults = filteredResults
    .map(result => ({ ...result, dashboardPercentage: getResultPercentage(result) }))
    .filter(result => result.dashboardPercentage !== null);
  const evolutionMap = new Map();
  gradedResults.forEach(result => {
    const resultKey = getTeacherResultStudentKey(result);
    const registered = aliasesToStudent.get(resultKey);
    const canonicalKey = registered?.canonicalKey || resultKey || `result:${result.id}`;
    if (!evolutionMap.has(canonicalKey)) {
      evolutionMap.set(canonicalKey, {
        studentKey: canonicalKey,
        studentName: registered?.student.fullName
          || normalizeText(`${result.firstName || ''} ${result.lastName || ''}`)
          || result.userEmail
          || 'Aluno não identificado',
        className: registered?.student.className || result.className || 'Turma não informada',
        results: []
      });
    }
    evolutionMap.get(canonicalKey).results.push({
      examId: result.examId || '',
      examTitle: result.examTitle || 'Avaliação',
      percentage: result.dashboardPercentage,
      submittedAtMillis: toMillis(result.submittedAtMillis)
    });
  });
  const studentEvolution = [...evolutionMap.values()].map(item => {
    const orderedResults = item.results.sort((a, b) => a.submittedAtMillis - b.submittedAtMillis);
    const first = orderedResults[0]?.percentage ?? null;
    const latest = orderedResults.at(-1)?.percentage ?? null;
    const delta = first === null || latest === null ? 0 : latest - first;
    return {
      ...item,
      results: orderedResults,
      average: average(orderedResults.map(result => result.percentage)),
      firstPercentage: first,
      latestPercentage: latest,
      delta,
      trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable'
    };
  }).sort((a, b) => compareLabels(a.studentName, b.studentName));

  const averageGroups = new Map();
  gradedResults.forEach(result => {
    const classKey = getAcademicFilterKey(result.classId, result.className) || 'class:unknown';
    const subjectKey = getAcademicFilterKey(result.subjectId, result.subjectName) || 'subject:unknown';
    const key = `${classKey}|${subjectKey}`;
    if (!averageGroups.has(key)) {
      averageGroups.set(key, {
        key,
        className: result.className || 'Turma não informada',
        subjectName: result.subjectName || 'Matéria não informada',
        percentages: []
      });
    }
    averageGroups.get(key).percentages.push(result.dashboardPercentage);
  });
  const classSubjectAverages = [...averageGroups.values()].map(group => ({
    key: group.key,
    className: group.className,
    subjectName: group.subjectName,
    average: average(group.percentages),
    attempts: group.percentages.length
  })).sort((a, b) => compareLabels(a.className, b.className) || compareLabels(a.subjectName, b.subjectName));

  const errorGroups = new Map();
  filteredResults.forEach(result => {
    (result.feedback || []).forEach(feedback => {
      if (typeof feedback.isCorrect !== 'boolean') return;
      const prompt = normalizeText(feedback.prompt) || 'Questão sem enunciado';
      const key = `${result.examId || result.examTitle || 'exam'}:${feedback.questionId || normalizeAcademicKey(prompt)}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, {
          key,
          prompt,
          examTitle: result.examTitle || 'Avaliação',
          subjectName: result.subjectName || 'Matéria não informada',
          totalAnswers: 0,
          wrongAnswers: 0
        });
      }
      const group = errorGroups.get(key);
      group.totalAnswers += 1;
      if (!feedback.isCorrect) group.wrongAnswers += 1;
    });
  });
  const errorTopics = [...errorGroups.values()].map(group => ({
    ...group,
    errorRate: group.totalAnswers ? Math.round((group.wrongAnswers / group.totalAnswers) * 100) : 0
  })).filter(group => group.wrongAnswers > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.wrongAnswers - a.wrongAnswers || compareLabels(a.prompt, b.prompt))
    .slice(0, 8);

  const pendingActivities = filteredActivities.map(activity => {
    const expectedStudents = students.filter(student => {
      const studentClassKey = getAcademicFilterKey(student.classId, student.className);
      const activityClassKey = getAcademicFilterKey(activity.classId, activity.className);
      return studentClassKey && studentClassKey === activityClassKey;
    });
    const deliveredAliases = new Set((activity.submissions || []).flatMap(getSubmissionAliases));
    const pendingStudents = expectedStudents.filter(student =>
      !getStudentAliases(student).some(alias => deliveredAliases.has(alias))
    );
    return {
      id: activity.id,
      title: activity.title || 'Atividade',
      className: activity.className || 'Turma não informada',
      subjectName: activity.subjectName || 'Matéria não informada',
      expectedCount: expectedStudents.length,
      deliveredCount: Math.max(0, expectedStudents.length - pendingStudents.length),
      pendingCount: pendingStudents.length,
      pendingStudents: pendingStudents.map(student => student.fullName)
    };
  }).sort((a, b) => b.pendingCount - a.pendingCount || compareLabels(a.title, b.title));

  const examGroups = new Map();
  gradedResults.forEach(result => {
    const key = result.examId || `title:${normalizeAcademicKey(result.examTitle)}`;
    if (!examGroups.has(key)) {
      examGroups.set(key, {
        examId: result.examId || '',
        examTitle: result.examTitle || 'Avaliação',
        className: result.className || 'Turma não informada',
        subjectName: result.subjectName || 'Matéria não informada',
        percentages: [],
        submittedAtMillis: 0
      });
    }
    const group = examGroups.get(key);
    group.percentages.push(result.dashboardPercentage);
    group.submittedAtMillis = Math.max(group.submittedAtMillis, toMillis(result.submittedAtMillis));
  });
  const examComparison = [...examGroups.values()].map(group => ({
    examId: group.examId,
    examTitle: group.examTitle,
    className: group.className,
    subjectName: group.subjectName,
    average: average(group.percentages),
    attempts: group.percentages.length,
    submittedAtMillis: group.submittedAtMillis
  })).sort((a, b) => a.submittedAtMillis - b.submittedAtMillis || compareLabels(a.examTitle, b.examTitle));

  return {
    summary: {
      average: average(gradedResults.map(result => result.dashboardPercentage)),
      gradedAttempts: gradedResults.length,
      studentsWithResults: studentEvolution.length,
      pendingDeliveries: pendingActivities.reduce((sum, activity) => sum + activity.pendingCount, 0)
    },
    studentEvolution,
    classSubjectAverages,
    errorTopics,
    pendingActivities,
    examComparison
  };
}


function getStudentsForAcademicClass(students, item) {
  const itemClassKey = getAcademicFilterKey(item.classId, item.className);
  return students.filter(student => itemClassKey
    && getAcademicFilterKey(student.classId, student.className) === itemClassKey);
}

function studentMatchesResultFilter(student, studentKey) {
  return !studentKey || getStudentAliases(student).includes(studentKey);
}

function getExamGroupKey(item = {}) {
  const examId = normalizeText(item.examId || item.id);
  if (examId) return `id:${examId}`;
  return `title:${normalizeAcademicKey(item.examTitle || item.title || 'Avaliação')}`;
}

export function buildTeacherExamResultGroups({
  results = [],
  exams = [],
  studentRecords = [],
  classes = [],
  filters = {}
} = {}) {
  const approvedStudents = buildTeacherStudentGroups(studentRecords, classes)
    .flatMap(group => group.students)
    .filter(student => student.approved);
  const filteredResults = filterTeacherResults(results, filters);
  const groups = new Map();

  (exams || [])
    .filter(exam => exam.deleted !== true)
    .filter(exam => matchesDashboardAcademicFilter(exam, filters))
    .forEach(exam => groups.set(getExamGroupKey(exam), {
      examId: exam.id || '',
      examTitle: exam.title || 'Avaliação',
      classId: exam.classId || '',
      className: exam.className || 'Turma não informada',
      subjectId: exam.subjectId || '',
      subjectName: exam.subjectName || 'Matéria não informada',
      updatedAtMillis: toMillis(exam.updatedAtMillis || exam.createdAtMillis),
      results: []
    }));

  filteredResults.forEach(result => {
    const key = getExamGroupKey(result);
    if (!groups.has(key)) {
      groups.set(key, {
        examId: result.examId || '',
        examTitle: result.examTitle || 'Avaliação',
        classId: result.classId || '',
        className: result.className || 'Turma não informada',
        subjectId: result.subjectId || '',
        subjectName: result.subjectName || 'Matéria não informada',
        updatedAtMillis: toMillis(result.submittedAtMillis),
        results: []
      });
    }
    groups.get(key).results.push(result);
  });

  return [...groups.values()].map(group => {
    const expectedStudents = getStudentsForAcademicClass(approvedStudents, group)
      .filter(student => studentMatchesResultFilter(student, filters.studentKey));
    const resultsByAlias = new Map();
    group.results.forEach(result => {
      const key = getTeacherResultStudentKey(result);
      if (!filters.studentKey || key === filters.studentKey) resultsByAlias.set(key, result);
    });
    const matchedResultIds = new Set();
    const students = expectedStudents.map(student => {
      const result = getStudentAliases(student).map(alias => resultsByAlias.get(alias)).find(Boolean) || null;
      if (result) matchedResultIds.add(result.id);
      return {
        studentId: student.id,
        studentName: student.fullName,
        email: student.email,
        completed: Boolean(result),
        observation: result ? '' : 'Não realizou a prova.',
        result
      };
    });
    group.results.forEach(result => {
      if (matchedResultIds.has(result.id)) return;
      const resultKey = getTeacherResultStudentKey(result);
      if (filters.studentKey && resultKey !== filters.studentKey) return;
      students.push({
        studentId: result.userId || '',
        studentName: normalizeText(`${result.firstName || ''} ${result.lastName || ''}`) || result.userEmail || 'Aluno não identificado',
        email: result.userEmail || '',
        completed: true,
        observation: '',
        result
      });
    });
    students.sort((a, b) => compareLabels(a.studentName, b.studentName));
    const completedCount = students.filter(student => student.completed).length;
    return {
      ...group,
      students,
      completedCount,
      pendingCount: students.length - completedCount,
      expectedCount: students.length
    };
  }).filter(group => !filters.studentKey || group.students.length > 0)
    .sort((a, b) => b.updatedAtMillis - a.updatedAtMillis || compareLabels(a.examTitle, b.examTitle));
}

export function buildTeacherActivityGroups(activities = [], studentRecords = [], classes = []) {
  const approvedStudents = buildTeacherStudentGroups(studentRecords, classes)
    .flatMap(group => group.students)
    .filter(student => student.approved);
  return (activities || []).map(activity => {
    const expectedStudents = getStudentsForAcademicClass(approvedStudents, activity);
    const submissionsByAlias = new Map();
    (activity.submissions || []).forEach(submission => {
      getSubmissionAliases(submission).forEach(alias => submissionsByAlias.set(alias, submission));
    });
    const matchedSubmissionIds = new Set();
    const students = expectedStudents.map(student => {
      const submission = getStudentAliases(student).map(alias => submissionsByAlias.get(alias)).find(Boolean) || null;
      if (submission) matchedSubmissionIds.add(submission.id);
      return {
        studentId: student.id,
        studentName: student.fullName,
        email: student.email,
        completed: Boolean(submission),
        observation: submission ? '' : 'Não realizou a atividade.',
        submission
      };
    });
    (activity.submissions || []).forEach(submission => {
      if (matchedSubmissionIds.has(submission.id)) return;
      students.push({
        studentId: submission.userId || '',
        studentName: submission.studentName || submission.userEmail || 'Aluno não identificado',
        email: submission.userEmail || '',
        completed: true,
        observation: '',
        submission
      });
    });
    students.sort((a, b) => compareLabels(a.studentName, b.studentName));
    const completedCount = students.filter(student => student.completed).length;
    return {
      activity,
      students,
      completedCount,
      pendingCount: students.length - completedCount,
      expectedCount: students.length
    };
  });
}
