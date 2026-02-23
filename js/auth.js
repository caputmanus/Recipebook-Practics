import { loadCurrentUser, login, register, showToast } from './app.js';

loadCurrentUser().then(user => {
  if (user) location.href = '/index.html';
});

let mode = 'login';

document.getElementById('tabLogin').addEventListener('click',    () => setMode('login'));
document.getElementById('tabRegister').addEventListener('click', () => setMode('register'));

function setMode(m) {
  mode = m;
  document.getElementById('tabLogin').classList.toggle('active',    m === 'login');
  document.getElementById('tabRegister').classList.toggle('active', m === 'register');
  document.getElementById('nameGroup').style.display = m === 'register' ? '' : 'none';
  document.getElementById('submitBtn').textContent   = m === 'login' ? 'Войти' : 'Зарегистрироваться';
  document.getElementById('errMsg').textContent      = '';
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passInput').value;
  const name     = document.getElementById('nameInput').value.trim();
  const errEl    = document.getElementById('errMsg');
  const btn      = document.getElementById('submitBtn');

  if (!email || !password) { errEl.textContent = 'Заполни все поля'; return; }
  if (password.length < 6) { errEl.textContent = 'Пароль минимум 6 символов'; return; }

  btn.disabled     = true;
  btn.textContent  = '…';
  errEl.textContent = '';

  try {
    if (mode === 'login') {
      await login(email, password);
    } else {
      if (!name) { errEl.textContent = 'Введи имя'; btn.disabled = false; return; }
      await register(email, password, name);
    }
    location.href = '/index.html';
  } catch (err) {
    errEl.textContent = err.message || 'Ошибка, попробуй снова';
    btn.disabled = false;
    btn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
  }
});
