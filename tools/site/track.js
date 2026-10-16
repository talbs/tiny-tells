const PAGE = { '/': 'landing', '/docs/': 'docs' };

export const track = (name, data) =>
  window.umami?.track(name, { ...data, page: PAGE[location.pathname] ?? location.pathname });

const url = new URL(location);
const stats = url.searchParams.get('stats');
if (stats === 'off' || stats === 'on') {
  /* Umami's own opt-out: it checks this key before every send. */
  try {
    stats === 'off' ? localStorage.setItem('umami.disabled', '1') : localStorage.removeItem('umami.disabled');
  } catch {}
  url.searchParams.delete('stats');
  history.replaceState(null, '', url);
}
