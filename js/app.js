(function () {
  'use strict';

  var Arukone = window.Arukone;
  var ALLOWED_SIZES = [5, 6, 7, 8, 9, 10];
  var DEFAULT_SIZE = 7;

  var container = document.getElementById('grid');
  var sizeSelect = document.getElementById('size-select');
  var newGameBtn = document.getElementById('new-game-btn');
  var resetBtn = document.getElementById('reset-btn');
  var winBanner = document.getElementById('win-banner');
  var generatingHint = document.getElementById('generating-hint');

  var stateHolder = { grid: null };
  var cellElements = [];
  var generationToken = 0;

  function redraw() {
    Arukone.Renderer.render(cellElements, stateHolder.grid);
  }

  function showWin() {
    winBanner.hidden = false;
  }

  function hideWin() {
    winBanner.hidden = true;
  }

  function setControlsEnabled(enabled) {
    sizeSelect.disabled = !enabled;
    newGameBtn.disabled = !enabled;
    resetBtn.disabled = !enabled;
  }

  function startNewGame(size) {
    hideWin();
    setControlsEnabled(false);
    generatingHint.hidden = false;

    var token = ++generationToken;
    Arukone.PuzzleGenerator.generateAsync(size, function (puzzle) {
      if (token !== generationToken) return;
      stateHolder.grid = Arukone.GridModel.createGrid(puzzle.size, puzzle.pairs);
      cellElements = Arukone.Renderer.buildBoard(container, size);
      redraw();
      generatingHint.hidden = true;
      setControlsEnabled(true);
    });
  }

  sizeSelect.addEventListener('change', function () {
    var size = parseInt(sizeSelect.value, 10);
    Arukone.Storage.saveSize(size);
    startNewGame(size);
  });

  newGameBtn.addEventListener('click', function () {
    startNewGame(parseInt(sizeSelect.value, 10));
  });

  resetBtn.addEventListener('click', function () {
    Arukone.GridModel.resetAllPaths(stateHolder.grid);
    hideWin();
    redraw();
  });

  Arukone.InputController.attach(container, stateHolder, {
    onUpdate: redraw,
    onWin: showWin
  });

  var storedSize = Arukone.Storage.loadSize(DEFAULT_SIZE);
  var initialSize = ALLOWED_SIZES.indexOf(storedSize) !== -1 ? storedSize : DEFAULT_SIZE;
  sizeSelect.value = String(initialSize);
  startNewGame(initialSize);
})();
