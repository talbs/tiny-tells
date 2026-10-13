/* The build inlines this function's source into each page's <head> so it runs before first paint, so it can't use imports or outer variables. */
export const setScheme = () => {
  let saved;
  try {
    saved = localStorage.getItem('tells-site-theme');
  } catch {}
  const isDark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches,
    root = document.documentElement;
  root.classList.toggle('wa-dark', isDark);
  root.classList.toggle('wa-light', !isDark);
  root.dataset.theme = isDark ? 'dark' : 'light';
  return isDark;
};
