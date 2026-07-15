window.Arukone = window.Arukone || {};

(function () {
  'use strict';

  var GridModel = window.Arukone.GridModel;

  function directionTo(from, to) {
    if (to.row === from.row - 1) return 'up';
    if (to.row === from.row + 1) return 'down';
    if (to.col === from.col - 1) return 'left';
    if (to.col === from.col + 1) return 'right';
    return null;
  }

  function buildBoard(container, size) {
    container.innerHTML = '';
    container.style.setProperty('--grid-size', size);

    var cells = [];
    for (var row = 0; row < size; row++) {
      for (var col = 0; col < size; col++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        container.appendChild(cell);
        cells.push(cell);
      }
    }
    return cells;
  }

  function render(cellElements, grid) {
    var size = grid.size;
    var connections = [];
    for (var i = 0; i < size * size; i++) connections.push({});

    grid.pairs.forEach(function (pair) {
      for (var i = 0; i < pair.path.length - 1; i++) {
        var a = pair.path[i];
        var b = pair.path[i + 1];
        var idxA = GridModel.flatIndex(size, a.row, a.col);
        var idxB = GridModel.flatIndex(size, b.row, b.col);
        connections[idxA][directionTo(a, b)] = true;
        connections[idxB][directionTo(b, a)] = true;
      }
    });

    cellElements.forEach(function (el, idx) {
      var row = Math.floor(idx / size);
      var col = idx % size;
      var ownerId = grid.cellOwner[idx];

      el.className = 'cell';
      el.style.removeProperty('--pair-color');
      el.innerHTML = '';

      if (ownerId !== null) {
        var pair = GridModel.getPairById(grid, ownerId);
        el.style.setProperty('--pair-color', pair.color);
        el.classList.add('filled');

        Object.keys(connections[idx]).forEach(function (dir) {
          var bar = document.createElement('div');
          bar.className = 'bar bar-' + dir;
          el.appendChild(bar);
        });

        var pellet = document.createElement('div');
        pellet.className = 'pellet';
        el.appendChild(pellet);
      }

      var endpointPair = GridModel.findEndpointPair(grid, row, col);
      if (endpointPair) {
        el.classList.add('endpoint');
        var label = document.createElement('span');
        label.className = 'label';
        label.textContent = String(endpointPair.id);
        el.appendChild(label);
      }
    });
  }

  window.Arukone.Renderer = {
    buildBoard: buildBoard,
    render: render
  };
})();
