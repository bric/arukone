window.Arukone = window.Arukone || {};

(function () {
  'use strict';

  var GridModel = window.Arukone.GridModel;

  function cellFromPoint(clientX, clientY) {
    var el = document.elementFromPoint(clientX, clientY);
    if (!el || !el.classList || !el.classList.contains('cell')) return null;
    return { row: parseInt(el.dataset.row, 10), col: parseInt(el.dataset.col, 10) };
  }

  function attach(container, stateHolder, callbacks) {
    var dragState = { active: false, pairId: null };

    function handlePointerDown(e) {
      var cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;

      var pairId = GridModel.beginDrag(stateHolder.grid, cell.row, cell.col);
      if (pairId === null) return;

      dragState.active = true;
      dragState.pairId = pairId;
      e.preventDefault();
      callbacks.onUpdate();
    }

    function handlePointerMove(e) {
      if (!dragState.active) return;
      var cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;

      var changed = GridModel.continueDrag(stateHolder.grid, dragState.pairId, cell.row, cell.col);
      if (changed) callbacks.onUpdate();
    }

    function handlePointerUp() {
      if (!dragState.active) return;
      dragState.active = false;
      dragState.pairId = null;

      callbacks.onUpdate();
      if (GridModel.isSolved(stateHolder.grid)) callbacks.onWin();
    }

    container.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
  }

  window.Arukone.InputController = {
    attach: attach
  };
})();
