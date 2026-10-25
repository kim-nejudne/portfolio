// Runs before the first paint (a classic script in index.html's <head>; the §10 CSP allows no
// inline script, so it is this file): reads the §7 settings object and puts the colour scheme
// and the resolved mode on <html> as data-scheme and data-mode, plus the `dark` class Tailwind's
// variant and the existing tests read, and color-scheme for native controls. src/app/theme.ts
// takes over once the app runs, validating the scheme id and following every change. The default
// scheme id here is DEFAULT_SCHEME in src/theme/schemes/index.ts (a unit test keeps them equal).
(function () {
  var settings = {};
  try {
    var raw = window.localStorage.getItem('ts-dojo:settings');
    var parsed = raw === null ? null : JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') settings = parsed;
  } catch (_error) {
    settings = {};
  }
  var theme = settings.theme;
  var dark =
    theme === 'dark' ||
    (theme !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  var scheme =
    typeof settings.scheme === 'string' &&
    /^[a-z]+(-[a-z]+)*$/.test(settings.scheme)
      ? settings.scheme
      : 'catppuccin';
  var root = document.documentElement;
  root.setAttribute('data-scheme', scheme);
  root.setAttribute('data-mode', dark ? 'dark' : 'light');
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
