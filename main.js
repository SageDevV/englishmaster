import './style.css';
import { topics } from './src/data/topics.js';
import { questionWordsData } from './src/data/questionWords.js';
import { verbToBeData } from './src/data/verbToBe.js';
import { computerStuffData } from './src/data/computerStuff.js';

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

// --- Application State ---
const state = {
  currentView: 'login',
  currentTopic: null,
  currentDifficulty: 'bronze', // 'bronze', 'prata', 'ouro', 'sobrevivente'
  currentQuestionIndex: 0,
  score: 0,
  isAnswered: false,
  selectedAnswer: null,
  streak: 0,
  user: null,
  timeLeft: 30,
  timerId: null,
  isSurvivor: false,
  userStats: {
    xp: 0,
    level: 1,
    topicHistory: {},
    survivorBest: 0
  }
};

// --- Auth Observers ---
auth.onAuthStateChanged(async (user) => {
  try {
    if (user) {
      state.user = user;
      await loadProgressFromFirestore(user.uid);
      state.currentView = 'home';
    } else {
      state.user = null;
      state.currentView = 'login';
    }
  } catch (error) {
    console.error("Erro ao processar login/progresso:", error);
    // Even if firestore fails, we allow the user to see the home screen
    if (user) {
      state.currentView = 'home';
    }
  } finally {
    renderApp();
  }
});

// --- Data Sync ---
async function loadProgressFromFirestore(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      state.userStats = doc.data();
    } else {
      // Initial data for new user
      await db.collection('users').doc(uid).set(state.userStats);
    }
  } catch (error) {
    console.warn("Firestore não disponível, usando estado local:", error);
    // We don't throw here so the app can continue
  }
}

async function saveProgressToFirestore() {
  if (state.user) {
    await db.collection('users').doc(state.user.uid).set(state.userStats);
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
  auth.signOut();
};

// --- XP Logic ---
const XP_PER_LEVEL = 100;
const XP_CORRECT = 20;
const XP_STREAK_BONUS = 5;

function addXP(amount) {
  state.userStats.xp += amount;
  if (state.userStats.xp >= XP_PER_LEVEL) {
    state.userStats.level++;
    state.userStats.xp -= XP_PER_LEVEL;
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f59e0b', '#fbbf24', '#ffffff'] });
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

  headerTop.innerHTML = `
    <div class="user-profile">
      <img src="${state.user.photoURL}" class="user-avatar" alt="Profile">
      <div style="text-align: left">
        <div style="font-weight: 700; font-size: 0.9rem">${state.user.displayName}</div>
        <button class="logout-btn" onclick="window.logout()">Sair</button>
      </div>
    </div>
    
    <div class="user-stats">
      <div class="level-badge">Nível <span id="user-level">${state.userStats.level}</span></div>
      <div class="xp-container">
        <div class="xp-bar-fill" id="user-xp-bar" style="width: ${(state.userStats.xp/XP_PER_LEVEL)*100}%"></div>
        <span class="xp-text"><span>${state.userStats.xp}</span> XP</span>
      </div>
    </div>
  `;
}

function renderHome() {
  state.currentView = 'home';
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="home-container">
      <div class="survivor-banner" onclick="window.startSurvivor()">
        <div class="survivor-content">
          <h2>MODO SOBREVIVENTE ⏳</h2>
          <p>O tempo não para! Acerte para ganhar segundos. Qual o seu recorde?</p>
          <div class="best-score">MELHOR PONTUAÇÃO: ${state.userStats.survivorBest || 0}</div>
        </div>
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
            <h3>${topic.title}</h3>
            <p>${topic.description}</p>
          </div>
        `}).join('')}
      </div>
    </div>

    <!-- Difficulty Modal -->
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

function renderQuiz() {
  const data = state.isSurvivor ? getAllQuestions() : getTopicData(state.currentTopic, state.currentDifficulty);
  const question = state.isSurvivor ? state.currentSurvivorQuestion : data[state.currentQuestionIndex];
  const progress = state.isSurvivor ? 100 : ((state.currentQuestionIndex) / data.length) * 100;

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container ${state.isSurvivor ? 'survivor-mode' : ''}">
      <div id="streak-badge" class="streak-badge" style="display: ${state.streak >= 2 ? 'block' : 'none'}">
        🔥 COMBO X${state.streak}
      </div>
      
      ${state.isSurvivor ? `
        <div class="timer-display ${state.timeLeft < 10 ? 'low-time' : ''}">
          <span class="timer-icon">⏳</span> <span id="timer-seconds">${state.timeLeft}s</span>
        </div>
      ` : ''}

      <div class="quiz-header">
        <button class="back-btn" onclick="window.goHome()">← Sair</button>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div class="score-display">${state.isSurvivor ? 'RECORD' : 'PONTOS'}: ${state.score}</div>
      </div>

      <div class="question-box">
        <div class="difficulty-tag ${state.currentDifficulty}">${state.currentDifficulty.toUpperCase()}</div>
        <p class="question-text">${question.question}</p>
        <div class="options-grid">
          ${question.options.map(option => `
            <button class="option-btn ${getOptionClass(option, question)}" 
                    onclick="window.selectAnswer('${option}')"
                    ${state.isAnswered ? 'disabled' : ''}>
              ${option}
            </button>
          `).join('')}
        </div>
      </div>

      ${state.isAnswered ? `
        <div class="feedback-area">
          <span class="feedback-title ${state.selectedAnswer === question.answer ? 'text-success' : 'text-error'}">
            ${state.selectedAnswer === question.answer ? '✨ Correto! ' + (state.isSurvivor ? '+5s' : '') : '❌ Incorreto'}
          </span>
          <p class="feedback-text">${question.explanation}</p>
          <button class="next-btn" onclick="window.nextQuestion()">
            ${(!state.isSurvivor && state.currentQuestionIndex === data.length - 1) ? 'Finalizar Quiz' : 'Próxima Pergunta'}
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderResults() {
  if (state.timerId) clearInterval(state.timerId);
  
  const data = state.isSurvivor ? getAllQuestions() : getTopicData(state.currentTopic, state.currentDifficulty);
  const percentage = state.isSurvivor ? 0 : Math.round((state.score / data.length) * 100);
  
  let stars = 0;
  if (!state.isSurvivor) {
    if (percentage >= 100) stars = 3;
    else if (percentage >= 70) stars = 2;
    else if (percentage >= 40) stars = 1;

    const history = state.userStats.topicHistory[state.currentTopic] || { stars: 0 };
    if (stars > history.stars) {
      state.userStats.topicHistory[state.currentTopic] = { stars };
      saveProgressToFirestore();
    }
  } else {
    if (state.score > (state.userStats.survivorBest || 0)) {
      state.userStats.survivorBest = state.score;
      saveProgressToFirestore();
    }
  }

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container result-screen ${state.isSurvivor ? 'survivor-results' : ''}">
      <h2>${state.isSurvivor ? 'Tempo Esgotado!' : 'Quiz Finalizado!'}</h2>
      
      ${!state.isSurvivor ? `
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
        ${state.isSurvivor ? `Você sobreviveu por uma pontuação de <strong>${state.score}</strong>!` : `Você acertou <strong>${state.score}</strong> de <strong>${data.length}</strong> perguntas.`}
      </p>
      
      <button class="next-btn" onclick="window.goHome()">Voltar ao Início</button>
    </div>
  `;

  if (stars === 3 || (state.isSurvivor && state.score > 20)) {
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
  }
}

function getTopicData(topicId, difficulty) {
  let fullData = [];
  switch(topicId) {
    case 'question-words': fullData = questionWordsData; break;
    case 'verb-to-be': fullData = verbToBeData; break;
    case 'computer-stuff': fullData = computerStuffData; break;
    default: fullData = [];
  }
  return fullData.filter(q => q.difficulty === difficulty);
}

function getAllQuestions() {
  return [...questionWordsData, ...verbToBeData, ...computerStuffData];
}

function getOptionClass(option, question) {
  if (!state.isAnswered) return '';
  if (option === question.answer) return 'correct';
  if (option === state.selectedAnswer) return 'wrong';
  return '';
}

window.openDifficultyModal = (topicId) => {
  window.pendingTopic = topicId;
  const modal = document.getElementById('difficulty-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeDifficultyModal = () => {
  const modal = document.getElementById('difficulty-modal');
  if (modal) modal.style.display = 'none';
};

window.startQuiz = (topicId, difficulty) => {
  state.currentTopic = topicId;
  state.currentDifficulty = difficulty;
  state.currentView = 'quiz';
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.isAnswered = false;
  state.isSurvivor = false;
  window.closeDifficultyModal();
  renderApp();
};

window.startSurvivor = () => {
  state.isSurvivor = true;
  state.currentDifficulty = 'sobrevivente';
  state.currentView = 'quiz';
  state.score = 0;
  state.streak = 0;
  state.timeLeft = 30;
  state.isAnswered = false;
  state.currentSurvivorQuestion = getRandomQuestion();
  
  startTimer();
  renderApp();
};

function startTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.timeLeft--;
    const timerEl = document.getElementById('timer-seconds');
    if (timerEl) {
      timerEl.innerText = state.timeLeft + 's';
      if (state.timeLeft < 10) timerEl.parentElement.classList.add('low-time');
    }
    
    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      renderResults();
    }
  }, 1000);
}

function getRandomQuestion() {
  const all = getAllQuestions();
  return all[Math.floor(Math.random() * all.length)];
}

window.goHome = () => {
  if (state.timerId) clearInterval(state.timerId);
  state.currentView = 'home';
  renderApp();
};

window.selectAnswer = (answer) => {
  if (state.isAnswered) return;
  const data = state.isSurvivor ? getAllQuestions() : getTopicData(state.currentTopic, state.currentDifficulty);
  const question = state.isSurvivor ? state.currentSurvivorQuestion : data[state.currentQuestionIndex];
  
  state.isAnswered = true;
  state.selectedAnswer = answer;
  if (answer === question.answer) {
    state.score++;
    state.streak++;
    
    let xpGain = XP_CORRECT;
    if (state.currentDifficulty === 'prata') xpGain *= 1.5;
    if (state.currentDifficulty === 'ouro') xpGain *= 2;
    if (state.isSurvivor) {
      xpGain *= 0.5; // Survivor gives less XP per question but it's infinite
      state.timeLeft += 5;
    }
    
    addXP(Math.round(xpGain + (state.streak >= 3 ? XP_STREAK_BONUS : 0)));
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: ['#10b981', '#ffffff'] });
  } else {
    state.streak = 0;
    if (state.isSurvivor) {
      state.timeLeft = Math.max(0, state.timeLeft - 3); // Penalty for wrong answer in survivor
    }
  }
  renderQuiz();
};

window.nextQuestion = () => {
  if (state.isSurvivor) {
    state.currentSurvivorQuestion = getRandomQuestion();
    state.isAnswered = false;
    state.selectedAnswer = null;
    renderQuiz();
    return;
  }

  const data = getTopicData(state.currentTopic, state.currentDifficulty);
  if (state.currentQuestionIndex < data.length - 1) {
    state.currentQuestionIndex++;
    state.isAnswered = false;
    state.selectedAnswer = null;
    renderQuiz();
  } else {
    renderResults();
  }
};

// Initialize
renderApp();
