import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { Window } from 'happy-dom';
import { installGlobals } from './dom-globals.mjs';

const MANIFEST = JSON.parse(readFileSync(new URL('../dist/custom-elements.json', import.meta.url)));
const API = MANIFEST.modules[0].declarations[0];
const FIELD_MEMBERS = API.members.filter(m => m.kind === 'field' && !m.static);
const FIELDS = FIELD_MEMBERS.map(m => m.name);
const ATTR = Object.fromEntries(API.attributes.map(a => [a.name, a]));
const valuesOf = name => [...ATTR[name].type.text.matchAll(/'([^']+)'/g)].map(m => m[1]);

const window = new Window();
const { customElements, document } = window;
installGlobals(window);
await import('../dist/tiny-tells.js');
const TinyTell = customElements.get('tiny-tell');

describe('the public surface matches custom-elements.json', () => {
  test('names', () => {
    assert.deepEqual(
      Object.getOwnPropertyNames(TinyTell.prototype).sort(),
      ['attributeChangedCallback', 'connectedCallback', 'constructor', 'disconnectedCallback', ...FIELDS].sort(),
      'the prototype has the lifecycle callbacks plus one property per documented field, nothing else'
    );
    assert.deepEqual(TinyTell.observedAttributes, FIELDS, 'every documented field is observed, in order');
  });

  test('every module lists the names it exports', async () => {
    for (const { path, exports } of MANIFEST.modules) {
      const listed = exports.filter(e => e.kind === 'js').map(e => e.name);
      assert.deepEqual(
        listed.sort(),
        Object.keys(await import(`../${path}`)).sort(),
        `${path} lists every name it exports, nothing else`
      );
    }
  });

  test('defaults', () => {
    const el = document.createElement('tiny-tell');
    assert.deepEqual(
      Object.fromEntries(FIELD_MEMBERS.map(m => [m.name, el[m.name]])),
      Object.fromEntries(FIELD_MEMBERS.map(m => [m.name, JSON.parse(m.default)])),
      'each property starts at its documented default'
    );
  });

  test('reflection', () => {
    const el = document.createElement('tiny-tell');
    document.body.append(el);
    for (const name of ['state', 'color', 'scheme'])
      for (const value of valuesOf(name)) {
        el[name] = value;
        assert.equal(el[name], value, `${name}="${value}" reads back from the property`);
        assert.equal(el.getAttribute(name), value, `${name}="${value}" reflects to the attribute`);
      }
    for (const value of valuesOf('skin')) {
      el.skin = value;
      assert.equal(el.getAttribute('skin'), value, `skin="${value}" reflects to the attribute`);
    }
    el.label = 'Uploading photos';
    assert.equal(el.getAttribute('label'), 'Uploading photos', 'label reflects to the attribute');
    el.paused = true;
    assert.ok(el.hasAttribute('paused'), 'paused reflects as a boolean attribute');
    assert.deepEqual(Object.keys(el), [], 'a connected tell keeps no own properties that would shadow the API');
    el.remove();
  });

  test('unknown, null, and undefined values read back as the default', () => {
    const el = document.createElement('tiny-tell');
    for (const name of ['skin', 'state', 'color', 'scheme']) {
      const fallback = JSON.parse(ATTR[name].default);
      el[name] = 'nope';
      assert.equal(el[name], fallback, `an unknown ${name} reads back as "${fallback}"`);
      for (const empty of [null, undefined]) {
        el[name] = empty;
        assert.equal(el.hasAttribute(name), false, `${name} = ${empty} removes the attribute`);
        assert.equal(el[name], fallback, `${name} = ${empty} reads back as "${fallback}"`);
      }
    }
  });
});

describe('statics', () => {
  test('timeScale stops the tells for anything that is not a finite number', () => {
    for (const value of [Infinity, -Infinity, NaN, -1, 'fast', undefined]) {
      TinyTell.timeScale = value;
      assert.equal(TinyTell.timeScale, 0, `timeScale = ${String(value)} reads back as 0`);
    }
    TinyTell.timeScale = 2;
    assert.equal(TinyTell.timeScale, 2, 'a finite speed reads back as set');
    TinyTell.timeScale = 1;
  });
});

describe('play bundle', () => {
  test('play adds the documented methods, and core never observes play-only attributes', async () => {
    const methods = API.members.filter(m => m.kind === 'method').map(m => m.name);
    const playOnly = API.attributes.filter(a => !a.fieldName).map(a => a.name);
    assert.deepEqual(methods, ['dance'], 'the manifest documents dance()');
    assert.deepEqual(playOnly, ['noplay'], 'and noplay as an attribute with no property');
    await import('../dist/tiny-tells-play.js');
    for (const name of methods) assert.equal(typeof TinyTell.prototype[name], 'function', `play adds ${name}()`);
    assert.equal(TinyTell.observedAttributes.includes('noplay'), false, 'core never observes noplay');
  });
});
