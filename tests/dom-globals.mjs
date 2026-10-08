export const installGlobals = window => {
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'customElements',
    'CSSStyleSheet',
    'CSS',
    'matchMedia',
    'getComputedStyle',
    'requestAnimationFrame',
    'IntersectionObserver',
    'ResizeObserver',
    'MutationObserver',
    'performance',
    'addEventListener',
  ])
    if (window[key] !== undefined && globalThis[key] === undefined)
      globalThis[key] =
        key === 'window'
          ? window
          : typeof window[key] === 'function' && /^[a-z]/.test(key)
            ? window[key].bind(window)
            : window[key];
};
