const PAGE = { '/': 'landing', '/docs/': 'docs' };

export const track = (name, data) =>
  window.umami?.track(name, { ...data, page: PAGE[location.pathname] ?? location.pathname });
