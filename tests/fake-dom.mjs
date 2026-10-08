import { installGlobals } from './dom-globals.mjs';

const problems = [];
console.error = (...a) => problems.push(`console.error: ${a[0]}`);
console.warn = (...a) => problems.push(`console.warn: ${a[0]}`);
process.on('uncaughtException', e => {
  problems.push(`uncaught: ${e}`);
});

const environments = {
  jsdom: async () => {
    const { JSDOM, VirtualConsole } = await import('jsdom');
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', e => problems.push(`jsdom: ${e.message}`));
    return new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true, virtualConsole }).window;
  },
  'happy-dom': async () => {
    const window = new (await import('happy-dom')).Window();
    window.addEventListener('error', e => problems.push(`happy-dom: ${e.error?.message ?? e.message}`));
    return window;
  },
};

const name = process.argv[2];
const window = await environments[name]();
const { document } = window;
installGlobals(window);
const nextFrame = () => new Promise(r => window.requestAnimationFrame(r));

await import('../dist/tiny-tells.js');
const el = document.createElement('tiny-tell');
el.setAttribute('skin', 'eyes');
document.body.append(el);
await nextFrame();
el.state = 'done';
el.paused = true;
await nextFrame();
el.remove();
await nextFrame();

const reflected = el.getAttribute('state') === 'done' && el.hasAttribute('paused');
if (!reflected) problems.push('attributes did not reflect');
if (problems.length) {
  process.stdout.write(`fake dom (${name}) failed:\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}
console.log(`fake dom (${name}): ok`);
process.exit(0);
