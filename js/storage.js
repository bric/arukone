window.Arukone = window.Arukone || {};

(function () {
  'use strict';

  var STORAGE_KEY = 'arukone.gridSize';

  function loadSize(defaultSize) {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      var size = parseInt(stored, 10);
      return Number.isInteger(size) && size > 0 ? size : defaultSize;
    } catch (e) {
      return defaultSize;
    }
  }

  function saveSize(size) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(size));
    } catch (e) {
      // localStorage unavailable (e.g. private browsing) - ignore, nothing to persist
    }
  }

  window.Arukone.Storage = {
    loadSize: loadSize,
    saveSize: saveSize
  };
})();
