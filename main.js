import './style.css';
import { topics } from './src/data/topics.js';
import { questionWordsData } from './src/data/questionWords.js';
import { verbToBeData } from './src/data/verbToBe.js';
import { computerStuffData } from './src/data/computerStuff.js';
import { instructionsData } from './src/data/instructions.js';
import { techLifeData } from './src/data/techLife.js';

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

// --- Game Balance ---
const XP_PER_LEVEL = 100;
const XP_CORRECT = 20;
const XP_STREAK_BONUS = 5;
const SURVIVOR_START_TIME = 30;
const MAX_SURVIVOR_TIME = 60;
const MAX_SHIELDS = 3;
const SHIELD_EVERY_STREAK = 10;

const topicQuestionMap = {
  'question-words': questionWordsData,
  'verb-to-be': verbToBeData,
  'computer-stuff': computerStuffData,
  'instructions': instructionsData,
  'tech-life': techLifeData
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
    xp: 0,
    level: 1,
    nickname: '',
    topicHistory: {},
    survivorBest: 0,
    speedrunBestTime: null,
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
  survivorTier: 'bronze',
  shields: 0,
  lastQuestionStartTime: 0,
  lastQuestionId: null,
  survivorAskedIds: [],
  currentSurvivorQuestion: null,
  resultReason: 'completed',
  leaderboard: [],
  userStats: createDefaultStats()
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
      state.currentView = 'home';
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
    level: Math.max(1, Number(data.level || defaults.level)),
    xp: Math.max(0, Number(data.xp || defaults.xp)),
    survivorBest: Math.max(0, Number(data.survivorBest || defaults.survivorBest)),
    speedrunBestTime: data.speedrunBestTime !== undefined ? data.speedrunBestTime : defaults.speedrunBestTime,
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
    nickname: state.userStats.nickname || '',
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
      // Garantir que o nickname seja carregado
      state.userStats.nickname = data.nickname || '';
      return true;
    } else {
      console.log("Nenhum dado encontrado para este usuário. Iniciando novo perfil.");
      state.userStats = createDefaultStats();
      return true;
    }
  } catch (error) {
    console.error("Erro ao carregar do Firestore:", error);
    return false;
  }
}

async function saveProgressToFirestore() {
  if (!state.user) return;

  try {
    const payload = getUserProfilePayload();
    await db.collection('users').doc(state.user.uid).set(payload, { merge: true });
    console.log("Progresso salvo com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar no Firestore:", error);
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

    state.leaderboard = snapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        id: doc.id,
        rank: index + 1,
        ...normalizeStats(data),
        displayName: data.displayName || 'Aluno',
        nickname: data.nickname || '',
        photoURL: data.photoURL || ''
      };
    });
  } catch (error) {
    console.warn("Nao foi possivel carregar o ranking:", error);
    state.leaderboard = [];
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

window.openNicknameModal = () => {
  const modal = document.getElementById('nickname-modal');
  const input = document.getElementById('nickname-input');
  if (modal && input) {
    input.value = state.userStats.nickname || '';
    modal.style.display = 'flex';
  }
};

window.closeNicknameModal = () => {
  const modal = document.getElementById('nickname-modal');
  if (modal) modal.style.display = 'none';
};

window.saveNickname = async (event) => {
  event.preventDefault();
  const input = document.getElementById('nickname-input');
  const nickname = input.value.trim();
  
  if (!nickname) {
    alert("Por favor, digite um nickname.");
    return;
  }

  state.userStats.nickname = nickname;
  await saveProgressToFirestore();
  window.closeNicknameModal();
  renderApp();
  await loadLeaderboardFromFirestore();
  if (state.currentView === 'home') renderHome();
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

// --- UI Rendering ---
function renderApp() {
  if (!state.user) {
    renderLogin();
    return;
  }

  updateHeader();
  if (state.currentView === 'home') renderHome();
  else if (state.currentView === 'quiz') renderQuiz();
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
  const displayName = escapeHtml(state.user.displayName || 'Aluno');
  const nickname = escapeHtml(state.userStats.nickname || displayName);
  const xpPercent = Math.min(100, (state.userStats.xp / XP_PER_LEVEL) * 100);

  headerTop.innerHTML = `
    <div class="user-profile">
      ${photoURL ? `<img src="${escapeHtml(photoURL)}" class="user-avatar" alt="Profile">` : '<div class="user-avatar avatar-fallback">A</div>'}
      <div style="text-align: left">
        <div style="display: flex; align-items: center">
          <div style="font-weight: 700; font-size: 0.9rem">${nickname}</div>
          <button class="edit-nickname-btn" onclick="window.openNicknameModal()" title="Editar Nickname">✏️</button>
        </div>
        <button class="logout-btn" onclick="window.logout()">Sair</button>
      </div>
    </div>

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

      <div class="special-modes-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="survivor-banner" onclick="window.startSurvivor()">
          <div class="survivor-content">
            <h2>SOBREVIVENTE ⏳</h2>
            <p>Acerte para ganhar tempo!</p>
            <div class="best-score">RECORDE: ${state.userStats.survivorBest || 0}</div>
          </div>
        </div>
        <div class="speedrun-banner" onclick="window.startSpeedrun()">
          <div class="survivor-content">
            <h2>SPEEDRUN ⚡</h2>
            <p>3 perguntas por tópico. Seja rápido!</p>
            <div class="best-score">MELHOR: ${state.userStats.speedrunBestTime ? formatTime(state.userStats.speedrunBestTime) : '--:--'}</div>
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

    <div id="nickname-modal" class="modal">
      <div class="modal-content">
        <h2>Seu Nickname</h2>
        <p>Como você quer ser chamado no ranking?</p>
        <form onsubmit="window.saveNickname(event)">
          <div class="nickname-input-group">
            <label for="nickname-input">Nickname</label>
            <input type="text" id="nickname-input" class="nickname-field" maxlength="20" placeholder="Ex: MasterEnglish">
          </div>
          <button type="submit" class="next-btn">Salvar Nickname</button>
        </form>
        <button class="close-modal" onclick="window.closeNicknameModal()">Cancelar</button>
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

function renderLeaderboard() {
  const rows = state.leaderboard.length
    ? state.leaderboard.map(student => {
        const nameToShow = escapeHtml(student.nickname || student.displayName || 'Aluno');
        return `
        <div class="leaderboard-row ${student.id === state.user.uid ? 'current-student' : ''}">
          <span class="rank-position">#${student.rank}</span>
          <span class="rank-name">${nameToShow}</span>
          <span class="rank-score">${student.rankingScore || 0} pts</span>
        </div>
      `}).join('')
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

function renderQuiz() {
  const question = getCurrentQuestion();

  if (!question) {
    renderEmptyQuiz();
    return;
  }

  const totalQuestions = state.isSurvivor ? 1 : state.questionQueue.length;
  const progress = state.isSurvivor ? 100 : ((state.currentQuestionIndex + 1) / totalQuestions) * 100;
  const mainContent = document.getElementById('main-content');

  mainContent.innerHTML = `
    <div class="quiz-container ${state.isSurvivor ? 'survivor-mode' : ''} ${state.isSpeedrun ? 'speedrun-mode' : ''}">
      <div id="streak-badge" class="streak-badge" style="display: ${state.streak >= 2 ? 'block' : 'none'}">
        🔥 COMBO X${state.streak}
      </div>

      ${state.isSurvivor || state.isSpeedrun ? `
        <div class="survivor-header-stats">
          <div class="timer-display ${!state.isSpeedrun && state.timeLeft < 10 ? 'low-time' : ''} ${state.isSpeedrun ? 'speedrun-timer' : `tier-${state.survivorTier}`}">
            <span class="timer-icon">${state.isSpeedrun ? '⚡' : '⏳'}</span> <span id="timer-seconds">${state.isSpeedrun ? formatTime(state.speedrunTime) : state.timeLeft + 's'}</span>
          </div>
          ${state.isSurvivor ? `
            <div class="shield-display ${state.shields > 0 ? 'has-shields' : ''}">
              🛡️ ${state.shields}/${MAX_SHIELDS}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="quiz-header">
        <button class="back-btn" onclick="window.goHome()">← Sair</button>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div class="score-display">
          ${state.isSurvivor ? `NÍVEL: ${state.survivorTier.toUpperCase()}` : (state.isSpeedrun ? `${state.currentQuestionIndex + 1}/${totalQuestions}` : `PONTOS: ${state.score}`)}
        </div>
      </div>

      ${state.isSurvivor ? `<div class="survivor-score-overlay">${state.score}</div>` : ''}

      <div class="question-box">
        <div class="difficulty-tag ${state.isSpeedrun ? 'ouro' : state.currentDifficulty}">${state.isSpeedrun ? 'SPEEDRUN' : state.currentDifficulty.toUpperCase()}</div>
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
  stopTimer();

  const totalQuestions = state.isSurvivor ? Math.max(1, state.score) : state.questionQueue.length;
  const percentage = state.isSurvivor ? 0 : Math.round((state.score / totalQuestions) * 100);

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
  } else if (state.isSurvivor && state.score > (state.userStats.survivorBest || 0)) {
    state.userStats.survivorBest = state.score;
    saveProgressToFirestore();
  } else if (state.isSpeedrun) {
    if (state.score === totalQuestions) { // Só salva recorde se acertar tudo
      if (!state.userStats.speedrunBestTime || state.speedrunTime < state.userStats.speedrunBestTime) {
        state.userStats.speedrunBestTime = state.speedrunTime;
        saveProgressToFirestore();
      }
    }
  }

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container result-screen ${state.isSurvivor ? 'survivor-results' : ''} ${state.isSpeedrun ? 'speedrun-results' : ''}">
      <h2>${getResultTitle()}</h2>

      ${!state.isSurvivor && !state.isSpeedrun ? `
        <div class="topic-stars" style="justify-content: center; font-size: 3rem; margin: 1rem 0">
          ${Array.from({ length: 3 }).map((_, i) => `
            <span class="${i < stars ? 'star-filled' : 'star-empty'}">★</span>
          `).join('')}
        </div>
        <div class="score-circle">${percentage}%</div>
      ` : (state.isSpeedrun ? `
        <div class="time-big">${formatTime(state.speedrunTime)}</div>
        <p>Tempo Total</p>
      ` : `
        <div class="survivor-score-big">${state.score}</div>
        <p>Questões respondidas</p>
      `)}

      <p style="font-size: 1.2rem; margin-bottom: 2rem">
        ${state.isSurvivor
          ? `Você terminou com <strong>${state.score}</strong> ponto(s).`
          : `Você acertou <strong>${state.score}</strong> de <strong>${totalQuestions}</strong> perguntas.`}
      </p>

      <button class="next-btn" onclick="window.goHome()">Voltar ao Início</button>
    </div>
  `;

  if (stars === 3 || (state.isSurvivor && state.score > 20) || (state.isSpeedrun && state.score === totalQuestions)) {
    launchConfetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
  }
}

function getResultTitle() {
  if (state.isSpeedrun) return 'Speedrun Concluído!';
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
  state.resultReason = 'completed';
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
  state.currentSurvivorQuestion = getRandomQuestion('bronze');
  state.lastQuestionStartTime = Date.now();

  startTimer();
  renderApp();
};

window.startSpeedrun = () => {
  state.isSurvivor = false;
  state.isSpeedrun = true;
  state.currentView = 'quiz';
  state.score = 0;
  state.streak = 0;
  state.speedrunTime = 0;
  state.currentQuestionIndex = 0;
  state.isAnswered = false;
  state.selectedAnswer = null;
  state.resultReason = 'completed';

  // Selecionar até 3 perguntas aleatórias por tópico
  const speedrunQuestions = [];
  topics.forEach(topic => {
    const topicPool = allQuestionData.filter(q => q.topicId === topic.id);
    const shuffledPool = shuffleArray(topicPool);
    const selected = shuffledPool.slice(0, 3);
    speedrunQuestions.push(...selected);
  });

  state.questionQueue = shuffleArray(speedrunQuestions).map(withShuffledOptions);

  if (!state.questionQueue.length) {
    alert("Nenhuma pergunta disponível para o modo Speedrun.");
    return;
  }

  startTimer();
  renderApp();
};

function startTimer() {
  stopTimer();
  state.timerId = setInterval(() => {
    if (state.isSpeedrun) {
      state.speedrunTime++;
      updateTimerDisplay();
    } else {
      state.timeLeft--;
      updateTimerDisplay();

      if (state.timeLeft <= 0) {
        state.resultReason = 'time';
        renderResults();
      }
    }
  }, 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('timer-seconds');
  if (!timerEl) return;

  if (state.isSpeedrun) {
    timerEl.innerText = formatTime(state.speedrunTime);
  } else {
    timerEl.innerText = state.timeLeft + 's';
    if (state.timeLeft < 10) timerEl.parentElement.classList.add('low-time');
  }
}

window.goHome = async () => {
  stopTimer();
  state.currentView = 'home';
  state.isSurvivor = false;
  state.isSpeedrun = false;
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

  if (state.streak > 0 && state.streak % SHIELD_EVERY_STREAK === 0) {
    state.shields = Math.min(MAX_SHIELDS, state.shields + 1);
  }

  let xpGain = XP_CORRECT;
  if (state.currentDifficulty === 'prata') xpGain *= 1.5;
  if (state.currentDifficulty === 'ouro') xpGain *= 2;

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
    renderQuiz();
  } else {
    state.resultReason = 'completed';
    renderResults();
  }
}

// Initialize
renderApp();
