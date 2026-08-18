import assert from 'node:assert/strict';
import {
  ATTACHMENT_CHUNK_SIZE_BYTES,
  calculateExamElapsedSeconds,
  DEFAULT_EXAM_DURATION_MINUTES,
  DEFAULT_EXAM_DURATION_SECONDS,
  ESSAY_REVIEW_DECISIONS,
  EXAM_QUESTION_TYPES,
  formatExamDurationLabel,
  getExamDurationSeconds,
  getExamQuestionType,
  gradeExamAnswers,
  getArchiveContentType,
  getArchiveExtension,
  hasArchiveFileSignature,
  hasRarFileSignature,
  hasZipFileSignature,
  hashAttachmentBytes,
  hashExamAnswer,
  MAX_ZIP_FILE_SIZE_BYTES,
  normalizeExamAnswer,
  sanitizeExamAnswers,
  splitAttachmentBytes,
  validateExamDurationMinutes,
  validateEssayQuestion,
  validateMultipleChoiceQuestion,
  validateStudentName,
  validateZipAttachmentQuestion,
  validateZipFileDescriptor
} from './examServices.js';

assert.equal(normalizeExamAnswer('  AÇÃO   Correta  '), 'acao correta');
assert.equal(validateStudentName('  Ana  Maria ', 'Nome'), 'Ana Maria');
assert.throws(() => validateStudentName('A', 'Nome'), /entre 2 e 80/);
assert.equal(validateExamDurationMinutes(45), 2_700);
assert.equal(validateExamDurationMinutes(String(DEFAULT_EXAM_DURATION_MINUTES)), DEFAULT_EXAM_DURATION_SECONDS);
assert.throws(() => validateExamDurationMinutes(0), /entre 1 e 720 minutos/);
assert.throws(() => validateExamDurationMinutes(721), /entre 1 e 720 minutos/);
assert.throws(() => validateExamDurationMinutes(1.5), /número inteiro/);
assert.equal(getExamDurationSeconds(undefined), DEFAULT_EXAM_DURATION_SECONDS);
assert.equal(getExamDurationSeconds(3_600), 3_600);
assert.equal(getExamDurationSeconds(59), DEFAULT_EXAM_DURATION_SECONDS);
assert.equal(formatExamDurationLabel(60), '1 minuto');
assert.equal(formatExamDurationLabel(3_600), '1 hora');
assert.equal(formatExamDurationLabel(5_400), '1 hora e 30 minutos');
assert.equal(formatExamDurationLabel(undefined), '2 horas');
assert.equal(getExamQuestionType({}), EXAM_QUESTION_TYPES.MULTIPLE_CHOICE);
assert.equal(getExamQuestionType({ type: 'zip_attachment' }), EXAM_QUESTION_TYPES.ZIP_ATTACHMENT);
assert.equal(getExamQuestionType({ type: 'essay' }), EXAM_QUESTION_TYPES.ESSAY);
assert.deepEqual(validateEssayQuestion({ prompt: 'Explique HTTP.' }), {
  type: EXAM_QUESTION_TYPES.ESSAY,
  prompt: 'Explique HTTP.'
});
assert.throws(() => validateEssayQuestion({ prompt: '' }), /Preencha a pergunta/);

const salt = 'fixed-test-salt';
const questions = [
  { id: 'q1', prompt: 'How are you?', answerHash: await hashExamAnswer('I am fine', salt) },
  { id: 'q2', prompt: 'Computer?', answerHash: await hashExamAnswer('Computér', salt) }
];
const exam = { gradingSalt: salt, questions };
const answers = sanitizeExamAnswers([{ value: ' i am fine ' }, 'computer'], questions);
const result = await gradeExamAnswers(exam, answers);

assert.equal(result.correctCount, 2);
assert.equal(result.autoGradedCount, 2);
assert.equal(result.manualReviewCount, 0);
assert.equal(result.totalQuestions, 2);
assert.equal(result.percentage, 100);
assert.equal(result.feedback.every(item => item.isCorrect), true);

const blankResult = await gradeExamAnswers(exam, sanitizeExamAnswers([], questions));
assert.equal(blankResult.correctCount, 0);
assert.equal(calculateExamElapsedSeconds(1_000, 61_000, 7_200), 60);
assert.equal(calculateExamElapsedSeconds(1_000, 10_000_000, 7_200), 7_200);

const multipleChoice = validateMultipleChoiceQuestion({
  prompt: 'Choose the correct translation',
  options: ['Computador', 'Computer', 'Keyboard', 'Mouse'],
  correctOptionIndex: 1
});
assert.equal(multipleChoice.type, EXAM_QUESTION_TYPES.MULTIPLE_CHOICE);
assert.equal(multipleChoice.options.length, 4);
assert.equal(multipleChoice.correctOptionIndex, 1);
assert.throws(
  () => validateMultipleChoiceQuestion({ prompt: 'Too few', options: ['Only one'], correctOptionIndex: 0 }),
  /entre 2 e 4/
);
assert.throws(
  () => validateMultipleChoiceQuestion({ prompt: 'Duplicates', options: ['Ação', 'acao'], correctOptionIndex: 0 }),
  /devem ser diferentes/
);
assert.throws(
  () => validateMultipleChoiceQuestion({ prompt: 'No correct', options: ['A', 'B'], correctOptionIndex: -1 }),
  /Selecione a resposta correta/
);

const zipQuestion = validateZipAttachmentQuestion({ prompt: 'Envie o repositório.' });
assert.deepEqual(zipQuestion, {
  type: EXAM_QUESTION_TYPES.ZIP_ATTACHMENT,
  prompt: 'Envie o repositório.',
  maxFileSizeBytes: MAX_ZIP_FILE_SIZE_BYTES
});
assert.throws(() => validateZipAttachmentQuestion({ prompt: '' }), /Preencha a pergunta/);
assert.deepEqual(validateZipFileDescriptor({ name: 'projeto.ZIP', size: 1024 }), {
  name: 'projeto.ZIP',
  size: 1024,
  contentType: 'application/zip'
});
assert.deepEqual(validateZipFileDescriptor({ name: 'projeto.RAR', size: 1024 }), {
  name: 'projeto.RAR',
  size: 1024,
  contentType: 'application/vnd.rar'
});
assert.throws(() => validateZipFileDescriptor({ name: 'projeto.pdf', size: 1024 }), /extensão .zip ou .rar/);
assert.throws(
  () => validateZipFileDescriptor({ name: 'projeto.zip', size: MAX_ZIP_FILE_SIZE_BYTES + 1 }),
  /máximo 5 MB/
);
assert.equal(getArchiveExtension('trabalho.RAR'), 'rar');
assert.equal(getArchiveExtension('trabalho.zip'), 'zip');
assert.equal(getArchiveExtension('trabalho.txt'), '');
assert.equal(getArchiveContentType('trabalho.rar'), 'application/vnd.rar');
assert.equal(getArchiveContentType('trabalho.zip'), 'application/zip');
assert.equal(getArchiveContentType('trabalho.txt'), '');
assert.equal(hasZipFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), true);
assert.equal(hasZipFileSignature(Uint8Array.from([0x50, 0x4b, 0x05, 0x06])), true);
assert.equal(hasZipFileSignature(Uint8Array.from([0x00, 0x01, 0x02, 0x03])), false);
// RAR 1.5-4.x signature ends in 0x00, RAR 5.0+ ends in 0x01
assert.equal(hasRarFileSignature(Uint8Array.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])), true);
assert.equal(hasRarFileSignature(Uint8Array.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01])), true);
assert.equal(hasRarFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), false);
assert.equal(hasArchiveFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), true);
assert.equal(hasArchiveFileSignature(Uint8Array.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01])), true);
assert.equal(hasArchiveFileSignature(Uint8Array.from([0x00, 0x01, 0x02, 0x03])), false);

const chunkSource = new Uint8Array(ATTACHMENT_CHUNK_SIZE_BYTES + 7).fill(9);
const chunks = splitAttachmentBytes(chunkSource);
assert.equal(chunks.length, 2);
assert.equal(chunks[0].length, ATTACHMENT_CHUNK_SIZE_BYTES);
assert.equal(chunks[1].length, 7);
assert.equal(await hashAttachmentBytes(new Uint8Array([1, 2, 3])), await hashAttachmentBytes(new Uint8Array([1, 2, 3])));

const mixedQuestions = [
  questions[0],
  { id: 'zip1', prompt: 'Envie o projeto', type: EXAM_QUESTION_TYPES.ZIP_ATTACHMENT }
];
const mixedResult = await gradeExamAnswers(
  { gradingSalt: salt, questions: mixedQuestions },
  sanitizeExamAnswers([{ value: 'I am fine' }, { value: 'attempt__zip1' }], mixedQuestions)
);
assert.equal(mixedResult.correctCount, 1);
assert.equal(mixedResult.autoGradedCount, 1);
assert.equal(mixedResult.manualReviewCount, 1);
assert.equal(mixedResult.totalQuestions, 2);
assert.equal(mixedResult.percentage, 100);
assert.equal(mixedResult.feedback[1].requiresManualReview, true);
assert.equal(mixedResult.feedback[1].isCorrect, null);

const manualOnlyResult = await gradeExamAnswers(
  { gradingSalt: salt, questions: [mixedQuestions[1]] },
  [{ questionId: 'zip1', value: 'attachment' }]
);
assert.equal(manualOnlyResult.percentage, null);
assert.equal(manualOnlyResult.manualReviewCount, 1);

const essayQuestions = [
  questions[0],
  { id: 'essay1', prompt: 'Explique HTTP.', type: EXAM_QUESTION_TYPES.ESSAY }
];
const essayAnswers = sanitizeExamAnswers([
  { value: 'I am fine' },
  { value: 'HTTP é um protocolo de aplicação.' }
], essayQuestions);
const pendingEssayResult = await gradeExamAnswers(
  { gradingSalt: salt, questions: essayQuestions },
  essayAnswers
);
assert.equal(pendingEssayResult.correctCount, 1);
assert.equal(pendingEssayResult.essayQuestionCount, 1);
assert.equal(pendingEssayResult.pendingEssayReviewCount, 1);
assert.equal(pendingEssayResult.finalGradeReady, false);
assert.equal(pendingEssayResult.finalPercentage, null);
assert.equal(pendingEssayResult.feedback[1].requiresEssayReview, true);

const reviewedEssayResult = await gradeExamAnswers(
  { gradingSalt: salt, questions: essayQuestions },
  essayAnswers,
  {
    status: 'in_review',
    items: [{ questionId: 'essay1', decision: ESSAY_REVIEW_DECISIONS.APPROVED }]
  }
);
assert.equal(reviewedEssayResult.reviewedEssayCount, 1);
assert.equal(reviewedEssayResult.pendingEssayReviewCount, 0);
assert.equal(reviewedEssayResult.finalGradeReady, false);
assert.equal(reviewedEssayResult.feedback[1].isCorrect, null);

const finalizedEssayResult = await gradeExamAnswers(
  { gradingSalt: salt, questions: essayQuestions },
  essayAnswers,
  {
    status: 'finalized',
    items: [{ questionId: 'essay1', decision: ESSAY_REVIEW_DECISIONS.APPROVED }]
  }
);
assert.equal(finalizedEssayResult.finalGradeReady, true);
assert.equal(finalizedEssayResult.finalCorrectCount, 2);
assert.equal(finalizedEssayResult.finalGradedQuestionCount, 2);
assert.equal(finalizedEssayResult.finalPercentage, 100);
assert.equal(finalizedEssayResult.feedback[1].isCorrect, true);

const rejectedEssayResult = await gradeExamAnswers(
  { gradingSalt: salt, questions: essayQuestions },
  essayAnswers,
  {
    status: 'finalized',
    items: [{ questionId: 'essay1', decision: ESSAY_REVIEW_DECISIONS.REJECTED }]
  }
);
assert.equal(rejectedEssayResult.finalCorrectCount, 1);
assert.equal(rejectedEssayResult.finalPercentage, 50);
assert.equal(rejectedEssayResult.feedback[1].isCorrect, false);

const essayWithZipResult = await gradeExamAnswers(
  {
    gradingSalt: salt,
    questions: [questions[0], essayQuestions[1], mixedQuestions[1]]
  },
  [
    { questionId: 'q1', value: 'I am fine' },
    { questionId: 'essay1', value: 'HTTP é um protocolo de aplicação.' },
    { questionId: 'zip1', value: 'attachment' }
  ],
  {
    status: 'finalized',
    items: [{ questionId: 'essay1', decision: ESSAY_REVIEW_DECISIONS.APPROVED }]
  }
);
assert.equal(essayWithZipResult.finalPercentage, 100);
assert.equal(essayWithZipResult.finalGradedQuestionCount, 2);
assert.equal(essayWithZipResult.manualReviewCount, 1);
assert.equal(essayWithZipResult.totalQuestions, 3);

console.log('examServices tests passed');
