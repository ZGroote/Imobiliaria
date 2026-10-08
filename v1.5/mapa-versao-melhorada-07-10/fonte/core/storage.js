/* Access is resolved inside try: reading localStorage itself can be denied. */
(function(root) {
  'use strict';
  function create(getStorage) {
    return Object.freeze({
      le(key) {
        try { return getStorage().getItem(key); } catch { return null; }
      },
      grava(key, value) {
        try { getStorage().setItem(key, value); } catch { /* Keep the app usable offline. */ }
      }
    });
  }
  root.MapStorage = Object.freeze({create});
})(globalThis);
