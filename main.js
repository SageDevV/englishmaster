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
  currentQuestionIndex: 0,
  score: 0,
  isAnswered: false,
  selectedAnswer: null,
  streak: 0,
  user: null,
  userStats: {
    xp: 0,
    level: 1,
    topicHistory: {}
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
    <div class="topic-grid">
      ${topics.map(topic => {
        const history = state.userStats.topicHistory[topic.id] || { stars: 0 };
        return `
        <div class="topic-card ${topic.locked ? 'locked' : ''}" 
             style="--card-color: ${topic.color}"
             onclick="${topic.locked ? '' : `window.startQuiz('${topic.id}')`}">
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
  `;
}

function renderQuiz() {
  const data = getTopicData(state.currentTopic);
  const question = data[state.currentQuestionIndex];
  const progress = ((state.currentQuestionIndex) / data.length) * 100;

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container">
      <div id="streak-badge" class="streak-badge" style="display: ${state.streak >= 2 ? 'block' : 'none'}">
        🔥 COMBO X${state.streak}
      </div>
      
      <div class="quiz-header">
        <button class="back-btn" onclick="window.goHome()">← Voltar</button>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div class="score-display">PONTOS: ${state.score}</div>
      </div>

      <div class="question-box">
        <p class="question-text">${question.question}</p>
        <div class="options-grid">
          ${question.options.map(option => `
            <button class="option-btn ${getOptionClass(option)}" 
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
            ${state.selectedAnswer === question.answer ? '✨ Correto!' : '❌ Incorreto'}
          </span>
          <p class="feedback-text">${question.explanation}</p>
          <button class="next-btn" onclick="window.nextQuestion()">
            ${state.currentQuestionIndex === data.length - 1 ? 'Finalizar Quiz' : 'Próxima Pergunta'}
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderResults() {
  const data = getTopicData(state.currentTopic);
  const percentage = Math.round((state.score / data.length) * 100);
  
  let stars = 0;
  if (percentage >= 100) stars = 3;
  else if (percentage >= 70) stars = 2;
  else if (percentage >= 40) stars = 1;

  const history = state.userStats.topicHistory[state.currentTopic] || { stars: 0 };
  if (stars > history.stars) {
    state.userStats.topicHistory[state.currentTopic] = { stars };
    saveProgressToFirestore();
  }

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="quiz-container result-screen">
      <h2>Quiz Finalizado!</h2>
      <div class="topic-stars" style="justify-content: center; font-size: 3rem; margin: 1rem 0">
        ${Array.from({ length: 3 }).map((_, i) => `
          <span class="${i < stars ? 'star-filled' : 'star-empty'}">★</span>
        `).join('')}
      </div>
      
      <div class="score-circle">
        ${percentage}%
      </div>
      
      <p style="font-size: 1.2rem; margin-bottom: 2rem">
        Você acertou <strong>${state.score}</strong> de <strong>${data.length}</strong> perguntas.
      </p>
      
      <button class="next-btn" onclick="window.goHome()">Voltar ao Início</button>
    </div>
  `;

  if (stars === 3) {
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
  }
}

function getTopicData(topicId) {
  switch(topicId) {
    case 'question-words': return questionWordsData;
    case 'verb-to-be': return verbToBeData;
    case 'computer-stuff': return computerStuffData;
    default: return [];
  }
}

function getOptionClass(option) {
  if (!state.isAnswered) return '';
  const question = getTopicData(state.currentTopic)[state.currentQuestionIndex];
  if (option === question.answer) return 'correct';
  if (option === state.selectedAnswer) return 'wrong';
  return '';
}

window.startQuiz = (topicId) => {
  state.currentTopic = topicId;
  state.currentView = 'quiz';
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.isAnswered = false;
  renderApp();
};

window.goHome = () => {
  state.currentView = 'home';
  renderApp();
};

window.selectAnswer = (answer) => {
  if (state.isAnswered) return;
  const question = getTopicData(state.currentTopic)[state.currentQuestionIndex];
  state.isAnswered = true;
  state.selectedAnswer = answer;
  if (answer === question.answer) {
    state.score++;
    state.streak++;
    addXP(XP_CORRECT + (state.streak >= 3 ? XP_STREAK_BONUS : 0));
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: ['#10b981', '#ffffff'] });
  } else {
    state.streak = 0;
  }
  renderQuiz();
};

window.nextQuestion = () => {
  const data = getTopicData(state.currentTopic);
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
