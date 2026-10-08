/* Dance events, Web Awesome's pattern: one class per event, both cross shadow roots, and only the first can be canceled. */
export class TellDanceEvent extends Event {
  constructor() {
    super('tell-dance', { bubbles: true, cancelable: true, composed: true });
  }
}

export class TellAfterDanceEvent extends Event {
  constructor() {
    super('tell-after-dance', { bubbles: true, cancelable: false, composed: true });
  }
}
