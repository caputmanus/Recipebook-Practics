import { db } from './firebase-config.js';
import { loadCurrentUser, renderHeader, showToast, renderStars, categoryEmoji } from './app.js';
import {
  collection, query, where, orderBy, limit,
  startAfter, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const PAGE = 12;
let lastDoc = null;
let activeFilter = 'all';
let activeSort   = 'createdAt';
let searchTerm   = '';
let busy         = false;

const user = await loadCurrentUser();
renderHeader(user);
setupFilters();
setupSort();
setupSearch();
await loadRecipes(true);
setupRealtime();

document.getElementById('loadMoreBtn').addEventListener('click', () => loadRecipes(false));

async function loadRecipes(reset = false) {
  if (busy) return;
  busy = true;

  if (reset) {
    lastDoc = null;
    document.getElementById('grid').innerHTML =
      '<div class="loading"><div class="spinner"></div>Загрузка…</div>';
  }

  try {
    const constraints = [orderBy(activeSort, 'desc'), limit(PAGE)];
    if (activeFilter !== 'all') constraints.unshift(where('category', '==', activeFilter));
    if (lastDoc) constraints.push(startAfter(lastDoc));

    const snap = await getDocs(query(collection(db, 'recipes'), ...constraints));

    if (reset) document.getElementById('grid').innerHTML = '';

    if (snap.empty && reset) {
      document.getElementById('grid').innerHTML =
        '<div class="empty" style="grid-column:1/-1"><p>🍽️</p><h3>Рецептов пока нет</h3></div>';
      document.getElementById('loadMoreBtn').hidden = true;
    } else {
      snap.forEach(d => addCard(d.id, d.data()));
      lastDoc = snap.docs.at(-1);
      document.getElementById('loadMoreBtn').hidden = snap.size < PAGE;
      applySearch();
    }
  } catch (e) {
    console.error(e);
    showToast('Ошибка загрузки');
  }
  busy = false;
}

function addCard(id, r) {
  const grid = document.getElementById('grid');
  const el   = document.createElement('article');
  el.className    = 'card';
  el.dataset.id   = id;
  el.dataset.title = (r.title || '').toLowerCase();
  el.innerHTML = `
    <div class="card-thumb">${categoryEmoji(r.category)}</div>
    <div class="card-body">
      <span class="card-cat">${r.category || '—'}</span>
      <h3 class="card-title">${r.title}</h3>
      <div class="card-meta">
        <span>⏱ ${r.cookTime || '—'} мин</span>
        <span>🍽 ${r.servings || '—'} порц.</span>
      </div>
      <div class="card-rating">
        <span class="stars">${renderStars(r.avgRating)}</span>
        <span class="rating-n">${r.ratingCount ? `(${r.ratingCount})` : 'нет оценок'}</span>
      </div>
    </div>`;
  el.addEventListener('click', () => location.href = `/recipe.html?id=${id}`);
  grid.appendChild(el);
}

function setupRealtime() {
  const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'), limit(1));
  let first = true;
  onSnapshot(q, snap => {
    if (first) { first = false; return; }
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added') showToast('Появился новый рецепт 🍴');
    });
  });
}

function setupSearch() {
  const inp = document.getElementById('searchInput');
  let timer;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      searchTerm = inp.value.toLowerCase().trim();
      applySearch();
    }, 250);
  });
}

function applySearch() {
  document.querySelectorAll('.card').forEach(card => {
    card.hidden = !!(searchTerm && !card.dataset.title.includes(searchTerm));
  });
}

function setupFilters() {
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.cat;
      loadRecipes(true);
    });
  });
}

function setupSort() {
  document.getElementById('sortSel').addEventListener('change', e => {
    activeSort = e.target.value;
    loadRecipes(true);
  });
}
