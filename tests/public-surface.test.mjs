import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { Window } from 'happy-dom';
import { installGlobals } from './dom-globals.mjs';

const API = JSON.parse(readFileSync(new URL('../dist/custom-elements.json', import.meta.url))).modules[0]
  .declarations[0];
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
      [
        'attributeChangedCallback',
        'connectedCallback',
        'constructor',
        'disconnectedCallback',
        ...Object.keys(ATTR),
      ].sort(),
      'the prototype has the lifecycle callbacks plus one property per documented attribute, nothing else'
    );
    assert.deepEqual(
      TinyTell.observedAttributes,
      Object.keys(ATTR),
      'every documented attribute is observed, in order'
    );
  });

  test('defaults', () => {
    const el = document.createElement('tiny-tell');
    assert.deepEqual(
      Object.fromEntries(API.attributes.map(a => [a.name, el[a.name]])),
      Object.fromEntries(API.attributes.map(a => [a.name, JSON.parse(a.default)])),
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
