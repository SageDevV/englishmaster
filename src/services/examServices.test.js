import assert from 'node:assert/strict';
import {
  ATTACHMENT_CHUNK_SIZE_BYTES,
  calculateExamElapsedSeconds,
  EXAM_QUESTION_TYPES,
  getExamQuestionType,
  gradeExamAnswers,
  hasZipFileSignature,
  hashAttachmentBytes,
  hashExamAnswer,
  MAX_ZIP_FILE_SIZE_BYTES,
  normalizeExamAnswer,
  sanitizeExamAnswers,
  splitAttachmentBytes,
  validateMultipleChoiceQuestion,
  validateStudentName,
  validateZipAttachmentQuestion,
  validateZipFileDescriptor
} from './examServices.js';

assert.equal(normalizeExamAnswer('  AÇÃO   Correta  '), 'acao correta');
assert.equal(validateStudentName('  Ana  Maria ', 'Nome'), 'Ana Maria');
assert.throws(() => validateStudentName('A', 'Nome'), /entre 2 e 80/);
assert.equal(getExamQuestionType({}), EXAM_QUESTION_TYPES.MULTIPLE_CHOICE);
assert.equal(getExamQuestionType({ type: 'zip_attachment' }), EXAM_QUESTION_TYPES.ZIP_ATTACHMENT);

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
  size: 1024
});
assert.throws(() => validateZipFileDescriptor({ name: 'projeto.rar', size: 1024 }), /extensão .zip/);
assert.throws(
  () => validateZipFileDescriptor({ name: 'projeto.zip', size: MAX_ZIP_FILE_SIZE_BYTES + 1 }),
  /máximo 5 MB/
);
assert.equal(hasZipFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), true);
assert.equal(hasZipFileSignature(Uint8Array.from([0x50, 0x4b, 0x05, 0x06])), true);
assert.equal(hasZipFileSignature(Uint8Array.from([0x00, 0x01, 0x02, 0x03])), false);

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

console.log('examServices tests passed');
