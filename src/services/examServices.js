export const EXAM_QUESTION_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  ZIP_ATTACHMENT: 'zip_attachment',
  ESSAY: 'essay'
});

export const ESSAY_REVIEW_DECISIONS = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected'
});

export const MAX_ZIP_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_CHUNK_SIZE_BYTES = 640 * 1024;
export const DEFAULT_EXAM_DURATION_MINUTES = 120;
export const MIN_EXAM_DURATION_MINUTES = 1;
export const MAX_EXAM_DURATION_MINUTES = 720;
export const DEFAULT_EXAM_DURATION_SECONDS = DEFAULT_EXAM_DURATION_MINUTES * 60;

export function validateExamDurationMinutes(value) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes)
    || minutes < MIN_EXAM_DURATION_MINUTES
    || minutes > MAX_EXAM_DURATION_MINUTES) {
    throw new Error(`O tempo da prova deve ser um número inteiro entre ${MIN_EXAM_DURATION_MINUTES} e ${MAX_EXAM_DURATION_MINUTES} minutos.`);
  }
  return minutes * 60;
}

export function getExamDurationSeconds(value) {
  const seconds = Number(value);
  const minimumSeconds = MIN_EXAM_DURATION_MINUTES * 60;
  const maximumSeconds = MAX_EXAM_DURATION_MINUTES * 60;
  return Number.isInteger(seconds) && seconds >= minimumSeconds && seconds <= maximumSeconds
    ? seconds
    : DEFAULT_EXAM_DURATION_SECONDS;
}

export function formatExamDurationLabel(value) {
  const totalMinutes = Math.ceil(getExamDurationSeconds(value) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' e ');
}

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
  if (question.type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) return EXAM_QUESTION_TYPES.ZIP_ATTACHMENT;
  if (question.type === EXAM_QUESTION_TYPES.ESSAY) return EXAM_QUESTION_TYPES.ESSAY;
  return EXAM_QUESTION_TYPES.MULTIPLE_CHOICE;
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

export async function gradeExamAnswers(exam, answers, essayReview = null) {
  const answersById = new Map((answers || []).map(item => [item.questionId, item.value || '']));
  const allowedDecisions = new Set(Object.values(ESSAY_REVIEW_DECISIONS));
  const decisionsById = new Map((essayReview?.items || [])
    .filter(item => allowedDecisions.has(item?.decision))
    .map(item => [item.questionId, item.decision]));
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
        requiresManualReview: true,
        requiresEssayReview: false
      };
    }

    if (type === EXAM_QUESTION_TYPES.ESSAY) {
      const decision = decisionsById.get(question.id) || null;
      const finalized = essayReview?.status === 'finalized';
      return {
        questionId: question.id,
        prompt: question.prompt,
        type,
        studentAnswer,
        essayDecision: decision,
        reviewStatus: finalized && decision ? decision : 'pending',
        isCorrect: finalized && decision ? decision === ESSAY_REVIEW_DECISIONS.APPROVED : null,
        requiresManualReview: false,
        requiresEssayReview: true
      };
    }

    const answerHash = await hashExamAnswer(studentAnswer, exam.gradingSalt);
    return {
      questionId: question.id,
      prompt: question.prompt,
      type,
      studentAnswer,
      isCorrect: answerHash === question.answerHash,
      requiresManualReview: false,
      requiresEssayReview: false
    };
  }));

  const objectiveFeedback = feedback.filter(item => item.type === EXAM_QUESTION_TYPES.MULTIPLE_CHOICE);
  const essayFeedback = feedback.filter(item => item.requiresEssayReview);
  const reviewedEssayFeedback = essayFeedback.filter(item => item.essayDecision);
  const approvedEssayCount = reviewedEssayFeedback
    .filter(item => item.essayDecision === ESSAY_REVIEW_DECISIONS.APPROVED).length;
  const correctCount = objectiveFeedback.filter(item => item.isCorrect).length;
  const autoGradedCount = objectiveFeedback.length;
  const manualReviewCount = feedback.filter(item => item.requiresManualReview).length;
  const essayQuestionCount = essayFeedback.length;
  const reviewedEssayCount = reviewedEssayFeedback.length;
  const pendingEssayReviewCount = essayQuestionCount - reviewedEssayCount;
  const finalGradeReady = essayQuestionCount === 0
    || (essayReview?.status === 'finalized' && pendingEssayReviewCount === 0);
  const finalCorrectCount = correctCount + approvedEssayCount;
  const finalGradedQuestionCount = autoGradedCount + essayQuestionCount;
  return {
    correctCount,
    autoGradedCount,
    manualReviewCount,
    essayQuestionCount,
    reviewedEssayCount,
    pendingEssayReviewCount,
    approvedEssayCount,
    finalGradeReady,
    finalCorrectCount,
    finalGradedQuestionCount,
    finalPercentage: finalGradeReady && finalGradedQuestionCount
      ? Math.round((finalCorrectCount / finalGradedQuestionCount) * 100)
      : null,
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

export function validateEssayQuestion(item, index = 0) {
  return {
    type: EXAM_QUESTION_TYPES.ESSAY,
    prompt: validateQuestionPrompt(item, index)
  };
}

export function validateZipAttachmentQuestion(item, index = 0) {
  return {
    type: EXAM_QUESTION_TYPES.ZIP_ATTACHMENT,
    prompt: validateQuestionPrompt(item, index),
    maxFileSizeBytes: MAX_ZIP_FILE_SIZE_BYTES
  };
}

export const ARCHIVE_CONTENT_TYPES = Object.freeze({
  zip: 'application/zip',
  rar: 'application/vnd.rar'
});

export function getArchiveExtension(name) {
  const match = /\.(zip|rar)$/i.exec(String(name || '').trim());
  return match ? match[1].toLowerCase() : '';
}

export function getArchiveContentType(name) {
  return ARCHIVE_CONTENT_TYPES[getArchiveExtension(name)] || '';
}

export function validateZipFileDescriptor(file = {}) {
  const name = String(file.name || '').trim();
  const size = Number(file.size || 0);
  const extension = getArchiveExtension(name);
  if (!extension) throw new Error('Selecione um arquivo com extensão .zip ou .rar.');
  if (!Number.isFinite(size) || size <= 0) throw new Error('O arquivo está vazio.');
  if (size > MAX_ZIP_FILE_SIZE_BYTES) throw new Error('O arquivo deve ter no máximo 5 MB.');
  return { name, size, contentType: ARCHIVE_CONTENT_TYPES[extension] };
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

export function hasRarFileSignature(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || []);
  if (bytes.length < 7) return false;
  // "Rar!\x1A\x07" followed by 0x00 (RAR 1.5-4.x) or 0x01 (RAR 5.0+)
  return bytes[0] === 0x52
    && bytes[1] === 0x61
    && bytes[2] === 0x72
    && bytes[3] === 0x21
    && bytes[4] === 0x1a
    && bytes[5] === 0x07
    && (bytes[6] === 0x00 || bytes[6] === 0x01);
}

export function hasArchiveFileSignature(value) {
  return hasZipFileSignature(value) || hasRarFileSignature(value);
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
