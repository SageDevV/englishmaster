import './style.css';
import { topics } from './src/data/topics.js';
import { questionWordsData } from './src/data/questionWords.js';
import { verbToBeData } from './src/data/verbToBe.js';
import { computerStuffData } from './src/data/computerStuff.js';
import { instructionsData } from './src/data/instructions.js';
import { techLifeData } from './src/data/techLife.js';
import { connectivityData } from './src/data/connectivity.js';
import { numeralsData } from './src/data/numerals.js';
import { webNavigationData } from './src/data/webNavigation.js';
import { softwareInterfacesData } from './src/data/softwareInterfaces.js';
import { collaborativeToolsData } from './src/data/collaborativeTools.js';
import { manualReadingData } from './src/data/manualReading.js';
import {
  buildSpeedrunQuestionQueue,
  formatElapsedTime,
  normalizeNicknameKey,
  resolveProfileName,
  sanitizeNickname,
  validateNickname
} from './src/services/gameServices.js';
import {
  calculateExamElapsedSeconds,
  gradeExamAnswers,
  hashExamAnswer,
  sanitizeExamAnswers,
  validateStudentName
} from './src/services/examServices.js';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCuNKZ9tWW_vLZ4bS8hwrDNMnuHWRuNeSI",
  authDomain: "englishmaster-ea9b9.firebaseapp.com",
  projectId: "englishmaster-ea9b9",
  storageBucket: "englishmaster-ea9b9.firebasestorage.app",
  messagingSenderId: "283770517765",
  appId: "1:283770517765:web:1d54dfd085e5094c7c5f6c"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const ADMIN_EMAIL = 'pandredbz@gmail.com';
const EXAM_DURATION_SECONDS = 2 * 60 * 60;

function isAdmin() {
  return String(state.user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

function getFriendlyError(error, fallback = 'Não foi possível concluir a operação.') {
  const message = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  return message || fallback;
}

function createExamSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function timestampToMillis(value) {
  return value?.toMillis ? value.toMillis() : Number(value || 0);
}

function serializeExamDocument(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    durationSeconds: data.durationSeconds,
    questionCount: data.questionCount,
    questions: data.questions || [],
    gradingSalt: data.gradingSalt,
    active: data.active === true,
    deleted: data.deleted === true,
    createdAtMillis: timestampToMillis(data.createdAt),
    updatedAtMillis: timestampToMillis(data.updatedAt)
  };
}

function getAttemptExam(data, fallbackExam) {
  if (!data.examSnapshot?.questions || !data.examSnapshot?.gradingSalt) return fallbackExam;
  return {
    ...fallbackExam,
    id: data.examId,
    title: data.examSnapshot.title || data.examTitle,
    questionCount: data.examSnapshot.questions.length,
    questions: data.examSnapshot.questions,
    gradingSalt: data.examSnapshot.gradingSalt
  };
}

async function serializeAttemptData(data, fallbackExam) {
  const exam = getAttemptExam(data, fallbackExam);
  const startedAtMillis = timestampToMillis(data.startedAt);
  const result = {
    status: data.status,
    firstName: data.firstName,
    lastName: data.lastName,
    answers: data.answers || [],
    startedAtMillis,
    endsAtMillis: startedAtMillis + EXAM_DURATION_SECONDS * 1000,
    submittedAtMillis: timestampToMillis(data.submittedAt),
    elapsedSeconds: data.submittedAt
      ? calculateExamElapsedSeconds(
          timestampToMillis(data.startedAt),
          timestampToMillis(data.submittedAt),
          EXAM_DURATION_SECONDS
        )
      : null
  };
  if (data.status === 'submitted') Object.assign(result, await gradeExamAnswers(exam, data.answers));
  return result;
}

async function getActiveExamDocument() {
  const snapshot = await db.collection('exams').where('active', '==', true).get();
  if (snapshot.empty) return null;
  return snapshot.docs.sort((a, b) => timestampToMillis(b.data().createdAt) - timestampToMillis(a.data().createdAt))[0];
}

async function getStudentVisibleExamDocument() {
  const activeExam = await getActiveExamDocument();
  if (activeExam) return activeExam;
  const snapshot = await db.collection('exams').get();
  return snapshot.docs
    .filter(doc => doc.data().deleted !== true)
    .sort((a, b) => {
      const aTime = timestampToMillis(a.data().updatedAt || a.data().createdAt);
      const bTime = timestampToMillis(b.data().updatedAt || b.data().createdAt);
      return bTime - aTime;
    })[0] || null;
}

function getExamAttemptId(examId, uid) {
  return `${examId}__${uid}`;
}

function attemptIsStillRunning(attempt) {
  return attempt.status === 'in_progress'
    && Date.now() < timestampToMillis(attempt.startedAt) + EXAM_DURATION_SECONDS * 1000;
}

async function getExamsWithRunningAttempts() {
  const snapshot = await db.collection('examAttempts').get();
  return new Set(snapshot.docs
    .map(doc => doc.data())
    .filter(attemptIsStillRunning)
    .map(attempt => attempt.examId));
}

async function createExamOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const title = String(data.title || 'Prova de Inglês').trim().slice(0, 120);
  if (!title) throw new Error('Informe o título da prova.');
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error('Adicione pelo menos uma pergunta à prova.');

  const gradingSalt = createExamSalt();
  const questions = await Promise.all(data.questions.map(async (item, index) => {
    const prompt = String(item?.prompt || '').trim();
    const answer = String(item?.answer || '').trim();
    if (!prompt || !answer) throw new Error(`Preencha a pergunta e a resposta correta do item ${index + 1}.`);
    if (prompt.length > 5000 || answer.length > 5000) throw new Error(`O item ${index + 1} excede o limite de 5.000 caracteres.`);
    return {
      id: `q${index + 1}`,
      prompt,
      answerHash: await hashExamAnswer(answer, gradingSalt)
    };
  }));

  const [activeSnapshot, examsWithRunningAttempts] = await Promise.all([
    db.collection('exams').where('active', '==', true).get(),
    getExamsWithRunningAttempts()
  ]);
  if (activeSnapshot.docs.some(doc => examsWithRunningAttempts.has(doc.id))) {
    throw new Error('Existe uma tentativa em andamento na prova atual. Aguarde o término antes de publicar outra prova.');
  }
  const examRef = db.collection('exams').doc();
  const batch = db.batch();
  activeSnapshot.docs.forEach(doc => batch.update(doc.ref, {
    active: false,
    archivedAt: firebase.firestore.FieldValue.serverTimestamp()
  }));
  batch.set(examRef, {
    title,
    active: true,
    deleted: false,
    durationSeconds: EXAM_DURATION_SECONDS,
    questionCount: questions.length,
    questions,
    gradingSalt,
    createdBy: state.user.uid,
    createdByEmail: state.user.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  return { ok: true, examId: examRef.id, title, questionCount: questions.length };
}

function createManagedQuestionId() {
  return `q_${crypto.randomUUID ? crypto.randomUUID() : createExamSalt()}`;
}

async function listRegisteredExamsOnFreeTier() {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const snapshot = await db.collection('exams').get();
  const exams = snapshot.docs
    .map(serializeExamDocument)
    .filter(exam => !exam.deleted)
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return (b.updatedAtMillis || b.createdAtMillis) - (a.updatedAtMillis || a.createdAtMillis);
    });
  return { exams };
}

async function updateExamOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const examId = String(data.examId || '');
  const examRef = db.collection('exams').doc(examId);
  const [examDoc, attemptsSnapshot] = await Promise.all([
    examRef.get(),
    db.collection('examAttempts').get()
  ]);
  if (!examDoc.exists || examDoc.data().deleted === true) throw new Error('Prova não encontrada.');
  const relatedAttempts = attemptsSnapshot.docs
    .map(doc => doc.data())
    .filter(attempt => attempt.examId === examId);
  const legacyAttempts = relatedAttempts.filter(attempt => !attempt.examSnapshot);
  if (legacyAttempts.some(attemptIsStillRunning)) {
    throw new Error('Esta prova possui uma tentativa antiga em andamento. Aguarde o término antes de editá-la.');
  }

  const existing = serializeExamDocument(examDoc);
  const title = String(data.title || '').trim().slice(0, 120);
  if (!title) throw new Error('Informe o título da prova.');
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error('Mantenha pelo menos uma pergunta na prova.');
  const existingById = new Map(existing.questions.map(question => [question.id, question]));
  const questions = await Promise.all(data.questions.map(async (item, index) => {
    const prompt = String(item?.prompt || '').trim();
    const answer = String(item?.answer || '').trim();
    const previous = existingById.get(item?.id);
    if (!prompt) throw new Error(`Preencha a pergunta do item ${index + 1}.`);
    if (prompt.length > 5000 || answer.length > 5000) throw new Error(`O item ${index + 1} excede o limite de 5.000 caracteres.`);
    if (!answer && !previous?.answerHash) throw new Error(`Informe a resposta correta da nova questão ${index + 1}.`);
    return {
      id: previous?.id || createManagedQuestionId(),
      prompt,
      answerHash: answer ? await hashExamAnswer(answer, existing.gradingSalt) : previous.answerHash
    };
  }));

  if (legacyAttempts.length) {
    const replacementRef = db.collection('exams').doc();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(replacementRef, {
      title,
      active: existing.active,
      deleted: false,
      durationSeconds: existing.durationSeconds || EXAM_DURATION_SECONDS,
      questionCount: questions.length,
      questions,
      gradingSalt: existing.gradingSalt,
      createdBy: state.user.uid,
      createdByEmail: state.user.email,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      previousVersionId: examId
    });
    batch.update(examRef, {
      active: false,
      deleted: true,
      supersededBy: replacementRef.id,
      deletedAt: serverTimestamp,
      updatedAt: serverTimestamp
    });
    await batch.commit();
    return { ok: true, examId: replacementRef.id, title, questionCount: questions.length, versioned: true };
  }

  await examRef.update({
    title,
    questions,
    questionCount: questions.length,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, examId, title, questionCount: questions.length, versioned: false };
}

async function publishExamOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const examId = String(data.examId || '');
  const targetRef = db.collection('exams').doc(examId);
  const [targetDoc, activeSnapshot, examsWithRunningAttempts] = await Promise.all([
    targetRef.get(),
    db.collection('exams').where('active', '==', true).get(),
    getExamsWithRunningAttempts()
  ]);
  if (!targetDoc.exists || targetDoc.data().deleted === true) throw new Error('Prova não encontrada.');
  if (activeSnapshot.docs.some(doc => doc.id !== examId && examsWithRunningAttempts.has(doc.id))) {
    throw new Error('Existe uma tentativa em andamento na prova atual. Aguarde o término antes de publicar outra prova.');
  }

  const batch = db.batch();
  activeSnapshot.docs.forEach(doc => {
    if (doc.id !== examId) batch.update(doc.ref, {
      active: false,
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  batch.update(targetRef, {
    active: true,
    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  return { ok: true };
}

async function deactivateExamOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const examId = String(data.examId || '');
  const examRef = db.collection('exams').doc(examId);
  const [examDoc, examsWithRunningAttempts] = await Promise.all([
    examRef.get(),
    getExamsWithRunningAttempts()
  ]);
  if (!examDoc.exists || examDoc.data().deleted === true) throw new Error('Prova não encontrada.');
  if (examsWithRunningAttempts.has(examId)) {
    throw new Error('Esta prova possui uma tentativa em andamento e não pode ser desativada agora.');
  }
  if (examDoc.data().active !== true) return { ok: true };
  await examRef.update({
    active: false,
    deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
}

async function deleteExamOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const examId = String(data.examId || '');
  const examRef = db.collection('exams').doc(examId);
  const [examDoc, examsWithRunningAttempts] = await Promise.all([
    examRef.get(),
    getExamsWithRunningAttempts()
  ]);
  if (!examDoc.exists || examDoc.data().deleted === true) throw new Error('Prova não encontrada.');
  if (examsWithRunningAttempts.has(examId)) {
    throw new Error('Esta prova possui uma tentativa em andamento e não pode ser excluída agora.');
  }
  await examRef.update({
    active: false,
    deleted: true,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
}

async function getExamStateOnFreeTier() {
  const examDoc = await getStudentVisibleExamDocument();
  if (!examDoc) return { exam: null, attempt: null };
  const exam = serializeExamDocument(examDoc);
  const attemptRef = db.collection('examAttempts').doc(getExamAttemptId(exam.id, state.user.uid));
  const attemptDoc = await attemptRef.get();
  if (!attemptDoc.exists) return { exam, attempt: null };
  const rawAttempt = attemptDoc.data();
  const deadlineMillis = timestampToMillis(rawAttempt.startedAt) + EXAM_DURATION_SECONDS * 1000;
  if (rawAttempt.status === 'in_progress' && Date.now() >= deadlineMillis) {
    return { exam, attempt: await submitExamOnFreeTier({ examId: exam.id }) };
  }
  return { exam, attempt: await serializeAttemptData(rawAttempt, exam) };
}

async function startExamOnFreeTier(data) {
  const examId = String(data.examId || '');
  const firstName = validateStudentName(data.firstName, 'Nome');
  const lastName = validateStudentName(data.lastName, 'Sobrenome');
  const examRef = db.collection('exams').doc(examId);
  const attemptRef = db.collection('examAttempts').doc(getExamAttemptId(examId, state.user.uid));

  const exam = await db.runTransaction(async transaction => {
    const examDoc = await transaction.get(examRef);
    const attemptDoc = await transaction.get(attemptRef);
    if (!examDoc.exists || examDoc.data().active !== true) throw new Error('Esta prova não está mais disponível.');
    if (attemptDoc.exists) throw new Error('Você já iniciou esta prova. A tentativa é única.');

    const publicExam = serializeExamDocument(examDoc);
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    transaction.set(attemptRef, {
      examId,
      examTitle: publicExam.title,
      userId: state.user.uid,
      userEmail: state.user.email || '',
      firstName,
      lastName,
      status: 'in_progress',
      startedAt: serverTimestamp,
      examSnapshot: {
        title: publicExam.title,
        questions: publicExam.questions,
        gradingSalt: publicExam.gradingSalt
      },
      answers: sanitizeExamAnswers([], publicExam.questions),
      updatedAt: serverTimestamp
    });
    return publicExam;
  });

  const createdAttempt = await attemptRef.get();
  return { exam, attempt: await serializeAttemptData(createdAttempt.data(), exam) };
}

async function saveExamAnswersOnFreeTier(data) {
  const examId = String(data.examId || '');
  const examRef = db.collection('exams').doc(examId);
  const attemptRef = db.collection('examAttempts').doc(getExamAttemptId(examId, state.user.uid));
  await db.runTransaction(async transaction => {
    const examDoc = await transaction.get(examRef);
    const attemptDoc = await transaction.get(attemptRef);
    if (!examDoc.exists || !attemptDoc.exists) throw new Error('Tentativa não encontrada.');
    const attempt = attemptDoc.data();
    if (attempt.status !== 'in_progress') throw new Error('Esta prova já foi enviada.');
    const deadlineMillis = timestampToMillis(attempt.startedAt) + EXAM_DURATION_SECONDS * 1000;
    if (Date.now() >= deadlineMillis) throw new Error('O tempo da prova terminou.');
    const attemptQuestions = attempt.examSnapshot?.questions || examDoc.data().questions || [];
    transaction.update(attemptRef, {
      answers: sanitizeExamAnswers(data.answers, attemptQuestions),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  return { ok: true };
}

async function submitExamOnFreeTier(data) {
  const examId = String(data.examId || '');
  const examRef = db.collection('exams').doc(examId);
  const attemptRef = db.collection('examAttempts').doc(getExamAttemptId(examId, state.user.uid));
  const exam = await db.runTransaction(async transaction => {
    const examDoc = await transaction.get(examRef);
    const attemptDoc = await transaction.get(attemptRef);
    if (!examDoc.exists || !attemptDoc.exists) throw new Error('Tentativa não encontrada.');
    const publicExam = serializeExamDocument(examDoc);
    const attempt = attemptDoc.data();
    if (attempt.status === 'submitted') return publicExam;

    const attemptExam = getAttemptExam(attempt, publicExam);
    const deadlineMillis = timestampToMillis(attempt.startedAt) + EXAM_DURATION_SECONDS * 1000;
    const isPastDeadline = Date.now() >= deadlineMillis;
    const answers = sanitizeExamAnswers(
      isPastDeadline || data.answers === undefined ? attempt.answers : data.answers,
      attemptExam.questions
    );
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    transaction.update(attemptRef, {
      status: 'submitted',
      answers,
      submittedAt: serverTimestamp,
      updatedAt: serverTimestamp
    });
    return publicExam;
  });
  const submittedAttempt = await attemptRef.get();
  return serializeAttemptData(submittedAttempt.data(), exam);
}

async function listExamResultsOnFreeTier() {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const attemptsSnapshot = await db.collection('examAttempts').get();
  const submitted = attemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.status === 'submitted');
  const examIds = [...new Set(submitted.map(item => item.examId))];
  const examDocs = await Promise.all(examIds.map(id => db.collection('exams').doc(id).get()));
  const exams = new Map(examDocs.filter(doc => doc.exists).map(doc => [doc.id, serializeExamDocument(doc)]));
  const results = [];
  for (const item of submitted) {
    const exam = exams.get(item.examId);
    if (!exam) continue;
    const computed = await serializeAttemptData(item, exam);
    results.push({
      id: item.id,
      examId: item.examId,
      examTitle: item.examTitle,
      firstName: item.firstName,
      lastName: item.lastName,
      userEmail: item.userEmail,
      elapsedSeconds: computed.elapsedSeconds,
      correctCount: computed.correctCount,
      totalQuestions: computed.totalQuestions,
      percentage: computed.percentage,
      submittedAtMillis: computed.submittedAtMillis
    });
  }
  results.sort((a, b) => b.submittedAtMillis - a.submittedAtMillis);
  return { results };
}

const freeTierApi = {
  createExam: createExamOnFreeTier,
  listRegisteredExams: listRegisteredExamsOnFreeTier,
  updateExam: updateExamOnFreeTier,
  publishExam: publishExamOnFreeTier,
  deactivateExam: deactivateExamOnFreeTier,
  deleteExam: deleteExamOnFreeTier,
  getExamState: getExamStateOnFreeTier,
  startExam: startExamOnFreeTier,
  saveExamAnswers: saveExamAnswersOnFreeTier,
  submitExam: submitExamOnFreeTier,
  listExamResults: listExamResultsOnFreeTier
};

async function callExamApi(name, data = {}) {
  const operation = freeTierApi[name];
  if (!operation) throw new Error('Operação de avaliação desconhecida.');
  return operation(data);
}

// --- Game Balance ---
const XP_PER_LEVEL = 100;
const XP_CORRECT = 20;
const XP_STREAK_BONUS = 5;
const SURVIVOR_START_TIME = 30;
const MAX_SURVIVOR_TIME = 60;
const MAX_SHIELDS = 3;
const SHIELD_EVERY_STREAK = 10;
const SPEEDRUN_MODE = 'speedrun';

const topicQuestionMap = {
  'question-words': questionWordsData,
  'verb-to-be': verbToBeData,
  'computer-stuff': computerStuffData,
  'instructions': instructionsData,
  'tech-life': techLifeData,
  'connectivity': connectivityData,
  'numerals-units': numeralsData,
  'web-navigation': webNavigationData,
  'software-interfaces': softwareInterfacesData,
  'collaborative-tools': collaborativeToolsData,
  'manual-reading': manualReadingData
};

const allQuestionData = Object.entries(topicQuestionMap).flatMap(([topicId, questions]) =>
  questions.map((question, index) => ({
    ...question,
    id: `${topicId}-${index}`,
    topicId
  }))
);

function createDefaultStats() {
  return {
    nickname: '',
    nicknameKey: '',
    xp: 0,
    level: 1,
    topicHistory: {},
    survivorBest: 0,
    speedrunBestTime: 0,
    speedrunBestCorrect: 0,
    speedrunAttempts: 0,
    speedrunLastResult: null,
    totalCorrect: 0,
    quizzesCompleted: 0,
    rankingScore: 0
  };
}

// --- Application State ---
const state = {
  currentView: 'login',
  currentTopic: null,
  currentDifficulty: 'bronze',
  currentQuestionIndex: 0,
  questionQueue: [],
  score: 0,
  isAnswered: false,
  selectedAnswer: null,
  answerMode: 'multiple',
  streak: 0,
  user: null,
  timeLeft: SURVIVOR_START_TIME,
  timerId: null,
  isSurvivor: false,
  isSpeedrun: false,
  speedrunTime: 0,
  speedrunStartedAt: 0,
  survivorTier: 'bronze',
  shields: 0,
  lastQuestionStartTime: 0,
  lastQuestionId: null,
  survivorAskedIds: [],
  currentSurvivorQuestion: null,
  resultReason: 'completed',
  resultPersisted: false,
  leaderboard: [],
  userStats: createDefaultStats(),
  exam: null,
  examAttempt: null,
  examAnswers: [],
  examScreen: 'idle',
  examMessage: '',
  pendingIdentity: null,
  examSaveTimer: null,
  examSubmitting: false,
  examAutoSubmitAttempted: false,
  teacherExamTitle: 'Prova de Inglês',
  teacherQuestions: [{ prompt: '', answer: '' }],
  teacherMessage: '',
  examResults: [],
  examResultsStatus: 'idle',
  teacherExams: [],
  teacherExamsStatus: 'idle',
  teacherExamsMessage: '',
  editingExamId: null,
  editingExamTitle: '',
  editingExamQuestions: []
};

// --- Auth Observers ---
auth.onAuthStateChanged(async (user) => {
  try {
    if (user) {
      console.log("Usuário autenticado:", user.email);
      state.user = user;
      
      const loadSuccess = await loadProgressFromFirestore(user.uid);
      
      if (loadSuccess) {
        // Só salvamos se conseguimos carregar com sucesso (ou se é novo usuário)
        // Isso evita sobrescrever dados reais com o estado padrão em caso de erro de rede
        await saveProgressToFirestore();
      }
      
      await loadLeaderboardFromFirestore();
      state.currentView = getAuthorizedViewFromHash();
      if (!window.location.hash) {
        window.history.replaceState(null, '', '#/');
      }
    } else {
      state.user = null;
      state.currentView = 'login';
      state.userStats = createDefaultStats(); // Limpa estado local ao deslogar
    }
  } catch (error) {
    console.error("Erro crítico no observer de auth:", error);
  } finally {
    renderApp();
  }
});

// --- Data Sync ---
function normalizeStats(data = {}) {
  const defaults = createDefaultStats();
  const normalized = {
    ...defaults,
    ...data,
    nickname: sanitizeNickname(data.nickname || defaults.nickname),
    nicknameKey: data.nicknameKey || normalizeNicknameKey(data.nickname || defaults.nickname),
    level: Math.max(1, Number(data.level || defaults.level)),
    xp: Math.max(0, Number(data.xp || defaults.xp)),
    survivorBest: Math.max(0, Number(data.survivorBest || defaults.survivorBest)),
    speedrunBestTime: Math.max(0, Number(data.speedrunBestTime || defaults.speedrunBestTime)),
    speedrunBestCorrect: Math.max(0, Number(data.speedrunBestCorrect || defaults.speedrunBestCorrect)),
    speedrunAttempts: Math.max(0, Number(data.speedrunAttempts || defaults.speedrunAttempts)),
    speedrunLastResult: data.speedrunLastResult || defaults.speedrunLastResult,
    totalCorrect: Math.max(0, Number(data.totalCorrect || defaults.totalCorrect)),
    quizzesCompleted: Math.max(0, Number(data.quizzesCompleted || defaults.quizzesCompleted)),
    topicHistory: data.topicHistory || defaults.topicHistory
  };

  normalized.rankingScore = calculateRankingScore(normalized);
  return normalized;
}

function calculateRankingScore(stats) {
  const levelXP = (Math.max(1, stats.level) - 1) * XP_PER_LEVEL;
  const currentXP = Math.max(0, stats.xp);
  const totalXp = levelXP + currentXP;
  
  return totalXp + (stats.totalCorrect || 0) * 2 + (stats.survivorBest || 0) * 10;
}

function getUserProfilePayload() {
  const rankingScore = calculateRankingScore(state.userStats);
  state.userStats.rankingScore = rankingScore;

  return {
    ...state.userStats,
    displayName: state.user?.displayName || 'Aluno',
    nickname: sanitizeNickname(state.userStats.nickname || ''),
    nicknameKey: normalizeNicknameKey(state.userStats.nickname || ''),
    photoURL: state.user?.photoURL || '',
    email: state.user?.email || '',
    rankingScore,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

async function loadProgressFromFirestore(uid) {
  try {
    console.log("Carregando progresso do Firestore...");
    const doc = await db.collection('users').doc(uid).get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log("Dados carregados com sucesso:", data);
      state.userStats = normalizeStats(data);
      return true;
    } else {
      console.log("Nenhum dado encontrado para este usuário. Iniciando novo perfil.");
      state.userStats = createDefaultStats();
      return true;
    }
  } catch (error) {
    console.error("Erro ao carregar do Firestore:", error);
    // Se falhar a comunicação, mantemos o que temos mas avisamos que não foi carregado
    return false;
  }
}

async function saveProgressToFirestore() {
  if (!state.user) return false;

  try {
    const payload = getUserProfilePayload();
    await db.collection('users').doc(state.user.uid).set(payload, { merge: true });
    console.log("Progresso salvo com sucesso.");
    return true;
  } catch (error) {
    console.error("Erro ao salvar no Firestore:", error);
    // Se falhar o save, o usuário continua jogando localmente
    return false;
  }
}

async function loadLeaderboardFromFirestore() {
  if (!state.user) return;

  try {
    const snapshot = await db
      .collection('users')
      .orderBy('rankingScore', 'desc')
      .limit(10)
      .get();

    state.leaderboard = snapshot.docs.map((doc, index) => ({
      id: doc.id,
      rank: index + 1,
      ...normalizeStats(doc.data()),
      displayName: doc.data().displayName || 'Aluno',
      email: doc.data().email || '',
      photoURL: doc.data().photoURL || ''
    }));
  } catch (error) {
    console.warn("Nao foi possivel carregar o ranking:", error);
    state.leaderboard = [];
  }
}

async function isNicknameAvailable(nicknameKey) {
  const snapshot = await db
    .collection('users')
    .where('nicknameKey', '==', nicknameKey)
    .limit(1)
    .get();

  return snapshot.empty || snapshot.docs.every(doc => doc.id === state.user.uid);
}

async function saveNickname(rawNickname) {
  const validation = validateNickname(rawNickname);

  if (!validation.isValid) {
    return { ok: false, message: validation.message };
  }

  try {
    const available = await isNicknameAvailable(validation.nicknameKey);

    if (!available) {
      return { ok: false, message: 'Este nickname ja esta em uso.' };
    }

    state.userStats.nickname = validation.nickname;
    state.userStats.nicknameKey = validation.nicknameKey;

    const saved = await saveProgressToFirestore();
    if (!saved) {
      return { ok: false, message: 'Nao foi possivel salvar agora. Tente novamente.' };
    }

    await loadLeaderboardFromFirestore();
    return { ok: true };
  } catch (error) {
    console.error('Erro ao salvar nickname:', error);
    return { ok: false, message: 'Nao foi possivel validar o nickname.' };
  }
}

function getSpeedrunElapsedSeconds() {
  if (!state.speedrunStartedAt) return state.speedrunTime;
  return Math.floor((Date.now() - state.speedrunStartedAt) / 1000);
}

function createSpeedrunResult(totalQuestions) {
  const errors = Math.max(0, totalQuestions - state.score);

  return {
    mode: SPEEDRUN_MODE,
    timeSeconds: state.speedrunTime,
    correct: state.score,
    errors,
    totalQuestions,
    completedAt: new Date().toISOString()
  };
}

function recordSpeedrunResult(totalQuestions) {
  if (state.resultPersisted) return state.userStats.speedrunLastResult;

  const result = createSpeedrunResult(totalQuestions);
  const currentBestTime = Number(state.userStats.speedrunBestTime || 0);
  const currentBestCorrect = Number(state.userStats.speedrunBestCorrect || 0);
  const isBetterResult =
    !currentBestTime ||
    result.correct > currentBestCorrect ||
    (result.correct === currentBestCorrect && result.timeSeconds < currentBestTime);

  state.resultPersisted = true;
  state.userStats.speedrunAttempts++;
  state.userStats.speedrunLastResult = result;

  if (isBetterResult) {
    state.userStats.speedrunBestTime = result.timeSeconds;
    state.userStats.speedrunBestCorrect = result.correct;
  }

  persistSpeedrunResult(result);
  return result;
}

async function persistSpeedrunResult(result) {
  if (!state.user) return;

  await saveProgressToFirestore();

  try {
    await db.collection('gameResults').add({
      ...result,
      userId: state.user.uid,
      nickname: getCurrentProfileName(),
      displayName: state.user.displayName || '',
      email: state.user.email || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn('Nao foi possivel registrar a tentativa de Speedrun:', error);
  }
}

// --- Auth Actions ---
window.loginWithGoogle = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(error => {
    console.error("Erro ao fazer login:", error);
    alert("Erro ao fazer login com Google.");
  });
};

window.logout = () => {
  stopTimer();
  auth.signOut();
};

// --- Utility ---
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCurrentProfileName() {
  return resolveProfileName({
    nickname: state.userStats.nickname,
    displayName: state.user?.displayName,
    email: state.user?.email
  });
}

function getAccountDisplayName() {
  return state.user?.displayName || state.user?.email || 'Aluno';
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function withShuffledOptions(question) {
  return {
    ...question,
    optionOrder: shuffleArray(question.options || [])
  };
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isCorrectAnswer(answer, question) {
  const acceptedAnswers = [question.answer, ...(question.acceptedAnswers || [])];
  return acceptedAnswers.some(correctAnswer => normalizeAnswer(correctAnswer) === normalizeAnswer(answer));
}

function launchConfetti(options) {
  if (typeof confetti === 'function') {
    confetti(options);
  }
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

// --- XP Logic ---
function addXP(amount) {
  state.userStats.xp += amount;

  while (state.userStats.xp >= XP_PER_LEVEL) {
    state.userStats.level++;
    state.userStats.xp -= XP_PER_LEVEL;
    launchConfetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#ffffff']
    });
  }

  saveProgressToFirestore();
  updateHeader();
}

// --- Application Routes ---
const viewRoutes = {
  home: '#/',
  exam: '#/prova',
  'teacher-create': '#/professor/criacao-de-prova',
  'teacher-exams': '#/professor/provas-cadastradas',
  'teacher-results': '#/professor/resultados'
};

function getAuthorizedViewFromHash() {
  const route = window.location.hash || '#/';
  const requestedView = Object.entries(viewRoutes).find(([, hash]) => hash === route)?.[0] || 'home';
  const teacherOnly = requestedView === 'teacher-create'
    || requestedView === 'teacher-exams'
    || requestedView === 'teacher-results';

  if (teacherOnly && !isAdmin()) return 'home';
  if (requestedView === 'exam' && isAdmin()) return 'home';
  return requestedView;
}

window.navigateTo = view => {
  const route = viewRoutes[view] || viewRoutes.home;
  if (view === 'exam') state.examScreen = 'idle';
  if (view === 'teacher-exams') state.teacherExamsStatus = 'idle';
  if (view === 'teacher-results') state.examResultsStatus = 'idle';
  if (window.location.hash === route) {
    state.currentView = getAuthorizedViewFromHash();
    renderApp();
    return;
  }
  window.location.hash = route;
};

window.addEventListener('hashchange', () => {
  if (!state.user) return;
  stopTimer();
  if (state.examSaveTimer) clearTimeout(state.examSaveTimer);
  state.currentView = getAuthorizedViewFromHash();
  const authorizedRoute = viewRoutes[state.currentView];
  if (window.location.hash !== authorizedRoute) {
    window.history.replaceState(null, '', authorizedRoute);
  }
  renderApp();
});

// --- UI Rendering ---
function renderApp() {
  if (!state.user) {
    renderLogin();
    return;
  }

  updateHeader();
  if (state.currentView === 'home') renderHome();
  else if (state.currentView === 'quiz') renderQuiz();
  else if (state.currentView === 'exam' && !isAdmin()) renderExamPortal();
  else if (state.currentView === 'teacher-create' && isAdmin()) renderTeacherExamCreator();
  else if (state.currentView === 'teacher-exams' && isAdmin()) renderTeacherExamManager();
  else if (state.currentView === 'teacher-results' && isAdmin()) renderTeacherResults();
  else {
    state.currentView = 'home';
    renderHome();
  }
}

function renderLogin() {
  const mainContent = document.getElementById('main-content');
  const headerTop = document.querySelector('.header-top');
  if (headerTop) headerTop.style.display = 'none';
  document.querySelector('header p').style.display = 'none';

  mainContent.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <h2>Bem-vindo!</h2>
        <p>Para começar sua jornada no inglês, faça login com sua conta Google.</p>
        <button class="next-btn" onclick="window.loginWithGoogle()">
          Fazer Login com Google
        </button>
        <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted)">
          Plataforma protegida pelo Firebase.
        </div>
      </div>
    </div>
  `;
}

function updateHeader() {
  const headerTop = document.querySelector('.header-top');
  if (!headerTop) return;

  headerTop.style.display = 'flex';
  document.querySelector('header p').style.display = 'block';

  const photoURL = state.user.photoURL || '';
  const profileName = escapeHtml(getCurrentProfileName());
  const accountName = escapeHtml(getAccountDisplayName());
  const profileHint = state.userStats.nickname ? accountName : 'Sem nickname';
  const xpPercent = Math.min(100, (state.userStats.xp / XP_PER_LEVEL) * 100);

  headerTop.innerHTML = `
    <div class="user-profile">
      ${photoURL ? `<img src="${escapeHtml(photoURL)}" class="user-avatar" alt="Profile">` : '<div class="user-avatar avatar-fallback">A</div>'}
      <div class="user-profile-copy">
        <div class="profile-display-name">${profileName}</div>
        <div class="profile-subtitle">${escapeHtml(profileHint)}</div>
        <div class="profile-actions">
          <button class="profile-action-btn" onclick="window.openNicknameModal()">Editar nick</button>
          <button class="logout-btn" onclick="window.logout()">Sair</button>
        </div>
      </div>
    </div>

    <nav class="app-nav" aria-label="Navegação principal">
      <button class="nav-btn ${state.currentView === 'home' ? 'active' : ''}" onclick="window.navigateTo('home')">Início</button>
      ${isAdmin() ? `
        <button class="nav-btn ${state.currentView === 'teacher-create' ? 'active' : ''}" onclick="window.navigateTo('teacher-create')">Criação de Prova</button>
        <button class="nav-btn ${state.currentView === 'teacher-exams' ? 'active' : ''}" onclick="window.navigateTo('teacher-exams')">Provas cadastradas</button>
        <button class="nav-btn ${state.currentView === 'teacher-results' ? 'active' : ''}" onclick="window.navigateTo('teacher-results')">Resultados</button>
      ` : `
        <button class="nav-btn ${state.currentView === 'exam' ? 'active' : ''}" onclick="window.navigateTo('exam')">${state.examScreen === 'locked' ? '🔒 ' : ''}Prova</button>
      `}
    </nav>

    <div class="user-stats">
      <div class="level-badge">Nível <span id="user-level">${state.userStats.level}</span></div>
      <div class="xp-container">
        <div class="xp-bar-fill" id="user-xp-bar" style="width: ${xpPercent}%"></div>
        <span class="xp-text"><span>${state.userStats.xp}</span> XP</span>
      </div>
    </div>
  `;
}

function renderHome() {
  state.currentView = 'home';
  const mainContent = document.getElementById('main-content');

  const totalQuestions = allQuestionData.length;
  const progressPercent = Math.min(100, (state.userStats.totalCorrect / totalQuestions * 100).toFixed(0));

  mainContent.innerHTML = `
    <div class="home-container">
      <div class="gamification-row">
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <div class="stat-info">
            <h4>Sequência</h4>
            <p>${state.streak} Dias</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🎯</div>
          <div class="stat-info">
            <h4>Precisão</h4>
            <p>${state.userStats.totalCorrect} Acertos</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏆</div>
          <div class="stat-info">
            <h4>Seu Posto</h4>
            <p>#${state.leaderboard.findIndex(s => s.id === state.user.uid) + 1 || '--'}</p>
          </div>
        </div>
      </div>

      <div class="home-dashboard">
        ${renderAnswerModePanel()}
        ${renderLeaderboard()}
      </div>

      <div class="game-modes-grid">
        <div class="survivor-banner" onclick="window.startSurvivor()">
          <div class="survivor-content">
            <h2>MODO SOBREVIVENTE ⏳</h2>
            <p>O tempo não para! Acerte para ganhar segundos, até o teto de ${MAX_SURVIVOR_TIME}s.</p>
            <div class="best-score">RECORDE PESSOAL: ${state.userStats.survivorBest || 0} PTS</div>
          </div>
        </div>

        <div class="speedrun-banner" onclick="window.startSpeedrun()">
          <div class="survivor-content">
            <h2>SPEEDRUN ⏱</h2>
            <p>Responda 3 perguntas por tópico com cronômetro total e ordem aleatória.</p>
            <div class="best-score speedrun-best">
              MELHOR: ${state.userStats.speedrunBestTime ? `${state.userStats.speedrunBestCorrect} acertos em ${formatElapsedTime(state.userStats.speedrunBestTime)}` : '--'}
            </div>
          </div>
        </div>
      </div>

      <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
        <h3 style="font-size: 1.5rem; font-weight: 800;">Explorar Tópicos</h3>
        <span class="progress-pill" style="background: rgba(255,255,255,0.05); padding: 0.4rem 1rem; border-radius: 50px; font-size: 0.8rem; font-weight: 700; border: 1px solid var(--glass-border); color: var(--primary);">${progressPercent}% concluído</span>
      </div>

      <div class="topic-grid">
        ${topics.map(topic => {
          const history = state.userStats.topicHistory[topic.id] || { stars: 0 };
          return `
          <div class="topic-card ${topic.locked ? 'locked' : ''}"
               style="--card-color: ${topic.color}"
               onclick="${topic.locked ? '' : `window.openDifficultyModal('${topic.id}')`}">
            <div class="topic-icon">${topic.icon}</div>
            <div class="topic-stars">
              ${Array.from({ length: 3 }).map((_, i) => `
                <span class="${i < history.stars ? 'star-filled' : 'star-empty'}">★</span>
              `).join('')}
            </div>
            <h3>${escapeHtml(topic.title)}</h3>
            <p>${escapeHtml(topic.description)}</p>
          </div>
        `}).join('')}
      </div>
    </div>

    <div id="difficulty-modal" class="modal">
      <div class="modal-content">
        <h2>Escolha a Dificuldade</h2>
        <div class="difficulty-options">
          <button class="diff-btn bronze" onclick="window.startQuiz(window.pendingTopic, 'bronze')">
            <span class="diff-icon">🥉</span> BRONZE (Iniciante)
          </button>
          <button class="diff-btn prata" onclick="window.startQuiz(window.pendingTopic, 'prata')">
            <span class="diff-icon">🥈</span> PRATA (Intermediário)
          </button>
          <button class="diff-btn ouro" onclick="window.startQuiz(window.pendingTopic, 'ouro')">
            <span class="diff-icon">🥇</span> OURO (Avançado)
          </button>
        </div>
        <button class="close-modal" onclick="window.closeDifficultyModal()">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAnswerModePanel() {
  return `
    <section class="answer-mode-panel" aria-label="Modo de resposta">
      <div>
        <h2>Modo de resposta</h2>
        <p>${state.answerMode === 'multiple' ? 'Toque na alternativa correta.' : 'Digite a resposta correta.'}</p>
      </div>
      <div class="mode-toggle">
        <button class="mode-btn ${state.answerMode === 'multiple' ? 'active' : ''}" onclick="window.setAnswerMode('multiple')">
          Alternativas
        </button>
        <button class="mode-btn ${state.answerMode === 'written' ? 'active' : ''}" onclick="window.setAnswerMode('written')">
          Escrita
        </button>
      </div>
    </section>
  `;
}

function renderNicknameModal() {
  return `
    <div id="nickname-modal" class="modal" aria-hidden="true">
      <div class="modal-content nickname-modal-content">
        <h2>Seu nickname</h2>
        <p class="modal-description">Este nome aparece no ranking e nas telas do jogo.</p>
        <form class="nickname-form" onsubmit="window.submitNickname(event)">
          <input
            id="nickname-input"
            class="nickname-input"
            type="text"
            autocomplete="off"
            maxlength="20"
            placeholder="Digite seu nickname"
            aria-label="Nickname"
          />
          <div id="nickname-feedback" class="nickname-feedback" role="status"></div>
          <button class="next-btn nickname-submit" type="submit">Salvar nickname</button>
        </form>
        <button class="close-modal" onclick="window.closeNicknameModal()">Cancelar</button>
      </div>
    </div>
  `;
}

function ensureNicknameModal() {
  let modal = document.getElementById('nickname-modal');

  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', renderNicknameModal());
    modal = document.getElementById('nickname-modal');
  }

  return modal;
}

function setNicknameFeedback(message, type = 'error') {
  const feedback = document.getElementById('nickname-feedback');
  if (!feedback) return;

  feedback.textContent = message || '';
  feedback.className = `nickname-feedback ${type}`;
}

function renderLeaderboard() {
  const rows = state.leaderboard.length
    ? state.leaderboard.map(student => `
        <div class="leaderboard-row ${student.id === state.user.uid ? 'current-student' : ''}">
          <span class="rank-position">#${student.rank}</span>
          <span class="rank-name">${escapeHtml(resolveProfileName(student))}</span>
          <span class="rank-score">${student.rankingScore || 0} pts</span>
        </div>
      `).join('')
    : '<div class="leaderboard-empty">Ranking indisponível no momento.</div>';

  return `
    <section class="leaderboard-panel" aria-label="Ranking dos alunos">
      <div class="leaderboard-header">
        <h2>Ranking dos alunos</h2>
        <button class="refresh-rank-btn" onclick="window.refreshLeaderboard()" aria-label="Atualizar ranking">↻</button>
      </div>
      <div class="leaderboard-list">${rows}</div>
    </section>
  `;
}

function formatExamTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function formatExamDate(timestamp) {
  if (!timestamp) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

function renderTeacherExamCreator() {
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <section class="exam-page teacher-exam-page">
      <div class="exam-page-heading">
        <div>
          <span class="eyebrow">Área do professor</span>
          <h2>Criação de Prova</h2>
          <p>Monte o gabarito. Ao confirmar, esta prova substituirá a avaliação atualmente disponível.</p>
        </div>
      </div>

      <form class="exam-builder" onsubmit="window.submitExamCreation(event)">
        <label class="exam-field">
          <span>Título da prova</span>
          <input type="text" maxlength="120" required value="${escapeHtml(state.teacherExamTitle)}"
            oninput="window.updateTeacherExamTitle(this.value)" placeholder="Ex.: Avaliação de Inglês - Unidade 1" />
        </label>

        <div class="builder-heading">
          <h3>Perguntas e respostas</h3>
          <span>${state.teacherQuestions.length} ${state.teacherQuestions.length === 1 ? 'questão' : 'questões'}</span>
        </div>

        <div class="question-builder-list">
          ${state.teacherQuestions.map((item, index) => `
            <article class="question-builder-card">
              <div class="question-builder-number">${index + 1}</div>
              <label class="exam-field">
                <span>Pergunta</span>
                <textarea required maxlength="5000" rows="3" placeholder="Digite a pergunta"
                  oninput="window.updateTeacherQuestion(${index}, 'prompt', this.value)">${escapeHtml(item.prompt)}</textarea>
              </label>
              <label class="exam-field correct-answer-field">
                <span>Resposta correta</span>
                <textarea required maxlength="5000" rows="2" placeholder="Digite a resposta esperada"
                  oninput="window.updateTeacherQuestion(${index}, 'answer', this.value)">${escapeHtml(item.answer)}</textarea>
              </label>
              <button type="button" class="remove-question-btn" onclick="window.removeTeacherQuestion(${index})"
                ${state.teacherQuestions.length === 1 ? 'disabled' : ''} aria-label="Remover questão ${index + 1}">Remover</button>
            </article>
          `).join('')}
        </div>

        <button type="button" class="add-question-btn" onclick="window.addTeacherQuestion()">
          <span aria-hidden="true">+</span> Adicionar pergunta
        </button>

        ${state.teacherMessage ? `<div class="exam-alert ${state.teacherMessage.startsWith('Prova criada') ? 'success' : 'error'}" role="status">${escapeHtml(state.teacherMessage)}</div>` : ''}

        <button type="submit" class="next-btn confirm-exam-btn">Confirmar Criação</button>
      </form>
    </section>
  `;
}

function renderTeacherExamManager() {
  const mainContent = document.getElementById('main-content');
  if (state.editingExamId) {
    renderTeacherExamEditor(mainContent);
    return;
  }
  if (state.teacherExamsStatus === 'idle') {
    state.teacherExamsStatus = 'loading';
    queueMicrotask(loadTeacherExams);
  }

  const content = state.teacherExamsStatus === 'loading'
    ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando provas...</p></div>'
    : state.teacherExamsStatus === 'error'
      ? `<div class="exam-empty"><h3>Não foi possível carregar</h3><p>${escapeHtml(state.teacherExamsMessage)}</p><button class="next-btn" onclick="window.refreshTeacherExams()">Tentar novamente</button></div>`
      : state.teacherExams.length
        ? `<div class="registered-exams-grid">
            ${state.teacherExams.map(exam => `
              <article class="registered-exam-card ${exam.active ? 'active' : ''}">
                <div class="registered-exam-topline">
                  <span class="exam-status-badge ${exam.active ? 'active' : 'inactive'}">${exam.active ? 'Ativa para alunos' : '🔒 Desativada'}</span>
                  <span class="registered-exam-date">${formatExamDate(exam.updatedAtMillis || exam.createdAtMillis)}</span>
                </div>
                <h3>${escapeHtml(exam.title)}</h3>
                <p>${exam.questionCount} ${exam.questionCount === 1 ? 'questão cadastrada' : 'questões cadastradas'}</p>
                <div class="registered-exam-actions">
                  <button class="secondary-btn" onclick="window.startEditingExam('${exam.id}')">Editar</button>
                  ${exam.active
                    ? `<button class="deactivate-exam-btn" onclick="window.deactivateRegisteredExam('${exam.id}')">Desativar</button>`
                    : `<button class="publish-exam-btn" onclick="window.publishRegisteredExam('${exam.id}')">Ativar</button>`}
                  <button class="delete-exam-btn" onclick="window.deleteRegisteredExam('${exam.id}')">Excluir</button>
                </div>
              </article>
            `).join('')}
          </div>`
        : `<div class="exam-empty"><div class="empty-icon">📄</div><h3>Nenhuma prova cadastrada</h3><p>Crie sua primeira avaliação para disponibilizá-la aos alunos.</p><button class="next-btn" onclick="window.navigateTo('teacher-create')">Criar prova</button></div>`;

  mainContent.innerHTML = `
    <section class="exam-page teacher-exams-manager">
      <div class="exam-page-heading results-heading">
        <div><span class="eyebrow">Área do professor</span><h2>Provas cadastradas</h2><p>Visualize, atualize, ative, desative ou remova avaliações.</p></div>
        <button class="secondary-btn" onclick="window.refreshTeacherExams()">Atualizar lista</button>
      </div>
      ${state.teacherExamsMessage && state.teacherExamsStatus !== 'error' ? `<div class="exam-alert ${state.teacherExamsMessage.startsWith('Erro:') ? 'error' : 'success'}" role="status">${escapeHtml(state.teacherExamsMessage)}</div>` : ''}
      ${content}
    </section>
  `;
}

function renderTeacherExamEditor(mainContent) {
  mainContent.innerHTML = `
    <section class="exam-page teacher-exam-editor">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Editar prova</span><h2>${escapeHtml(state.editingExamTitle)}</h2><p>Deixe a resposta correta em branco para manter o gabarito atual.</p></div>
        <button class="secondary-btn" onclick="window.cancelExamEditing()">Cancelar edição</button>
      </div>
      <form class="exam-builder" onsubmit="window.submitExamUpdate(event)">
        <label class="exam-field"><span>Título da prova</span><input type="text" maxlength="120" required value="${escapeHtml(state.editingExamTitle)}" oninput="window.updateEditingExamTitle(this.value)" /></label>
        <div class="builder-heading"><h3>Perguntas e respostas</h3><span>${state.editingExamQuestions.length} ${state.editingExamQuestions.length === 1 ? 'questão' : 'questões'}</span></div>
        <div class="question-builder-list">
          ${state.editingExamQuestions.map((item, index) => `
            <article class="question-builder-card">
              <div class="question-builder-number">${index + 1}</div>
              <label class="exam-field"><span>Pergunta</span><textarea required maxlength="5000" rows="3" oninput="window.updateEditingExamQuestion(${index}, 'prompt', this.value)">${escapeHtml(item.prompt)}</textarea></label>
              <label class="exam-field correct-answer-field">
                <span>Resposta correta ${item.id ? '<small>(opcional se não mudou)</small>' : '<small>(obrigatória)</small>'}</span>
                <textarea ${item.id ? '' : 'required'} maxlength="5000" rows="2" placeholder="${item.id ? 'Deixe em branco para manter a resposta atual' : 'Digite a resposta correta'}" oninput="window.updateEditingExamQuestion(${index}, 'answer', this.value)">${escapeHtml(item.answer || '')}</textarea>
              </label>
              <button type="button" class="remove-question-btn" onclick="window.removeEditingExamQuestion(${index})" ${state.editingExamQuestions.length === 1 ? 'disabled' : ''}>Remover</button>
            </article>
          `).join('')}
        </div>
        <button type="button" class="add-question-btn" onclick="window.addEditingExamQuestion()"><span aria-hidden="true">+</span> Adicionar pergunta</button>
        ${state.teacherExamsMessage ? `<div class="exam-alert ${state.teacherExamsMessage.startsWith('Erro:') ? 'error' : 'success'}">${escapeHtml(state.teacherExamsMessage)}</div>` : ''}
        <button type="submit" class="next-btn confirm-exam-btn">Salvar alterações</button>
      </form>
    </section>
  `;
}

async function loadTeacherExams() {
  try {
    const data = await callExamApi('listRegisteredExams');
    state.teacherExams = data.exams || [];
    state.teacherExamsStatus = 'ready';
  } catch (error) {
    state.teacherExamsStatus = 'error';
    state.teacherExamsMessage = getFriendlyError(error, 'Não foi possível carregar as provas.');
  }
  if (state.currentView === 'teacher-exams') renderTeacherExamManager();
}

function renderTeacherResults() {
  const mainContent = document.getElementById('main-content');
  if (state.examResultsStatus === 'idle') {
    state.examResultsStatus = 'loading';
    queueMicrotask(loadTeacherResults);
  }

  const content = state.examResultsStatus === 'loading'
    ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando resultados...</p></div>'
    : state.examResultsStatus === 'error'
      ? `<div class="exam-empty"><h3>Não foi possível carregar</h3><p>${escapeHtml(state.examMessage)}</p><button class="next-btn" onclick="window.refreshExamResults()">Tentar novamente</button></div>`
      : state.examResults.length
        ? `
          <div class="results-table-wrap">
            <table class="results-table">
              <thead><tr><th>Aluno</th><th>Prova</th><th>Tempo total</th><th>Nota</th><th>Enviada em</th></tr></thead>
              <tbody>
                ${state.examResults.map(result => `
                  <tr>
                    <td><strong>${escapeHtml(`${result.firstName} ${result.lastName}`)}</strong><small>${escapeHtml(result.userEmail || '')}</small></td>
                    <td>${escapeHtml(result.examTitle || 'Prova')}</td>
                    <td>${formatExamTime(result.elapsedSeconds)}</td>
                    <td><span class="grade-pill">${result.correctCount}/${result.totalQuestions} · ${result.percentage}%</span></td>
                    <td>${formatExamDate(result.submittedAtMillis)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
        : '<div class="exam-empty"><h3>Nenhuma prova realizada</h3><p>Os resultados aparecerão aqui assim que os alunos enviarem a avaliação.</p></div>';

  mainContent.innerHTML = `
    <section class="exam-page teacher-results-page">
      <div class="exam-page-heading results-heading">
        <div><span class="eyebrow">Área do professor</span><h2>Dashboard de Resultados</h2><p>Acompanhe notas e duração das avaliações enviadas.</p></div>
        <button class="secondary-btn" onclick="window.refreshExamResults()">Atualizar</button>
      </div>
      ${content}
    </section>
  `;
}

async function loadTeacherResults() {
  try {
    const data = await callExamApi('listExamResults');
    state.examResults = data.results || [];
    state.examResultsStatus = 'ready';
  } catch (error) {
    state.examResultsStatus = 'error';
    state.examMessage = getFriendlyError(error, 'Não foi possível carregar os resultados.');
  }
  if (state.currentView === 'teacher-results') renderTeacherResults();
}

function renderExamPortal() {
  const mainContent = document.getElementById('main-content');
  if (state.examScreen === 'idle') {
    state.examScreen = 'loading';
    queueMicrotask(loadExamPortal);
  }

  if (state.examScreen === 'loading') {
    mainContent.innerHTML = '<section class="exam-page"><div class="exam-loading"><div class="loading-spinner"></div><p>Carregando prova...</p></div></section>';
    return;
  }
  if (state.examScreen === 'error') {
    mainContent.innerHTML = `<section class="exam-page"><div class="exam-empty"><h2>Não foi possível abrir a prova</h2><p>${escapeHtml(state.examMessage)}</p><button class="next-btn" onclick="window.reloadExamPortal()">Tentar novamente</button></div></section>`;
    return;
  }
  if (state.examScreen === 'empty' || !state.exam) {
    mainContent.innerHTML = '<section class="exam-page"><div class="exam-empty"><div class="empty-icon">📝</div><h2>Nenhuma prova disponível</h2><p>O professor ainda não publicou uma avaliação. Volte mais tarde.</p></div></section>';
    return;
  }
  if (state.examScreen === 'locked') {
    mainContent.innerHTML = `
      <section class="exam-page locked-exam-page">
        <div class="locked-exam-card">
          <div class="locked-exam-icon" aria-hidden="true">🔒</div>
          <span class="eyebrow">Avaliação bloqueada</span>
          <h2>${escapeHtml(state.exam.title)}</h2>
          <p>Esta prova está cadastrada, mas ainda não foi ativada pelo professor.</p>
          <div class="locked-exam-info"><span>${state.exam.questionCount} ${state.exam.questionCount === 1 ? 'questão' : 'questões'}</span><span>Tempo previsto: 2 horas</span></div>
          <div class="exam-alert locked" role="status">Aguarde o professor liberar a avaliação. Enquanto estiver bloqueada, nenhuma tentativa poderá ser iniciada.</div>
        </div>
      </section>
    `;
    return;
  }
  if (state.examScreen === 'instructions') {
    renderExamInstructions(mainContent);
    return;
  }
  if (state.examScreen === 'taking') {
    renderActiveExam(mainContent);
    return;
  }
  if (state.examScreen === 'result') {
    renderExamResult(mainContent);
    return;
  }

  mainContent.innerHTML = `
    <section class="exam-page identification-page">
      <div class="exam-card identification-card">
        <span class="eyebrow">${escapeHtml(state.exam.title)}</span>
        <h2>Identificação do aluno</h2>
        <p class="identity-warning">Insira seu nome e sobrenome verdadeiros. Não utilize nicknames.</p>
        <form class="identity-form" onsubmit="window.continueToExamInstructions(event)">
          <label class="exam-field"><span>Nome</span><input name="firstName" type="text" minlength="2" maxlength="80" required autocomplete="given-name" /></label>
          <label class="exam-field"><span>Sobrenome</span><input name="lastName" type="text" minlength="2" maxlength="80" required autocomplete="family-name" /></label>
          <button class="next-btn" type="submit">Continuar</button>
        </form>
      </div>
    </section>
  `;
}

function renderExamInstructions(mainContent) {
  const identity = state.pendingIdentity || {};
  mainContent.innerHTML = `
    <section class="exam-page instructions-page">
      <div class="exam-card instructions-card">
        <span class="eyebrow">Antes de começar</span>
        <h2>Leia as regras da avaliação</h2>
        <div class="rule-notice">
          <div class="rule-icon">!</div>
          <div>
            <h3>Aviso contra fraude</h3>
            <p>Este computador será monitorado contra o uso de internet ou Inteligências Artificiais durante a avaliação. Qualquer fraude identificada anulará a prova.</p>
          </div>
        </div>
        <ul class="exam-rules">
          <li>Você terá <strong>2 horas</strong> a partir da confirmação.</li>
          <li>A tentativa é <strong>única</strong> e não poderá ser reiniciada.</li>
          <li>Ao zerar o cronômetro, as respostas preenchidas serão enviadas automaticamente.</li>
          <li>Confira seu nome: <strong>${escapeHtml(`${identity.firstName || ''} ${identity.lastName || ''}`)}</strong>.</li>
        </ul>
        ${state.examMessage ? `<div class="exam-alert error">${escapeHtml(state.examMessage)}</div>` : ''}
        <div class="instruction-actions">
          <button class="secondary-btn" onclick="window.backToExamIdentification()">Corrigir nome</button>
          <button class="next-btn" onclick="window.confirmExamStart()">Confirmar e iniciar prova</button>
        </div>
      </div>
    </section>
  `;
}

function renderActiveExam(mainContent) {
  const attempt = state.examAttempt;
  const questions = state.exam.questions || [];
  mainContent.innerHTML = `
    <section class="exam-page active-exam-page">
      <div class="active-exam-topbar">
        <div><span class="eyebrow">Em andamento</span><h2>${escapeHtml(state.exam.title)}</h2><p>${escapeHtml(`${attempt.firstName} ${attempt.lastName}`)}</p></div>
        <div class="exam-countdown" aria-live="polite"><span>Tempo restante</span><strong id="exam-countdown">${formatExamTime(Math.ceil((attempt.endsAtMillis - Date.now()) / 1000))}</strong></div>
      </div>
      <div id="exam-save-status" class="exam-save-status">Respostas salvas automaticamente</div>
      <form class="student-question-list" onsubmit="window.submitExamManually(event)">
        ${questions.map((question, index) => `
          <article class="student-question-card">
            <div class="student-question-number">Questão ${index + 1} de ${questions.length}</div>
            <h3>${escapeHtml(question.prompt)}</h3>
            <label class="exam-field"><span>Sua resposta</span><textarea rows="4" maxlength="5000" placeholder="Digite sua resposta" oninput="window.updateStudentExamAnswer(${index}, this.value)">${escapeHtml(state.examAnswers[index]?.value || '')}</textarea></label>
          </article>
        `).join('')}
        ${state.examMessage ? `<div class="exam-alert error" role="alert">${escapeHtml(state.examMessage)}</div>` : ''}
        <button class="next-btn submit-exam-btn" type="submit" ${state.examSubmitting ? 'disabled' : ''}>${state.examSubmitting ? 'Enviando...' : 'Enviar prova'}</button>
      </form>
    </section>
  `;
  startExamCountdown();
}

function renderExamResult(mainContent) {
  const result = state.examAttempt;
  const feedback = result.feedback || [];
  mainContent.innerHTML = `
    <section class="exam-page exam-result-page">
      <div class="exam-result-summary">
        <span class="eyebrow">Prova corrigida</span>
        <h2>${escapeHtml(state.exam.title)}</h2>
        <div class="result-grade">${result.percentage}%</div>
        <p>Você acertou <strong>${result.correctCount}</strong> de <strong>${result.totalQuestions}</strong> questões.</p>
        <div class="result-meta"><span>Tempo total: <strong>${formatExamTime(result.elapsedSeconds)}</strong></span><span>Aluno: <strong>${escapeHtml(`${result.firstName} ${result.lastName}`)}</strong></span></div>
      </div>
      <div class="feedback-list">
        <h3>Feedback da avaliação</h3>
        ${feedback.map((item, index) => `
          <article class="feedback-card ${item.isCorrect ? 'correct' : 'incorrect'}">
            <div class="feedback-status">${item.isCorrect ? '✓ Correta' : '✕ Incorreta'}</div>
            <h4>${index + 1}. ${escapeHtml(item.prompt)}</h4>
            <p><span>Sua resposta:</span> ${escapeHtml(item.studentAnswer || 'Não respondida')}</p>
            ${item.isCorrect ? '' : '<p><span>Feedback:</span> Sua resposta não corresponde ao gabarito.</p>'}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

async function loadExamPortal() {
  try {
    const data = await callExamApi('getExamState');
    state.exam = data.exam;
    state.examAttempt = data.attempt;
    state.examMessage = '';
    if (!data.exam) {
      state.examScreen = 'empty';
    } else if (!data.attempt && data.exam.active !== true) {
      state.examScreen = 'locked';
    } else if (!data.attempt) {
      state.examScreen = 'identify';
    } else if (data.attempt.status === 'submitted') {
      state.examScreen = 'result';
    } else {
      state.examAnswers = data.attempt.answers || [];
      state.examAutoSubmitAttempted = false;
      state.examScreen = 'taking';
    }
  } catch (error) {
    state.examScreen = 'error';
    state.examMessage = getFriendlyError(error, 'Não foi possível carregar a prova.');
  }
  if (state.currentView === 'exam') {
    updateHeader();
    renderExamPortal();
  }
}

function startExamCountdown() {
  stopTimer();
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((state.examAttempt.endsAtMillis - Date.now()) / 1000));
    const timerElement = document.getElementById('exam-countdown');
    if (timerElement) {
      timerElement.textContent = formatExamTime(remaining);
      timerElement.parentElement.classList.toggle('low-time', remaining <= 300);
    }
    if (remaining <= 0) {
      stopTimer();
      if (!state.examAutoSubmitAttempted) submitCurrentExam(true);
    }
  };
  tick();
  if (state.examScreen === 'taking' && !state.examSubmitting) {
    state.timerId = setInterval(tick, 1000);
  }
}

async function saveCurrentExamAnswers() {
  if (state.examScreen !== 'taking' || !state.exam?.id || state.examSubmitting) return;
  const status = document.getElementById('exam-save-status');
  if (status) status.textContent = 'Salvando respostas...';
  try {
    await callExamApi('saveExamAnswers', { examId: state.exam.id, answers: state.examAnswers });
    if (status) status.textContent = 'Respostas salvas automaticamente';
  } catch (error) {
    if (status) status.textContent = 'Não foi possível salvar agora; o envio final ainda será tentado.';
  }
}

async function submitCurrentExam(autoSubmitted = false) {
  if (state.examSubmitting || state.examScreen !== 'taking') return;
  if (autoSubmitted) state.examAutoSubmitAttempted = true;
  state.examSubmitting = true;
  state.examMessage = '';
  stopTimer();
  if (state.examSaveTimer) clearTimeout(state.examSaveTimer);
  renderExamPortal();
  try {
    const result = await callExamApi('submitExam', {
      examId: state.exam.id,
      answers: state.examAnswers
    });
    state.examAttempt = result;
    state.examAnswers = result.answers || state.examAnswers;
    state.examScreen = 'result';
  } catch (error) {
    state.examMessage = getFriendlyError(error, autoSubmitted
      ? 'O tempo terminou, mas não foi possível enviar. Verifique sua conexão e tente novamente.'
      : 'Não foi possível enviar a prova.');
  } finally {
    state.examSubmitting = false;
    if (state.currentView === 'exam') renderExamPortal();
  }
}

window.updateTeacherExamTitle = value => {
  state.teacherExamTitle = value;
};

window.updateTeacherQuestion = (index, field, value) => {
  if (!state.teacherQuestions[index] || !['prompt', 'answer'].includes(field)) return;
  state.teacherQuestions[index][field] = value;
};

window.addTeacherQuestion = () => {
  state.teacherQuestions.push({ prompt: '', answer: '' });
  renderTeacherExamCreator();
  requestAnimationFrame(() => document.querySelector('.question-builder-card:last-child textarea')?.focus());
};

window.removeTeacherQuestion = index => {
  if (state.teacherQuestions.length <= 1) return;
  state.teacherQuestions.splice(index, 1);
  renderTeacherExamCreator();
};

window.submitExamCreation = async event => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('.confirm-exam-btn');
  submitButton.disabled = true;
  submitButton.textContent = 'Criando prova...';
  state.teacherMessage = '';
  try {
    const result = await callExamApi('createExam', {
      title: state.teacherExamTitle,
      questions: state.teacherQuestions
    });
    state.teacherMessage = `Prova criada com sucesso: ${result.questionCount} questão(ões) publicada(s).`;
    state.teacherExamTitle = 'Prova de Inglês';
    state.teacherQuestions = [{ prompt: '', answer: '' }];
    state.teacherExamsStatus = 'idle';
    state.examResultsStatus = 'idle';
  } catch (error) {
    state.teacherMessage = getFriendlyError(error, 'Não foi possível criar a prova.');
  }
  renderTeacherExamCreator();
};

window.refreshTeacherExams = () => {
  state.teacherExamsMessage = '';
  state.teacherExamsStatus = 'idle';
  renderTeacherExamManager();
};

window.startEditingExam = examId => {
  const exam = state.teacherExams.find(item => item.id === examId);
  if (!exam) return;
  state.editingExamId = exam.id;
  state.editingExamTitle = exam.title;
  state.editingExamQuestions = exam.questions.map(question => ({
    id: question.id,
    prompt: question.prompt,
    answer: ''
  }));
  state.teacherExamsMessage = '';
  renderTeacherExamManager();
};

window.cancelExamEditing = () => {
  state.editingExamId = null;
  state.editingExamTitle = '';
  state.editingExamQuestions = [];
  state.teacherExamsMessage = '';
  renderTeacherExamManager();
};

window.updateEditingExamTitle = value => {
  state.editingExamTitle = value;
};

window.updateEditingExamQuestion = (index, field, value) => {
  if (!state.editingExamQuestions[index] || !['prompt', 'answer'].includes(field)) return;
  state.editingExamQuestions[index][field] = value;
};

window.addEditingExamQuestion = () => {
  state.editingExamQuestions.push({ id: null, prompt: '', answer: '' });
  renderTeacherExamManager();
  requestAnimationFrame(() => document.querySelector('.question-builder-card:last-child textarea')?.focus());
};

window.removeEditingExamQuestion = index => {
  if (state.editingExamQuestions.length <= 1) return;
  state.editingExamQuestions.splice(index, 1);
  renderTeacherExamManager();
};

window.submitExamUpdate = async event => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('.confirm-exam-btn');
  submitButton.disabled = true;
  submitButton.textContent = 'Salvando alterações...';
  state.teacherExamsMessage = '';
  try {
    const result = await callExamApi('updateExam', {
      examId: state.editingExamId,
      title: state.editingExamTitle,
      questions: state.editingExamQuestions
    });
    state.editingExamId = null;
    state.editingExamTitle = '';
    state.editingExamQuestions = [];
    state.teacherExamsMessage = result.versioned
      ? 'Nova versão da prova criada com sucesso. Resultados da versão anterior foram preservados.'
      : 'Prova atualizada com sucesso. Resultados anteriores foram preservados.';
    state.teacherExamsStatus = 'idle';
    state.examResultsStatus = 'idle';
  } catch (error) {
    state.teacherExamsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível atualizar a prova.')}`;
  }
  renderTeacherExamManager();
};

window.publishRegisteredExam = async examId => {
  if (!window.confirm('Deseja ativar esta prova para os alunos? A prova ativa atual será desativada.')) return;
  state.teacherExamsStatus = 'loading';
  state.teacherExamsMessage = '';
  renderTeacherExamManager();
  try {
    await callExamApi('publishExam', { examId });
    state.teacherExamsMessage = 'Prova ativada com sucesso e disponível aos alunos.';
    state.teacherExamsStatus = 'idle';
    state.examScreen = 'idle';
  } catch (error) {
    state.teacherExamsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível ativar a prova.')}`;
    state.teacherExamsStatus = 'ready';
  }
  renderTeacherExamManager();
};

window.deactivateRegisteredExam = async examId => {
  if (!window.confirm('Deseja desativar esta prova? Os alunos verão a avaliação bloqueada e não poderão iniciá-la.')) return;
  state.teacherExamsStatus = 'loading';
  state.teacherExamsMessage = '';
  renderTeacherExamManager();
  try {
    await callExamApi('deactivateExam', { examId });
    state.teacherExamsMessage = 'Prova desativada. Ela agora aparece bloqueada para os alunos.';
    state.teacherExamsStatus = 'idle';
    state.examScreen = 'idle';
  } catch (error) {
    state.teacherExamsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível desativar a prova.')}`;
    state.teacherExamsStatus = 'ready';
  }
  renderTeacherExamManager();
};

window.deleteRegisteredExam = async examId => {
  const exam = state.teacherExams.find(item => item.id === examId);
  if (!exam) return;
  const confirmed = window.confirm(`Excluir "${exam.title}"? Ela deixará de aparecer e não ficará disponível aos alunos. Os resultados já registrados serão preservados.`);
  if (!confirmed) return;
  state.teacherExamsStatus = 'loading';
  state.teacherExamsMessage = '';
  renderTeacherExamManager();
  try {
    await callExamApi('deleteExam', { examId });
    state.teacherExamsMessage = 'Prova excluída com sucesso. Os resultados anteriores permanecem disponíveis.';
    state.teacherExamsStatus = 'idle';
    state.examResultsStatus = 'idle';
    state.examScreen = 'idle';
  } catch (error) {
    state.teacherExamsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível excluir a prova.')}`;
    state.teacherExamsStatus = 'ready';
  }
  renderTeacherExamManager();
};

window.refreshExamResults = () => {
  state.examResultsStatus = 'idle';
  renderTeacherResults();
};

window.reloadExamPortal = () => {
  state.examScreen = 'idle';
  state.examMessage = '';
  renderExamPortal();
};

window.continueToExamInstructions = event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.pendingIdentity = {
    firstName: String(formData.get('firstName') || '').trim(),
    lastName: String(formData.get('lastName') || '').trim()
  };
  state.examMessage = '';
  state.examScreen = 'instructions';
  renderExamPortal();
};

window.backToExamIdentification = () => {
  state.examScreen = 'identify';
  state.examMessage = '';
  renderExamPortal();
};

window.confirmExamStart = async () => {
  if (!state.pendingIdentity) return;
  state.examMessage = '';
  const identity = state.pendingIdentity;
  state.examScreen = 'loading';
  renderExamPortal();
  try {
    const data = await callExamApi('startExam', {
      examId: state.exam.id,
      firstName: identity.firstName,
      lastName: identity.lastName
    });
    state.exam = data.exam;
    state.examAttempt = data.attempt;
    state.examAnswers = data.attempt.answers || [];
    state.examAutoSubmitAttempted = false;
    state.examScreen = 'taking';
  } catch (error) {
    state.examMessage = getFriendlyError(error, 'Não foi possível iniciar a prova.');
    state.examScreen = 'instructions';
  }
  renderExamPortal();
};

window.updateStudentExamAnswer = (index, value) => {
  const question = state.exam?.questions?.[index];
  if (!question) return;
  state.examAnswers[index] = { questionId: question.id, value };
  const status = document.getElementById('exam-save-status');
  if (status) status.textContent = 'Alterações pendentes...';
  if (state.examSaveTimer) clearTimeout(state.examSaveTimer);
  state.examSaveTimer = setTimeout(saveCurrentExamAnswers, 900);
};

window.submitExamManually = event => {
  event.preventDefault();
  if (window.confirm('Deseja enviar a prova agora? Após o envio, as respostas não poderão ser alteradas.')) {
    submitCurrentExam(false);
  }
};

function renderQuiz() {
  const question = getCurrentQuestion();

  if (!question) {
    renderEmptyQuiz();
    return;
  }

  const totalQuestions = state.isSurvivor ? 1 : state.questionQueue.length;
  const progress = state.isSurvivor ? 100 : (state.currentQuestionIndex / totalQuestions) * 100;
  const quizModeClass = state.isSurvivor ? 'survivor-mode' : state.isSpeedrun ? 'speedrun-mode' : '';
  const difficulty = state.isSpeedrun ? question.difficulty : state.currentDifficulty;
  const scoreLabel = state.isSurvivor
    ? `NÍVEL: ${state.survivorTier.toUpperCase()}`
    : state.isSpeedrun
      ? `ACERTOS: ${state.score}`
      : `PONTOS: ${state.score}`;
  const mainContent = document.getElementById('main-content');

  mainContent.innerHTML = `
    <div class="quiz-container ${quizModeClass}">
      <div id="streak-badge" class="streak-badge" style="display: ${state.streak >= 2 ? 'block' : 'none'}">
        🔥 COMBO X${state.streak}
      </div>

      ${state.isSurvivor ? `
        <div class="survivor-header-stats">
          <div class="timer-display ${state.timeLeft < 10 ? 'low-time' : ''} tier-${state.survivorTier}">
            <span class="timer-icon">⏳</span> <span id="timer-seconds">${state.timeLeft}s</span>
          </div>
          <div class="shield-display ${state.shields > 0 ? 'has-shields' : ''}">
            🛡️ ${state.shields}/${MAX_SHIELDS}
          </div>
        </div>
      ` : ''}

      ${state.isSpeedrun ? `
        <div class="speedrun-header-stats">
          <div class="timer-display speedrun-timer">
            <span class="timer-icon">⏱</span> <span id="timer-seconds">${formatElapsedTime(state.speedrunTime)}</span>
          </div>
          <div class="speedrun-progress">
            ${state.currentQuestionIndex + 1}/${totalQuestions}
          </div>
        </div>
      ` : ''}

      <div class="quiz-header">
        <button class="back-btn" onclick="window.goHome()">← Sair</button>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div class="score-display">
          ${scoreLabel}
        </div>
      </div>

      ${state.isSurvivor ? `<div class="survivor-score-overlay">${state.score}</div>` : ''}

      <div class="question-box">
        <div class="difficulty-tag ${difficulty}">${difficulty.toUpperCase()}</div>
        <p class="question-text">${escapeHtml(question.question)}</p>
        ${state.answerMode === 'written' ? renderWrittenAnswerForm() : renderMultipleChoiceOptions(question)}
      </div>
    </div>
  `;

  if (state.answerMode === 'written') {
    requestAnimationFrame(() => document.getElementById('written-answer')?.focus());
  }
}

function renderMultipleChoiceOptions(question) {
  return `
    <div class="options-grid">
      ${question.optionOrder.map((option, index) => `
        <button class="option-btn" onclick="window.selectAnswerByIndex(${index})" ${state.isAnswered ? 'disabled' : ''}>
          ${escapeHtml(option)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderWrittenAnswerForm() {
  return `
    <form class="written-answer-form" onsubmit="window.submitWrittenAnswer(event)">
      <input
        id="written-answer"
        class="written-answer-input"
        type="text"
        autocomplete="off"
        placeholder="Digite sua resposta"
        aria-label="Digite sua resposta"
        ${state.isAnswered ? 'disabled' : ''}
      />
      <button class="next-btn written-submit" type="submit" ${state.isAnswered ? 'disabled' : ''}>
        Responder
      </button>
    </form>
  `;
}

function renderEmptyQuiz() {
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container result-screen">
      <h2>Nenhuma pergunta encontrada</h2>
      <p style="font-size: 1.1rem; margin-bottom: 2rem">Escolha outro tópico ou dificuldade.</p>
      <button class="next-btn" onclick="window.goHome()">Voltar ao Início</button>
    </div>
  `;
}

function renderResults() {
  if (state.isSpeedrun) {
    state.speedrunTime = getSpeedrunElapsedSeconds();
  }

  stopTimer();

  const totalQuestions = state.isSurvivor ? Math.max(1, state.score) : state.questionQueue.length;
  const percentage = state.isSurvivor ? 0 : Math.round((state.score / totalQuestions) * 100);
  const speedrunResult = state.isSpeedrun ? recordSpeedrunResult(totalQuestions) : null;

  let stars = 0;
  if (!state.isSurvivor && !state.isSpeedrun) {
    if (percentage >= 100) stars = 3;
    else if (percentage >= 70) stars = 2;
    else if (percentage >= 40) stars = 1;

    const history = state.userStats.topicHistory[state.currentTopic] || { stars: 0 };
    if (stars > history.stars) {
      state.userStats.topicHistory[state.currentTopic] = { stars };
    }
    state.userStats.quizzesCompleted++;
    saveProgressToFirestore();
  } else if (state.score > (state.userStats.survivorBest || 0)) {
    state.userStats.survivorBest = state.score;
    saveProgressToFirestore();
  }

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container result-screen ${state.isSurvivor ? 'survivor-results' : ''} ${state.isSpeedrun ? 'speedrun-results' : ''}">
      <h2>${getResultTitle()}</h2>

      ${state.isSpeedrun ? `
        <div class="speedrun-score-big">${formatElapsedTime(speedrunResult.timeSeconds)}</div>
        <p>Tempo total</p>
      ` : !state.isSurvivor ? `
        <div class="topic-stars" style="justify-content: center; font-size: 3rem; margin: 1rem 0">
          ${Array.from({ length: 3 }).map((_, i) => `
            <span class="${i < stars ? 'star-filled' : 'star-empty'}">★</span>
          `).join('')}
        </div>
        <div class="score-circle">${percentage}%</div>
      ` : `
        <div class="survivor-score-big">${state.score}</div>
        <p>Questões respondidas</p>
      `}

      <p style="font-size: 1.2rem; margin-bottom: 2rem">
        ${state.isSpeedrun
          ? `Você acertou <strong>${speedrunResult.correct}</strong> e errou <strong>${speedrunResult.errors}</strong> de <strong>${speedrunResult.totalQuestions}</strong> perguntas.`
          : state.isSurvivor
          ? `Você terminou com <strong>${state.score}</strong> ponto(s).`
          : `Você acertou <strong>${state.score}</strong> de <strong>${totalQuestions}</strong> perguntas.`}
      </p>

      <button class="next-btn" onclick="window.goHome()">Voltar ao Início</button>
    </div>
  `;

  if (stars === 3 || (state.isSurvivor && state.score > 20) || (state.isSpeedrun && speedrunResult.correct === speedrunResult.totalQuestions)) {
    launchConfetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
  }
}

function getResultTitle() {
  if (state.isSpeedrun) return 'Speedrun Finalizado!';
  if (!state.isSurvivor) return 'Quiz Finalizado!';
  if (state.resultReason === 'wrong') return 'Você errou!';
  if (state.resultReason === 'time') return 'Tempo Esgotado!';
  return 'Modo Sobrevivente Finalizado!';
}

// --- Question Selection ---
function getTopicData(topicId, difficulty) {
  return allQuestionData.filter(q => q.topicId === topicId && q.difficulty === difficulty);
}

function getAllQuestions() {
  return allQuestionData;
}

function getSurvivorDifficultyTier(score) {
  if (score < 8) return 'bronze';
  if (score < 16) return 'prata';
  return 'ouro';
}

function getQuestionsByTier(tier) {
  return getAllQuestions().filter(q => q.difficulty === tier);
}

function getCurrentQuestion() {
  return state.isSurvivor ? state.currentSurvivorQuestion : state.questionQueue[state.currentQuestionIndex];
}

function buildQuestionQueue(topicId, difficulty) {
  return shuffleArray(getTopicData(topicId, difficulty)).map(withShuffledOptions);
}

function buildSpeedrunQueue() {
  return buildSpeedrunQuestionQueue({
    topics,
    topicQuestionMap
  });
}

function getRandomQuestion(tier) {
  const pool = getQuestionsByTier(tier);
  if (!pool.length) return null;

  const askedIds = new Set(state.survivorAskedIds);
  let available = pool.filter(question => !askedIds.has(question.id) && question.id !== state.lastQuestionId);

  if (!available.length) {
    state.survivorAskedIds = [];
    available = pool.filter(question => question.id !== state.lastQuestionId);
  }

  const fallbackPool = available.length ? available : pool;
  const question = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  state.survivorAskedIds.push(question.id);
  state.lastQuestionId = question.id;

  return withShuffledOptions(question);
}

// --- Actions ---
window.openDifficultyModal = (topicId) => {
  window.pendingTopic = topicId;
  const modal = document.getElementById('difficulty-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeDifficultyModal = () => {
  const modal = document.getElementById('difficulty-modal');
  if (modal) modal.style.display = 'none';
};

window.openNicknameModal = () => {
  const modal = ensureNicknameModal();
  const input = document.getElementById('nickname-input');

  if (input) {
    input.value = state.userStats.nickname || '';
    setNicknameFeedback('');
    requestAnimationFrame(() => input.focus());
  }

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
};

window.closeNicknameModal = () => {
  const modal = document.getElementById('nickname-modal');
  if (!modal) return;

  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
};

window.submitNickname = async (event) => {
  event.preventDefault();
  const input = document.getElementById('nickname-input');
  const submitButton = document.querySelector('.nickname-submit');
  if (!input) return;

  submitButton?.setAttribute('disabled', 'true');
  setNicknameFeedback('Salvando...', 'info');

  const result = await saveNickname(input.value);

  submitButton?.removeAttribute('disabled');

  if (!result.ok) {
    setNicknameFeedback(result.message);
    input.focus();
    return;
  }

  setNicknameFeedback('Nickname salvo.', 'success');
  window.closeNicknameModal();
  updateHeader();
  if (state.currentView === 'home') renderHome();
};

window.setAnswerMode = (mode) => {
  state.answerMode = mode === 'written' ? 'written' : 'multiple';
  renderHome();
};

window.refreshLeaderboard = async () => {
  await loadLeaderboardFromFirestore();
  renderHome();
};

window.startQuiz = (topicId, difficulty) => {
  const queue = buildQuestionQueue(topicId, difficulty);
  if (!queue.length) {
    alert("Nenhuma pergunta encontrada para esta dificuldade.");
    return;
  }

  state.currentTopic = topicId;
  state.currentDifficulty = difficulty;
  state.currentView = 'quiz';
  state.currentQuestionIndex = 0;
  state.questionQueue = queue;
  state.score = 0;
  state.streak = 0;
  state.isAnswered = false;
  state.selectedAnswer = null;
  state.isSurvivor = false;
  state.isSpeedrun = false;
  state.speedrunTime = 0;
  state.speedrunStartedAt = 0;
  state.resultReason = 'completed';
  state.resultPersisted = false;
  window.closeDifficultyModal();
  renderApp();
};

window.startSurvivor = () => {
  state.isSurvivor = true;
  state.isSpeedrun = false;
  state.survivorTier = 'bronze';
  state.currentDifficulty = 'bronze';
  state.currentView = 'quiz';
  state.score = 0;
  state.streak = 0;
  state.shields = 0;
  state.timeLeft = SURVIVOR_START_TIME;
  state.isAnswered = false;
  state.selectedAnswer = null;
  state.survivorAskedIds = [];
  state.lastQuestionId = null;
  state.resultReason = 'time';
  state.resultPersisted = false;
  state.speedrunTime = 0;
  state.speedrunStartedAt = 0;
  state.currentSurvivorQuestion = getRandomQuestion('bronze');
  state.lastQuestionStartTime = Date.now();

  startTimer();
  renderApp();
};

window.startSpeedrun = () => {
  const speedrunQueue = buildSpeedrunQueue();

  if (!speedrunQueue.ok) {
    const topicsWithoutEnoughQuestions = speedrunQueue.missingTopics
      .map(topic => `${topic.title} (${topic.available}/${topic.required})`)
      .join(', ');

    alert(`Nao foi possivel iniciar o Speedrun. Topicos com perguntas insuficientes: ${topicsWithoutEnoughQuestions}.`);
    return;
  }

  state.currentTopic = SPEEDRUN_MODE;
  state.currentDifficulty = speedrunQueue.questions[0]?.difficulty || 'bronze';
  state.currentView = 'quiz';
  state.currentQuestionIndex = 0;
  state.questionQueue = speedrunQueue.questions;
  state.score = 0;
  state.streak = 0;
  state.shields = 0;
  state.isAnswered = false;
  state.selectedAnswer = null;
  state.isSurvivor = false;
  state.isSpeedrun = true;
  state.speedrunTime = 0;
  state.speedrunStartedAt = Date.now();
  state.currentSurvivorQuestion = null;
  state.resultReason = 'completed';
  state.resultPersisted = false;

  startSpeedrunTimer();
  renderApp();
};

function startTimer() {
  stopTimer();
  state.timerId = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();

    if (state.timeLeft <= 0) {
      state.resultReason = 'time';
      renderResults();
    }
  }, 1000);
}

function startSpeedrunTimer() {
  stopTimer();
  state.speedrunStartedAt = Date.now();
  state.timerId = setInterval(() => {
    state.speedrunTime = getSpeedrunElapsedSeconds();
    updateTimerDisplay();
  }, 250);
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('timer-seconds');
  if (!timerEl) return;

  if (state.isSpeedrun) {
    timerEl.innerText = formatElapsedTime(state.speedrunTime);
    return;
  }

  timerEl.innerText = state.timeLeft + 's';
  if (state.timeLeft < 10) timerEl.parentElement.classList.add('low-time');
}

window.goHome = async () => {
  stopTimer();
  state.currentView = 'home';
  state.isSurvivor = false;
  state.isSpeedrun = false;
  state.speedrunStartedAt = 0;
  await loadLeaderboardFromFirestore();
  renderApp();
};

window.selectAnswerByIndex = (index) => {
  const question = getCurrentQuestion();
  if (!question || state.isAnswered) return;
  handleAnswer(question.optionOrder[index]);
};

window.submitWrittenAnswer = (event) => {
  event.preventDefault();
  const question = getCurrentQuestion();
  const input = document.getElementById('written-answer');
  if (!question || !input || state.isAnswered) return;

  const answer = input.value.trim();
  if (!answer) {
    input.focus();
    return;
  }

  handleAnswer(answer);
};

function handleAnswer(answer) {
  const question = getCurrentQuestion();
  if (!question) return;

  state.isAnswered = true;
  state.selectedAnswer = answer;

  if (isCorrectAnswer(answer, question)) {
    handleCorrectAnswer();
    goToNextQuestion();
    return;
  }

  handleWrongAnswer();
}

function handleCorrectAnswer() {
  state.score++;
  state.streak++;
  state.userStats.totalCorrect++;

  if (state.isSurvivor && state.streak > 0 && state.streak % SHIELD_EVERY_STREAK === 0) {
    state.shields = Math.min(MAX_SHIELDS, state.shields + 1);
  }

  const activeDifficulty = state.isSpeedrun ? getCurrentQuestion()?.difficulty : state.currentDifficulty;
  let xpGain = XP_CORRECT;
  if (activeDifficulty === 'prata') xpGain *= 1.5;
  if (activeDifficulty === 'ouro') xpGain *= 2;

  if (state.isSurvivor) {
    xpGain *= 0.5;
    const responseTime = Date.now() - state.lastQuestionStartTime;
    const speedBonus = responseTime < 3000 ? 7 : 5;
    state.timeLeft = Math.min(MAX_SURVIVOR_TIME, state.timeLeft + speedBonus);

    const nextTier = getSurvivorDifficultyTier(state.score);
    if (nextTier !== state.survivorTier) {
      state.survivorTier = nextTier;
      state.currentDifficulty = nextTier;
      launchConfetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#ffffff', '#6366f1'] });
    }
  }

  addXP(Math.round(xpGain + (state.streak >= 3 ? XP_STREAK_BONUS : 0)));
  launchConfetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: ['#10b981', '#ffffff'] });
}

function handleWrongAnswer() {
  state.streak = 0;

  if (state.isSurvivor) {
    if (state.shields > 0) {
      state.shields--;
      goToNextQuestion();
      return;
    }

    state.resultReason = 'wrong';
    state.timeLeft = 0;
    renderResults();
    return;
  }

  goToNextQuestion();
}

function goToNextQuestion() {
  state.isAnswered = false;
  state.selectedAnswer = null;

  if (state.isSurvivor) {
    state.currentSurvivorQuestion = getRandomQuestion(state.survivorTier);
    state.lastQuestionStartTime = Date.now();
    renderQuiz();
    return;
  }

  if (state.currentQuestionIndex < state.questionQueue.length - 1) {
    state.currentQuestionIndex++;
    if (state.isSpeedrun) {
      state.currentDifficulty = state.questionQueue[state.currentQuestionIndex]?.difficulty || state.currentDifficulty;
    }
    renderQuiz();
  } else {
    state.resultReason = 'completed';
    renderResults();
  }
}

// Initialize
renderApp();
