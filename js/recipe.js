import { db } from './firebase-config.js';
import { loadCurrentUser, renderHeader, showToast, renderStars, categoryEmoji, plural } from './app.js';
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc,
  collection, query, orderBy, limit, startAfter,
  getDocs, addDoc, onSnapshot, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const id = new URLSearchParams(location.search).get('id');
if (!id) location.href = '/index.html';

let user       = null;
let recipe     = null;
let pickedStar = 0;
let lastRev    = null;
const REV_PAGE = 10;

user   = await loadCurrentUser();
recipe = await loadRecipe();
if (!recipe) { location.href = '/index.html'; }

renderHeader(user);
renderRecipe(recipe);
watchRating();
renderReviewForm();
loadReviews(true);
watchFavorite();

document.getElementById('moreRevBtn')?.addEventListener('click', () => loadReviews(false));

async function loadRecipe() {
  const snap = await getDoc(doc(db, 'recipes', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function renderRecipe(r) {
  document.title = r.title + ' — КнигаРецептов';
  document.getElementById('recipeWrap').innerHTML = `
    <div class="eyebrow">${r.category || 'Рецепт'}</div>
    <h1 class="recipe-title">${r.title}</h1>
    <div class="hero-thumb">${categoryEmoji(r.category)}</div>

    <div class="info-bar">
      <div><strong>Время</strong>${r.cookTime || '—'} мин</div>
      <div><strong>Порций</strong>${r.servings || '—'}</div>
      <div><strong>Сложность</strong>${r.difficulty || '—'}</div>
      <div><strong>Автор</strong>${r.authorName || 'Аноним'}</div>
    </div>

    ${r.description ? `<p class="desc">${r.description}</p>` : ''}

    <h2 class="sec-title">Ингредиенты</h2>
    <ul class="ingredients">
      ${(r.ingredients || []).map(i => `<li>${i}</li>`).join('')}
    </ul>

    <h2 class="sec-title">Приготовление</h2>
    <ol class="steps">
      ${(r.steps || []).map(s => `<li>${s}</li>`).join('')}
    </ol>

    <div class="action-row">
      <button id="favBtn" class="btn outline">❤️ В избранное</button>
    </div>
  `;
  document.getElementById('favBtn').addEventListener('click', toggleFavorite);
}

function favDocId() { return user ? `${user.uid}_${id}` : null; }

async function watchFavorite() {
  if (!user) return;
  const snap = await getDoc(doc(db, 'favorites', favDocId()));
  updateFavBtn(snap.exists());
}

function updateFavBtn(isFav) {
  const btn = document.getElementById('favBtn');
  if (!btn) return;
  btn.textContent = isFav ? '💔 Убрать из избранного' : '❤️ В избранное';
}

async function toggleFavorite() {
  if (!user) { showToast('Войди, чтобы сохранять рецепты'); return; }
  const ref  = doc(db, 'favorites', favDocId());
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    updateFavBtn(false);
    showToast('Убрано из избранного');
  } else {
    await setDoc(ref, {
      userId:    user.uid,
      recipeId:  id,
      recipeTitle: recipe.title,
      category:  recipe.category || '',
      savedAt:   serverTimestamp()
    });
    updateFavBtn(true);
    showToast('Добавлено в избранное ✓');
  }
}

function watchRating() {
  onSnapshot(doc(db, 'recipes', id), snap => {
    const d   = snap.data() || {};
    const avg = d.avgRating || 0;
    const cnt = d.ratingCount || 0;
    document.getElementById('ratingBlock').innerHTML = `
      <div class="avg-rating">
        <span class="avg-num">${avg.toFixed(1)}</span>
        <div>
          <div class="stars lg">${renderStars(avg)}</div>
          <div class="rating-sub">${cnt} ${plural(cnt,'отзыв','отзыва','отзывов')}</div>
        </div>
      </div>`;
  });
}

function renderReviewForm() {
  const wrap = document.getElementById('reviewFormWrap');
  if (!user) {
    wrap.innerHTML = `<p class="hint"><a href="/auth.html">Войди</a>, чтобы оставить отзыв</p>`;
    return;
  }
  wrap.innerHTML = `
    <div class="star-row" id="starPicker">
      ${[1,2,3,4,5].map(n => `<span data-v="${n}">★</span>`).join('')}
    </div>
    <textarea id="revText" placeholder="Расскажи о своём опыте…"></textarea>
    <button class="btn primary" id="submitRevBtn">Опубликовать</button>
  `;

  const picker = document.getElementById('starPicker');
  picker.querySelectorAll('span').forEach(s => {
    s.addEventListener('click',     () => { pickedStar = +s.dataset.v; paintStars(pickedStar); });
    s.addEventListener('mouseover', () => paintStars(+s.dataset.v));
    s.addEventListener('mouseout',  () => paintStars(pickedStar));
  });

  document.getElementById('submitRevBtn').addEventListener('click', submitReview);
}

function paintStars(n) {
  document.querySelectorAll('#starPicker span').forEach((s, i) => {
    s.classList.toggle('on', i < n);
  });
}

async function submitReview() {
  const text = document.getElementById('revText').value.trim();
  if (!pickedStar)  { showToast('Выбери оценку');  return; }
  if (text.length < 5) { showToast('Отзыв слишком короткий'); return; }

  try {
    await runTransaction(db, async t => {
      const recRef  = doc(db, 'recipes', id);
      const recSnap = await t.get(recRef);
      const d       = recSnap.data();
      const oldCnt  = d.ratingCount || 0;
      const newCnt  = oldCnt + 1;
      const newAvg  = ((d.avgRating || 0) * oldCnt + pickedStar) / newCnt;

      const revRef = doc(collection(db, 'recipes', id, 'reviews'));
      t.set(revRef, {
        userId:     user.uid,
        authorName: user.name || 'Аноним',
        rating:     pickedStar,
        text,
        createdAt:  serverTimestamp()
      });
      t.update(recRef, { avgRating: newAvg, ratingCount: newCnt });

      // История пользователя
      const histRef = doc(collection(db, 'users', user.uid, 'history'));
      t.set(histRef, {
        type: 'review', recipeId: id,
        recipeTitle: recipe.title, rating: pickedStar, text, createdAt: serverTimestamp()
      });
    });

    document.getElementById('revText').value = '';
    pickedStar = 0;
    paintStars(0);
    loadReviews(true);
    showToast('Отзыв опубликован ✓');
  } catch (e) {
    console.error(e);
    showToast('Ошибка сохранения');
  }
}

async function loadReviews(reset = false) {
  if (reset) lastRev = null;

  const constraints = [orderBy('createdAt', 'desc'), limit(REV_PAGE)];
  if (lastRev) constraints.push(startAfter(lastRev));

  const snap = await getDocs(query(collection(db, 'recipes', id, 'reviews'), ...constraints));

  const list = document.getElementById('reviewsList');
  if (reset) list.innerHTML = '';

  if (snap.empty && reset) {
    list.innerHTML = '<p class="hint">Отзывов пока нет — будь первым!</p>';
    document.getElementById('moreRevBtn').hidden = true;
    return;
  }

  snap.forEach(d => {
    const r    = d.data();
    const mine = user && user.uid === r.userId;
    const el   = document.createElement('div');
    el.className = 'review-card';
    el.id = 'rev_' + d.id;
    el.innerHTML = `
      <div class="rev-head">
        <div>
          <strong>${r.authorName}</strong>
          <span class="stars">${renderStars(r.rating)}</span>
        </div>
        <span class="rev-date">${r.createdAt?.toDate().toLocaleDateString('ru-RU') || ''}</span>
      </div>
      <p class="rev-text">${r.text}</p>
      ${mine ? `
        <div class="rev-actions">
          <button class="btn sm ghost" onclick="editRev('${d.id}','${r.text.replace(/'/g,"\\'")}',${r.rating})">Изменить</button>
          <button class="btn sm danger" onclick="deleteRev('${d.id}',${r.rating})">Удалить</button>
        </div>` : ''}
    `;
    list.appendChild(el);
  });

  lastRev = snap.docs.at(-1);
  document.getElementById('moreRevBtn').hidden = snap.size < REV_PAGE;
}

window.editRev = async (revId, oldText, oldRating) => {
  const text = prompt('Изменить отзыв:', oldText);
  if (!text) return;
  await updateDoc(doc(db, 'recipes', id, 'reviews', revId), { text, updatedAt: serverTimestamp() });
  loadReviews(true);
  showToast('Отзыв обновлён ✓');
};

window.deleteRev = async (revId, rating) => {
  if (!confirm('Удалить отзыв?')) return;
  await runTransaction(db, async t => {
    const recRef  = doc(db, 'recipes', id);
    const recSnap = await t.get(recRef);
    const d       = recSnap.data();
    const oldCnt  = d.ratingCount || 0;
    const newCnt  = Math.max(0, oldCnt - 1);
    const newAvg  = newCnt ? ((d.avgRating || 0) * oldCnt - rating) / newCnt : 0;
    t.delete(doc(db, 'recipes', id, 'reviews', revId));
    t.update(recRef, { avgRating: newAvg, ratingCount: newCnt });
  });
  loadReviews(true);
  showToast('Отзыв удалён');
};
