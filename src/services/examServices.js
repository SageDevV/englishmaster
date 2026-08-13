export function normalizeExamAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export async function hashExamAnswer(value, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${normalizeExamAnswer(value)}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateStudentName(value, label) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned.length > 80) {
    throw new Error(`${label} deve ter entre 2 e 80 caracteres.`);
  }
  return cleaned;
}

export function sanitizeExamAnswers(rawAnswers, questions) {
  const supplied = Array.isArray(rawAnswers) ? rawAnswers : [];
  return questions.map((question, index) => ({
    questionId: question.id,
    value: String(supplied[index]?.value ?? supplied[index] ?? '').slice(0, 5000)
  }));
}

export async function gradeExamAnswers(exam, answers) {
  const answersById = new Map((answers || []).map(item => [item.questionId, item.value || '']));
  const feedback = await Promise.all((exam.questions || []).map(async question => {
    const studentAnswer = answersById.get(question.id) || '';
    const answerHash = await hashExamAnswer(studentAnswer, exam.gradingSalt);
    return {
      questionId: question.id,
      prompt: question.prompt,
      studentAnswer,
      isCorrect: answerHash === question.answerHash
    };
  }));
  const correctCount = feedback.filter(item => item.isCorrect).length;
  const totalQuestions = feedback.length;
  return {
    correctCount,
    totalQuestions,
    percentage: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
    feedback
  };
}

export function calculateExamElapsedSeconds(startedAtMillis, submittedAtMillis, durationSeconds) {
  return Math.max(0, Math.min(
    durationSeconds,
    Math.floor((submittedAtMillis - startedAtMillis) / 1000)
  ));
}
