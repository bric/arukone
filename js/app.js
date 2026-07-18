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
  var winTime = document.getElementById('win-time');
  var fillBanner = document.getElementById('fill-banner');
  var generatingHint = document.getElementById('generating-hint');
  var timerDisplay = document.getElementById('timer');

  var stateHolder = { grid: null };
  var cellElements = [];
  var generationToken = 0;
  var timerStart = null;
  var timerInterval = null;

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var mmss = m + ':' + (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + (m < 10 ? '0' : '') + mmss : mmss;
  }

  function startTimer() {
    stopTimer();
    timerStart = Date.now();
    timerDisplay.textContent = '0:00';
    timerInterval = window.setInterval(function () {
      timerDisplay.textContent = formatTime(Date.now() - timerStart);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval !== null) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function redraw() {
    Arukone.Renderer.render(cellElements, stateHolder.grid);
  }

  function showWin() {
    stopTimer();
    if (timerStart !== null) {
      var elapsed = formatTime(Date.now() - timerStart);
      timerDisplay.textContent = elapsed;
      winTime.textContent = ' – Zeit: ' + elapsed;
    }
    winBanner.hidden = false;
    fillBanner.hidden = true;
  }

  function hideWin() {
    winBanner.hidden = true;
  }

  // Weist darauf hin, dass zwar alle Paare verbunden sind, aber noch Felder
  // frei sind — sonst wirkt der fehlende "Gelöst!"-Zustand wie ein Fehler.
  function updateFillHint() {
    var grid = stateHolder.grid;
    fillBanner.hidden = !grid ||
      Arukone.GridModel.isSolved(grid) ||
      !Arukone.GridModel.allPairsConnected(grid);
  }

  function setControlsEnabled(enabled) {
    sizeSelect.disabled = !enabled;
    newGameBtn.disabled = !enabled;
    resetBtn.disabled = !enabled;
  }

  function startNewGame(size) {
    hideWin();
    fillBanner.hidden = true;
    setControlsEnabled(false);
    generatingHint.hidden = false;
    stopTimer();
    timerStart = null;
    timerDisplay.textContent = '0:00';

    var token = ++generationToken;
    Arukone.PuzzleGenerator.generateAsync(size, function (puzzle) {
      if (token !== generationToken) return;
      stateHolder.grid = Arukone.GridModel.createGrid(puzzle.size, puzzle.pairs);
      cellElements = Arukone.Renderer.buildBoard(container, size);
      redraw();
      generatingHint.hidden = true;
      setControlsEnabled(true);
      startTimer();
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
    fillBanner.hidden = true;
    redraw();
    // Nach einem gelösten Rätsel zählt Zurücksetzen als neuer Versuch;
    // mitten im Spiel läuft die Uhr einfach weiter.
    if (timerInterval === null && stateHolder.grid) startTimer();
  });

  Arukone.InputController.attach(container, stateHolder, {
    onUpdate: function () {
      redraw();
      updateFillHint();
    },
    onWin: showWin
  });

  var storedSize = Arukone.Storage.loadSize(DEFAULT_SIZE);
  var initialSize = ALLOWED_SIZES.indexOf(storedSize) !== -1 ? storedSize : DEFAULT_SIZE;
  sizeSelect.value = String(initialSize);
  startNewGame(initialSize);
})();
