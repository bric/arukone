window.Arukone = window.Arukone || {};

(function () {
  'use strict';

  function flatIndex(size, row, col) {
    return row * size + col;
  }

  function equalsCell(a, b) {
    return a.row === b.row && a.col === b.col;
  }

  function isAdjacent(a, b) {
    var dr = Math.abs(a.row - b.row);
    var dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  function indexOfInPath(pair, row, col) {
    for (var i = 0; i < pair.path.length; i++) {
      if (pair.path[i].row === row && pair.path[i].col === col) return i;
    }
    return -1;
  }

  function isPairEndpoint(pair, row, col) {
    return equalsCell(pair.endpointA, { row: row, col: col }) ||
      equalsCell(pair.endpointB, { row: row, col: col });
  }

  function findEndpointPair(grid, row, col) {
    for (var i = 0; i < grid.pairs.length; i++) {
      if (isPairEndpoint(grid.pairs[i], row, col)) return grid.pairs[i];
    }
    return null;
  }

  function getPairById(grid, pairId) {
    return grid.pairs[pairId - 1];
  }

  function getOwner(grid, row, col) {
    return grid.cellOwner[flatIndex(grid.size, row, col)];
  }

  function setOwner(grid, row, col, pairId) {
    grid.cellOwner[flatIndex(grid.size, row, col)] = pairId;
  }

  function truncatePath(grid, pair, keepLength) {
    var removed = pair.path.slice(keepLength);
    pair.path = pair.path.slice(0, keepLength);
    for (var i = 0; i < removed.length; i++) {
      var cell = removed[i];
      if (!isPairEndpoint(pair, cell.row, cell.col)) {
        setOwner(grid, cell.row, cell.col, null);
      }
    }
  }

  function createGrid(size, pairDefs) {
    var grid = {
      size: size,
      cellOwner: new Array(size * size).fill(null),
      pairs: []
    };
    for (var i = 0; i < pairDefs.length; i++) {
      var def = pairDefs[i];
      grid.pairs.push({
        id: def.id,
        color: window.Arukone.colorForPair(def.id),
        endpointA: def.endpointA,
        endpointB: def.endpointB,
        path: []
      });
    }
    for (var j = 0; j < grid.pairs.length; j++) {
      var pair = grid.pairs[j];
      setOwner(grid, pair.endpointA.row, pair.endpointA.col, pair.id);
      setOwner(grid, pair.endpointB.row, pair.endpointB.col, pair.id);
    }
    return grid;
  }

  function beginDrag(grid, row, col) {
    var pair = findEndpointPair(grid, row, col);
    if (pair) {
      var idx = indexOfInPath(pair, row, col);
      if (idx !== -1) {
        truncatePath(grid, pair, idx + 1);
      } else {
        truncatePath(grid, pair, 0);
        pair.path = [{ row: row, col: col }];
      }
      return pair.id;
    }

    var owner = getOwner(grid, row, col);
    if (owner === null) return null;

    var ownedPair = getPairById(grid, owner);
    var ownedIdx = indexOfInPath(ownedPair, row, col);
    if (ownedIdx === -1) return null;
    truncatePath(grid, ownedPair, ownedIdx + 1);
    return ownedPair.id;
  }

  function shortestFreeRoute(grid, start, goal) {
    var size = grid.size;
    var startIdx = flatIndex(size, start.row, start.col);
    var goalIdx = flatIndex(size, goal.row, goal.col);
    var prev = new Array(size * size).fill(-1);
    var visited = new Array(size * size).fill(false);
    visited[startIdx] = true;

    var queue = [start];
    var deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      var cur = queue.shift();
      var curIdx = flatIndex(size, cur.row, cur.col);
      if (curIdx === goalIdx) {
        var route = [];
        var idx = goalIdx;
        while (idx !== startIdx) {
          route.unshift({ row: Math.floor(idx / size), col: idx % size });
          idx = prev[idx];
        }
        return route;
      }
      for (var d = 0; d < deltas.length; d++) {
        var nr = cur.row + deltas[d][0];
        var nc = cur.col + deltas[d][1];
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        var ni = flatIndex(size, nr, nc);
        if (visited[ni]) continue;
        if (ni !== goalIdx && grid.cellOwner[ni] !== null) continue;
        visited[ni] = true;
        prev[ni] = curIdx;
        queue.push({ row: nr, col: nc });
      }
    }
    return null;
  }

  function continueDrag(grid, pairId, row, col) {
    var pair = getPairById(grid, pairId);
    if (pair.path.length === 0) return false;

    var last = pair.path[pair.path.length - 1];
    if (last.row === row && last.col === col) return false;

    var idx = indexOfInPath(pair, row, col);
    if (idx !== -1) {
      truncatePath(grid, pair, idx + 1);
      return true;
    }

    var owner = getOwner(grid, row, col);
    if (owner !== null && owner !== pairId) return false;

    var route;
    if (isAdjacent(last, { row: row, col: col })) {
      route = [{ row: row, col: col }];
    } else {
      route = shortestFreeRoute(grid, last, { row: row, col: col });
      if (!route) return false;
    }

    for (var i = 0; i < route.length; i++) {
      var step = route[i];
      pair.path.push(step);
      if (getOwner(grid, step.row, step.col) === null) {
        setOwner(grid, step.row, step.col, pairId);
      }
    }
    return true;
  }

  function isPairComplete(grid, pairId) {
    var pair = getPairById(grid, pairId);
    if (pair.path.length < 2) return false;
    var first = pair.path[0];
    var last = pair.path[pair.path.length - 1];
    return (equalsCell(first, pair.endpointA) && equalsCell(last, pair.endpointB)) ||
      (equalsCell(first, pair.endpointB) && equalsCell(last, pair.endpointA));
  }

  function clearPairPath(grid, pairId) {
    truncatePath(grid, getPairById(grid, pairId), 0);
  }

  function resetAllPaths(grid) {
    for (var i = 0; i < grid.pairs.length; i++) {
      truncatePath(grid, grid.pairs[i], 0);
    }
  }

  function isSolved(grid) {
    for (var i = 0; i < grid.cellOwner.length; i++) {
      if (grid.cellOwner[i] === null) return false;
    }
    for (var j = 0; j < grid.pairs.length; j++) {
      var pair = grid.pairs[j];
      if (pair.path.length < 2) return false;
      var first = pair.path[0];
      var last = pair.path[pair.path.length - 1];
      var forward = equalsCell(first, pair.endpointA) && equalsCell(last, pair.endpointB);
      var backward = equalsCell(first, pair.endpointB) && equalsCell(last, pair.endpointA);
      if (!forward && !backward) return false;
    }
    return true;
  }

  window.Arukone.GridModel = {
    createGrid: createGrid,
    isAdjacent: isAdjacent,
    equalsCell: equalsCell,
    flatIndex: flatIndex,
    findEndpointPair: findEndpointPair,
    getPairById: getPairById,
    getOwner: getOwner,
    indexOfInPath: indexOfInPath,
    beginDrag: beginDrag,
    continueDrag: continueDrag,
    isPairComplete: isPairComplete,
    clearPairPath: clearPairPath,
    resetAllPaths: resetAllPaths,
    isSolved: isSolved
  };
})();
