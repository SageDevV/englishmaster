export const SPEEDRUN_QUESTIONS_PER_TOPIC = 3;

export function shuffleItems(items, random = Math.random) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function sanitizeNickname(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeNicknameKey(value) {
  return sanitizeNickname(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function validateNickname(value) {
  const nickname = sanitizeNickname(value);

  if (!nickname) {
    return { isValid: false, message: 'Informe um nickname.' };
  }

  if (nickname.length < 3 || nickname.length > 20) {
    return { isValid: false, message: 'Use entre 3 e 20 caracteres.' };
  }

  if (!/^[\p{L}\p{N}_ -]+$/u.test(nickname)) {
    return { isValid: false, message: 'Use apenas letras, numeros, espacos, _ ou -.' };
  }

  return {
    isValid: true,
    nickname,
    nicknameKey: normalizeNicknameKey(nickname)
  };
}

export function resolveProfileName(profile = {}, fallback = 'Aluno') {
  return sanitizeNickname(profile.nickname) || profile.displayName || profile.email || fallback;
}

export function formatElapsedTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toLocalDateKey(value = Date.now()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function dateKeyToDayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
  return Number.isFinite(day) ? day : null;
}

export function updateDailyLearningStreak(stats = {}, activityAt = Date.now()) {
  const activityDate = toLocalDateKey(activityAt);
  if (!activityDate) return { learningStreak: Math.max(0, Number(stats.learningStreak || 0)), lastLearningDate: String(stats.lastLearningDate || '') };
  const previousDate = stats.lastLearningDate ? toLocalDateKey(stats.lastLearningDate) : '';
  const previousStreak = Math.max(0, Number(stats.learningStreak || 0));
  if (previousDate === activityDate) {
    return { learningStreak: previousStreak, lastLearningDate: activityDate };
  }

  const currentDay = dateKeyToDayNumber(activityDate);
  const previousDay = dateKeyToDayNumber(previousDate);
  return {
    learningStreak: previousDay !== null && currentDay - previousDay === 1 ? previousStreak + 1 : 1,
    lastLearningDate: activityDate
  };
}

export function getEffectiveLearningStreak(stats = {}, now = Date.now()) {
  const streak = Math.max(0, Number(stats.learningStreak || 0));
  const currentDay = dateKeyToDayNumber(toLocalDateKey(now));
  const lastDay = dateKeyToDayNumber(toLocalDateKey(stats.lastLearningDate));
  if (!streak || currentDay === null || lastDay === null) return 0;
  return currentDay - lastDay <= 1 ? streak : 0;
}

function createQuestionRecord(topicId, question, index) {
  return {
    ...question,
    id: question.id || `${topicId}-${index}`,
    topicId
  };
}

function withShuffledOptions(question, random) {
  return {
    ...question,
    optionOrder: shuffleItems(question.options || [], random)
  };
}

export function buildSpeedrunQuestionQueue({
  topics,
  topicQuestionMap,
  questionsPerTopic = SPEEDRUN_QUESTIONS_PER_TOPIC,
  random = Math.random
}) {
  const missingTopics = [];
  const selectedQuestions = [];

  for (const topic of topics) {
    const topicQuestions = (topicQuestionMap[topic.id] || [])
      .map((question, index) => createQuestionRecord(topic.id, question, index));

    if (topicQuestions.length < questionsPerTopic) {
      missingTopics.push({
        id: topic.id,
        title: topic.title || topic.id,
        available: topicQuestions.length,
        required: questionsPerTopic
      });
      continue;
    }

    selectedQuestions.push(...shuffleItems(topicQuestions, random).slice(0, questionsPerTopic));
  }

  if (missingTopics.length) {
    return {
      ok: false,
      questions: [],
      missingTopics
    };
  }

  return {
    ok: true,
    questions: shuffleItems(selectedQuestions, random).map(question => withShuffledOptions(question, random)),
    missingTopics: []
  };
}
