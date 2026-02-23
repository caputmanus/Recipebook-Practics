import { initAuth, register, login } from './auth.js';

initAuth((user) => {
  if (user) location.href = '/index.html';
});

let mode = 'login';

document.getElementById('tabLogin').addEventListener('click', () => setMode('login'));
document.getElementById('tabRegister').addEventListener('click', () => setMode('register'));

function setMode(m) {
  mode = m;
  document.getElementById('tabLogin').classList.toggle('active', m === 'login');
  document.getElementById('tabRegister').classList.toggle('active', m === 'register');
  document.getElementById('nameGroup').style.display = m === 'register' ? '' : 'none';
  document.getElementById('authSubmit').textContent = m === 'login' ? 'Войти' : 'Зарегистрироваться';
  document.getElementById('authError').textContent = '';
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  const btn = document.getElementById('authSubmit');
  const errEl = document.getElementById('authError');

  if (password.length < 6) {
    errEl.textContent = 'Пароль должен быть не менее 6 символов';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Загрузка…';
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
    errEl.textContent = friendlyError(err.code);
    btn.disabled = false;
    btn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
  }
});

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
  };
  return map[code] || 'Ошибка. Попробуй ещё раз.';
}
