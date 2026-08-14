export const EXAM_QUESTION_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  ZIP_ATTACHMENT: 'zip_attachment'
});

export const MAX_ZIP_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_CHUNK_SIZE_BYTES = 640 * 1024;

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

export async function hashAttachmentBytes(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
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

export function getExamQuestionType(question = {}) {
  return question.type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT
    ? EXAM_QUESTION_TYPES.ZIP_ATTACHMENT
    : EXAM_QUESTION_TYPES.MULTIPLE_CHOICE;
}

function validateQuestionPrompt(item, index) {
  const prompt = String(item?.prompt || '').trim();
  if (!prompt) throw new Error(`Preencha a pergunta do item ${index + 1}.`);
  if (prompt.length > 5000) throw new Error(`A pergunta do item ${index + 1} excede 5.000 caracteres.`);
  return prompt;
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
    const type = getExamQuestionType(question);

    if (type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) {
      return {
        questionId: question.id,
        prompt: question.prompt,
        type,
        studentAnswer,
        attachmentId: studentAnswer,
        isCorrect: null,
        requiresManualReview: true
      };
    }

    const answerHash = await hashExamAnswer(studentAnswer, exam.gradingSalt);
    return {
      questionId: question.id,
      prompt: question.prompt,
      type,
      studentAnswer,
      isCorrect: answerHash === question.answerHash,
      requiresManualReview: false
    };
  }));

  const objectiveFeedback = feedback.filter(item => !item.requiresManualReview);
  const correctCount = objectiveFeedback.filter(item => item.isCorrect).length;
  const autoGradedCount = objectiveFeedback.length;
  const manualReviewCount = feedback.length - autoGradedCount;
  return {
    correctCount,
    autoGradedCount,
    manualReviewCount,
    totalQuestions: feedback.length,
    percentage: autoGradedCount ? Math.round((correctCount / autoGradedCount) * 100) : null,
    feedback
  };
}

export function calculateExamElapsedSeconds(startedAtMillis, submittedAtMillis, durationSeconds) {
  return Math.max(0, Math.min(
    durationSeconds,
    Math.floor((submittedAtMillis - startedAtMillis) / 1000)
  ));
}

export function validateMultipleChoiceQuestion(item, index = 0) {
  const prompt = validateQuestionPrompt(item, index);
  const options = Array.isArray(item?.options)
    ? item.options.map(option => String(option || '').trim())
    : [];
  const correctOptionIndex = Number(item?.correctOptionIndex);
  if (options.length < 2 || options.length > 4) {
    throw new Error(`A questão ${index + 1} deve ter entre 2 e 4 alternativas.`);
  }
  if (options.some(option => !option)) throw new Error(`Preencha todas as alternativas da questão ${index + 1}.`);
  if (options.some(option => option.length > 5000)) throw new Error(`Uma alternativa da questão ${index + 1} excede 5.000 caracteres.`);
  if (new Set(options.map(normalizeExamAnswer)).size !== options.length) {
    throw new Error(`As alternativas da questão ${index + 1} devem ser diferentes.`);
  }
  if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    throw new Error(`Selecione a resposta correta da questão ${index + 1}.`);
  }
  return { type: EXAM_QUESTION_TYPES.MULTIPLE_CHOICE, prompt, options, correctOptionIndex };
}

export function validateZipAttachmentQuestion(item, index = 0) {
  return {
    type: EXAM_QUESTION_TYPES.ZIP_ATTACHMENT,
    prompt: validateQuestionPrompt(item, index),
    maxFileSizeBytes: MAX_ZIP_FILE_SIZE_BYTES
  };
}

export function validateZipFileDescriptor(file = {}) {
  const name = String(file.name || '').trim();
  const size = Number(file.size || 0);
  if (!/\.zip$/i.test(name)) throw new Error('Selecione um arquivo com extensão .zip.');
  if (!Number.isFinite(size) || size <= 0) throw new Error('O arquivo ZIP está vazio.');
  if (size > MAX_ZIP_FILE_SIZE_BYTES) throw new Error('O arquivo ZIP deve ter no máximo 5 MB.');
  return { name, size };
}

export function hasZipFileSignature(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || []);
  if (bytes.length < 4) return false;
  return bytes[0] === 0x50
    && bytes[1] === 0x4b
    && ((bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08));
}

export function splitAttachmentBytes(value, chunkSize = ATTACHMENT_CHUNK_SIZE_BYTES) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('Tamanho de bloco inválido.');
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.slice(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return chunks;
}
