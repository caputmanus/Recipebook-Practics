import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function getSessionUid() {
  return localStorage.getItem('session_uid');
}

function setSessionUid(uid) {
  localStorage.setItem('session_uid', uid);
}

function clearSession() {
  localStorage.removeItem('session_uid');
}

async function hashPassword(password) {
  const data = new TextEncoder().encode('rb_salt_' + password);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function loadCurrentUser() {
  const uid = getSessionUid();
  if (!uid) return null;

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    clearSession(); // документ удалён - чистим сессию
    return null;
  }
  return { id: snap.id, ...snap.data() };
}

export async function register(email, password, name) {
  email = email.trim().toLowerCase();

  // Проверяем - нет ли уже такого email
  const exists = await getDocs(
    query(collection(db, 'users'), where('email', '==', email))
  );
  if (!exists.empty) throw new Error('Этот email уже зарегистрирован');

  const uid          = 'u' + Date.now() + Math.random().toString(36).slice(2, 7);
  const passwordHash = await hashPassword(password);

  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    name,
    passwordHash,
    role:      'user',
    createdAt: serverTimestamp()
  });

  setSessionUid(uid);
  return uid;
}

export async function login(email, password) {
  email = email.trim().toLowerCase();

  const snap = await getDocs(
    query(collection(db, 'users'), where('email', '==', email))
  );
  if (snap.empty) throw new Error('Пользователь не найден');

  const userData     = snap.docs[0].data();
  const passwordHash = await hashPassword(password);

  if (userData.passwordHash !== passwordHash) throw new Error('Неверный пароль');

  setSessionUid(userData.uid);
  return userData.uid;
}

export function logout() {
  clearSession();
  location.href = '/auth.html';
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

// Редирект если не залогинен
export async function requireAuth() {
  const user = await loadCurrentUser();
  if (!user) { location.href = '/auth.html'; return null; }
  return user;
}

// Редирект если не админ
export async function requireAdmin() {
  const user = await loadCurrentUser();
  if (!user || !isAdmin(user)) { location.href = '/index.html'; return null; }
  return user;
}

export function renderHeader(user) {
  const nav = document.getElementById('nav');
  if (!nav) return;

  if (user) {
    nav.innerHTML = `
      <a href="/index.html">Рецепты</a>
      <a href="/profile.html" class="user-name">${user.name || user.email}</a>
      ${isAdmin(user) ? '<a href="/admin.html" style="color:var(--terra)">Админ</a>' : ''}
      <button id="logoutBtn" class="nav-btn">Выйти</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', logout);
  } else {
    nav.innerHTML = `
      <a href="/index.html">Рецепты</a>
      <a href="/auth.html" class="nav-btn primary">Войти</a>
    `;
  }
}

export function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

export function renderStars(rating = 0) {
  const n = Math.round(rating);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function categoryEmoji(cat) {
  const m = { Завтрак:'🥞', Супы:'🍜', Салаты:'🥗', Выпечка:'🥐', Десерты:'🍰', Ужины:'🍝', Напитки:'🥤' };
  return m[cat] || '🍽️';
}

export function plural(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if ([2,3,4].includes(mod10) && ![12,13,14].includes(mod100)) return few;
  return many;
}
