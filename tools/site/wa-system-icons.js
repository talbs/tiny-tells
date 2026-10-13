/* Serve Web Awesome's own icons (chevrons, the drawer's ×, checks) in sharp regular from the kit. The bundle runs this before components first render, so the built-in set never shows. */
import { getKitCode, registerIconLibrary } from '@awesome.me/webawesome';

const SYSTEM_ALIASES = { indeterminate: 'minus' };
registerIconLibrary('system', {
  resolver: name =>
    `https://ka-p.fontawesome.com/releases/v${__FA_VERSION__}/svgs/sharp-regular/${SYSTEM_ALIASES[name] ?? name}.svg?token=${encodeURIComponent(getKitCode())}`,
  mutator: svg => svg.hasAttribute('fill') || svg.setAttribute('fill', 'currentColor'),
});
