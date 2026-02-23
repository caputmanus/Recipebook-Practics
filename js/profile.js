import { db } from './firebase-config.js';
import { requireAuth, renderHeader, isAdmin, showToast, renderStars, updateDoc as _u } from './app.js';
import {
  doc, collection, query, orderBy, getDocs,
  deleteDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const user = await requireAuth();
if (!user) throw 0;

renderHeader(user);

document.getElementById('ava').textContent  = (user.name || user.email)[0].toUpperCase();
document.getElementById('uname').textContent = user.name || 'Пользователь';
document.getElementById('uemail').textContent = user.email;
if (isAdmin(user)) document.getElementById('adminLink').hidden = false;

let activeTab = 'history';
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    showTab(activeTab);
  });
});
showTab('history');

function showTab(tab) {
  const el = document.getElementById('tabContent');
  if (tab === 'history')   loadHistory(el);
  if (tab === 'favorites') loadFavorites(el);
  if (tab === 'settings')  showSettings(el);
}

async function loadHistory(el) {
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const snap = await getDocs(
    query(collection(db, 'users', user.uid, 'history'), orderBy('createdAt', 'desc'))
  );

  if (snap.empty) {
    el.innerHTML = '<div class="empty"><p>📝</p><h3>Отзывов пока нет</h3><p>Открывай рецепты и делись мнением</p></div>';
    return;
  }

  el.innerHTML = '<h2>История отзывов</h2>';
  snap.forEach(d => {
    const h = d.data();
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="hist-icon">⭐</div>
      <div class="hist-info">
        <div class="hist-title">${h.recipeTitle || 'Рецепт'}</div>
        <div class="hist-sub">${renderStars(h.rating)} · ${h.text?.slice(0,80) || ''}…</div>
        <div class="hist-date">${h.createdAt?.toDate().toLocaleDateString('ru-RU') || ''}</div>
      </div>
      <div class="hist-actions">
        <a href="/recipe.html?id=${h.recipeId}" class="btn sm outline">Открыть</a>
        <button class="btn sm ghost" onclick="deleteHistory('${d.id}')">✕</button>
      </div>`;
    el.appendChild(div);
  });
}

window.deleteHistory = async (hid) => {
  await deleteDoc(doc(db, 'users', user.uid, 'history', hid));
  showToast('Удалено');
  showTab('history');
};

async function loadFavorites(el) {
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const snap = await getDocs(
    query(collection(db, 'favorites'), orderBy('savedAt', 'desc'))
  );

  const mine = snap.docs.filter(d => d.data().userId === user.uid);
  if (!mine.length) {
    el.innerHTML = '<div class="empty"><p>❤️</p><h3>Избранное пусто</h3><p>Сохраняй понравившиеся рецепты</p></div>';
    return;
  }

  el.innerHTML = '<h2>Избранное</h2>';
  mine.forEach(d => {
    const f   = d.data();
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="hist-icon">❤️</div>
      <div class="hist-info">
        <div class="hist-title">${f.recipeTitle}</div>
        <div class="hist-date">${f.savedAt?.toDate().toLocaleDateString('ru-RU') || ''}</div>
      </div>
      <div class="hist-actions">
        <a href="/recipe.html?id=${f.recipeId}" class="btn sm outline">Открыть</a>
        <button class="btn sm ghost" onclick="removeFav('${d.id}')">✕ Убрать</button>
      </div>`;
    el.appendChild(div);
  });
}

window.removeFav = async (fid) => {
  await deleteDoc(doc(db, 'favorites', fid));
  showToast('Убрано из избранного');
  showTab('favorites');
};

function showSettings(el) {
  el.innerHTML = `
    <h2>Настройки</h2>
    <div class="form-box">
      <div class="fg">
        <label>Имя</label>
        <input id="newName" value="${user.name || ''}">
      </div>
      <div class="fg">
        <label>Email</label>
        <input value="${user.email}" disabled style="opacity:.5">
      </div>
      <button class="btn primary" id="saveBtn">Сохранить</button>
    </div>`;
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const name = document.getElementById('newName').value.trim();
    if (!name) return;
    await updateDoc(doc(db, 'users', user.uid), { name });
    showToast('Сохранено ✓');
  });
}
