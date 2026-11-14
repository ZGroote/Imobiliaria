// A seleção é síncrona; o término de um download antigo nunca muda o ambiente atual.
export function createSplatCache({create, changed = () => {}, limit = 3}) {
  const items = new Map();
  let selected = null, disposed = false;
  function release(item) {
    item.mesh.visible = false;
    // O loader ainda pode escrever nas texturas até initialized terminar.
    item.done.then(() => item.mesh.dispose(), () => item.mesh.dispose());
  }
  function trim() {
    for (const [file, item] of items) {
      if (items.size <= limit) break;
      if (file === selected) continue;
      items.delete(file); release(item);
    }
  }
  function prepare(file) {
    if (disposed || !file) return null;
    let item = items.get(file);
    if (!item) {
      const mesh = create(file);
      mesh.visible = false;
      item = {mesh, loaded: false, error: null, done: null};
      items.set(file, item);
      item.done = Promise.resolve(mesh.initialized).then(() => {
        item.loaded = true;
        if (!disposed && items.get(file) === item) {
          mesh.visible = file === selected; changed();
        }
      }, error => {
        item.error = String(error); mesh.visible = false;
        if (!disposed && items.get(file) === item) changed();
      });
    } else {
      items.delete(file); items.set(file, item);
    }
    trim();
    return item;
  }
  return {
    select(file) {
      if (disposed || file === selected) return;
      selected = file;
      const item = prepare(file);
      for (const [name, entry] of items) entry.mesh.visible = name === file && entry.loaded;
      changed();
      return item;
    },
    prefetch: prepare,
    get selected() { return selected; },
    get ready() { return !!items.get(selected)?.loaded && !items.get(selected)?.error; },
    get error() { return items.get(selected)?.error || null; },
    get mesh() { return items.get(selected)?.mesh; },
    snapshot() {
      return {selected, ready: this.ready, error: this.error,
        files: [...items].map(([file, item]) => ({file, loaded: item.loaded, error: item.error}))};
    },
    dispose() {
      disposed = true; selected = null;
      for (const item of items.values()) release(item);
      items.clear(); changed();
    }
  };
}
