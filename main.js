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
  ATTACHMENT_CHUNK_SIZE_BYTES,
  calculateExamElapsedSeconds,
  DEFAULT_EXAM_DURATION_MINUTES,
  formatExamDurationLabel,
  getExamDurationSeconds,
  EXAM_QUESTION_TYPES,
  getExamQuestionType,
  gradeExamAnswers,
  hasZipFileSignature,
  hashAttachmentBytes,
  hashExamAnswer,
  MAX_EXAM_DURATION_MINUTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  MIN_EXAM_DURATION_MINUTES,
  sanitizeExamAnswers,
  splitAttachmentBytes,
  validateExamDurationMinutes,
  validateEssayQuestion,
  validateMultipleChoiceQuestion,
  validateStudentName,
  validateZipAttachmentQuestion,
  validateZipFileDescriptor
} from './src/services/examServices.js';
import {
  DEFAULT_ACADEMIC_CLASSES,
  getExamSubjectsForClass,
  getProfileClassId,
  getSubjectsForClass,
  mergeAcademicClasses,
  normalizeAcademicKey,
  resolveExamSubjectSelection,
  validateAcademicEntityName,
  validateAcademicSelection,
  validateStudyReference
} from './src/services/academicServices.js';
import { validateActivity } from './src/services/activityServices.js';
import {
  isStudentProfileComplete,
  splitStudentFullName,
  validateStudentProfile
} from './src/services/studentProfileServices.js';
import {
  filterNewsletterItems,
  loadDeveloperNews,
  NEWSLETTER_CATEGORIES,
  NEWSLETTER_SOURCES
} from './src/services/newsletterServices.js';
import {
  buildTeacherStudentGroups,
  filterTeacherResults,
  getTeacherResultFilterOptions
} from './src/services/teacherDashboardServices.js';

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

function createMultipleChoiceDraft() {
  return {
    type: EXAM_QUESTION_TYPES.MULTIPLE_CHOICE,
    prompt: '',
    options: ['', ''],
    correctOptionIndex: 0
  };
}

function createZipAttachmentDraft() {
  return {
    type: EXAM_QUESTION_TYPES.ZIP_ATTACHMENT,
    prompt: '',
    maxFileSizeBytes: MAX_ZIP_FILE_SIZE_BYTES
  };
}

function createEssayDraft() {
  return {
    type: EXAM_QUESTION_TYPES.ESSAY,
    prompt: ''
  };
}

function timestampToMillis(value) {
  return value?.toMillis ? value.toMillis() : Number(value || 0);
}

function serializeAcademicDocument(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    nameKey: data.nameKey || normalizeAcademicKey(data.name),
    classId: data.classId || '',
    className: data.className || '',
    active: data.active !== false,
    deleted: data.deleted === true,
    builtin: false,
    createdAtMillis: timestampToMillis(data.createdAt),
    updatedAtMillis: timestampToMillis(data.updatedAt)
  };
}

function serializeStudyReference(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    description: data.description || '',
    url: data.url,
    classId: data.classId,
    className: data.className,
    subjectId: data.subjectId,
    subjectName: data.subjectName,
    active: data.active !== false,
    deleted: data.deleted === true,
    createdAtMillis: timestampToMillis(data.createdAt),
    updatedAtMillis: timestampToMillis(data.updatedAt)
  };
}

async function loadAcademicCatalog() {
  if (!state.user) return;
  state.academicStatus = 'loading';
  try {
    const profileClassId = isAdmin()
      ? ''
      : getProfileClassId(state.userStats.studentProfile || {}, state.academicClasses);
    const subjectsQuery = isAdmin()
      ? db.collection('academicSubjects')
      : (profileClassId
        ? db.collection('academicSubjects').where('classId', '==', profileClassId)
        : null);
    const [classesSnapshot, subjectsSnapshot] = await Promise.all([
      db.collection('academicClasses').get(),
      subjectsQuery ? subjectsQuery.get() : Promise.resolve({ docs: [] })
    ]);
    state.academicClasses = mergeAcademicClasses(classesSnapshot.docs.map(serializeAcademicDocument));
    state.academicSubjects = subjectsSnapshot.docs
      .map(serializeAcademicDocument)
      .filter(item => item.active && !item.deleted)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    state.academicStatus = 'ready';
    state.academicMessage = '';
  } catch (error) {
    console.error('Erro ao carregar catálogo acadêmico:', error);
    state.academicClasses = mergeAcademicClasses();
    state.academicSubjects = [];
    state.academicStatus = 'error';
    state.academicMessage = 'Não foi possível carregar turmas e matérias.';
  }
}

function getAcademicCollection(kind) {
  if (kind === 'class') return { collection: 'academicClasses', label: 'Turma' };
  if (kind === 'subject') return { collection: 'academicSubjects', label: 'Matéria' };
  throw new Error('Tipo de cadastro acadêmico inválido.');
}

async function createAcademicEntityOnFreeTier(kind, rawName, classId = '') {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const { collection, label } = getAcademicCollection(kind);
  const entity = validateAcademicEntityName(rawName, label);
  let classRelation = {};
  if (kind === 'subject') {
    const academicClass = state.academicClasses.find(item => item.id === classId && item.active !== false);
    if (!academicClass) throw new Error('Selecione uma turma válida para a matéria.');
    classRelation = { classId: academicClass.id, className: academicClass.name };
  }

  const currentItems = kind === 'class' ? state.academicClasses : state.academicSubjects;
  const duplicate = currentItems.some(item => item.nameKey === entity.nameKey
    && (kind === 'class' || item.classId === classRelation.classId));
  if (duplicate) throw new Error(`${label} já cadastrada${kind === 'subject' ? ' nesta turma' : ''}.`);

  const existingSnapshot = await db.collection(collection).where('nameKey', '==', entity.nameKey).get();
  const existingDoc = kind === 'subject'
    ? existingSnapshot.docs.find(doc => doc.data().classId === classRelation.classId)
    : existingSnapshot.docs[0];
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  if (existingDoc) {
    await existingDoc.ref.update({
      name: entity.name,
      ...classRelation,
      active: true,
      deleted: false,
      deletedAt: firebase.firestore.FieldValue.delete(),
      updatedAt: serverTimestamp
    });
  } else {
    await db.collection(collection).add({
      ...entity,
      ...classRelation,
      active: true,
      deleted: false,
      createdBy: state.user.uid,
      createdByEmail: state.user.email || '',
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp
    });
  }
  await loadAcademicCatalog();
  return { ok: true, name: entity.name };
}

async function ensureExamSubjectForClassOnFreeTier(subjectId, classId) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const academicClass = state.academicClasses.find(item => item.id === classId && item.active !== false);
  if (!academicClass) throw new Error('Selecione uma turma válida para a prova.');

  const subject = state.academicSubjects.find(item => item.id === subjectId
    && item.active !== false
    && item.deleted !== true);
  if (!subject) throw new Error('Selecione uma matéria existente.');
  if (subject.classId === academicClass.id) return subject.id;
  if (subject.classId) throw new Error('A matéria selecionada não pertence à turma informada.');

  const linkedSubject = state.academicSubjects.find(item => item.classId === academicClass.id
    && item.nameKey === subject.nameKey
    && item.active !== false
    && item.deleted !== true);
  if (linkedSubject) return linkedSubject.id;

  const snapshot = await db.collection('academicSubjects').where('nameKey', '==', subject.nameKey).get();
  const existingDoc = snapshot.docs.find(doc => doc.data().classId === academicClass.id);
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  if (existingDoc) {
    await existingDoc.ref.update({
      name: subject.name,
      classId: academicClass.id,
      className: academicClass.name,
      active: true,
      deleted: false,
      deletedAt: firebase.firestore.FieldValue.delete(),
      updatedAt: serverTimestamp
    });
    await loadAcademicCatalog();
    return existingDoc.id;
  }

  const docRef = await db.collection('academicSubjects').add({
    name: subject.name,
    nameKey: subject.nameKey,
    classId: academicClass.id,
    className: academicClass.name,
    active: true,
    deleted: false,
    migratedFromSubjectId: subject.id,
    createdBy: state.user.uid,
    createdByEmail: state.user.email || '',
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp
  });
  await loadAcademicCatalog();
  return docRef.id;
}

async function archiveAcademicEntityOnFreeTier(kind, id) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const { collection } = getAcademicCollection(kind);
  const item = (kind === 'class' ? state.academicClasses : state.academicSubjects)
    .find(candidate => candidate.id === id);
  if (!item || item.builtin) throw new Error('Este item não pode ser arquivado.');
  await db.collection(collection).doc(id).update({
    active: false,
    deleted: true,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await loadAcademicCatalog();
  return { ok: true };
}

async function createStudyReferenceOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const reference = validateStudyReference(data, state.academicClasses, state.academicSubjects);
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('studyReferences').add({
    ...reference,
    active: true,
    deleted: false,
    createdBy: state.user.uid,
    createdByEmail: state.user.email || '',
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp
  });
  return { ok: true, id: docRef.id };
}

async function archiveStudyReferenceOnFreeTier(referenceId) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  await db.collection('studyReferences').doc(String(referenceId || '')).update({
    active: false,
    deleted: true,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
}

async function loadStudyReferences() {
  if (!state.user) return;
  state.referencesStatus = 'loading';
  try {
    let query = db.collection('studyReferences');
    if (!isAdmin()) {
      const classId = getProfileClassId(state.userStats.studentProfile || {}, state.academicClasses);
      if (!classId) {
        state.studyReferences = [];
        state.referencesStatus = 'ready';
        return;
      }
      query = query
        .where('classId', '==', classId)
        .where('active', '==', true)
        .where('deleted', '==', false);
    }
    const snapshot = await query.get();
    state.studyReferences = snapshot.docs
      .map(serializeStudyReference)
      .filter(item => item.active && !item.deleted)
      .sort((a, b) => (b.updatedAtMillis || b.createdAtMillis) - (a.updatedAtMillis || a.createdAtMillis));
    state.referencesStatus = 'ready';
  } catch (error) {
    console.error('Erro ao carregar referências:', error);
    state.referencesStatus = 'error';
    state.referencesMessage = getFriendlyError(error, 'Não foi possível carregar as referências.');
  }
}


function serializeActivityDocument(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    instructions: data.instructions || '',
    classId: data.classId || '',
    className: data.className || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    active: data.active === true,
    deleted: data.deleted === true,
    createdAtMillis: timestampToMillis(data.createdAt),
    updatedAtMillis: timestampToMillis(data.updatedAt),
    submissions: [],
    submission: null
  };
}

function getActivitySubmissionId(activityId, userId) {
  return `${activityId}__${userId}`;
}

function serializeActivitySubmission(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    activityId: data.activityId,
    activityTitle: data.activityTitle || '',
    classId: data.classId || '',
    className: data.className || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    userId: data.userId,
    userEmail: data.userEmail || '',
    studentName: data.studentName || '',
    fileName: data.fileName || '',
    contentType: data.contentType || 'application/zip',
    size: Number(data.size || 0),
    chunkCount: Number(data.chunkCount || 0),
    sha256: data.sha256 || '',
    status: data.status || 'uploading',
    submittedAtMillis: timestampToMillis(data.submittedAt),
    updatedAtMillis: timestampToMillis(data.updatedAt)
  };
}

async function loadActivities() {
  if (!state.user) return;
  state.activitiesStatus = 'loading';
  try {
    let query = db.collection('activities');
    if (!isAdmin()) {
      const classId = getProfileClassId(state.userStats.studentProfile || {}, state.academicClasses);
      if (!classId) {
        state.activities = [];
        state.activitiesStatus = 'ready';
        return;
      }
      query = query
        .where('classId', '==', classId)
        .where('active', '==', true)
        .where('deleted', '==', false);
    }
    const activitySnapshot = await query.get();
    const activities = activitySnapshot.docs
      .map(serializeActivityDocument)
      .filter(activity => isAdmin() || (activity.active && !activity.deleted))
      .sort((a, b) => (b.updatedAtMillis || b.createdAtMillis) - (a.updatedAtMillis || a.createdAtMillis));

    if (isAdmin()) {
      const submissionSnapshot = await db.collection('activitySubmissions').get();
      const submissionsByActivity = new Map();
      submissionSnapshot.docs
        .map(serializeActivitySubmission)
        .filter(submission => submission.status === 'ready')
        .forEach(submission => {
          const current = submissionsByActivity.get(submission.activityId) || [];
          current.push(submission);
          submissionsByActivity.set(submission.activityId, current);
        });
      activities.forEach(activity => {
        activity.submissions = (submissionsByActivity.get(activity.id) || [])
          .sort((a, b) => b.submittedAtMillis - a.submittedAtMillis);
      });
    } else {
      const submissionDocs = await Promise.all(activities.map(activity =>
        db.collection('activitySubmissions')
          .doc(getActivitySubmissionId(activity.id, state.user.uid))
          .get()
      ));
      activities.forEach((activity, index) => {
        activity.submission = submissionDocs[index].exists
          ? serializeActivitySubmission(submissionDocs[index])
          : null;
      });
    }

    state.activities = activities;
    state.activitiesStatus = 'ready';
  } catch (error) {
    console.error('Erro ao carregar atividades:', error);
    state.activities = [];
    state.activitiesStatus = 'error';
    state.activitiesMessage = getFriendlyError(error, 'Não foi possível carregar as atividades.');
  }
}

async function createActivityOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const activity = validateActivity(data, state.academicClasses, state.academicSubjects);
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('activities').add({
    ...activity,
    active: true,
    deleted: false,
    createdBy: state.user.uid,
    createdByEmail: state.user.email || '',
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp
  });
  return { ok: true, id: docRef.id };
}

async function archiveActivityOnFreeTier(activityId) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  await db.collection('activities').doc(String(activityId || '')).update({
    active: false,
    deleted: true,
    archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
}

function updateActivityUploadStatus(activityId, message, progress = null, type = '') {
  state.activityUploads[activityId] = { message, progress, type };
  const status = document.getElementById(`activity-upload-status-${activityId}`);
  if (status) {
    status.textContent = message;
    status.className = `zip-upload-status ${type}`.trim();
  }
  const progressBar = document.getElementById(`activity-upload-progress-${activityId}`);
  if (progressBar && progress !== null) progressBar.style.width = `${progress}%`;
}

async function uploadActivitySubmission(activity, file) {
  if (!activity?.id || activity.active !== true || activity.deleted === true) {
    throw new Error('Esta atividade não está disponível para entrega.');
  }
  const descriptor = validateZipFileDescriptor(file);
  updateActivityUploadStatus(activity.id, 'Validando arquivo ZIP...', 3, 'uploading');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasZipFileSignature(bytes)) {
    throw new Error('O conteúdo selecionado não corresponde a um arquivo ZIP válido.');
  }
  const chunks = splitAttachmentBytes(bytes);
  const sha256 = await hashAttachmentBytes(bytes);
  const submissionId = getActivitySubmissionId(activity.id, state.user.uid);
  const submissionRef = db.collection('activitySubmissions').doc(submissionId);
  const previousDoc = await submissionRef.get();
  const previousChunkCount = previousDoc.exists ? Number(previousDoc.data().chunkCount || 0) : 0;
  const profile = state.userStats.studentProfile || {};
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  await submissionRef.set({
    activityId: activity.id,
    activityTitle: activity.title,
    classId: activity.classId,
    className: activity.className,
    subjectId: activity.subjectId,
    subjectName: activity.subjectName,
    userId: state.user.uid,
    userEmail: state.user.email || '',
    studentName: profile.fullName || state.user.displayName || state.user.email || 'Aluno',
    fileName: descriptor.name,
    contentType: 'application/zip',
    size: descriptor.size,
    chunkCount: chunks.length,
    sha256,
    status: 'uploading',
    submittedAt: serverTimestamp,
    updatedAt: serverTimestamp
  });

  for (let index = chunks.length; index < previousChunkCount; index++) {
    await submissionRef.collection('chunks').doc(String(index)).delete();
  }
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    await submissionRef.collection('chunks').doc(String(index)).set({
      index,
      size: chunk.length,
      data: firebase.firestore.Blob.fromUint8Array(chunk),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const progress = Math.min(95, Math.round(((index + 1) / chunks.length) * 90) + 5);
    updateActivityUploadStatus(
      activity.id,
      `Enviando parte ${index + 1} de ${chunks.length}...`,
      progress,
      'uploading'
    );
  }
  await submissionRef.update({
    status: 'ready',
    submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  updateActivityUploadStatus(activity.id, 'Atividade encaminhada com sucesso.', 100, 'success');
}

async function downloadActivitySubmissionOnFreeTier(submissionId) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const submissionRef = db.collection('activitySubmissions').doc(String(submissionId || ''));
  const submissionDoc = await submissionRef.get();
  if (!submissionDoc.exists || submissionDoc.data().status !== 'ready') {
    throw new Error('Entrega não encontrada ou ainda incompleta.');
  }
  const metadata = serializeActivitySubmission(submissionDoc);
  const maxChunks = Math.ceil(MAX_ZIP_FILE_SIZE_BYTES / ATTACHMENT_CHUNK_SIZE_BYTES);
  if (metadata.chunkCount < 1 || metadata.chunkCount > maxChunks) {
    throw new Error('Quantidade de partes da entrega inválida.');
  }
  const chunkDocs = await Promise.all(Array.from({ length: metadata.chunkCount }, (_, index) =>
    submissionRef.collection('chunks').doc(String(index)).get()
  ));
  if (chunkDocs.some(doc => !doc.exists)) throw new Error('A entrega está incompleta.');
  const chunks = chunkDocs.map(doc => doc.data().data.toUint8Array());
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (totalSize !== metadata.size) throw new Error('O tamanho da entrega não confere.');
  const bytes = new Uint8Array(totalSize);
  let offset = 0;
  chunks.forEach(chunk => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  if (!hasZipFileSignature(bytes) || await hashAttachmentBytes(bytes) !== metadata.sha256) {
    throw new Error('A integridade da entrega ZIP não pôde ser confirmada.');
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = metadata.fileName || 'atividade.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, fileName: metadata.fileName };
}

function serializeExamDocument(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    classId: data.classId || '',
    className: data.className || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    durationSeconds: getExamDurationSeconds(data.durationSeconds),
    questionCount: data.questionCount,
    questions: data.questions || [],
    gradingSalt: data.gradingSalt,
    active: data.active === true,
    deleted: data.deleted === true,
    createdAtMillis: timestampToMillis(data.createdAt),
    updatedAtMillis: timestampToMillis(data.updatedAt)
  };
}

function getAttemptDurationSeconds(data = {}) {
  return getExamDurationSeconds(data.examSnapshot?.durationSeconds ?? data.durationSeconds);
}

function getAttemptExam(data, fallbackExam) {
  const durationSeconds = getAttemptDurationSeconds(data);
  if (!data.examSnapshot?.questions || !data.examSnapshot?.gradingSalt) {
    return { ...fallbackExam, durationSeconds };
  }
  return {
    ...fallbackExam,
    id: data.examId,
    title: data.examSnapshot.title || data.examTitle,
    durationSeconds,
    questionCount: data.examSnapshot.questions.length,
    questions: data.examSnapshot.questions,
    gradingSalt: data.examSnapshot.gradingSalt
  };
}

async function serializeAttemptData(data, fallbackExam) {
  const exam = getAttemptExam(data, fallbackExam);
  const durationSeconds = getAttemptDurationSeconds(data);
  const startedAtMillis = timestampToMillis(data.startedAt);
  const result = {
    status: data.status,
    firstName: data.firstName,
    lastName: data.lastName,
    answers: data.answers || [],
    startedAtMillis,
    endsAtMillis: startedAtMillis + durationSeconds * 1000,
    submittedAtMillis: timestampToMillis(data.submittedAt),
    essayReview: data.essayReview || null,
    finalScore: data.finalScore || null,
    finalGradeAtMillis: timestampToMillis(data.finalGradeAt),
    elapsedSeconds: data.submittedAt
      ? calculateExamElapsedSeconds(
          timestampToMillis(data.startedAt),
          timestampToMillis(data.submittedAt),
          durationSeconds
        )
      : null
  };
  if (data.status === 'submitted') Object.assign(result, await gradeExamAnswers(exam, data.answers, data.essayReview));
  return result;
}

async function getStudentExamDocuments() {
  const classId = getProfileClassId(state.userStats.studentProfile || {}, state.academicClasses);
  if (!classId) return [];
  const snapshot = await db.collection('exams').where('classId', '==', classId).get();
  return snapshot.docs
    .filter(doc => doc.data().deleted !== true)
    .sort((a, b) => {
      if (a.data().active !== b.data().active) return a.data().active ? -1 : 1;
      const aTime = timestampToMillis(a.data().updatedAt || a.data().createdAt);
      const bTime = timestampToMillis(b.data().updatedAt || b.data().createdAt);
      return bTime - aTime;
    });
}

async function getStudentVisibleExamDocument(examId) {
  const documents = await getStudentExamDocuments();
  return documents.find(doc => doc.id === String(examId || '')) || null;
}

async function loadStudentExamCatalog() {
  if (!state.user || isAdmin()) return;
  state.studentExamsStatus = 'loading';
  try {
    const documents = await getStudentExamDocuments();
    const attempts = await Promise.all(documents.map(doc =>
      db.collection('examAttempts').doc(getExamAttemptId(doc.id, state.user.uid)).get()
    ));
    state.studentExams = documents.map((doc, index) => ({
      ...serializeExamDocument(doc),
      attemptStatus: attempts[index].exists ? attempts[index].data().status : '',
      hasAttempt: attempts[index].exists
    }));
    state.studentExamsStatus = 'ready';
    state.studentExamsMessage = '';
  } catch (error) {
    console.error('Erro ao carregar provas da turma:', error);
    state.studentExams = [];
    state.studentExamsStatus = 'error';
    state.studentExamsMessage = getFriendlyError(error, 'Não foi possível carregar as provas da turma.');
  }
}

function getExamAttemptId(examId, uid) {
  return `${examId}__${uid}`;
}

function getExamAttachmentId(attemptId, questionId, slot) {
  return `${attemptId}__${questionId}__${slot}`;
}

function serializeAttachmentMetadata(id, data = {}) {
  return {
    id,
    attemptId: data.attemptId,
    examId: data.examId,
    questionId: data.questionId,
    questionIndex: Number(data.questionIndex),
    userId: data.userId,
    fileName: data.fileName,
    contentType: data.contentType,
    size: Number(data.size || 0),
    chunkCount: Number(data.chunkCount || 0),
    sha256: data.sha256 || '',
    status: data.status || 'uploading',
    uploadedAtMillis: timestampToMillis(data.uploadedAt),
    updatedAtMillis: timestampToMillis(data.updatedAt)
  };
}

async function loadAttemptAttachments(exam, answers = [], userId = state.user?.uid) {
  if (!exam?.id || !userId) return {};
  const answersByQuestion = new Map((answers || []).map(answer => [answer.questionId, answer.value]));
  const attachmentEntries = (exam.questions || [])
    .filter(question => getExamQuestionType(question) === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT)
    .map(question => [question, answersByQuestion.get(question.id)])
    .filter(([, attachmentId]) => Boolean(attachmentId));
  const documents = await Promise.all(attachmentEntries.map(([, attachmentId]) =>
    db.collection('examAttachments').doc(attachmentId).get()
  ));
  return Object.fromEntries(documents
    .filter(doc => doc.exists && doc.data().status === 'ready')
    .map(doc => {
      const metadata = serializeAttachmentMetadata(doc.id, doc.data());
      return [metadata.questionId, metadata];
    }));
}

function attemptIsStillRunning(attempt) {
  return attempt.status === 'in_progress'
    && Date.now() < timestampToMillis(attempt.startedAt) + getAttemptDurationSeconds(attempt) * 1000;
}

async function getExamsWithRunningAttempts() {
  const snapshot = await db.collection('examAttempts').get();
  return new Set(snapshot.docs
    .map(doc => doc.data())
    .filter(attemptIsStillRunning)
    .map(attempt => attempt.examId));
}

async function buildStoredExamQuestion(item, index, gradingSalt, questionId) {
  const type = getExamQuestionType(item);
  if (type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) {
    const zipQuestion = validateZipAttachmentQuestion(item, index);
    return {
      id: questionId,
      type: zipQuestion.type,
      prompt: zipQuestion.prompt,
      maxFileSizeBytes: zipQuestion.maxFileSizeBytes
    };
  }
  if (type === EXAM_QUESTION_TYPES.ESSAY) {
    const essayQuestion = validateEssayQuestion(item, index);
    return {
      id: questionId,
      type: essayQuestion.type,
      prompt: essayQuestion.prompt
    };
  }

  const multipleChoice = validateMultipleChoiceQuestion(item, index);
  return {
    id: questionId,
    type: multipleChoice.type,
    prompt: multipleChoice.prompt,
    options: multipleChoice.options,
    answerHash: await hashExamAnswer(
      multipleChoice.options[multipleChoice.correctOptionIndex],
      gradingSalt
    )
  };
}

async function createExamOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const title = String(data.title || 'Prova de Inglês').trim().slice(0, 120);
  if (!title) throw new Error('Informe o título da prova.');
  const audience = validateAcademicSelection(data, state.academicClasses, state.academicSubjects);
  const durationSeconds = validateExamDurationMinutes(data.durationMinutes);
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error('Adicione pelo menos uma pergunta à prova.');

  const gradingSalt = createExamSalt();
  const questions = await Promise.all(data.questions.map((item, index) =>
    buildStoredExamQuestion(item, index, gradingSalt, `q${index + 1}`)
  ));

  const [activeSnapshot, examsWithRunningAttempts] = await Promise.all([
    db.collection('exams').where('active', '==', true).get(),
    getExamsWithRunningAttempts()
  ]);
  const activeForClass = activeSnapshot.docs.filter(doc =>
    doc.data().classId === audience.classId
  );
  if (activeForClass.some(doc => examsWithRunningAttempts.has(doc.id))) {
    throw new Error('Existe uma tentativa em andamento na prova atual desta turma. Aguarde o término antes de publicar outra prova.');
  }
  const examRef = db.collection('exams').doc();
  const batch = db.batch();
  activeForClass.forEach(doc => batch.update(doc.ref, {
    active: false,
    archivedAt: firebase.firestore.FieldValue.serverTimestamp()
  }));
  batch.set(examRef, {
    title,
    ...audience,
    active: true,
    deleted: false,
    durationSeconds,
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
  const audience = validateAcademicSelection(data, state.academicClasses, state.academicSubjects);
  const durationSeconds = validateExamDurationMinutes(data.durationMinutes);
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error('Mantenha pelo menos uma pergunta na prova.');
  const existingById = new Map(existing.questions.map(question => [question.id, question]));
  const questions = await Promise.all(data.questions.map((item, index) => {
    const previous = existingById.get(item?.id);
    return buildStoredExamQuestion(
      item,
      index,
      existing.gradingSalt,
      previous?.id || createManagedQuestionId()
    );
  }));

  if (legacyAttempts.length) {
    const replacementRef = db.collection('exams').doc();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(replacementRef, {
      title,
      ...audience,
      active: existing.active,
      deleted: false,
      durationSeconds,
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
    ...audience,
    durationSeconds,
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
  const targetClassId = targetDoc.data().classId || '';
  const activeForClass = activeSnapshot.docs.filter(doc =>
    doc.id !== examId
      && (targetClassId ? doc.data().classId === targetClassId : !doc.data().classId)
  );
  if (activeForClass.some(doc => examsWithRunningAttempts.has(doc.id))) {
    throw new Error('Existe uma tentativa em andamento na prova atual desta turma. Aguarde o término antes de publicar outra prova.');
  }

  const batch = db.batch();
  activeForClass.forEach(doc => {
    batch.update(doc.ref, {
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

async function getExamStateOnFreeTier(data = {}) {
  const examDoc = await getStudentVisibleExamDocument(data.examId);
  if (!examDoc) return { exam: null, attempt: null };
  const exam = serializeExamDocument(examDoc);
  const attemptRef = db.collection('examAttempts').doc(getExamAttemptId(exam.id, state.user.uid));
  const attemptDoc = await attemptRef.get();
  if (!attemptDoc.exists) return { exam, attempt: null };
  const rawAttempt = attemptDoc.data();
  const deadlineMillis = timestampToMillis(rawAttempt.startedAt) + getAttemptDurationSeconds(rawAttempt) * 1000;
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
      durationSeconds: publicExam.durationSeconds,
      examSnapshot: {
        title: publicExam.title,
        durationSeconds: publicExam.durationSeconds,
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
    const deadlineMillis = timestampToMillis(attempt.startedAt) + getAttemptDurationSeconds(attempt) * 1000;
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
    const deadlineMillis = timestampToMillis(attempt.startedAt) + getAttemptDurationSeconds(attempt) * 1000;
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
  const submitted = attemptsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => item.status === 'submitted' && item.logDeleted !== true);
  const examIds = [...new Set(submitted.map(item => item.examId))];
  const examDocs = await Promise.all(examIds.map(id => db.collection('exams').doc(id).get()));
  const exams = new Map(examDocs.filter(doc => doc.exists).map(doc => [doc.id, serializeExamDocument(doc)]));
  const results = [];
  for (const item of submitted) {
    const exam = exams.get(item.examId);
    if (!exam) continue;
    const computed = await serializeAttemptData(item, exam);
    const attachmentFeedback = (computed.feedback || [])
      .filter(feedback => feedback.requiresManualReview);
    const attachmentIds = attachmentFeedback
      .map(feedback => feedback.attachmentId)
      .filter(Boolean);
    const attachmentDocs = await Promise.all(attachmentIds.map(attachmentId =>
      db.collection('examAttachments').doc(attachmentId).get()
    ));
    const attachments = attachmentDocs
      .filter(doc => doc.exists && doc.data().status === 'ready')
      .map(doc => serializeAttachmentMetadata(doc.id, doc.data()));
    results.push({
      id: item.id,
      examId: item.examId,
      examTitle: item.examTitle,
      userId: item.userId || '',
      classId: exam.classId || '',
      className: exam.className || '',
      subjectId: exam.subjectId || '',
      subjectName: exam.subjectName || '',
      firstName: item.firstName,
      lastName: item.lastName,
      userEmail: item.userEmail,
      elapsedSeconds: computed.elapsedSeconds,
      correctCount: computed.correctCount,
      autoGradedCount: computed.autoGradedCount,
      manualReviewCount: computed.manualReviewCount,
      essayQuestionCount: computed.essayQuestionCount,
      reviewedEssayCount: computed.reviewedEssayCount,
      pendingEssayReviewCount: computed.pendingEssayReviewCount,
      approvedEssayCount: computed.approvedEssayCount,
      finalGradeReady: computed.finalGradeReady,
      finalCorrectCount: computed.finalCorrectCount,
      finalGradedQuestionCount: computed.finalGradedQuestionCount,
      finalPercentage: computed.finalPercentage,
      essayReview: computed.essayReview,
      feedback: computed.feedback,
      totalQuestions: computed.totalQuestions,
      percentage: computed.percentage,
      attachments,
      submittedAtMillis: computed.submittedAtMillis
    });
  }
  results.sort((a, b) => b.submittedAtMillis - a.submittedAtMillis);
  return { results };
}

async function downloadExamAttachmentOnFreeTier(attachmentId) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const attachmentRef = db.collection('examAttachments').doc(String(attachmentId || ''));
  const attachmentDoc = await attachmentRef.get();
  if (!attachmentDoc.exists || attachmentDoc.data().status !== 'ready') {
    throw new Error('Anexo ZIP não encontrado ou ainda incompleto.');
  }

  const metadata = serializeAttachmentMetadata(attachmentDoc.id, attachmentDoc.data());
  if (metadata.chunkCount < 1 || metadata.chunkCount > Math.ceil(MAX_ZIP_FILE_SIZE_BYTES / ATTACHMENT_CHUNK_SIZE_BYTES)) {
    throw new Error('Quantidade de partes do anexo inválida.');
  }
  const chunkDocs = await Promise.all(Array.from({ length: metadata.chunkCount }, (_, index) =>
    attachmentRef.collection('chunks').doc(String(index)).get()
  ));
  if (chunkDocs.some(doc => !doc.exists)) throw new Error('O anexo está incompleto.');

  const chunks = chunkDocs.map(doc => doc.data().data.toUint8Array());
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (totalSize !== metadata.size) throw new Error('O tamanho do anexo não confere.');
  const bytes = new Uint8Array(totalSize);
  let offset = 0;
  chunks.forEach(chunk => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  if (!hasZipFileSignature(bytes) || await hashAttachmentBytes(bytes) !== metadata.sha256) {
    throw new Error('A integridade do arquivo ZIP não pôde ser confirmada.');
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = metadata.fileName || 'projeto.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, fileName: metadata.fileName };
}

async function getEssayReviewContext(resultId) {
  const attemptRef = db.collection('examAttempts').doc(String(resultId || ''));
  const attemptDoc = await attemptRef.get();
  if (!attemptDoc.exists || attemptDoc.data().status !== 'submitted') {
    throw new Error('Resultado enviado não encontrado.');
  }
  const attempt = attemptDoc.data();
  const examDoc = await db.collection('exams').doc(attempt.examId).get();
  const fallbackExam = examDoc.exists
    ? serializeExamDocument(examDoc)
    : {
        id: attempt.examId,
        title: attempt.examTitle,
        durationSeconds: getAttemptDurationSeconds(attempt),
        questions: attempt.examSnapshot?.questions || [],
        gradingSalt: attempt.examSnapshot?.gradingSalt || ''
      };
  return { attemptRef, attempt, exam: getAttemptExam(attempt, fallbackExam) };
}

async function reviewEssayAnswerOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const decision = String(data.decision || '');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Decisão de correção inválida.');
  const { attemptRef, attempt, exam } = await getEssayReviewContext(data.resultId);
  if (attempt.essayReview?.status === 'finalized') {
    throw new Error('A nota final desta tentativa já foi contabilizada.');
  }
  const questionId = String(data.questionId || '');
  const essayQuestions = (exam.questions || [])
    .filter(question => getExamQuestionType(question) === EXAM_QUESTION_TYPES.ESSAY);
  if (!essayQuestions.some(question => question.id === questionId)) {
    throw new Error('Questão dissertativa não encontrada nesta tentativa.');
  }
  const currentItems = Array.isArray(attempt.essayReview?.items) ? attempt.essayReview.items : [];
  const decisions = new Map(currentItems.map(item => [item.questionId, item.decision]));
  decisions.set(questionId, decision);
  const validQuestionIds = new Set(essayQuestions.map(question => question.id));
  const items = [...decisions]
    .filter(([id, value]) => validQuestionIds.has(id) && ['approved', 'rejected'].includes(value))
    .map(([id, value]) => ({ questionId: id, decision: value }));
  await attemptRef.update({
    essayReview: {
      status: 'in_review',
      items,
      reviewedBy: state.user.uid,
      reviewedByEmail: state.user.email || ''
    },
    essayReviewUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
}

async function finalizeEssayReviewOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const { attemptRef, attempt, exam } = await getEssayReviewContext(data.resultId);
  if (attempt.essayReview?.status === 'finalized') {
    return { ok: true, finalScore: attempt.finalScore?.percentage ?? null };
  }
  const essayQuestions = (exam.questions || [])
    .filter(question => getExamQuestionType(question) === EXAM_QUESTION_TYPES.ESSAY);
  if (!essayQuestions.length) throw new Error('Esta prova não possui questões dissertativas.');
  const decisions = new Map((attempt.essayReview?.items || []).map(item => [item.questionId, item.decision]));
  if (essayQuestions.some(question => !['approved', 'rejected'].includes(decisions.get(question.id)))) {
    throw new Error('Corrija todas as questões dissertativas antes de contabilizar a nota final.');
  }
  const essayReview = {
    status: 'finalized',
    items: essayQuestions.map(question => ({
      questionId: question.id,
      decision: decisions.get(question.id)
    })),
    reviewedBy: state.user.uid,
    reviewedByEmail: state.user.email || ''
  };
  const computed = await gradeExamAnswers(exam, attempt.answers, essayReview);
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  await attemptRef.update({
    essayReview,
    essayReviewUpdatedAt: serverTimestamp,
    finalGradeAt: serverTimestamp,
    finalScore: {
      correctCount: computed.finalCorrectCount,
      totalQuestions: computed.finalGradedQuestionCount,
      percentage: computed.finalPercentage
    }
  });
  return { ok: true, finalScore: computed.finalPercentage };
}

async function deleteExamResultLogOnFreeTier(data) {
  if (!isAdmin()) throw new Error('Área exclusiva do professor.');
  const resultId = String(data.resultId || '');
  const attemptRef = db.collection('examAttempts').doc(resultId);
  const attemptDoc = await attemptRef.get();
  if (!attemptDoc.exists || attemptDoc.data().status !== 'submitted') {
    throw new Error('Log de resultado não encontrado.');
  }
  if (attemptDoc.data().logDeleted === true) return { ok: true };
  await attemptRef.update({
    logDeleted: true,
    logDeletedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
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
  listExamResults: listExamResultsOnFreeTier,
  downloadExamAttachment: ({ attachmentId }) => downloadExamAttachmentOnFreeTier(attachmentId),
  reviewEssayAnswer: reviewEssayAnswerOnFreeTier,
  finalizeEssayReview: finalizeEssayReviewOnFreeTier,
  deleteExamResultLog: deleteExamResultLogOnFreeTier
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
    studentProfile: null,
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
  selectedExamId: null,
  studentExams: [],
  studentExamsStatus: 'idle',
  studentExamsMessage: '',
  examAttempt: null,
  examAnswers: [],
  examAttachments: {},
  examAttachmentUploads: {},
  examScreen: 'idle',
  examMessage: '',
  pendingIdentity: null,
  studentProfileMessage: '',
  academicClasses: mergeAcademicClasses(),
  academicSubjects: [],
  academicStatus: 'idle',
  academicMessage: '',
  academicSubjectClassId: 'entra21',
  studyReferences: [],
  referencesStatus: 'idle',
  referencesMessage: '',
  newsletterItems: [],
  newsletterStatus: 'idle',
  newsletterErrors: [],
  newsletterLoadedAt: '',
  newsletterSearch: '',
  newsletterSource: 'all',
  newsletterCategory: 'Todos',
  newsletterSort: 'recent',
  teacherReferenceTitle: '',
  teacherReferenceDescription: '',
  teacherReferenceUrl: '',
  teacherReferenceClassId: 'entra21',
  teacherReferenceSubjectId: '',
  activities: [],
  activitiesStatus: 'idle',
  activitiesMessage: '',
  activityUploads: {},
  teacherActivityTitle: '',
  teacherActivityInstructions: '',
  teacherActivityClassId: 'entra21',
  teacherActivitySubjectId: '',
  examSaveTimer: null,
  examSubmitting: false,
  examAutoSubmitAttempted: false,
  teacherExamTitle: 'Prova de Inglês',
  teacherExamDurationMinutes: DEFAULT_EXAM_DURATION_MINUTES,
  teacherExamClassId: 'entra21',
  teacherExamSubjectId: '',
  teacherQuestions: [createMultipleChoiceDraft()],
  teacherMessage: '',
  examResults: [],
  examResultsStatus: 'idle',
  examResultsMessage: '',
  reviewingExamResultId: null,
  examReviewSaving: false,
  examResultFilters: {
    classKey: '',
    subjectKey: '',
    studentKey: ''
  },
  teacherStudents: [],
  teacherStudentsStatus: 'idle',
  teacherStudentsMessage: '',
  teacherExams: [],
  teacherExamsStatus: 'idle',
  teacherExamsMessage: '',
  editingExamId: null,
  editingExamTitle: '',
  editingExamDurationMinutes: DEFAULT_EXAM_DURATION_MINUTES,
  editingExamClassId: '',
  editingExamSubjectId: '',
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
      await loadAcademicCatalog();
      state.currentView = getAuthorizedViewFromHash();
      if (state.currentView === 'exam' && !isAdmin()) {
        state.examScreen = 'catalog';
        state.studentExamsStatus = 'idle';
      }
      if (!window.location.hash) {
        window.history.replaceState(null, '', '#/');
      }
    } else {
      state.user = null;
      state.currentView = 'login';
      state.userStats = createDefaultStats(); // Limpa estado local ao deslogar
      state.academicClasses = mergeAcademicClasses();
      state.academicSubjects = [];
      state.academicStatus = 'idle';
      state.studyReferences = [];
      state.referencesStatus = 'idle';
      state.newsletterItems = [];
      state.newsletterStatus = 'idle';
      state.newsletterErrors = [];
      state.newsletterLoadedAt = '';
      state.newsletterSearch = '';
      state.newsletterSource = 'all';
      state.newsletterCategory = 'Todos';
      state.newsletterSort = 'recent';
      state.activities = [];
      state.activitiesStatus = 'idle';
      state.activitiesMessage = '';
      state.activityUploads = {};
      state.teacherStudents = [];
      state.teacherStudentsStatus = 'idle';
      state.teacherStudentsMessage = '';
      state.examResults = [];
      state.examResultsStatus = 'idle';
      state.examResultFilters = { classKey: '', subjectKey: '', studentKey: '' };
      state.studentExams = [];
      state.studentExamsStatus = 'idle';
      state.selectedExamId = null;
      state.exam = null;
      state.examAttempt = null;
      state.examAnswers = [];
      state.examAttachments = {};
      state.examAttachmentUploads = {};
      state.examScreen = 'idle';
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
    studentProfile: data.studentProfile && typeof data.studentProfile === 'object'
      ? { ...data.studentProfile }
      : defaults.studentProfile,
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
    if (state.userStats.studentProfile) {
      state.userStats.studentProfile = {
        ...state.userStats.studentProfile,
        nickname: validation.nickname,
        nicknameKey: validation.nicknameKey,
        updatedAt: new Date().toISOString()
      };
    }

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

async function saveStudentProfile(rawProfile) {
  let profile;
  try {
    profile = validateStudentProfile(rawProfile);
  } catch (error) {
    return { ok: false, message: error.message };
  }

  try {
    const available = await isNicknameAvailable(profile.nicknameKey);
    if (!available) {
      return { ok: false, message: 'Este nickname já está em uso.' };
    }

    const previousStats = state.userStats;
    state.userStats = {
      ...state.userStats,
      nickname: profile.nickname,
      nicknameKey: profile.nicknameKey,
      studentProfile: {
        ...profile,
        completed: true,
        version: 2,
        updatedAt: new Date().toISOString()
      }
    };

    const saved = await saveProgressToFirestore();
    if (!saved) {
      state.userStats = previousStats;
      return { ok: false, message: 'Não foi possível salvar agora. Tente novamente.' };
    }

    await loadLeaderboardFromFirestore();
    return { ok: true };
  } catch (error) {
    console.error('Erro ao salvar cadastro do aluno:', error);
    return { ok: false, message: 'Não foi possível validar ou salvar o cadastro.' };
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

function getSafeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '#';
  } catch {
    return '#';
  }
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
  hub: '#/',
  newsletter: '#/newsletter',
  'english-master': '#/english-master',
  'student-registration': '#/cadastro-do-aluno',
  'student-references': '#/referencias-de-estudo',
  'student-activities': '#/atividades',
  exam: '#/prova',
  'teacher-academics': '#/professor/turmas-e-materias',
  'teacher-students': '#/professor/alunos-por-turma',
  'teacher-references': '#/professor/referencias-de-estudo',
  'teacher-activities': '#/professor/atividades',
  'teacher-create': '#/professor/criacao-de-prova',
  'teacher-exams': '#/professor/provas-cadastradas',
  'teacher-results': '#/professor/resultados'
};

function getAuthorizedViewFromHash() {
  const route = window.location.hash || '#/';
  const requestedView = Object.entries(viewRoutes).find(([, hash]) => hash === route)?.[0] || 'hub';
  const teacherOnly = requestedView === 'teacher-create'
    || requestedView === 'teacher-exams'
    || requestedView === 'teacher-results'
    || requestedView === 'teacher-academics'
    || requestedView === 'teacher-students'
    || requestedView === 'teacher-references'
    || requestedView === 'teacher-activities';
  const studentOnly = requestedView === 'exam'
    || requestedView === 'student-registration'
    || requestedView === 'student-references'
    || requestedView === 'student-activities';

  if (teacherOnly && !isAdmin()) return 'hub';
  if (studentOnly && isAdmin()) return 'hub';
  return requestedView;
}

window.navigateTo = view => {
  const route = viewRoutes[view] || viewRoutes.hub;
  if (view === 'exam') {
    state.examScreen = 'catalog';
    state.selectedExamId = null;
    state.studentExamsStatus = 'idle';
    state.pendingIdentity = null;
    state.examAttachments = {};
    state.examAttachmentUploads = {};
  }
  if (view === 'teacher-exams') state.teacherExamsStatus = 'idle';
  if (view === 'teacher-students') state.teacherStudentsStatus = 'idle';
  if (view === 'teacher-results') state.examResultsStatus = 'idle';
  if (view === 'teacher-references' || view === 'student-references') {
    state.referencesStatus = 'idle';
    state.referencesMessage = '';
  }
  if (view === 'teacher-activities' || view === 'student-activities') {
    state.activitiesStatus = 'idle';
    state.activitiesMessage = '';
    state.activityUploads = {};
  }
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
function isEnglishMasterView() {
  return state.currentView === 'english-master' || state.currentView === 'quiz';
}

function applyViewTheme() {
  const englishMasterActive = isEnglishMasterView();
  const newsletterActive = state.currentView === 'newsletter';
  document.body.dataset.module = englishMasterActive ? 'english-master' : (newsletterActive ? 'newsletter' : 'hub');
  document.title = englishMasterActive
    ? 'English Master | Magister Hub'
    : (newsletterActive ? 'Newsletter Dev | Magister Hub' : 'Magister Hub');
  const subtitle = document.querySelector('header > p');
  if (subtitle) {
    subtitle.textContent = englishMasterActive
      ? 'English Master · Aprendizado interativo de inglês'
      : (newsletterActive
        ? 'Newsletter Dev · Curadoria das comunidades de tecnologia'
        : 'Magister Hub · Seu hub de ferramentas educacionais');
  }
}

function renderApp() {
  applyViewTheme();
  if (!state.user) {
    renderLogin();
    return;
  }

  updateHeader();
  if (state.currentView === 'hub') renderHubHome();
  else if (state.currentView === 'newsletter') renderNewsletter();
  else if (state.currentView === 'english-master') renderEnglishMaster();
  else if (state.currentView === 'student-registration' && !isAdmin()) renderStudentRegistration();
  else if (state.currentView === 'student-references' && !isAdmin()) renderStudentReferences();
  else if (state.currentView === 'student-activities' && !isAdmin()) renderStudentActivities();
  else if (state.currentView === 'quiz') renderQuiz();
  else if (state.currentView === 'exam' && !isAdmin()) renderExamPortal();
  else if (state.currentView === 'teacher-academics' && isAdmin()) renderTeacherAcademics();
  else if (state.currentView === 'teacher-students' && isAdmin()) renderTeacherStudents();
  else if (state.currentView === 'teacher-references' && isAdmin()) renderTeacherReferences();
  else if (state.currentView === 'teacher-activities' && isAdmin()) renderTeacherActivities();
  else if (state.currentView === 'teacher-create' && isAdmin()) renderTeacherExamCreator();
  else if (state.currentView === 'teacher-exams' && isAdmin()) renderTeacherExamManager();
  else if (state.currentView === 'teacher-results' && isAdmin()) renderTeacherResults();
  else {
    state.currentView = 'hub';
    renderHubHome();
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
        <h2>Bem-vindo ao Magister Hub</h2>
        <p>Entre com sua conta Google para acessar seus módulos e ferramentas.</p>
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
  const accountName = getAccountDisplayName();
  const studentProfile = state.userStats.studentProfile;
  const profileHint = studentProfile?.fullName
    ? `${studentProfile.fullName}${studentProfile.className ? ` · ${studentProfile.className}` : ''}`
    : (state.userStats.nickname ? accountName : 'Cadastro pendente');
  const xpPercent = Math.min(100, (state.userStats.xp / XP_PER_LEVEL) * 100);

  headerTop.innerHTML = `
    <button class="hub-brand" onclick="window.navigateTo('hub')" aria-label="Ir para o Magister Hub">
      <span class="hub-brand-mark">MH</span>
      <span class="hub-brand-copy"><strong>Magister Hub</strong><small>${isAdmin() ? 'Hub do professor' : 'Hub do aluno'}</small></span>
    </button>

    <div class="user-profile">
      ${photoURL ? `<img src="${escapeHtml(photoURL)}" class="user-avatar" alt="Profile">` : '<div class="user-avatar avatar-fallback">A</div>'}
      <div class="user-profile-copy">
        <div class="profile-display-name">${profileName}</div>
        <div class="profile-subtitle">${escapeHtml(profileHint)}</div>
        <div class="profile-actions">
          ${isAdmin()
            ? '<button class="profile-action-btn" onclick="window.openNicknameModal()">Editar nick</button>'
            : '<button class="profile-action-btn" onclick="window.navigateTo(\'student-registration\')">Cadastro</button>'}
          <button class="logout-btn" onclick="window.logout()">Sair</button>
        </div>
      </div>
    </div>

    <nav class="app-nav" aria-label="Navegação principal">
      <button class="nav-btn ${state.currentView === 'hub' ? 'active' : ''}" onclick="window.navigateTo('hub')">Hub</button>
      <button class="nav-btn ${state.currentView === 'newsletter' ? 'active' : ''}" onclick="window.navigateTo('newsletter')">Newsletter</button>
      <button class="nav-btn ${isEnglishMasterView() ? 'active' : ''}" onclick="window.navigateTo('english-master')">English Master</button>
      <a class="nav-btn external-nav-btn" href="https://codeescape-c9e1b.web.app/" target="_blank" rel="noopener noreferrer" aria-label="Abrir CodeScape em uma nova guia">CodeScape <span aria-hidden="true">↗</span></a>
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

function formatNewsletterDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function renderNewsletterSourceCards() {
  return NEWSLETTER_SOURCES.map(source => `
    <a class="newsletter-source-card source-${source.id}" href="${escapeHtml(getSafeExternalUrl(source.url))}" target="_blank" rel="noopener noreferrer">
      <span class="newsletter-source-mark" aria-hidden="true">${source.id === 'devto' ? 'DEV' : (source.id === 'hackernews' ? 'Y' : 'SO')}</span>
      <span><small>${escapeHtml(source.kind)}</small><strong>${escapeHtml(source.name)}</strong><em>${escapeHtml(source.description)}</em></span>
      <span class="newsletter-external-mark" aria-hidden="true">↗</span>
    </a>
  `).join('');
}

function renderNewsletterStoryCard(item) {
  const safeUrl = getSafeExternalUrl(item.url);
  const tags = (item.tags || []).slice(0, 3);
  const answerLabel = item.sourceId === 'stackoverflow' ? 'respostas' : 'comentários';
  return `
    <article class="newsletter-story-card">
      <div class="newsletter-story-topline">
        <span class="newsletter-source-badge source-${escapeHtml(item.sourceId)}">${escapeHtml(item.sourceName)}</span>
        <span class="newsletter-category-badge">${escapeHtml(item.category)}</span>
      </div>
      <div class="newsletter-story-copy">
        <h3><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.summary)}</p>
      </div>
      ${tags.length ? `<div class="newsletter-tags">${tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="newsletter-story-meta">
        <span>Por ${escapeHtml(item.author)}</span>
        <span>${formatNewsletterDate(item.publishedAt)}</span>
      </div>
      <div class="newsletter-story-footer">
        <span title="Engajamento da comunidade">▲ ${item.score} · ◌ ${item.comments} ${answerLabel}</span>
        <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Ler ${escapeHtml(item.title)} em ${escapeHtml(item.sourceName)}">Ler na fonte <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  `;
}

function getFilteredNewsletterItems() {
  return filterNewsletterItems(state.newsletterItems, {
    search: state.newsletterSearch,
    source: state.newsletterSource,
    category: state.newsletterCategory,
    sort: state.newsletterSort
  });
}

function renderNewsletterResultsRegion() {
  if (state.newsletterStatus === 'loading') {
    return `
      <div class="newsletter-result-summary" role="status">Buscando novidades nas comunidades...</div>
      <div class="newsletter-grid newsletter-loading-grid" aria-hidden="true">
        ${Array.from({ length: 6 }, () => '<div class="newsletter-story-skeleton"><span></span><strong></strong><em></em><em></em></div>').join('')}
      </div>
    `;
  }

  const items = getFilteredNewsletterItems();
  const unavailableSources = state.newsletterErrors.map(error => error.sourceName);
  const partialWarning = unavailableSources.length && state.newsletterItems.length
    ? `<div class="newsletter-feed-alert warning" role="status"><strong>Feed parcial.</strong> ${escapeHtml(unavailableSources.join(', '))} ${unavailableSources.length === 1 ? 'não respondeu' : 'não responderam'} desta vez. As demais fontes continuam disponíveis.</div>`
    : '';

  if (!state.newsletterItems.length) {
    return `
      <div class="newsletter-feed-alert error" role="alert">
        <strong>Não foi possível atualizar o feed agora.</strong>
        <span>Você ainda pode acessar diretamente as comunidades abaixo ou tentar novamente.</span>
        <button type="button" onclick="window.refreshNewsletter()">Tentar novamente</button>
      </div>
      <div class="newsletter-direct-links">
        ${NEWSLETTER_SOURCES.map(source => `<a href="${escapeHtml(getSafeExternalUrl(source.url))}" target="_blank" rel="noopener noreferrer">Abrir ${escapeHtml(source.name)} ↗</a>`).join('')}
      </div>
    `;
  }

  const updatedLabel = state.newsletterLoadedAt
    ? `Atualizado em ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(state.newsletterLoadedAt))}`
    : '';
  return `
    ${partialWarning}
    <div class="newsletter-result-summary" role="status">
      <span><strong>${items.length}</strong> ${items.length === 1 ? 'publicação encontrada' : 'publicações encontradas'}</span>
      <small>${escapeHtml(updatedLabel)}</small>
    </div>
    ${items.length
      ? `<div class="newsletter-grid">${items.map(renderNewsletterStoryCard).join('')}</div>`
      : `<div class="newsletter-empty"><span aria-hidden="true">⌕</span><h3>Nenhuma publicação encontrada</h3><p>Altere a busca ou os filtros para explorar outros assuntos.</p><button type="button" onclick="window.clearNewsletterFilters()">Limpar filtros</button></div>`}
  `;
}

function updateNewsletterResultsRegion() {
  const region = document.querySelector('.newsletter-results-region');
  if (region) region.innerHTML = renderNewsletterResultsRegion();
}

async function loadNewsletterFeed() {
  state.newsletterStatus = 'loading';
  state.newsletterErrors = [];
  updateNewsletterResultsRegion();
  try {
    const result = await loadDeveloperNews();
    state.newsletterItems = result.items;
    state.newsletterErrors = result.errors;
    state.newsletterLoadedAt = result.loadedAt;
    state.newsletterStatus = result.items.length ? 'ready' : 'error';
  } catch (error) {
    console.warn('Não foi possível carregar a Newsletter:', error);
    state.newsletterItems = [];
    state.newsletterErrors = NEWSLETTER_SOURCES.map(source => ({ sourceId: source.id, sourceName: source.name }));
    state.newsletterStatus = 'error';
  }
  if (state.currentView === 'newsletter') updateNewsletterResultsRegion();
}

function renderNewsletter() {
  const mainContent = document.getElementById('main-content');
  const sourceButtons = [
    { id: 'all', name: 'Todas' },
    ...NEWSLETTER_SOURCES.map(source => ({ id: source.id, name: source.name }))
  ];
  mainContent.innerHTML = `
    <section class="newsletter-page">
      <div class="newsletter-hero">
        <div class="newsletter-hero-copy">
          <span class="newsletter-kicker">NEWSLETTER DEV</span>
          <h1>O que a comunidade está discutindo agora.</h1>
          <p>Uma curadoria automática de artigos, notícias e perguntas para quem desenvolve software — direto de comunidades e fóruns especializados.</p>
          <div class="newsletter-trust-line"><span aria-hidden="true">✓</span> Links sempre abrem na publicação original</div>
        </div>
        <div class="newsletter-code-window" aria-hidden="true">
          <div><i></i><i></i><i></i><small>community-feed.js</small></div>
          <code><span>const</span> dailyRead = [</code>
          <code>&nbsp; <b>'learn'</b>, <b>'build'</b>,</code>
          <code>&nbsp; <b>'share'</b>, <b>'repeat'</b></code>
          <code>];</code>
          <strong>24<span>/</span>7</strong>
        </div>
      </div>

      <div class="newsletter-section-heading">
        <div><span>FONTES SELECIONADAS</span><h2>Conteúdo de quem vive tecnologia</h2></div>
        <small>Comunidades independentes · conteúdo externo</small>
      </div>
      <div class="newsletter-sources-grid">${renderNewsletterSourceCards()}</div>

      <div class="newsletter-feed-heading">
        <div><span>RADAR TECH</span><h2>Últimas da comunidade</h2></div>
        <button class="newsletter-refresh-btn" type="button" onclick="window.refreshNewsletter()" ${state.newsletterStatus === 'loading' ? 'disabled' : ''}>
          <span aria-hidden="true">↻</span> Atualizar feed
        </button>
      </div>

      <div class="newsletter-controls">
        <label class="newsletter-search">
          <span aria-hidden="true">⌕</span>
          <span class="sr-only">Buscar publicações</span>
          <input type="search" maxlength="80" value="${escapeHtml(state.newsletterSearch)}" oninput="window.updateNewsletterSearch(this.value)" placeholder="Busque por tema, tecnologia ou autor..." />
        </label>
        <label class="newsletter-select-control">
          <span>Categoria</span>
          <select onchange="window.setNewsletterFilter('category', this.value)">
            ${NEWSLETTER_CATEGORIES.map(category => `<option value="${escapeHtml(category)}" ${state.newsletterCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
          </select>
        </label>
        <label class="newsletter-select-control">
          <span>Ordenar</span>
          <select onchange="window.setNewsletterFilter('sort', this.value)">
            <option value="recent" ${state.newsletterSort === 'recent' ? 'selected' : ''}>Mais recentes</option>
            <option value="popular" ${state.newsletterSort === 'popular' ? 'selected' : ''}>Mais relevantes</option>
          </select>
        </label>
      </div>
      <div class="newsletter-source-filters" aria-label="Filtrar por fonte">
        ${sourceButtons.map(source => `<button type="button" class="${state.newsletterSource === source.id ? 'active' : ''}" aria-pressed="${state.newsletterSource === source.id}" onclick="window.setNewsletterFilter('source', '${source.id}')">${escapeHtml(source.name)}</button>`).join('')}
      </div>

      <div class="newsletter-results-region">${renderNewsletterResultsRegion()}</div>
    </section>
  `;

  if (state.newsletterStatus === 'idle') queueMicrotask(loadNewsletterFeed);
}

window.updateNewsletterSearch = value => {
  state.newsletterSearch = String(value || '').slice(0, 80);
  updateNewsletterResultsRegion();
};

window.setNewsletterFilter = (kind, value) => {
  if (kind === 'source' && ['all', ...NEWSLETTER_SOURCES.map(source => source.id)].includes(value)) state.newsletterSource = value;
  if (kind === 'category' && NEWSLETTER_CATEGORIES.includes(value)) state.newsletterCategory = value;
  if (kind === 'sort' && ['recent', 'popular'].includes(value)) state.newsletterSort = value;
  renderNewsletter();
};

window.clearNewsletterFilters = () => {
  state.newsletterSearch = '';
  state.newsletterSource = 'all';
  state.newsletterCategory = 'Todos';
  state.newsletterSort = 'recent';
  renderNewsletter();
};

window.refreshNewsletter = () => {
  if (state.newsletterStatus !== 'loading') loadNewsletterFeed();
};

function renderHubModuleCard(module) {
  return `
    <button class="hub-module-card ${module.featured ? 'featured' : ''}" onclick="window.navigateTo('${module.view}')">
      <span class="hub-module-icon" aria-hidden="true">${module.icon}</span>
      <span class="hub-module-content">
        <span class="hub-module-kicker">${escapeHtml(module.kicker)}</span>
        <strong>${escapeHtml(module.title)}</strong>
        <small>${escapeHtml(module.description)}</small>
      </span>
      <span class="hub-module-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function renderHubHome() {
  state.currentView = 'hub';
  if (!isAdmin() && state.studentExamsStatus === 'idle' && isStudentProfileComplete(state.userStats.studentProfile)) {
    state.studentExamsStatus = 'loading';
    queueMicrotask(async () => {
      await loadStudentExamCatalog();
      if (state.currentView === 'hub') renderHubHome();
    });
  }
  const mainContent = document.getElementById('main-content');
  const blockedExamCount = state.studentExams.filter(exam => !exam.active).length;
  const activeExamCount = state.studentExams.filter(exam => exam.active).length;
  const modules = [
    ...(isAdmin() ? [
      {
        view: 'teacher-academics',
        icon: '▦',
        kicker: 'Organização acadêmica',
        title: 'Turmas e matérias',
        description: 'Cadastre as turmas e matérias utilizadas em provas e materiais.'
      },
      {
        view: 'teacher-students',
        icon: '◉',
        kicker: 'Perfis dos alunos',
        title: 'Alunos por turma',
        description: 'Consulte os dados preenchidos pelos alunos, organizados por turma.'
      },
      {
        view: 'teacher-references',
        icon: '⌁',
        kicker: 'Materiais de estudo',
        title: 'Gerenciar referências',
        description: 'Publique links e conteúdos de apoio para cada turma e matéria.'
      },
      {
        view: 'teacher-activities',
        icon: '⇧',
        kicker: 'Entregas em ZIP',
        title: 'Atividades',
        description: 'Cadastre atividades por turma e matéria e acompanhe as entregas.'
      },
      {
        view: 'teacher-create',
        icon: '✦',
        kicker: 'Avaliações',
        title: 'Criar prova',
        description: 'Monte avaliações objetivas ou solicite projetos em arquivo ZIP.'
      },
      {
        view: 'teacher-exams',
        icon: '▣',
        kicker: 'Gestão',
        title: 'Provas cadastradas',
        description: 'Edite, ative, desative ou remova avaliações existentes.'
      },
      {
        view: 'teacher-results',
        icon: '◫',
        kicker: 'Acompanhamento',
        title: 'Resultados',
        description: 'Consulte notas, alunos e tempo de realização das provas.'
      }
    ] : [
      {
        view: 'student-registration',
        icon: '◉',
        kicker: 'Perfil global',
        title: 'Cadastro do aluno',
        description: isStudentProfileComplete(state.userStats.studentProfile)
          ? 'Cadastro completo. Revise seus dados compartilhados entre os submódulos.'
          : 'Preencha seus dados para usá-los em todos os submódulos do Magister Hub.'
      },
      {
        view: 'student-references',
        icon: '⌁',
        kicker: 'Materiais de estudo',
        title: 'Referências de estudo',
        description: 'Consulte links e materiais publicados pelo professor para sua turma.'
      },
      {
        view: 'student-activities',
        icon: '⇧',
        kicker: 'Entregas da turma',
        title: 'Atividades',
        description: 'Consulte as orientações e encaminhe sua atividade em arquivo ZIP.'
      },
      {
        view: 'exam',
        icon: activeExamCount > 0 ? '✓' : (blockedExamCount > 0 ? '🔒' : '📝'),
        kicker: 'Avaliações da turma',
        title: 'Provas',
        description: state.studentExamsStatus === 'loading'
          ? 'Carregando as provas da sua turma...'
          : `${activeExamCount} disponível(is) · ${blockedExamCount} bloqueada(s).`
      }
    ])
  ];

  mainContent.innerHTML = `
    <section class="hub-dashboard">
      <div class="hub-hero">
        <div class="hub-hero-copy">
          <span class="hub-eyebrow">MAGISTER HUB</span>
          <h1>Um único lugar para ensinar, avaliar e acompanhar.</h1>
          <p>Escolha um módulo para continuar. Novas ferramentas educacionais poderão ser adicionadas ao Hub sem alterar os submódulos existentes.</p>
          <div class="hub-role-pill">${isAdmin() ? 'Perfil do professor' : 'Perfil do aluno'}</div>
        </div>
        <div class="hub-hero-orbit" aria-hidden="true">
          <span class="orbit-core">M</span>
          <span class="orbit-dot dot-one"></span>
          <span class="orbit-dot dot-two"></span>
          <span class="orbit-dot dot-three"></span>
        </div>
      </div>

      <div class="hub-section-heading">
        <div><span>Módulos disponíveis</span><h2>Seu espaço de trabalho</h2></div>
        <small>${modules.length} ${modules.length === 1 ? 'módulo' : 'módulos'}</small>
      </div>
      <div class="hub-modules-grid">${modules.map(renderHubModuleCard).join('')}</div>
    </section>
  `;
}

function renderAcademicOptions(items, selectedId, placeholder) {
  return `<option value="">${escapeHtml(placeholder)}</option>${items.map(item => `
    <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)}</option>
  `).join('')}`;
}

function renderAcademicEntityList(items, kind) {
  if (!items.length) return '<div class="academic-empty">Nenhum cadastro disponível.</div>';
  return `<div class="academic-entity-list">${items.map(item => `
    <div class="academic-entity-row">
      <span><strong>${escapeHtml(item.name)}</strong>${kind === 'subject'
        ? `<small>${escapeHtml(item.className || 'Sem turma vinculada')}</small>`
        : (item.builtin ? '<small>Turma padrão</small>' : '')}</span>
      ${item.builtin ? '' : `<button type="button" class="archive-academic-btn" onclick="window.archiveAcademicEntity('${kind}', '${item.id}')">Arquivar</button>`}
    </div>
  `).join('')}</div>`;
}

function renderTeacherAcademics() {
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <section class="exam-page academic-management-page">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Organização acadêmica</span><h2>Turmas e matérias</h2><p>Cadastre os dados usados no perfil dos alunos, nas referências e nas provas.</p></div>
        <button class="secondary-btn" onclick="window.navigateTo('hub')">Voltar ao Hub</button>
      </div>
      ${state.academicMessage ? `<div class="exam-alert ${state.academicMessage.startsWith('Erro:') ? 'error' : 'success'}">${escapeHtml(state.academicMessage)}</div>` : ''}
      <div class="academic-management-grid">
        <article class="academic-panel">
          <div><span class="academic-panel-kicker">Público</span><h3>Turmas</h3><p>Entra21 e JovemProgramador permanecem disponíveis como turmas padrão.</p></div>
          <form class="academic-inline-form" onsubmit="window.submitAcademicEntity(event, 'class')">
            <label class="exam-field"><span>Nome da turma</span><input name="name" minlength="2" maxlength="80" required placeholder="Ex.: Turma Noturna 2026" /></label>
            <button class="next-btn" type="submit">Cadastrar turma</button>
          </form>
          ${renderAcademicEntityList(state.academicClasses, 'class')}
        </article>
        <article class="academic-panel">
          <div><span class="academic-panel-kicker">Conteúdo</span><h3>Matérias</h3><p>As matérias serão relacionadas às provas e referências de estudo.</p></div>
          <form class="academic-inline-form subject-registration-form" onsubmit="window.submitAcademicEntity(event, 'subject')">
            <label class="exam-field"><span>Turma da matéria</span><select name="classId" required onchange="window.updateAcademicSubjectClass(this.value)">${renderAcademicOptions(state.academicClasses, state.academicSubjectClassId, 'Selecione a turma')}</select></label>
            <label class="exam-field"><span>Nome da matéria</span><input name="name" minlength="2" maxlength="80" required placeholder="Ex.: Desenvolvimento Web" /></label>
            <button class="next-btn" type="submit">Cadastrar matéria</button>
          </form>
          ${renderAcademicEntityList(state.academicSubjects, 'subject')}
        </article>
      </div>
    </section>
  `;
}

function renderReferenceCards(references, admin = false) {
  if (!references.length) {
    return '<div class="exam-empty"><div class="empty-icon">⌁</div><h3>Nenhuma referência publicada</h3><p>Os materiais aparecerão aqui quando forem cadastrados.</p></div>';
  }
  return `<div class="study-reference-grid">${references.map(reference => `
    <article class="study-reference-card">
      <div class="reference-card-topline"><span>${escapeHtml(reference.subjectName)}</span><small>${formatExamDate(reference.updatedAtMillis || reference.createdAtMillis)}</small></div>
      <h3>${escapeHtml(reference.title)}</h3>
      ${reference.description ? `<p>${escapeHtml(reference.description)}</p>` : ''}
      <div class="reference-audience">${escapeHtml(reference.className)}</div>
      <div class="reference-actions">
        <a href="${escapeHtml(getSafeExternalUrl(reference.url))}" target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>
        ${admin ? `<button type="button" onclick="window.archiveStudyReference('${reference.id}')">Arquivar</button>` : ''}
      </div>
    </article>
  `).join('')}</div>`;
}


function renderActivitySubmissionRows(submissions) {
  if (!submissions.length) {
    return '<div class="activity-no-submissions">Nenhuma entrega encaminhada até o momento.</div>';
  }
  return `<div class="activity-submission-list">${submissions.map(submission => `
    <div class="activity-submission-row">
      <div><strong>${escapeHtml(submission.studentName || 'Aluno')}</strong><small>${escapeHtml(submission.userEmail)}</small></div>
      <div><span>${escapeHtml(submission.fileName)}</span><small>${formatAttachmentSize(submission.size)} · ${formatExamDate(submission.submittedAtMillis)}</small></div>
      <button type="button" class="download-attachment-btn" onclick="window.downloadActivitySubmission('${submission.id}')">Baixar ZIP</button>
    </div>
  `).join('')}</div>`;
}

function renderTeacherActivities() {
  const mainContent = document.getElementById('main-content');
  if (state.activitiesStatus === 'idle') {
    state.activitiesStatus = 'loading';
    queueMicrotask(async () => {
      await loadActivities();
      if (state.currentView === 'teacher-activities') renderTeacherActivities();
    });
  }
  const subjects = getSubjectsForClass(state.academicSubjects, state.teacherActivityClassId);
  const canCreate = subjects.length > 0;
  const activeActivityCount = state.activities.filter(activity => activity.active && !activity.deleted).length;
  mainContent.innerHTML = `
    <section class="exam-page activities-management-page">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Entregas em ZIP</span><h2>Cadastro de atividades</h2><p>Publique orientações por turma e matéria e acompanhe os arquivos encaminhados.</p></div>
        <button class="secondary-btn" onclick="window.navigateTo('hub')">Voltar ao Hub</button>
      </div>
      ${state.activitiesMessage ? `<div class="exam-alert ${state.activitiesMessage.startsWith('Erro:') ? 'error' : 'success'}" role="status">${escapeHtml(state.activitiesMessage)}</div>` : ''}
      ${canCreate ? '' : '<div class="exam-alert error">Cadastre uma matéria para a turma selecionada antes de criar uma atividade.</div>'}
      <form class="exam-builder activity-builder" onsubmit="window.submitActivity(event)">
        <label class="exam-field"><span>Título da atividade</span><input name="title" minlength="3" maxlength="160" required value="${escapeHtml(state.teacherActivityTitle)}" oninput="window.updateActivityDraft('title', this.value)" placeholder="Ex.: Projeto final de JavaScript" /></label>
        <label class="exam-field"><span>Turma</span><select name="classId" required onchange="window.updateActivityDraft('classId', this.value)">${renderAcademicOptions(state.academicClasses, state.teacherActivityClassId, 'Selecione a turma')}</select></label>
        <label class="exam-field"><span>Matéria</span><select name="subjectId" required onchange="window.updateActivityDraft('subjectId', this.value)">${renderAcademicOptions(subjects, state.teacherActivitySubjectId, 'Selecione a matéria')}</select></label>
        <label class="exam-field activity-instructions-field"><span>Orientações</span><textarea name="instructions" maxlength="5000" rows="6" required oninput="window.updateActivityDraft('instructions', this.value)" placeholder="Descreva o que deve ser entregue e como preparar o arquivo ZIP">${escapeHtml(state.teacherActivityInstructions)}</textarea></label>
        <button class="next-btn" type="submit" ${canCreate ? '' : 'disabled'}>Cadastrar atividade</button>
      </form>
      <div class="hub-section-heading"><div><span>Publicadas</span><h2>Atividades cadastradas</h2></div><small>${activeActivityCount} ativa(s) · ${state.activities.length} total</small></div>
      ${state.activitiesStatus === 'loading'
        ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando atividades...</p></div>'
        : state.activities.length
          ? `<div class="teacher-activity-list">${state.activities.map(activity => `
              <article class="teacher-activity-card ${activity.deleted ? 'archived' : ''}">
                <div class="activity-card-topline"><span>${escapeHtml(activity.subjectName)}</span><small>${escapeHtml(activity.className)} · ${activity.deleted ? 'Arquivada' : 'Ativa'}</small></div>
                <h3>${escapeHtml(activity.title)}</h3>
                <p>${escapeHtml(activity.instructions)}</p>
                <div class="activity-card-actions"><strong>${activity.submissions.length} entrega(s)</strong>${activity.deleted ? '<span class="activity-archived-label">Somente consulta</span>' : `<button type="button" class="delete-exam-btn" onclick="window.archiveActivity('${activity.id}')">Arquivar</button>`}</div>
                ${renderActivitySubmissionRows(activity.submissions)}
              </article>
            `).join('')}</div>`
          : '<div class="exam-empty"><div class="empty-icon">⇧</div><h3>Nenhuma atividade cadastrada</h3><p>Use o formulário acima para publicar a primeira atividade.</p></div>'}
    </section>
  `;
}

function renderStudentActivityUpload(activity) {
  const submission = activity.submission;
  const upload = state.activityUploads[activity.id];
  const uploading = upload?.type === 'uploading';
  return `
    <div class="student-activity-delivery ${submission?.status === 'ready' ? 'delivered' : ''}">
      ${submission?.status === 'ready' ? `
        <div class="attached-file-summary">
          <span class="attached-file-icon">ZIP</span>
          <span><strong>${escapeHtml(submission.fileName)}</strong><small>${formatAttachmentSize(submission.size)} · enviado em ${formatExamDate(submission.submittedAtMillis)}</small></span>
        </div>
      ` : '<p>Nenhuma entrega encaminhada.</p>'}
      <label class="zip-file-picker ${uploading ? 'disabled' : ''}">
        <input type="file" accept=".zip,application/zip" ${uploading ? 'disabled' : ''} onchange="window.handleActivityZipUpload('${activity.id}', this)" />
        <span>${submission?.status === 'ready' ? 'Substituir arquivo ZIP' : 'Selecionar e encaminhar ZIP'}</span>
      </label>
      <div class="zip-upload-progress-track" aria-hidden="true"><span id="activity-upload-progress-${activity.id}" style="width: ${upload?.progress || (submission?.status === 'ready' ? 100 : 0)}%"></span></div>
      <div id="activity-upload-status-${activity.id}" class="zip-upload-status ${upload?.type || (submission?.status === 'ready' ? 'success' : '')}" role="status">${escapeHtml(upload?.message || (submission?.status === 'ready' ? 'Atividade encaminhada. Você pode substituir o ZIP enquanto ela estiver ativa.' : 'Arquivo ZIP de até 5 MB.'))}</div>
    </div>
  `;
}

function renderStudentActivities() {
  const mainContent = document.getElementById('main-content');
  const profile = state.userStats.studentProfile || {};
  const classId = getProfileClassId(profile, state.academicClasses);
  if (!isStudentProfileComplete(profile) || !classId) {
    mainContent.innerHTML = '<section class="exam-page"><div class="exam-empty"><div class="empty-icon">◉</div><h2>Complete seu cadastro</h2><p>Informe sua turma para visualizar e encaminhar atividades.</p><button class="next-btn" onclick="window.navigateTo(\'student-registration\')">Abrir cadastro</button></div></section>';
    return;
  }
  if (state.activitiesStatus === 'idle') {
    state.activitiesStatus = 'loading';
    queueMicrotask(async () => {
      await loadActivities();
      if (state.currentView === 'student-activities') renderStudentActivities();
    });
  }
  mainContent.innerHTML = `
    <section class="exam-page student-activities-page">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Turma ${escapeHtml(profile.className)}</span><h2>Encaminhamento de atividades</h2><p>Consulte as orientações e envie um arquivo ZIP. As atividades não possuem nota.</p></div>
        <button class="secondary-btn" onclick="window.navigateTo('hub')">Voltar ao Hub</button>
      </div>
      ${state.activitiesMessage ? `<div class="exam-alert ${state.activitiesMessage.startsWith('Erro:') ? 'error' : 'success'}" role="status">${escapeHtml(state.activitiesMessage)}</div>` : ''}
      ${state.activitiesStatus === 'loading'
        ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando atividades...</p></div>'
        : state.activities.length
          ? `<div class="student-activity-grid">${state.activities.map(activity => `
              <article class="student-activity-card">
                <div class="activity-card-topline"><span>${escapeHtml(activity.subjectName)}</span><small>${escapeHtml(activity.className)}</small></div>
                <h3>${escapeHtml(activity.title)}</h3>
                <div class="activity-instructions">${escapeHtml(activity.instructions)}</div>
                ${renderStudentActivityUpload(activity)}
              </article>
            `).join('')}</div>`
          : '<div class="exam-empty"><div class="empty-icon">⇧</div><h3>Nenhuma atividade disponível</h3><p>O professor ainda não publicou atividades para sua turma.</p></div>'}
    </section>
  `;
}

function renderTeacherReferences() {
  const mainContent = document.getElementById('main-content');
  if (state.referencesStatus === 'idle') {
    state.referencesStatus = 'loading';
    queueMicrotask(async () => {
      await loadStudyReferences();
      if (state.currentView === 'teacher-references') renderTeacherReferences();
    });
  }
  const referenceSubjects = getSubjectsForClass(state.academicSubjects, state.teacherReferenceClassId);
  const canPublish = referenceSubjects.length > 0;
  mainContent.innerHTML = `
    <section class="exam-page references-management-page">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Materiais de estudo</span><h2>Gerenciar referências</h2><p>Publique links de apoio direcionados por turma e matéria.</p></div>
        <button class="secondary-btn" onclick="window.navigateTo('hub')">Voltar ao Hub</button>
      </div>
      ${!canPublish ? '<div class="exam-alert error">Cadastre uma matéria para a turma selecionada antes de publicar referências.</div>' : ''}
      ${state.referencesMessage ? `<div class="exam-alert ${state.referencesMessage.startsWith('Erro:') ? 'error' : 'success'}">${escapeHtml(state.referencesMessage)}</div>` : ''}
      <form class="exam-builder reference-builder" onsubmit="window.submitStudyReference(event)">
        <label class="exam-field"><span>Título</span><input name="title" minlength="3" maxlength="160" required value="${escapeHtml(state.teacherReferenceTitle)}" oninput="window.updateReferenceDraft('title', this.value)" placeholder="Ex.: Guia de JavaScript" /></label>
        <label class="exam-field"><span>Link</span><input name="url" type="url" maxlength="2048" required value="${escapeHtml(state.teacherReferenceUrl)}" oninput="window.updateReferenceDraft('url', this.value)" placeholder="https://..." /></label>
        <label class="exam-field"><span>Turma</span><select name="classId" required onchange="window.updateReferenceDraft('classId', this.value)">${renderAcademicOptions(state.academicClasses, state.teacherReferenceClassId, 'Selecione a turma')}</select></label>
        <label class="exam-field"><span>Matéria</span><select name="subjectId" required onchange="window.updateReferenceDraft('subjectId', this.value)">${renderAcademicOptions(referenceSubjects, state.teacherReferenceSubjectId, 'Selecione a matéria')}</select></label>
        <label class="exam-field reference-description-field"><span>Descrição</span><textarea name="description" maxlength="1000" rows="4" oninput="window.updateReferenceDraft('description', this.value)" placeholder="Orientações para o estudo">${escapeHtml(state.teacherReferenceDescription)}</textarea></label>
        <button class="next-btn reference-submit" type="submit" ${canPublish ? '' : 'disabled'}>Publicar referência</button>
      </form>
      <div class="hub-section-heading"><div><span>Publicadas</span><h2>Referências cadastradas</h2></div><small>${state.studyReferences.length} item(ns)</small></div>
      ${state.referencesStatus === 'loading' ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando referências...</p></div>' : renderReferenceCards(state.studyReferences, true)}
    </section>
  `;
}

function renderStudentReferences() {
  const mainContent = document.getElementById('main-content');
  const profile = state.userStats.studentProfile || {};
  const classId = getProfileClassId(profile, state.academicClasses);
  if (!isStudentProfileComplete(profile) || !classId) {
    mainContent.innerHTML = '<section class="exam-page"><div class="exam-empty"><div class="empty-icon">◉</div><h2>Complete seu cadastro</h2><p>Informe sua turma no Cadastro do aluno para visualizar as referências corretas.</p><button class="next-btn" onclick="window.navigateTo(\'student-registration\')">Abrir cadastro</button></div></section>';
    return;
  }
  if (state.referencesStatus === 'idle') {
    state.referencesStatus = 'loading';
    queueMicrotask(async () => {
      await loadStudyReferences();
      if (state.currentView === 'student-references') renderStudentReferences();
    });
  }
  mainContent.innerHTML = `
    <section class="exam-page student-references-page">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Sua biblioteca</span><h2>Referências de estudo</h2><p>Materiais publicados para a turma <strong>${escapeHtml(profile.className)}</strong>.</p></div>
        <button class="secondary-btn" onclick="window.navigateTo('hub')">Voltar ao Hub</button>
      </div>
      ${state.referencesStatus === 'error' ? `<div class="exam-alert error">${escapeHtml(state.referencesMessage)}</div>` : ''}
      ${state.referencesStatus === 'loading' ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando referências...</p></div>' : renderReferenceCards(state.studyReferences)}
    </section>
  `;
}

function renderStudentRegistration() {
  state.currentView = 'student-registration';
  const mainContent = document.getElementById('main-content');
  const profile = state.userStats.studentProfile || {};
  const fullName = profile.fullName || state.user?.displayName || '';
  const nickname = profile.nickname || state.userStats.nickname || '';
  const email = profile.email || state.user?.email || '';
  const selectedClassId = getProfileClassId(profile, state.academicClasses);
  const isComplete = isStudentProfileComplete(profile);
  const messageType = state.studentProfileMessage.startsWith('Cadastro salvo') ? 'success' : 'error';

  mainContent.innerHTML = `
    <section class="student-registration-page">
      <div class="student-registration-heading">
        <div>
          <span class="hub-eyebrow">MAGISTER HUB / PERFIL GLOBAL</span>
          <h1>Cadastro do aluno</h1>
          <p>Estes dados ficam vinculados à sua conta e podem ser utilizados por todos os submódulos conectados ao Magister Hub.</p>
        </div>
        <button class="module-back-btn" type="button" onclick="window.navigateTo('hub')">← Voltar ao Hub</button>
      </div>

      <div class="student-registration-layout">
        <aside class="global-profile-notice">
          <span class="global-profile-icon" aria-hidden="true">◎</span>
          <div>
            <strong>Perfil compartilhado</strong>
            <p>Nome, nickname, turma, objetivo e e-mail são salvos em um único cadastro no Firebase.</p>
          </div>
          <span class="profile-completion-badge ${isComplete ? 'complete' : ''}">${isComplete ? 'Cadastro completo' : 'Cadastro pendente'}</span>
        </aside>

        <form class="student-registration-form" onsubmit="window.submitStudentRegistration(event)">
          <label class="exam-field">
            <span>Nome do aluno</span>
            <input name="fullName" type="text" minlength="3" maxlength="120" required autocomplete="name" value="${escapeHtml(fullName)}" placeholder="Nome e sobrenome" />
          </label>
          <label class="exam-field">
            <span>Nickname</span>
            <input name="nickname" type="text" minlength="3" maxlength="20" required autocomplete="off" value="${escapeHtml(nickname)}" placeholder="Como deseja ser chamado" />
          </label>
          <label class="exam-field">
            <span>Turma</span>
            <select name="classId" required>
              ${renderAcademicOptions(state.academicClasses, selectedClassId, 'Selecione sua turma')}
            </select>
          </label>
          <label class="exam-field">
            <span>E-mail</span>
            <input name="email" type="email" maxlength="254" required autocomplete="email" value="${escapeHtml(email)}" placeholder="aluno@email.com" />
          </label>
          <label class="exam-field student-goal-field">
            <span>Objetivo com o curso</span>
            <textarea name="courseGoal" minlength="10" maxlength="1000" rows="5" required placeholder="Conte o que você deseja alcançar com o curso">${escapeHtml(profile.courseGoal || '')}</textarea>
          </label>
          ${state.studentProfileMessage ? `<div class="exam-alert ${messageType}" role="status">${escapeHtml(state.studentProfileMessage)}</div>` : ''}
          <div class="student-registration-actions">
            <button class="secondary-btn" type="button" onclick="window.navigateTo('hub')">Cancelar</button>
            <button class="next-btn" type="submit">Salvar cadastro</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderEnglishMaster() {
  state.currentView = 'english-master';
  const mainContent = document.getElementById('main-content');

  const totalQuestions = allQuestionData.length;
  const progressPercent = Math.min(100, (state.userStats.totalCorrect / totalQuestions * 100).toFixed(0));

  mainContent.innerHTML = `
    <div class="home-container english-master-module">
      <div class="english-module-header">
        <div><span class="english-module-kicker">MAGISTER HUB / SUBMÓDULO</span><h1>English Master</h1><p>Aprenda inglês para tecnologia com prática, desafios e evolução contínua.</p></div>
        <button class="module-back-btn" onclick="window.navigateTo('hub')">← Voltar ao Hub</button>
      </div>
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

function formatAttachmentSize(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderQuestionTypeSelector(item, questionIndex, mode) {
  const editing = mode === 'edit';
  const handler = editing ? 'changeEditingExamQuestionType' : 'changeTeacherQuestionType';
  const type = getExamQuestionType(item);
  return `
    <label class="exam-field question-type-field">
      <span>Tipo de pergunta</span>
      <select onchange="window.${handler}(${questionIndex}, this.value)">
        <option value="${EXAM_QUESTION_TYPES.MULTIPLE_CHOICE}" ${type === EXAM_QUESTION_TYPES.MULTIPLE_CHOICE ? 'selected' : ''}>Múltipla escolha</option>
        <option value="${EXAM_QUESTION_TYPES.ZIP_ATTACHMENT}" ${type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT ? 'selected' : ''}>Resposta com anexo ZIP</option>
        <option value="${EXAM_QUESTION_TYPES.ESSAY}" ${type === EXAM_QUESTION_TYPES.ESSAY ? 'selected' : ''}>Dissertativa</option>
      </select>
    </label>
  `;
}

function renderZipAttachmentBuilder() {
  return `
    <div class="zip-question-config">
      <span class="zip-question-icon" aria-hidden="true">ZIP</span>
      <div>
        <strong>Entrega de repositório ou projeto</strong>
        <p>O aluno deverá anexar um único arquivo <code>.zip</code> de até 5 MB. Esta questão será encaminhada para revisão manual.</p>
      </div>
    </div>
  `;
}

function renderEssayBuilder() {
  return `
    <div class="essay-question-config">
      <span class="essay-question-icon" aria-hidden="true">TXT</span>
      <div>
        <strong>Resposta dissertativa</strong>
        <p>O aluno responderá em texto. A nota definitiva ficará pendente até o professor aprovar ou reprovar esta resposta.</p>
      </div>
    </div>
  `;
}

function renderQuestionBuilderByType(item, questionIndex, mode) {
  const type = getExamQuestionType(item);
  if (type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) return renderZipAttachmentBuilder();
  if (type === EXAM_QUESTION_TYPES.ESSAY) return renderEssayBuilder();
  return renderAlternativeBuilder(item, questionIndex, mode);
}

function renderAlternativeBuilder(item, questionIndex, mode) {
  const options = Array.isArray(item.options) ? item.options : ['', ''];
  const editing = mode === 'edit';
  const updateHandler = editing ? 'updateEditingExamOption' : 'updateTeacherOption';
  const correctHandler = editing ? 'setEditingCorrectOption' : 'setTeacherCorrectOption';
  const removeHandler = editing ? 'removeEditingExamOption' : 'removeTeacherOption';
  const addHandler = editing ? 'addEditingExamOption' : 'addTeacherOption';
  const name = `${editing ? 'edit' : 'create'}-correct-${questionIndex}`;
  return `
    <fieldset class="alternative-builder">
      <legend>Alternativas <small>Marque a resposta correta</small></legend>
      <div class="alternative-list">
        ${options.map((option, optionIndex) => `
          <div class="alternative-editor-row ${Number(item.correctOptionIndex) === optionIndex ? 'correct' : ''}">
            <label class="correct-choice-control" title="Marcar como resposta correta">
              <input type="radio" name="${name}" ${Number(item.correctOptionIndex) === optionIndex ? 'checked' : ''}
                onchange="window.${correctHandler}(${questionIndex}, ${optionIndex})" required />
              <span>${String.fromCharCode(65 + optionIndex)}</span>
            </label>
            <input type="text" maxlength="5000" required value="${escapeHtml(option)}" placeholder="Alternativa ${String.fromCharCode(65 + optionIndex)}"
              oninput="window.${updateHandler}(${questionIndex}, ${optionIndex}, this.value)" />
            <button type="button" class="remove-alternative-btn" onclick="window.${removeHandler}(${questionIndex}, ${optionIndex})"
              ${options.length <= 2 ? 'disabled' : ''} aria-label="Remover alternativa ${String.fromCharCode(65 + optionIndex)}">×</button>
          </div>
        `).join('')}
      </div>
      ${options.length < 4 ? `<button type="button" class="add-alternative-btn" onclick="window.${addHandler}(${questionIndex})">+ Adicionar alternativa</button>` : '<span class="alternative-limit">Limite de 4 alternativas atingido</span>'}
    </fieldset>
  `;
}

function renderTeacherExamCreator() {
  const mainContent = document.getElementById('main-content');
  const examSubjects = getExamSubjectsForClass(state.academicSubjects, state.teacherExamClassId);
  const canCreateExam = examSubjects.length > 0;
  mainContent.innerHTML = `
    <section class="exam-page teacher-exam-page">
      <div class="exam-page-heading">
        <div>
          <span class="eyebrow">Área do professor</span>
          <h2>Criação de Prova</h2>
          <p>Crie questões de múltipla escolha, dissertativas ou entregas em arquivo ZIP.</p>
        </div>
      </div>

      <form class="exam-builder" onsubmit="window.submitExamCreation(event)">
        <div class="exam-settings-fields">
          <label class="exam-field">
            <span>Título da prova</span>
            <input type="text" maxlength="120" required value="${escapeHtml(state.teacherExamTitle)}"
              oninput="window.updateTeacherExamTitle(this.value)" placeholder="Ex.: Avaliação de Inglês - Unidade 1" />
          </label>
          <label class="exam-field exam-duration-field">
            <span>Tempo da prova (minutos)</span>
            <input type="number" min="${MIN_EXAM_DURATION_MINUTES}" max="${MAX_EXAM_DURATION_MINUTES}" step="1" required
              value="${escapeHtml(state.teacherExamDurationMinutes)}" oninput="window.updateTeacherExamDuration(this.value)" />
            <small>De ${MIN_EXAM_DURATION_MINUTES} a ${MAX_EXAM_DURATION_MINUTES} minutos. O cronômetro inicia após a confirmação do aluno.</small>
          </label>
        </div>
        <div class="exam-audience-fields">
          <label class="exam-field"><span>Turma</span><select required onchange="window.updateTeacherExamAudience('classId', this.value)">${renderAcademicOptions(state.academicClasses, state.teacherExamClassId, 'Selecione a turma')}</select></label>
          <label class="exam-field"><span>Matéria</span><select required onchange="window.updateTeacherExamAudience('subjectId', this.value)">${renderAcademicOptions(examSubjects, state.teacherExamSubjectId, 'Selecione a matéria')}</select></label>
        </div>
        ${canCreateExam ? '' : '<div class="exam-alert error">Cadastre uma matéria para a turma selecionada antes de criar a prova.</div>'}

        <div class="builder-heading">
          <h3>Perguntas da prova</h3>
          <span>${state.teacherQuestions.length} ${state.teacherQuestions.length === 1 ? 'questão' : 'questões'}</span>
        </div>

        <div class="question-builder-list">
          ${state.teacherQuestions.map((item, index) => `
            <article class="question-builder-card">
              <div class="question-builder-number">${index + 1}</div>
              ${renderQuestionTypeSelector(item, index, 'create')}
              <label class="exam-field">
                <span>Pergunta</span>
                <textarea required maxlength="5000" rows="3" placeholder="Digite a pergunta"
                  oninput="window.updateTeacherQuestion(${index}, 'prompt', this.value)">${escapeHtml(item.prompt)}</textarea>
              </label>
              ${renderQuestionBuilderByType(item, index, 'create')}
              <button type="button" class="remove-question-btn" onclick="window.removeTeacherQuestion(${index})"
                ${state.teacherQuestions.length === 1 ? 'disabled' : ''} aria-label="Remover questão ${index + 1}">Remover</button>
            </article>
          `).join('')}
        </div>

        <button type="button" class="add-question-btn" onclick="window.addTeacherQuestion()">
          <span aria-hidden="true">+</span> Adicionar pergunta
        </button>

        ${state.teacherMessage ? `<div class="exam-alert ${state.teacherMessage.startsWith('Prova criada') ? 'success' : 'error'}" role="status">${escapeHtml(state.teacherMessage)}</div>` : ''}

        <button type="submit" class="next-btn confirm-exam-btn" ${canCreateExam ? '' : 'disabled'}>Confirmar Criação</button>
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
                <p>${exam.questionCount} ${exam.questionCount === 1 ? 'questão cadastrada' : 'questões cadastradas'} · ${formatExamDurationLabel(exam.durationSeconds)}</p>
                <div class="exam-academic-meta"><span>${escapeHtml(exam.className || 'Todas as turmas')}</span><span>${escapeHtml(exam.subjectName || 'Matéria não informada')}</span></div>
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
  const editingSubjects = getExamSubjectsForClass(state.academicSubjects, state.editingExamClassId);
  const canSaveExam = editingSubjects.length > 0;
  mainContent.innerHTML = `
    <section class="exam-page teacher-exam-editor">
      <div class="exam-page-heading">
        <div><span class="eyebrow">Editar prova</span><h2>${escapeHtml(state.editingExamTitle)}</h2><p>Edite questões objetivas, dissertativas ou entregas em ZIP.</p></div>
        <button class="secondary-btn" onclick="window.cancelExamEditing()">Cancelar edição</button>
      </div>
      <form class="exam-builder" onsubmit="window.submitExamUpdate(event)">
        <div class="exam-settings-fields">
          <label class="exam-field"><span>Título da prova</span><input type="text" maxlength="120" required value="${escapeHtml(state.editingExamTitle)}" oninput="window.updateEditingExamTitle(this.value)" /></label>
          <label class="exam-field exam-duration-field">
            <span>Tempo da prova (minutos)</span>
            <input type="number" min="${MIN_EXAM_DURATION_MINUTES}" max="${MAX_EXAM_DURATION_MINUTES}" step="1" required
              value="${escapeHtml(state.editingExamDurationMinutes)}" oninput="window.updateEditingExamDuration(this.value)" />
            <small>Alterações não afetam tentativas que já foram iniciadas.</small>
          </label>
        </div>
        <div class="exam-audience-fields">
          <label class="exam-field"><span>Turma</span><select required onchange="window.updateEditingExamAudience('classId', this.value)">${renderAcademicOptions(state.academicClasses, state.editingExamClassId, 'Selecione a turma')}</select></label>
          <label class="exam-field"><span>Matéria</span><select required onchange="window.updateEditingExamAudience('subjectId', this.value)">${renderAcademicOptions(editingSubjects, state.editingExamSubjectId, 'Selecione a matéria')}</select></label>
        </div>
        ${canSaveExam ? '' : '<div class="exam-alert error">Cadastre uma matéria para a turma selecionada antes de salvar a prova.</div>'}
        <div class="builder-heading"><h3>Perguntas da prova</h3><span>${state.editingExamQuestions.length} ${state.editingExamQuestions.length === 1 ? 'questão' : 'questões'}</span></div>
        <div class="question-builder-list">
          ${state.editingExamQuestions.map((item, index) => `
            <article class="question-builder-card">
              <div class="question-builder-number">${index + 1}</div>
              ${renderQuestionTypeSelector(item, index, 'edit')}
              <label class="exam-field"><span>Pergunta</span><textarea required maxlength="5000" rows="3" oninput="window.updateEditingExamQuestion(${index}, 'prompt', this.value)">${escapeHtml(item.prompt)}</textarea></label>
              ${renderQuestionBuilderByType(item, index, 'edit')}
              <button type="button" class="remove-question-btn" onclick="window.removeEditingExamQuestion(${index})" ${state.editingExamQuestions.length === 1 ? 'disabled' : ''}>Remover</button>
            </article>
          `).join('')}
        </div>
        <button type="button" class="add-question-btn" onclick="window.addEditingExamQuestion()"><span aria-hidden="true">+</span> Adicionar pergunta</button>
        ${state.teacherExamsMessage ? `<div class="exam-alert ${state.teacherExamsMessage.startsWith('Erro:') ? 'error' : 'success'}">${escapeHtml(state.teacherExamsMessage)}</div>` : ''}
        <button type="submit" class="next-btn confirm-exam-btn" ${canSaveExam ? '' : 'disabled'}>Salvar alterações</button>
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

function renderTeacherStudentCard(student) {
  const initial = escapeHtml(student.fullName.charAt(0).toUpperCase() || 'A');
  const updatedLabel = student.updatedAtMillis
    ? formatExamDate(student.updatedAtMillis)
    : 'Data não informada';
  return `
    <article class="teacher-student-card">
      <div class="teacher-student-identity">
        <span class="teacher-student-avatar" aria-hidden="true">${initial}</span>
        <div>
          <h3>${escapeHtml(student.fullName)}</h3>
          <span>${student.nickname ? `@${escapeHtml(student.nickname)}` : 'Nickname não informado'}</span>
        </div>
      </div>
      <dl class="teacher-student-details">
        <div><dt>E-mail</dt><dd>${escapeHtml(student.email || 'Não informado')}</dd></div>
        <div><dt>Objetivo com o curso</dt><dd>${escapeHtml(student.courseGoal || 'Não informado')}</dd></div>
        <div><dt>Cadastro atualizado</dt><dd>${escapeHtml(updatedLabel)}</dd></div>
      </dl>
    </article>
  `;
}

function renderTeacherStudents() {
  const mainContent = document.getElementById('main-content');
  if (state.teacherStudentsStatus === 'idle') {
    state.teacherStudentsStatus = 'loading';
    queueMicrotask(loadTeacherStudents);
  }

  const groups = buildTeacherStudentGroups(state.teacherStudents, state.academicClasses);
  const studentCount = groups.reduce((total, group) => total + group.students.length, 0);
  const content = state.teacherStudentsStatus === 'loading'
    ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando alunos...</p></div>'
    : state.teacherStudentsStatus === 'error'
      ? `<div class="exam-empty"><h3>Não foi possível carregar</h3><p>${escapeHtml(state.teacherStudentsMessage)}</p><button class="next-btn" onclick="window.refreshTeacherStudents()">Tentar novamente</button></div>`
      : groups.length
        ? `<div class="teacher-student-groups">${groups.map(group => `
            <section class="teacher-class-group">
              <div class="teacher-class-heading">
                <div><span>Turma</span><h2>${escapeHtml(group.className)}</h2></div>
                <strong>${group.students.length} ${group.students.length === 1 ? 'aluno' : 'alunos'}</strong>
              </div>
              <div class="teacher-student-grid">${group.students.map(renderTeacherStudentCard).join('')}</div>
            </section>
          `).join('')}</div>`
        : '<div class="exam-empty"><div class="empty-icon">◉</div><h3>Nenhum cadastro de aluno</h3><p>Os perfis aparecerão aqui depois que os alunos concluírem o cadastro.</p></div>';

  mainContent.innerHTML = `
    <section class="exam-page teacher-students-page">
      <div class="exam-page-heading results-heading">
        <div><span class="eyebrow">Área do professor</span><h2>Alunos por turma</h2><p>Consulte nome, nickname, e-mail e objetivo informados no perfil global.</p></div>
        <button class="secondary-btn" onclick="window.refreshTeacherStudents()">Atualizar</button>
      </div>
      ${state.teacherStudentsStatus === 'ready' ? `<div class="teacher-student-summary"><span><strong>${studentCount}</strong> ${studentCount === 1 ? 'aluno cadastrado' : 'alunos cadastrados'}</span><span><strong>${groups.length}</strong> ${groups.length === 1 ? 'turma' : 'turmas'}</span></div>` : ''}
      ${content}
    </section>
  `;
}

async function loadTeacherStudents() {
  if (!isAdmin()) return;
  try {
    const snapshot = await db.collection('users').get();
    state.teacherStudents = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    state.teacherStudentsStatus = 'ready';
    state.teacherStudentsMessage = '';
  } catch (error) {
    state.teacherStudentsStatus = 'error';
    state.teacherStudentsMessage = getFriendlyError(error, 'Não foi possível carregar os alunos.');
  }
  if (state.currentView === 'teacher-students') renderTeacherStudents();
}

function renderTeacherResultFilterOptions(options, selectedValue, emptyLabel) {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${options.map(option => `
    <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>
  `).join('')}`;
}

function renderTeacherResultFilters(filteredCount) {
  const options = getTeacherResultFilterOptions(state.examResults, state.examResultFilters);
  const hasActiveFilters = Object.values(state.examResultFilters).some(Boolean);
  return `
    <div class="teacher-results-filters">
      <div class="teacher-results-filter-grid">
        <label class="exam-field"><span>Turma</span><select onchange="window.updateExamResultFilter('classKey', this.value)">${renderTeacherResultFilterOptions(options.classes, state.examResultFilters.classKey, 'Todas as turmas')}</select></label>
        <label class="exam-field"><span>Matéria</span><select onchange="window.updateExamResultFilter('subjectKey', this.value)">${renderTeacherResultFilterOptions(options.subjects, state.examResultFilters.subjectKey, 'Todas as matérias')}</select></label>
        <label class="exam-field"><span>Aluno</span><select onchange="window.updateExamResultFilter('studentKey', this.value)">${renderTeacherResultFilterOptions(options.students, state.examResultFilters.studentKey, 'Todos os alunos')}</select></label>
        <button type="button" class="secondary-btn clear-result-filters-btn" onclick="window.clearExamResultFilters()" ${hasActiveFilters ? '' : 'disabled'}>Limpar filtros</button>
      </div>
      <p class="teacher-results-filter-summary" aria-live="polite">Mostrando <strong>${filteredCount}</strong> de <strong>${state.examResults.length}</strong> resultados.</p>
    </div>
  `;
}

function renderTeacherResultGrade(result) {
  if (result.essayQuestionCount > 0 && !result.finalGradeReady) {
    const progress = `${result.reviewedEssayCount}/${result.essayQuestionCount} dissertativas corrigidas`;
    const status = result.pendingEssayReviewCount === 0 ? 'Pronta para contabilizar' : 'Correção pendente';
    const automatic = result.autoGradedCount > 0
      ? `<small>Objetivas: ${result.correctCount}/${result.autoGradedCount} · ${result.percentage}%</small>`
      : '<small>Sem questões objetivas</small>';
    const zip = result.manualReviewCount > 0 ? '<small>ZIP em revisão separada</small>' : '';
    return `<span class="grade-pill manual-review">${status}</span><small>${progress}</small>${automatic}${zip}`;
  }
  if (result.manualReviewCount > 0) {
    const scored = result.finalPercentage !== null
      ? `<small>Nota contabilizada: ${result.finalPercentage}%</small>`
      : result.autoGradedCount > 0
        ? `<small>Objetivas: ${result.correctCount}/${result.autoGradedCount} · ${result.percentage}%</small>`
        : '<small>Sem nota calculável</small>';
    return `<span class="grade-pill manual-review">ZIP em revisão</span>${scored}`;
  }
  if (result.finalGradeReady && result.finalPercentage !== null) {
    return `<span class="grade-pill">${result.finalCorrectCount}/${result.finalGradedQuestionCount} · ${result.finalPercentage}%</span>`;
  }
  return '<span class="grade-pill manual-review">Sem nota calculável</span>';
}

function renderTeacherResultActions(result) {
  const downloads = (result.attachments || []).map((attachment, index) => `
    <button class="download-attachment-btn" onclick="event.stopPropagation(); window.downloadExamAttachment('${attachment.id}')">
      Baixar ZIP${result.attachments.length > 1 ? ` ${index + 1}` : ''}
    </button>
  `).join('');
  const missing = result.manualReviewCount > 0 && !result.attachments?.length
    ? '<span class="attachment-missing-label">ZIP não entregue</span>'
    : '';
  return `${downloads}${missing}<button class="delete-result-log-btn" onclick="event.stopPropagation(); window.deleteExamResultLog('${result.id}')">Excluir log</button>`;
}

function renderTeacherResultReview(result) {
  const essayFeedback = (result.feedback || []).filter(item => item.requiresEssayReview);
  const zipFeedback = (result.feedback || []).filter(item => item.requiresManualReview);
  const finalized = result.finalGradeReady && result.essayQuestionCount > 0;
  const allReviewed = result.pendingEssayReviewCount === 0 && essayFeedback.length > 0;
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <section class="exam-page teacher-result-review-page">
      <div class="exam-page-heading results-heading">
        <div>
          <span class="eyebrow">Correção individual</span>
          <h2>${escapeHtml(`${result.firstName} ${result.lastName}`)}</h2>
          <p>${escapeHtml(result.examTitle || 'Prova')} · ${escapeHtml([result.className, result.subjectName].filter(Boolean).join(' · '))}</p>
        </div>
        <button class="secondary-btn" onclick="window.closeExamResultReview()">Voltar aos resultados</button>
      </div>
      ${state.examResultsMessage ? `<div class="exam-alert ${state.examResultsMessage.startsWith('Erro:') ? 'error' : 'success'}" role="status">${escapeHtml(state.examResultsMessage)}</div>` : ''}
      <div class="review-score-summary">
        <div><span>Questões objetivas</span><strong>${result.autoGradedCount ? `${result.correctCount}/${result.autoGradedCount}` : '—'}</strong><small>${result.percentage === null ? 'Sem objetivas' : `${result.percentage}% provisório`}</small></div>
        <div><span>Dissertativas</span><strong>${result.approvedEssayCount}/${result.essayQuestionCount}</strong><small>${finalized ? 'Correção finalizada' : `${result.reviewedEssayCount} corrigidas`}</small></div>
        <div class="${finalized ? 'finalized' : ''}"><span>Nota definitiva</span><strong>${finalized ? `${result.finalPercentage}%` : 'Pendente'}</strong><small>${finalized ? `${result.finalCorrectCount}/${result.finalGradedQuestionCount} pontos` : 'Use o botão após corrigir todas'}</small></div>
      </div>
      ${essayFeedback.length ? `
        <div class="essay-review-list">
          ${essayFeedback.map((item, index) => {
            const decision = item.essayDecision;
            return `
              <article class="essay-review-card ${decision || 'pending'}">
                <div class="essay-review-card-heading">
                  <span>Dissertativa ${index + 1}</span>
                  <strong>${decision === 'approved' ? '✓ Aprovada' : decision === 'rejected' ? '✕ Incorreta' : 'Pendente'}</strong>
                </div>
                <h3>${escapeHtml(item.prompt)}</h3>
                <div class="student-written-answer">${escapeHtml(item.studentAnswer || 'Não respondida')}</div>
                <div class="essay-decision-actions">
                  <button type="button" class="approve-essay-btn ${decision === 'approved' ? 'selected' : ''}"
                    onclick="window.setEssayReviewDecision('${result.id}', '${item.questionId}', 'approved')"
                    ${state.examReviewSaving || finalized ? 'disabled' : ''}>✓ Aprovar resposta</button>
                  <button type="button" class="reject-essay-btn ${decision === 'rejected' ? 'selected' : ''}"
                    onclick="window.setEssayReviewDecision('${result.id}', '${item.questionId}', 'rejected')"
                    ${state.examReviewSaving || finalized ? 'disabled' : ''}>✕ Marcar incorreta</button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
        <div class="finalize-grade-panel">
          <div><strong>${finalized ? 'Nota final contabilizada' : allReviewed ? 'Todas as dissertativas foram corrigidas' : 'Correção ainda incompleta'}</strong><p>${finalized ? `Resultado definitivo: ${result.finalPercentage}%.` : 'A nota objetiva é provisória até a confirmação final do professor.'}</p></div>
          <button class="next-btn" onclick="window.finalizeEssayResult('${result.id}')"
            ${!allReviewed || finalized || state.examReviewSaving ? 'disabled' : ''}>${finalized ? 'Nota contabilizada' : 'Contabilizar nota final'}</button>
        </div>
      ` : '<div class="exam-empty"><h3>Sem questões dissertativas</h3><p>Este resultado não exige correção textual.</p></div>'}
      ${zipFeedback.length ? `<div class="zip-review-note"><strong>Anexos ZIP</strong><p>Os anexos continuam disponíveis para revisão separada e não entram na nota objetiva + dissertativa.</p><div class="result-action-list">${renderTeacherResultActions(result)}</div></div>` : ''}
    </section>
  `;
}

function renderTeacherResults() {
  const mainContent = document.getElementById('main-content');
  if (state.reviewingExamResultId) {
    const selectedResult = state.examResults.find(result => result.id === state.reviewingExamResultId);
    if (selectedResult) {
      renderTeacherResultReview(selectedResult);
      return;
    }
    state.reviewingExamResultId = null;
  }
  if (state.examResultsStatus === 'idle') {
    state.examResultsStatus = 'loading';
    queueMicrotask(loadTeacherResults);
  }

  const filteredResults = filterTeacherResults(state.examResults, state.examResultFilters);
  const filters = state.examResultsStatus === 'ready' && state.examResults.length
    ? renderTeacherResultFilters(filteredResults.length)
    : '';
  const content = state.examResultsStatus === 'loading'
    ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando resultados...</p></div>'
    : state.examResultsStatus === 'error'
      ? `<div class="exam-empty"><h3>Não foi possível carregar</h3><p>${escapeHtml(state.examResultsMessage)}</p><button class="next-btn" onclick="window.refreshExamResults()">Tentar novamente</button></div>`
      : filteredResults.length
        ? `<div class="teacher-result-card-grid">
            ${filteredResults.map(result => `
              <article class="teacher-result-card" role="button" tabindex="0"
                onclick="window.openExamResultReview('${result.id}')"
                onkeydown="if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); window.openExamResultReview('${result.id}'); }">
                <div class="teacher-result-card-topline"><span>${escapeHtml(result.examTitle || 'Prova')}</span><time>${formatExamDate(result.submittedAtMillis)}</time></div>
                <h3>${escapeHtml(`${result.firstName} ${result.lastName}`)}</h3>
                <p>${escapeHtml(result.userEmail || '')}</p>
                <div class="exam-academic-meta"><span>${escapeHtml(result.className || 'Turma não informada')}</span><span>${escapeHtml(result.subjectName || 'Matéria não informada')}</span></div>
                <div class="teacher-result-card-score">${renderTeacherResultGrade(result)}</div>
                <div class="teacher-result-card-footer"><span>Tempo: <strong>${formatExamTime(result.elapsedSeconds)}</strong></span><span>Abrir correção →</span></div>
                <div class="result-action-list">${renderTeacherResultActions(result)}</div>
              </article>
            `).join('')}
          </div>`
        : state.examResults.length
          ? '<div class="exam-empty filtered-results-empty"><h3>Nenhum resultado encontrado</h3><p>Altere ou limpe os filtros para visualizar outros resultados.</p></div>'
          : '<div class="exam-empty"><h3>Nenhuma prova realizada</h3><p>Os resultados aparecerão aqui assim que os alunos enviarem a avaliação.</p></div>';

  mainContent.innerHTML = `
    <section class="exam-page teacher-results-page">
      <div class="exam-page-heading results-heading">
        <div><span class="eyebrow">Área do professor</span><h2>Dashboard de Resultados</h2><p>Clique no card de um aluno para corrigir as respostas e contabilizar a nota final.</p></div>
        <button class="secondary-btn" onclick="window.refreshExamResults()">Atualizar</button>
      </div>
      ${state.examResultsMessage ? `<div class="exam-alert ${state.examResultsMessage.startsWith('Erro:') ? 'error' : 'success'}" role="status">${escapeHtml(state.examResultsMessage)}</div>` : ''}
      ${filters}
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
    state.examResultsMessage = getFriendlyError(error, 'Não foi possível carregar os resultados.');
  }
  if (state.currentView === 'teacher-results') renderTeacherResults();
}

function renderStudentExamCatalog(mainContent) {
  const profile = state.userStats.studentProfile || {};
  if (!isStudentProfileComplete(profile)) {
    mainContent.innerHTML = '<section class="exam-page"><div class="exam-empty"><div class="empty-icon">◉</div><h2>Complete seu cadastro</h2><p>Informe sua turma para visualizar somente as provas destinadas a você.</p><button class="next-btn" onclick="window.navigateTo(\'student-registration\')">Abrir cadastro</button></div></section>';
    return;
  }
  const blockedCount = state.studentExams.filter(exam => !exam.active).length;
  const activeCount = state.studentExams.filter(exam => exam.active).length;
  const content = state.studentExamsStatus === 'loading'
    ? '<div class="exam-loading"><div class="loading-spinner"></div><p>Carregando provas da turma...</p></div>'
    : state.studentExamsStatus === 'error'
      ? `<div class="exam-empty"><h3>Não foi possível carregar</h3><p>${escapeHtml(state.studentExamsMessage)}</p><button class="next-btn" onclick="window.refreshStudentExamCatalog()">Tentar novamente</button></div>`
      : state.studentExams.length
        ? `<div class="student-exam-catalog-grid">${state.studentExams.map(exam => {
            const canOpen = exam.active || exam.hasAttempt;
            const status = exam.attemptStatus === 'submitted'
              ? 'Concluída'
              : exam.attemptStatus === 'in_progress'
                ? 'Em andamento'
                : exam.active ? 'Disponível' : 'Bloqueada';
            const action = exam.attemptStatus === 'submitted'
              ? 'Ver resultado'
              : exam.attemptStatus === 'in_progress'
                ? 'Continuar prova'
                : 'Iniciar prova';
            return `
              <article class="student-exam-catalog-card ${exam.active ? 'active' : 'locked'}">
                <div class="registered-exam-topline"><span class="exam-status-badge ${exam.active ? 'active' : 'inactive'}">${exam.active ? '✓' : '🔒'} ${status}</span><span class="registered-exam-date">${formatExamDate(exam.updatedAtMillis || exam.createdAtMillis)}</span></div>
                <h3>${escapeHtml(exam.title)}</h3>
                <p>${exam.questionCount} ${exam.questionCount === 1 ? 'questão' : 'questões'} · ${formatExamDurationLabel(exam.durationSeconds)} · ${escapeHtml(exam.subjectName || 'Matéria')}</p>
                <div class="exam-academic-meta"><span>${escapeHtml(exam.className || profile.className)}</span><span>${escapeHtml(exam.subjectName || 'Matéria não informada')}</span></div>
                ${canOpen
                  ? `<button class="next-btn" onclick="window.openStudentExam('${exam.id}')">${action}</button>`
                  : '<div class="catalog-locked-notice">Aguarde o professor liberar esta prova.</div>'}
              </article>
            `;
          }).join('')}</div>`
        : '<div class="exam-empty"><div class="empty-icon">📝</div><h3>Nenhuma prova para sua turma</h3><p>O professor ainda não cadastrou avaliações para esta turma.</p></div>';

  mainContent.innerHTML = `
    <section class="exam-page student-exam-catalog-page">
      <div class="exam-page-heading results-heading">
        <div><span class="eyebrow">Turma ${escapeHtml(profile.className)}</span><h2>Provas da sua turma</h2><p>Você visualiza somente avaliações destinadas à sua turma.</p></div>
        <button class="secondary-btn" onclick="window.refreshStudentExamCatalog()">Atualizar</button>
      </div>
      <div class="exam-catalog-summary"><span><strong>${activeCount}</strong> disponíveis</span><span class="blocked"><strong>${blockedCount}</strong> bloqueadas</span><span><strong>${state.studentExams.length}</strong> total</span></div>
      ${content}
    </section>
  `;
}

function renderExamPortal() {
  const mainContent = document.getElementById('main-content');
  if (state.examScreen === 'catalog') {
    if (state.studentExamsStatus === 'idle') {
      state.studentExamsStatus = 'loading';
      queueMicrotask(async () => {
        await loadStudentExamCatalog();
        if (state.currentView === 'exam' && state.examScreen === 'catalog') renderExamPortal();
      });
    }
    renderStudentExamCatalog(mainContent);
    return;
  }
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
          <div class="locked-exam-info"><span>${state.exam.questionCount} ${state.exam.questionCount === 1 ? 'questão' : 'questões'}</span><span>Tempo previsto: ${formatExamDurationLabel(state.exam.durationSeconds)}</span></div>
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

  const profileIdentity = splitStudentFullName(state.userStats.studentProfile?.fullName || '');
  const identity = state.pendingIdentity || profileIdentity;
  mainContent.innerHTML = `
    <section class="exam-page identification-page">
      <div class="exam-card identification-card">
        <span class="eyebrow">${escapeHtml(state.exam.title)}</span>
        <h2>Identificação do aluno</h2>
        <p class="identity-warning">Insira seu nome e sobrenome verdadeiros. Não utilize nicknames.</p>
        <form class="identity-form" onsubmit="window.continueToExamInstructions(event)">
          <label class="exam-field"><span>Nome</span><input name="firstName" type="text" minlength="2" maxlength="80" required autocomplete="given-name" value="${escapeHtml(identity.firstName || '')}" /></label>
          <label class="exam-field"><span>Sobrenome</span><input name="lastName" type="text" minlength="2" maxlength="80" required autocomplete="family-name" value="${escapeHtml(identity.lastName || '')}" /></label>
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
          <li>Você terá <strong>${formatExamDurationLabel(state.exam.durationSeconds)}</strong> a partir da confirmação.</li>
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

function renderStudentZipAttachment(question, questionIndex) {
  const attachment = state.examAttachments[question.id];
  const upload = state.examAttachmentUploads[question.id];
  const uploading = upload?.type === 'uploading';
  const answerValue = state.examAnswers[questionIndex]?.value || '';
  const hasAttachment = attachment?.status === 'ready' || Boolean(answerValue);
  return `
    <div class="student-zip-answer ${hasAttachment ? 'has-file' : ''}">
      <div class="student-zip-heading">
        <div>
          <strong>${hasAttachment ? 'Arquivo ZIP anexado' : 'Anexe seu projeto em ZIP'}</strong>
          <p>Somente <code>.zip</code>, até ${formatAttachmentSize(MAX_ZIP_FILE_SIZE_BYTES)}. Remova <code>node_modules</code>, builds e dependências antes de compactar.</p>
        </div>
        <span class="manual-review-pill">Revisão manual</span>
      </div>
      ${attachment?.status === 'ready' ? `
        <div class="attached-file-summary">
          <span class="attached-file-icon">ZIP</span>
          <span><strong>${escapeHtml(attachment.fileName)}</strong><small>${formatAttachmentSize(attachment.size)}</small></span>
        </div>
      ` : ''}
      <label class="zip-file-picker ${uploading ? 'disabled' : ''}">
        <input type="file" accept=".zip,application/zip" ${uploading || state.examSubmitting ? 'disabled' : ''}
          onchange="window.handleStudentZipUpload(${questionIndex}, this)" />
        <span>${hasAttachment ? 'Substituir arquivo ZIP' : 'Selecionar e enviar ZIP'}</span>
      </label>
      <div class="zip-upload-progress-track" aria-hidden="true">
        <span id="zip-upload-progress-${question.id}" style="width: ${upload?.progress || (attachment?.status === 'ready' ? 100 : 0)}%"></span>
      </div>
      <div id="zip-upload-status-${question.id}" class="zip-upload-status ${upload?.type || (attachment?.status === 'ready' ? 'success' : '')}" role="status">
        ${escapeHtml(upload?.message || (attachment?.status === 'ready' ? 'Arquivo pronto para envio da prova.' : 'Nenhum arquivo selecionado.'))}
      </div>
    </div>
  `;
}

function renderStudentExamOptions(question, questionIndex) {
  const selectedAnswer = state.examAnswers[questionIndex]?.value || '';
  return `
    <fieldset class="student-exam-options">
      <legend>Selecione uma alternativa</legend>
      ${question.options.map((option, optionIndex) => {
        const selected = selectedAnswer === option;
        return `
          <button type="button" class="student-exam-option ${selected ? 'selected' : ''}"
            onclick="window.selectStudentExamOption(${questionIndex}, ${optionIndex})" aria-pressed="${selected}">
            <span class="student-option-letter">${String.fromCharCode(65 + optionIndex)}</span>
            <span>${escapeHtml(option)}</span>
          </button>
        `;
      }).join('')}
    </fieldset>
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
            ${getExamQuestionType(question) === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT
              ? renderStudentZipAttachment(question, index)
              : getExamQuestionType(question) === EXAM_QUESTION_TYPES.ESSAY
                ? `<div class="student-essay-answer"><span class="manual-review-pill">Correção pelo professor</span><label class="exam-field"><span>Sua resposta dissertativa</span><textarea rows="7" maxlength="5000" placeholder="Desenvolva sua resposta" oninput="window.updateStudentExamAnswer(${index}, this.value)">${escapeHtml(state.examAnswers[index]?.value || '')}</textarea></label></div>`
                : renderStudentExamOptions(question, index)}
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
  const hasPendingEssayReview = result.essayQuestionCount > 0 && !result.finalGradeReady;
  const hasZipReview = result.manualReviewCount > 0;
  const automaticSummary = result.autoGradedCount > 0
    ? `Nas questões objetivas, você acertou <strong>${result.correctCount}</strong> de <strong>${result.autoGradedCount}</strong>${result.percentage === null ? '' : ` (${result.percentage}%)`}.`
    : 'Esta avaliação não possui questões objetivas.';
  mainContent.innerHTML = `
    <section class="exam-page exam-result-page">
      <div class="exam-result-summary ${hasPendingEssayReview || hasZipReview ? 'manual-review-summary' : ''}">
        <span class="eyebrow">${hasPendingEssayReview ? 'Aguardando o professor' : 'Resultado da prova'}</span>
        <h2>${escapeHtml(state.exam.title)}</h2>
        ${hasPendingEssayReview
          ? '<div class="result-grade manual">Nota pendente</div>'
          : result.finalPercentage !== null
            ? `<div class="result-grade">${result.finalPercentage}%</div>`
            : '<div class="result-grade manual">Em revisão</div>'}
        <p>${hasPendingEssayReview
          ? `${automaticSummary} A nota definitiva será exibida após o professor corrigir ${result.essayQuestionCount} questão(ões) dissertativa(s) e contabilizar o resultado.`
          : result.finalPercentage !== null
            ? `Nota definitiva: <strong>${result.finalCorrectCount}</strong> de <strong>${result.finalGradedQuestionCount}</strong> pontos.`
            : automaticSummary}</p>
        ${hasZipReview ? '<p class="zip-result-note">O anexo ZIP permanece disponível para revisão separada e não compõe esta nota.</p>' : ''}
        <div class="result-meta"><span>Tempo total: <strong>${formatExamTime(result.elapsedSeconds)}</strong></span><span>Aluno: <strong>${escapeHtml(`${result.firstName} ${result.lastName}`)}</strong></span></div>
        ${hasPendingEssayReview ? '<button class="secondary-btn result-back-btn" onclick="window.reloadExamPortal()">Atualizar correção</button>' : ''}
        <button class="secondary-btn result-back-btn" onclick="window.backToStudentExamCatalog()">Voltar às provas</button>
      </div>
      <div class="feedback-list">
        <h3>Feedback da avaliação</h3>
        ${feedback.map((item, index) => {
          if (item.requiresEssayReview) {
            const finalized = result.finalGradeReady;
            return `
              <article class="feedback-card ${finalized ? (item.isCorrect ? 'correct' : 'incorrect') : 'manual-review'}">
                <div class="feedback-status">${finalized ? (item.isCorrect ? '✓ Aprovada pelo professor' : '✕ Marcada incorreta pelo professor') : '◷ Aguardando correção do professor'}</div>
                <h4>${index + 1}. ${escapeHtml(item.prompt)}</h4>
                <p><span>Sua resposta:</span> ${escapeHtml(item.studentAnswer || 'Não respondida')}</p>
              </article>
            `;
          }
          if (item.requiresManualReview) {
            const attachment = state.examAttachments[item.questionId];
            return `
              <article class="feedback-card manual-review">
                <div class="feedback-status">◷ Anexo em revisão separada</div>
                <h4>${index + 1}. ${escapeHtml(item.prompt)}</h4>
                ${attachment?.status === 'ready'
                  ? `<p><span>Arquivo entregue:</span> ${escapeHtml(attachment.fileName)} · ${formatAttachmentSize(attachment.size)}</p>`
                  : '<p><span>Arquivo entregue:</span> nenhum anexo ZIP válido foi localizado.</p>'}
              </article>
            `;
          }
          return `
            <article class="feedback-card ${item.isCorrect ? 'correct' : 'incorrect'}">
              <div class="feedback-status">${item.isCorrect ? '✓ Correta' : '✕ Incorreta'}</div>
              <h4>${index + 1}. ${escapeHtml(item.prompt)}</h4>
              <p><span>Sua resposta:</span> ${escapeHtml(item.studentAnswer || 'Não respondida')}</p>
              ${item.isCorrect ? '' : '<p><span>Feedback:</span> Sua resposta não corresponde ao gabarito.</p>'}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

async function loadExamPortal() {
  try {
    const data = await callExamApi('getExamState', { examId: state.selectedExamId });
    state.exam = data.exam;
    state.examAttempt = data.attempt;
    state.examMessage = '';
    state.examAttachmentUploads = {};
    state.examAttachments = data.exam && data.attempt
      ? await loadAttemptAttachments(data.exam, data.attempt.answers || [])
      : {};
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

function updateAttachmentUploadStatus(questionId, message, progress = null, type = '') {
  state.examAttachmentUploads[questionId] = { message, progress, type };
  const status = document.getElementById(`zip-upload-status-${questionId}`);
  if (status) {
    status.textContent = message;
    status.className = `zip-upload-status ${type}`.trim();
  }
  const progressBar = document.getElementById(`zip-upload-progress-${questionId}`);
  if (progressBar && progress !== null) progressBar.style.width = `${progress}%`;
}

async function deleteUnusedAttachment(metadata) {
  if (!metadata?.id || metadata.status !== 'ready') return;
  const attachmentRef = db.collection('examAttachments').doc(metadata.id);
  for (let index = 0; index < metadata.chunkCount; index++) {
    await attachmentRef.collection('chunks').doc(String(index)).delete();
  }
  await attachmentRef.delete();
}

async function uploadStudentZipAnswer(questionIndex, file) {
  const question = state.exam?.questions?.[questionIndex];
  if (!question || getExamQuestionType(question) !== EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) {
    throw new Error('Questão de anexo não encontrada.');
  }
  if (state.examAttempt?.status !== 'in_progress') {
    throw new Error('Esta tentativa não aceita mais anexos.');
  }

  const descriptor = validateZipFileDescriptor(file);
  updateAttachmentUploadStatus(question.id, 'Validando arquivo ZIP...', 3, 'uploading');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasZipFileSignature(bytes)) {
    throw new Error('O conteúdo selecionado não corresponde a um arquivo ZIP válido.');
  }

  const chunks = splitAttachmentBytes(bytes);
  const sha256 = await hashAttachmentBytes(bytes);
  const attemptId = getExamAttemptId(state.exam.id, state.user.uid);
  const previousAttachment = state.examAttachments[question.id] || null;
  const previousAnswer = state.examAnswers[questionIndex] || { questionId: question.id, value: '' };
  const activeAttachmentId = previousAttachment?.id || previousAnswer.value;
  const targetSlot = activeAttachmentId?.endsWith('__a') ? 'b' : 'a';
  const attachmentId = getExamAttachmentId(attemptId, question.id, targetSlot);
  const attachmentRef = db.collection('examAttachments').doc(attachmentId);
  const targetBeforeUpload = await attachmentRef.get();
  const previousTargetChunkCount = targetBeforeUpload.exists
    ? Number(targetBeforeUpload.data().chunkCount || 0)
    : 0;
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
  await attachmentRef.set({
    attemptId,
    examId: state.exam.id,
    questionId: question.id,
    questionIndex,
    userId: state.user.uid,
    fileName: descriptor.name,
    contentType: 'application/zip',
    size: descriptor.size,
    chunkCount: chunks.length,
    sha256,
    status: 'uploading',
    uploadedAt: serverTimestamp,
    updatedAt: serverTimestamp
  });

  for (let index = chunks.length; index < previousTargetChunkCount; index++) {
    await attachmentRef.collection('chunks').doc(String(index)).delete();
  }
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    await attachmentRef.collection('chunks').doc(String(index)).set({
      index,
      size: chunk.length,
      data: firebase.firestore.Blob.fromUint8Array(chunk),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const progress = Math.round(((index + 1) / chunks.length) * 90) + 5;
    updateAttachmentUploadStatus(
      question.id,
      `Enviando parte ${index + 1} de ${chunks.length}...`,
      Math.min(progress, 95),
      'uploading'
    );
  }

  await attachmentRef.update({
    status: 'ready',
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  const uploadedAttachment = {
    id: attachmentId,
    attemptId,
    examId: state.exam.id,
    questionId: question.id,
    questionIndex,
    userId: state.user.uid,
    fileName: descriptor.name,
    contentType: 'application/zip',
    size: descriptor.size,
    chunkCount: chunks.length,
    sha256,
    status: 'ready',
    updatedAtMillis: Date.now()
  };
  state.examAttachments[question.id] = uploadedAttachment;
  state.examAnswers[questionIndex] = { questionId: question.id, value: attachmentId };
  const answerSaved = await saveCurrentExamAnswers();
  if (!answerSaved) {
    state.examAnswers[questionIndex] = previousAnswer;
    if (previousAttachment) state.examAttachments[question.id] = previousAttachment;
    else delete state.examAttachments[question.id];
    throw new Error('O ZIP foi enviado, mas não foi possível vinculá-lo à tentativa. Tente novamente.');
  }

  if (previousAttachment?.id && previousAttachment.id !== uploadedAttachment.id) {
    try {
      await deleteUnusedAttachment(previousAttachment);
    } catch (error) {
      console.warn('Não foi possível limpar o anexo substituído:', error);
    }
  }
  updateAttachmentUploadStatus(question.id, 'Arquivo ZIP enviado e vinculado à resposta.', 100, 'success');
}

async function saveCurrentExamAnswers() {
  if (state.examScreen !== 'taking' || !state.exam?.id || state.examSubmitting) return false;
  const status = document.getElementById('exam-save-status');
  if (status) status.textContent = 'Salvando respostas...';
  try {
    await callExamApi('saveExamAnswers', { examId: state.exam.id, answers: state.examAnswers });
    if (status) status.textContent = 'Respostas salvas automaticamente';
    return true;
  } catch (error) {
    if (status) status.textContent = 'Não foi possível salvar agora; o envio final ainda será tentado.';
    return false;
  }
}

function getPendingZipQuestions() {
  return (state.exam?.questions || []).filter(question => {
    if (getExamQuestionType(question) !== EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) return false;
    const attachment = state.examAttachments[question.id];
    return attachment?.status !== 'ready';
  });
}

async function submitCurrentExam(autoSubmitted = false) {
  if (state.examSubmitting || state.examScreen !== 'taking') return;
  if (!autoSubmitted) {
    const uploadInProgress = Object.values(state.examAttachmentUploads)
      .some(upload => upload?.type === 'uploading');
    if (uploadInProgress) {
      state.examMessage = 'Aguarde o término do upload do arquivo ZIP antes de enviar a prova.';
      renderExamPortal();
      return;
    }
    const pendingZipQuestions = getPendingZipQuestions();
    if (pendingZipQuestions.length) {
      state.examMessage = `Anexe o arquivo ZIP solicitado em ${pendingZipQuestions.length} questão(ões) antes de enviar.`;
      renderExamPortal();
      return;
    }
  }
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

window.updateTeacherExamDuration = value => {
  state.teacherExamDurationMinutes = value;
};

window.updateTeacherExamAudience = (field, value) => {
  if (field === 'classId') {
    state.teacherExamClassId = value;
    const available = getExamSubjectsForClass(state.academicSubjects, value);
    if (!available.some(subject => subject.id === state.teacherExamSubjectId)) {
      state.teacherExamSubjectId = '';
    }
    renderTeacherExamCreator();
  }
  if (field === 'subjectId') state.teacherExamSubjectId = value;
};

window.updateTeacherQuestion = (index, field, value) => {
  if (!state.teacherQuestions[index] || field !== 'prompt') return;
  state.teacherQuestions[index].prompt = value;
};

window.changeTeacherQuestionType = (index, type) => {
  const current = state.teacherQuestions[index];
  if (!current || getExamQuestionType(current) === type) return;
  const draft = type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT
    ? createZipAttachmentDraft()
    : type === EXAM_QUESTION_TYPES.ESSAY
      ? createEssayDraft()
      : createMultipleChoiceDraft();
  state.teacherQuestions[index] = { ...draft, prompt: current.prompt || '' };
  renderTeacherExamCreator();
};

window.updateTeacherOption = (questionIndex, optionIndex, value) => {
  const question = state.teacherQuestions[questionIndex];
  if (!question?.options || optionIndex < 0 || optionIndex >= question.options.length) return;
  question.options[optionIndex] = value;
};

window.setTeacherCorrectOption = (questionIndex, optionIndex) => {
  const question = state.teacherQuestions[questionIndex];
  if (!question?.options?.[optionIndex] && question?.options?.[optionIndex] !== '') return;
  question.correctOptionIndex = optionIndex;
  renderTeacherExamCreator();
};

window.addTeacherOption = questionIndex => {
  const question = state.teacherQuestions[questionIndex];
  if (!question?.options || question.options.length >= 4) return;
  question.options.push('');
  renderTeacherExamCreator();
};

window.removeTeacherOption = (questionIndex, optionIndex) => {
  const question = state.teacherQuestions[questionIndex];
  if (!question?.options || question.options.length <= 2) return;
  question.options.splice(optionIndex, 1);
  if (question.correctOptionIndex === optionIndex) question.correctOptionIndex = 0;
  else if (question.correctOptionIndex > optionIndex) question.correctOptionIndex--;
  renderTeacherExamCreator();
};

window.addTeacherQuestion = () => {
  state.teacherQuestions.push(createMultipleChoiceDraft());
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
    const subjectId = await ensureExamSubjectForClassOnFreeTier(
      state.teacherExamSubjectId,
      state.teacherExamClassId
    );
    state.teacherExamSubjectId = subjectId;
    const result = await callExamApi('createExam', {
      title: state.teacherExamTitle,
      durationMinutes: state.teacherExamDurationMinutes,
      classId: state.teacherExamClassId,
      subjectId,
      questions: state.teacherQuestions
    });
    state.teacherMessage = `Prova criada com sucesso: ${result.questionCount} questão(ões) publicada(s).`;
    state.teacherExamTitle = 'Prova de Inglês';
    state.teacherExamDurationMinutes = DEFAULT_EXAM_DURATION_MINUTES;
    state.teacherExamClassId = 'entra21';
    state.teacherExamSubjectId = '';
    state.teacherQuestions = [createMultipleChoiceDraft()];
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

window.startEditingExam = async examId => {
  const exam = state.teacherExams.find(item => item.id === examId);
  if (!exam) return;
  state.teacherExamsMessage = '';
  state.teacherExamsStatus = 'loading';
  renderTeacherExamManager();
  const questions = await Promise.all(exam.questions.map(async question => {
    const type = getExamQuestionType(question);
    if (type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT) {
      return {
        id: question.id,
        ...createZipAttachmentDraft(),
        prompt: question.prompt
      };
    }
    if (type === EXAM_QUESTION_TYPES.ESSAY) {
      return {
        id: question.id,
        ...createEssayDraft(),
        prompt: question.prompt
      };
    }

    const options = Array.isArray(question.options) && question.options.length >= 2
      ? [...question.options]
      : ['', ''];
    let correctOptionIndex = 0;
    if (question.options?.length) {
      const hashes = await Promise.all(options.map(option => hashExamAnswer(option, exam.gradingSalt)));
      const matchedIndex = hashes.findIndex(hash => hash === question.answerHash);
      if (matchedIndex >= 0) correctOptionIndex = matchedIndex;
    }
    return {
      id: question.id,
      type: EXAM_QUESTION_TYPES.MULTIPLE_CHOICE,
      prompt: question.prompt,
      options,
      correctOptionIndex
    };
  }));
  state.editingExamId = exam.id;
  state.editingExamTitle = exam.title;
  state.editingExamDurationMinutes = Math.ceil(getExamDurationSeconds(exam.durationSeconds) / 60);
  state.editingExamClassId = exam.classId || 'entra21';
  state.editingExamSubjectId = resolveExamSubjectSelection(
    state.academicSubjects,
    state.editingExamClassId,
    exam.subjectId,
    exam.subjectName
  );
  state.editingExamQuestions = questions;
  state.teacherExamsStatus = 'ready';
  renderTeacherExamManager();
};

window.cancelExamEditing = () => {
  state.editingExamId = null;
  state.editingExamTitle = '';
  state.editingExamDurationMinutes = DEFAULT_EXAM_DURATION_MINUTES;
  state.editingExamClassId = '';
  state.editingExamSubjectId = '';
  state.editingExamQuestions = [];
  state.teacherExamsMessage = '';
  renderTeacherExamManager();
};

window.updateEditingExamTitle = value => {
  state.editingExamTitle = value;
};

window.updateEditingExamDuration = value => {
  state.editingExamDurationMinutes = value;
};

window.updateEditingExamAudience = (field, value) => {
  if (field === 'classId') {
    state.editingExamClassId = value;
    const available = getExamSubjectsForClass(state.academicSubjects, value);
    if (!available.some(subject => subject.id === state.editingExamSubjectId)) {
      state.editingExamSubjectId = '';
    }
    renderTeacherExamManager();
  }
  if (field === 'subjectId') state.editingExamSubjectId = value;
};

window.updateEditingExamQuestion = (index, field, value) => {
  if (!state.editingExamQuestions[index] || field !== 'prompt') return;
  state.editingExamQuestions[index].prompt = value;
};

window.changeEditingExamQuestionType = (index, type) => {
  const current = state.editingExamQuestions[index];
  if (!current || getExamQuestionType(current) === type) return;
  const draft = type === EXAM_QUESTION_TYPES.ZIP_ATTACHMENT
    ? createZipAttachmentDraft()
    : type === EXAM_QUESTION_TYPES.ESSAY
      ? createEssayDraft()
      : createMultipleChoiceDraft();
  state.editingExamQuestions[index] = {
    id: current.id || null,
    ...draft,
    prompt: current.prompt || ''
  };
  renderTeacherExamManager();
};

window.updateEditingExamOption = (questionIndex, optionIndex, value) => {
  const question = state.editingExamQuestions[questionIndex];
  if (!question?.options || optionIndex < 0 || optionIndex >= question.options.length) return;
  question.options[optionIndex] = value;
};

window.setEditingCorrectOption = (questionIndex, optionIndex) => {
  const question = state.editingExamQuestions[questionIndex];
  if (!question?.options || optionIndex < 0 || optionIndex >= question.options.length) return;
  question.correctOptionIndex = optionIndex;
  renderTeacherExamManager();
};

window.addEditingExamOption = questionIndex => {
  const question = state.editingExamQuestions[questionIndex];
  if (!question?.options || question.options.length >= 4) return;
  question.options.push('');
  renderTeacherExamManager();
};

window.removeEditingExamOption = (questionIndex, optionIndex) => {
  const question = state.editingExamQuestions[questionIndex];
  if (!question?.options || question.options.length <= 2) return;
  question.options.splice(optionIndex, 1);
  if (question.correctOptionIndex === optionIndex) question.correctOptionIndex = 0;
  else if (question.correctOptionIndex > optionIndex) question.correctOptionIndex--;
  renderTeacherExamManager();
};

window.addEditingExamQuestion = () => {
  state.editingExamQuestions.push({ id: null, ...createMultipleChoiceDraft() });
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
    const subjectId = await ensureExamSubjectForClassOnFreeTier(
      state.editingExamSubjectId,
      state.editingExamClassId
    );
    state.editingExamSubjectId = subjectId;
    const result = await callExamApi('updateExam', {
      examId: state.editingExamId,
      title: state.editingExamTitle,
      durationMinutes: state.editingExamDurationMinutes,
      classId: state.editingExamClassId,
      subjectId,
      questions: state.editingExamQuestions
    });
    state.editingExamId = null;
    state.editingExamTitle = '';
    state.editingExamDurationMinutes = DEFAULT_EXAM_DURATION_MINUTES;
    state.editingExamClassId = '';
    state.editingExamSubjectId = '';
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

window.openExamResultReview = resultId => {
  if (!state.examResults.some(result => result.id === resultId)) return;
  state.reviewingExamResultId = resultId;
  state.examResultsMessage = '';
  renderTeacherResults();
};

window.closeExamResultReview = () => {
  state.reviewingExamResultId = null;
  state.examResultsMessage = '';
  renderTeacherResults();
};

window.setEssayReviewDecision = async (resultId, questionId, decision) => {
  if (state.examReviewSaving) return;
  state.examReviewSaving = true;
  state.examResultsMessage = '';
  renderTeacherResults();
  try {
    await callExamApi('reviewEssayAnswer', { resultId, questionId, decision });
    state.examResultsStatus = 'loading';
    await loadTeacherResults();
  } catch (error) {
    state.examResultsStatus = 'ready';
    state.examResultsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível salvar a correção.')}`;
  } finally {
    state.examReviewSaving = false;
    renderTeacherResults();
  }
};

window.finalizeEssayResult = async resultId => {
  if (state.examReviewSaving) return;
  if (!window.confirm('Contabilizar a nota final? Depois disso, as decisões desta correção não poderão ser alteradas.')) return;
  state.examReviewSaving = true;
  state.examResultsMessage = '';
  renderTeacherResults();
  try {
    const response = await callExamApi('finalizeEssayReview', { resultId });
    state.examResultsMessage = `Nota final contabilizada: ${response.finalScore}%.`;
    state.examResultsStatus = 'loading';
    await loadTeacherResults();
  } catch (error) {
    state.examResultsStatus = 'ready';
    state.examResultsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível contabilizar a nota final.')}`;
  } finally {
    state.examReviewSaving = false;
    renderTeacherResults();
  }
};

window.downloadExamAttachment = async attachmentId => {
  state.examResultsMessage = 'Preparando o download do arquivo ZIP...';
  renderTeacherResults();
  try {
    const result = await callExamApi('downloadExamAttachment', { attachmentId });
    state.examResultsMessage = `Download preparado: ${result.fileName}.`;
  } catch (error) {
    state.examResultsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível baixar o anexo ZIP.')}`;
  }
  renderTeacherResults();
};

window.deleteExamResultLog = async resultId => {
  const result = state.examResults.find(item => item.id === resultId);
  if (!result) return;
  const studentName = `${result.firstName} ${result.lastName}`.trim();
  const confirmed = window.confirm(`Excluir o log de ${studentName} na prova "${result.examTitle || 'Prova'}"? A tentativa e o resultado do aluno serão preservados.`);
  if (!confirmed) return;
  state.examResultsMessage = '';
  try {
    await callExamApi('deleteExamResultLog', { resultId });
    state.examResults = state.examResults.filter(item => item.id !== resultId);
    state.examResultsMessage = 'Log excluído do dashboard. A tentativa do aluno foi preservada.';
  } catch (error) {
    state.examResultsMessage = `Erro: ${getFriendlyError(error, 'Não foi possível excluir o log.')}`;
  }
  renderTeacherResults();
};

window.refreshExamResults = () => {
  state.reviewingExamResultId = null;
  state.examResultsMessage = '';
  state.examResultsStatus = 'idle';
  renderTeacherResults();
};

window.updateExamResultFilter = (field, value) => {
  if (!['classKey', 'subjectKey', 'studentKey'].includes(field)) return;
  state.examResultFilters[field] = value;
  if (field === 'classKey') {
    state.examResultFilters.subjectKey = '';
    state.examResultFilters.studentKey = '';
  } else if (field === 'subjectKey') {
    state.examResultFilters.studentKey = '';
  }
  renderTeacherResults();
};

window.clearExamResultFilters = () => {
  state.examResultFilters = { classKey: '', subjectKey: '', studentKey: '' };
  renderTeacherResults();
};

window.refreshTeacherStudents = () => {
  state.teacherStudentsMessage = '';
  state.teacherStudentsStatus = 'idle';
  renderTeacherStudents();
};

window.updateReferenceDraft = (field, value) => {
  const fields = {
    title: 'teacherReferenceTitle',
    description: 'teacherReferenceDescription',
    url: 'teacherReferenceUrl',
    classId: 'teacherReferenceClassId',
    subjectId: 'teacherReferenceSubjectId'
  };
  if (!fields[field]) return;
  state[fields[field]] = value;
  if (field === 'classId') {
    const available = getSubjectsForClass(state.academicSubjects, value);
    if (!available.some(subject => subject.id === state.teacherReferenceSubjectId)) {
      state.teacherReferenceSubjectId = '';
    }
    renderTeacherReferences();
  }
};

window.updateAcademicSubjectClass = value => {
  state.academicSubjectClassId = value;
};

window.submitAcademicEntity = async (event, kind) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const name = formData.get('name');
  const classId = kind === 'subject' ? String(formData.get('classId') || '') : '';
  if (button) button.disabled = true;
  state.academicMessage = '';
  try {
    const result = await createAcademicEntityOnFreeTier(kind, name, classId);
    state.academicMessage = `${kind === 'class' ? 'Turma' : 'Matéria'} "${result.name}" cadastrada com sucesso.`;
    form.reset();
  } catch (error) {
    state.academicMessage = `Erro: ${getFriendlyError(error, 'Não foi possível cadastrar.')}`;
  }
  renderTeacherAcademics();
};

window.archiveAcademicEntity = async (kind, id) => {
  if (!window.confirm(`Arquivar esta ${kind === 'class' ? 'turma' : 'matéria'}? Cadastros e resultados anteriores serão preservados.`)) return;
  state.academicMessage = '';
  try {
    await archiveAcademicEntityOnFreeTier(kind, id);
    state.academicMessage = `${kind === 'class' ? 'Turma' : 'Matéria'} arquivada com sucesso.`;
  } catch (error) {
    state.academicMessage = `Erro: ${getFriendlyError(error, 'Não foi possível arquivar.')}`;
  }
  renderTeacherAcademics();
};

window.submitStudyReference = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const data = {
    title: formData.get('title'),
    description: formData.get('description'),
    url: formData.get('url'),
    classId: formData.get('classId'),
    subjectId: formData.get('subjectId')
  };
  state.teacherReferenceTitle = String(data.title || '');
  state.teacherReferenceDescription = String(data.description || '');
  state.teacherReferenceUrl = String(data.url || '');
  state.teacherReferenceClassId = String(data.classId || '');
  state.teacherReferenceSubjectId = String(data.subjectId || '');
  if (button) button.disabled = true;
  state.referencesMessage = '';
  try {
    await createStudyReferenceOnFreeTier(data);
    state.referencesMessage = 'Referência publicada com sucesso.';
    state.teacherReferenceTitle = '';
    state.teacherReferenceDescription = '';
    state.teacherReferenceUrl = '';
    await loadStudyReferences();
  } catch (error) {
    state.referencesMessage = `Erro: ${getFriendlyError(error, 'Não foi possível publicar a referência.')}`;
  }
  renderTeacherReferences();
};

window.archiveStudyReference = async referenceId => {
  if (!window.confirm('Arquivar esta referência? Ela deixará de aparecer para os alunos.')) return;
  state.referencesMessage = '';
  try {
    await archiveStudyReferenceOnFreeTier(referenceId);
    state.referencesMessage = 'Referência arquivada com sucesso.';
    await loadStudyReferences();
  } catch (error) {
    state.referencesMessage = `Erro: ${getFriendlyError(error, 'Não foi possível arquivar a referência.')}`;
  }
  renderTeacherReferences();
};


window.updateActivityDraft = (field, value) => {
  const fields = {
    title: 'teacherActivityTitle',
    instructions: 'teacherActivityInstructions',
    classId: 'teacherActivityClassId',
    subjectId: 'teacherActivitySubjectId'
  };
  if (!fields[field]) return;
  state[fields[field]] = value;
  if (field === 'classId') {
    const subjects = getSubjectsForClass(state.academicSubjects, value);
    if (!subjects.some(subject => subject.id === state.teacherActivitySubjectId)) {
      state.teacherActivitySubjectId = '';
    }
    renderTeacherActivities();
  }
};

window.submitActivity = async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  state.activitiesMessage = '';
  try {
    await createActivityOnFreeTier({
      title: state.teacherActivityTitle,
      instructions: state.teacherActivityInstructions,
      classId: state.teacherActivityClassId,
      subjectId: state.teacherActivitySubjectId
    });
    state.teacherActivityTitle = '';
    state.teacherActivityInstructions = '';
    state.activitiesMessage = 'Atividade cadastrada com sucesso.';
    await loadActivities();
  } catch (error) {
    state.activitiesMessage = `Erro: ${getFriendlyError(error, 'Não foi possível cadastrar a atividade.')}`;
  }
  renderTeacherActivities();
};

window.archiveActivity = async activityId => {
  if (!window.confirm('Arquivar esta atividade? Ela deixará de aceitar novas entregas, mas os arquivos recebidos serão preservados.')) return;
  state.activitiesMessage = '';
  try {
    await archiveActivityOnFreeTier(activityId);
    state.activitiesMessage = 'Atividade arquivada com sucesso. As entregas foram preservadas.';
    await loadActivities();
  } catch (error) {
    state.activitiesMessage = `Erro: ${getFriendlyError(error, 'Não foi possível arquivar a atividade.')}`;
  }
  renderTeacherActivities();
};

window.handleActivityZipUpload = async (activityId, input) => {
  const file = input?.files?.[0];
  const activity = state.activities.find(item => item.id === activityId);
  if (!file || !activity) return;
  try {
    await uploadActivitySubmission(activity, file);
    state.activitiesMessage = 'Atividade encaminhada com sucesso.';
    await loadActivities();
  } catch (error) {
    console.error('Erro ao encaminhar atividade:', error);
    updateActivityUploadStatus(activityId, getFriendlyError(error, 'Não foi possível encaminhar o ZIP.'), 0, 'error');
    state.activitiesMessage = `Erro: ${getFriendlyError(error, 'Não foi possível encaminhar o ZIP.')}`;
  }
  if (state.currentView === 'student-activities') renderStudentActivities();
};

window.downloadActivitySubmission = async submissionId => {
  state.activitiesMessage = 'Preparando o download da entrega...';
  renderTeacherActivities();
  try {
    const result = await downloadActivitySubmissionOnFreeTier(submissionId);
    state.activitiesMessage = `Download preparado: ${result.fileName}.`;
  } catch (error) {
    state.activitiesMessage = `Erro: ${getFriendlyError(error, 'Não foi possível baixar a entrega.')}`;
  }
  renderTeacherActivities();
};

window.refreshActivities = async () => {
  state.activitiesStatus = 'loading';
  state.activitiesMessage = '';
  await loadActivities();
  if (isAdmin()) renderTeacherActivities();
  else renderStudentActivities();
};

window.submitStudentRegistration = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const selectedClassId = String(formData.get('classId') || '');
  const selectedClass = state.academicClasses.find(item => item.id === selectedClassId);
  const rawProfile = {
    fullName: formData.get('fullName'),
    nickname: formData.get('nickname'),
    classId: selectedClassId,
    className: selectedClass?.name || '',
    courseGoal: formData.get('courseGoal'),
    email: formData.get('email')
  };

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
  }

  const result = await saveStudentProfile(rawProfile);
  state.studentProfileMessage = result.ok
    ? 'Cadastro salvo com sucesso. Seu perfil global já está disponível nos submódulos.'
    : result.message;
  if (result.ok) {
    state.studentExams = [];
    state.studentExamsStatus = 'idle';
    state.studyReferences = [];
    state.referencesStatus = 'idle';
    state.activities = [];
    state.activitiesStatus = 'idle';
    await loadAcademicCatalog();
  }
  updateHeader();
  renderStudentRegistration();
};

window.openStudentExam = examId => {
  const exam = state.studentExams.find(item => item.id === examId);
  if (!exam || (!exam.active && !exam.hasAttempt)) return;
  state.selectedExamId = examId;
  state.exam = null;
  state.examAttempt = null;
  state.examScreen = 'idle';
  state.examMessage = '';
  renderExamPortal();
};

window.refreshStudentExamCatalog = () => {
  state.examScreen = 'catalog';
  state.selectedExamId = null;
  state.studentExamsStatus = 'idle';
  state.studentExamsMessage = '';
  renderExamPortal();
};

window.backToStudentExamCatalog = () => {
  stopTimer();
  state.examScreen = 'catalog';
  state.selectedExamId = null;
  state.studentExamsStatus = 'idle';
  state.exam = null;
  state.examAttempt = null;
  renderExamPortal();
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
    state.examAttachments = {};
    state.examAttachmentUploads = {};
    state.examAutoSubmitAttempted = false;
    state.examScreen = 'taking';
  } catch (error) {
    state.examMessage = getFriendlyError(error, 'Não foi possível iniciar a prova.');
    state.examScreen = 'instructions';
  }
  renderExamPortal();
};

window.handleStudentZipUpload = async (questionIndex, input) => {
  const file = input?.files?.[0];
  const question = state.exam?.questions?.[questionIndex];
  if (!file || !question) return;
  try {
    await uploadStudentZipAnswer(questionIndex, file);
  } catch (error) {
    console.error('Erro ao enviar anexo ZIP:', error);
    updateAttachmentUploadStatus(
      question.id,
      getFriendlyError(error, 'Não foi possível enviar o arquivo ZIP.'),
      0,
      'error'
    );
  }
  if (state.currentView === 'exam' && state.examScreen === 'taking') renderExamPortal();
};

window.selectStudentExamOption = (questionIndex, optionIndex) => {
  const question = state.exam?.questions?.[questionIndex];
  const option = question?.options?.[optionIndex];
  if (option === undefined) return;
  window.updateStudentExamAnswer(questionIndex, option);
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
  if (state.currentView === 'english-master') renderEnglishMaster();
};

window.setAnswerMode = (mode) => {
  state.answerMode = mode === 'written' ? 'written' : 'multiple';
  renderEnglishMaster();
};

window.refreshLeaderboard = async () => {
  await loadLeaderboardFromFirestore();
  renderEnglishMaster();
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
  state.currentView = 'english-master';
  state.isSurvivor = false;
  state.isSpeedrun = false;
  state.speedrunStartedAt = 0;
  window.history.replaceState(null, '', viewRoutes['english-master']);
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
