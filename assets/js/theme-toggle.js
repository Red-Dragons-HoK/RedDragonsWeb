// js/theme-toggle.js
// Maneja el botón de modo oscuro/claro. El modo oscuro es el default:
// si no hay nada guardado en localStorage, no se toca el atributo
// data-theme y el sitio se ve como siempre (oscuro).
(function () {
  try {
    if (localStorage.getItem('rd-theme') === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (localStorage.getItem('rd-theme') === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (e) {}

  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function render() {
    if (isLight()) {
      btn.textContent = '☀️';
      btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
      btn.title = 'Cambiar a modo oscuro';
    } else {
      btn.textContent = '🌙';
      btn.setAttribute('aria-label', 'Cambiar a modo claro');
      btn.title = 'Cambiar a modo claro';
    }
  }

  btn.addEventListener('click', function () {
    if (isLight()) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('rd-theme', 'dark'); } catch (e) {}
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('rd-theme', 'light'); } catch (e) {}
    }
    render();
  });

  render();
})();
