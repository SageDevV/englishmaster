import assert from 'node:assert/strict';
import {
  calculateExamElapsedSeconds,
  gradeExamAnswers,
  hashExamAnswer,
  normalizeExamAnswer,
  sanitizeExamAnswers,
  validateStudentName
} from './examServices.js';

assert.equal(normalizeExamAnswer('  AÇÃO   Correta  '), 'acao correta');
assert.equal(validateStudentName('  Ana  Maria ', 'Nome'), 'Ana Maria');
assert.throws(() => validateStudentName('A', 'Nome'), /entre 2 e 80/);

const salt = 'fixed-test-salt';
const questions = [
  { id: 'q1', prompt: 'How are you?', answerHash: await hashExamAnswer('I am fine', salt) },
  { id: 'q2', prompt: 'Computer?', answerHash: await hashExamAnswer('Computér', salt) }
];
const exam = { gradingSalt: salt, questions };
const answers = sanitizeExamAnswers([{ value: ' i am fine ' }, 'computer'], questions);
const result = await gradeExamAnswers(exam, answers);

assert.equal(result.correctCount, 2);
assert.equal(result.totalQuestions, 2);
assert.equal(result.percentage, 100);
assert.equal(result.feedback.every(item => item.isCorrect), true);

const blankResult = await gradeExamAnswers(exam, sanitizeExamAnswers([], questions));
assert.equal(blankResult.correctCount, 0);
assert.equal(calculateExamElapsedSeconds(1_000, 61_000, 7_200), 60);
assert.equal(calculateExamElapsedSeconds(1_000, 10_000_000, 7_200), 7_200);

console.log('examServices tests passed');
