import { db } from './firebase-config.js';
import { requireAdmin, logout, showToast, renderStars } from './app.js';
import {
  collection, query, orderBy, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CATS = ['Завтрак','Супы','Салаты','Выпечка','Десерты','Ужины','Напитки'];

const admin = await requireAdmin();
if (!admin) throw 0;

document.getElementById('adminName').textContent = admin.name || admin.email;
document.getElementById('logoutBtn').addEventListener('click', logout);

setupNav();
showSection('recipes');

function setupNav() {
  document.querySelectorAll('[data-sec]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('[data-sec]').forEach(b => b.classList.remove('active'));
      a.classList.add('active');
      showSection(a.dataset.sec);
    });
  });
}

function showSection(sec) {
  const main = document.getElementById('main');
  if (sec === 'recipes') recipesSection(main);
  if (sec === 'users')   usersSection(main);
  if (sec === 'reviews') reviewsSection(main);
}

async function recipesSection(main) {
  main.innerHTML = `
    <div class="a-head">
      <h1>Рецепты</h1>
      <button class="btn primary" id="newRecipeBtn">+ Добавить</button>
    </div>
    <div class="loading"><div class="spinner"></div></div>`;
  document.getElementById('newRecipeBtn').addEventListener('click', () => openModal(null));

  const snap = await getDocs(query(collection(db, 'recipes'), orderBy('createdAt', 'desc')));

  const rows = snap.docs.map(d => {
    const r = d.data();
    return `<tr>
      <td>${r.title}</td>
      <td>${r.category || '—'}</td>
      <td>${r.avgRating?.toFixed(1) || '—'} (${r.ratingCount || 0})</td>
      <td>${r.cookTime || '—'} мин</td>
      <td>
        <button class="btn sm ghost" onclick="editRecipe('${d.id}')">Изменить</button>
        <button class="btn sm danger" onclick="delRecipe('${d.id}')">Удалить</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-row">Рецептов нет</td></tr>';

  main.innerHTML = `
    <div class="a-head">
      <h1>Рецепты</h1>
      <button class="btn primary" id="newRecipeBtn">+ Добавить</button>
    </div>
    <table class="tbl">
      <thead><tr><th>Название</th><th>Категория</th><th>Рейтинг</th><th>Время</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  document.getElementById('newRecipeBtn').addEventListener('click', () => openModal(null));
}

function openModal(existingId, data = {}) {
  const overlay = document.getElementById('overlay');
  overlay.classList.add('open');
  document.getElementById('modalTitle').textContent = existingId ? 'Редактировать' : 'Новый рецепт';

  document.getElementById('fTitle').value = data.title || '';
  document.getElementById('fCat').value   = data.category || '';
  document.getElementById('fDesc').value  = data.description || '';
  document.getElementById('fTime').value  = data.cookTime || '';
  document.getElementById('fServ').value  = data.servings || '';
  document.getElementById('fDiff').value  = data.difficulty || '';
  document.getElementById('fIngr').value  = (data.ingredients || []).join('\n');
  document.getElementById('fSteps').value = (data.steps || []).join('\n');

  document.getElementById('saveModalBtn').onclick = () => saveRecipe(existingId);
  document.getElementById('closeModal').onclick   = () => overlay.classList.remove('open');
}

async function saveRecipe(existingId) {
  const title = document.getElementById('fTitle').value.trim();
  if (!title) { showToast('Введи название'); return; }

  const data = {
    title,
    category:    document.getElementById('fCat').value,
    description: document.getElementById('fDesc').value.trim(),
    cookTime:    parseInt(document.getElementById('fTime').value) || null,
    servings:    parseInt(document.getElementById('fServ').value) || null,
    difficulty:  document.getElementById('fDiff').value,
    ingredients: document.getElementById('fIngr').value.split('\n').map(s=>s.trim()).filter(Boolean),
    steps:       document.getElementById('fSteps').value.split('\n').map(s=>s.trim()).filter(Boolean),
    updatedAt:   serverTimestamp()
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'recipes', existingId), data);
      showToast('Рецепт обновлён ✓');
    } else {
      await addDoc(collection(db, 'recipes'), {
        ...data,
        avgRating: 0, ratingCount: 0,
        authorName: admin.name || 'Admin',
        authorId:   admin.uid,
        createdAt:  serverTimestamp()
      });
      showToast('Рецепт добавлен ✓');
    }
    document.getElementById('overlay').classList.remove('open');
    recipesSection(document.getElementById('main'));
  } catch (e) {
    console.error(e); showToast('Ошибка сохранения');
  }
}

window.editRecipe = async id => {
  const snap = await getDoc(doc(db, 'recipes', id));
  openModal(id, snap.data());
};

window.delRecipe = async id => {
  if (!confirm('Удалить рецепт?')) return;
  await deleteDoc(doc(db, 'recipes', id));
  showToast('Удалено');
  recipesSection(document.getElementById('main'));
};

async function usersSection(main) {
  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));

  const rows = snap.docs.map(d => {
    const u   = d.data();
    const isA = u.role === 'admin';
    return `<tr>
      <td>${u.name || '—'}</td>
      <td>${u.email}</td>
      <td><span class="badge ${isA ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
      <td>${u.createdAt?.toDate().toLocaleDateString('ru-RU') || '—'}</td>
      <td>
        <button class="btn sm ${isA ? 'danger' : 'ghost'}"
          onclick="toggleRole('${d.id}','${u.role}')">
          ${isA ? 'Снять admin' : 'Сделать admin'}
        </button>
      </td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div class="a-head"><h1>Пользователи</h1></div>
    <table class="tbl">
      <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Зарегистрирован</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

window.toggleRole = async (uid, current) => {
  const newRole = current === 'admin' ? 'user' : 'admin';
  await updateDoc(doc(db, 'users', uid), { role: newRole });
  showToast(`Роль изменена → ${newRole}`);
  usersSection(document.getElementById('main'));
};

async function reviewsSection(main) {
  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const recipes = await getDocs(collection(db, 'recipes'));

  let all = [];
  for (const rd of recipes.docs) {
    const revs = await getDocs(
      query(collection(db, 'recipes', rd.id, 'reviews'), orderBy('createdAt','desc'))
    );
    revs.forEach(rv => all.push({ id: rv.id, recipeId: rd.id, recipeTitle: rd.data().title, ...rv.data() }));
  }

  const rows = all.map(r => `<tr>
    <td>${r.recipeTitle}</td>
    <td>${r.authorName || '—'}</td>
    <td class="stars">${renderStars(r.rating)}</td>
    <td class="rev-preview">${r.text}</td>
    <td><button class="btn sm danger" onclick="adminDelRev('${r.recipeId}','${r.id}',${r.rating})">Удалить</button></td>
  </tr>`).join('') || '<tr><td colspan="5" class="empty-row">Отзывов нет</td></tr>';

  main.innerHTML = `
    <div class="a-head"><h1>Модерация отзывов</h1></div>
    <table class="tbl">
      <thead><tr><th>Рецепт</th><th>Автор</th><th>Оценка</th><th>Отзыв</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

window.adminDelRev = async (recipeId, revId, rating) => {
  if (!confirm('Удалить отзыв?')) return;
  const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await runTransaction(db, async t => {
    const recRef  = doc(db, 'recipes', recipeId);
    const recSnap = await t.get(recRef);
    const d       = recSnap.data();
    const newCnt  = Math.max(0, (d.ratingCount || 0) - 1);
    const newAvg  = newCnt ? ((d.avgRating||0)*(d.ratingCount||0) - rating) / newCnt : 0;
    t.delete(doc(db, 'recipes', recipeId, 'reviews', revId));
    t.update(recRef, { avgRating: newAvg, ratingCount: newCnt });
  });
  showToast('Отзыв удалён');
  reviewsSection(document.getElementById('main'));
};
