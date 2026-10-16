// Just enough Foundry for the module's scripts to load under node.
class ApplicationV2 {
  static DEFAULT_OPTIONS = {};
  render() { return this; }
}

const hooks = new Map();
globalThis.Hooks = {
  on(name, fn) { (hooks.get(name) ?? hooks.set(name, []).get(name)).push(fn); return fn; },
  once(name, fn) { return this.on(name, fn); },
  off() {},
  callAll(name, ...args) { for (const fn of hooks.get(name) ?? []) fn(...args); }
};
globalThis.foundry = {
  applications: {
    api: { ApplicationV2, DialogV2: { confirm: async () => true } },
    apps: { FilePicker: { implementation: { browse: async () => ({ dirs: [], files: [] }) } } },
    instances: new Map()
  }
};
const settings = new Map();
globalThis.game = {
  user: { isGM: true },
  settings: {
    register(ns, key, cfg) { settings.set(`${ns}.${key}`, cfg); },
    get(ns, key) { return settings.get(`${ns}.${key}`)?.default; },
    set() {}
  },
  keybindings: { register() {} },
  modules: new Map([["overlay-palette", {}]])
};
globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
globalThis.canvas = null;

export { hooks, settings };
