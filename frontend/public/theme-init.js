(() => {
  const root = document.documentElement;
  const storageKey = root.dataset.themeStorageKey;
  let saved = null;

  try {
    saved = storageKey ? localStorage.getItem(storageKey) : null;
  } catch {
    // A preferência do sistema continua disponível quando o storage é bloqueado.
  }

  const preference = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  let systemDark = false;

  try {
    systemDark =
      typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    // O tema claro é usado quando matchMedia não está disponível.
  }

  const theme = preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light';

  root.dataset.themePreference = preference;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();
