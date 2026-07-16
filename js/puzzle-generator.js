window.Arukone = window.Arukone || {};

(function () {
  'use strict';

  function flat(size, cell) {
    return cell.row * size + cell.col;
  }

  function neighborsOf(size, row, col) {
    var result = [];
    if (row > 0) result.push({ row: row - 1, col: col });
    if (row < size - 1) result.push({ row: row + 1, col: col });
    if (col > 0) result.push({ row: row, col: col - 1 });
    if (col < size - 1) result.push({ row: row, col: col + 1 });
    return result;
  }

  function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  function generateHamiltonianPath(size) {
    var totalCells = size * size;
    var maxAttempts = 40;
    var stepBudget = totalCells * 200;

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var visited = new Array(totalCells).fill(false);
      var start = { row: Math.floor(Math.random() * size), col: Math.floor(Math.random() * size) };
      var path = [start];
      visited[flat(size, start)] = true;
      var steps = { count: 0 };

      if (dfs(start)) return path;

      function dfs(current) {
        steps.count++;
        if (steps.count > stepBudget) return false;
        if (path.length === totalCells) return true;

        var candidates = shuffle(neighborsOf(size, current.row, current.col))
          .filter(function (n) { return !visited[flat(size, n)]; });

        candidates.sort(function (a, b) {
          return countUnvisited(a) - countUnvisited(b);
        });

        for (var i = 0; i < candidates.length; i++) {
          var next = candidates[i];
          visited[flat(size, next)] = true;
          path.push(next);
          if (dfs(next)) return true;
          path.pop();
          visited[flat(size, next)] = false;
        }
        return false;
      }

      function countUnvisited(cell) {
        return neighborsOf(size, cell.row, cell.col)
          .filter(function (n) { return !visited[flat(size, n)]; }).length;
      }
    }

    throw new Error('Konnte keinen Hamiltonpfad erzeugen (Gittergröße ' + size + ')');
  }

  function cutPath(path, desiredK) {
    var k = desiredK;
    while (k >= 2) {
      var minSegLen = Math.max(2, Math.floor(path.length / (k * 3)));
      var segments = tryCut(path, k, minSegLen);
      if (segments) return segments;
      k--;
    }
    return [path];
  }

  function tryCut(path, k, minSegLen) {
    var maxResamples = 60;
    for (var attempt = 0; attempt < maxResamples; attempt++) {
      var cuts = [];
      while (cuts.length < k - 1) {
        var candidate = 1 + Math.floor(Math.random() * (path.length - 1));
        if (cuts.indexOf(candidate) === -1) cuts.push(candidate);
      }
      cuts.sort(function (a, b) { return a - b; });

      var boundaries = [0].concat(cuts).concat([path.length]);
      var valid = true;
      for (var i = 0; i < boundaries.length - 1; i++) {
        if (boundaries[i + 1] - boundaries[i] < minSegLen) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      var segments = [];
      for (var s = 0; s < boundaries.length - 1; s++) {
        segments.push(path.slice(boundaries[s], boundaries[s + 1]));
      }
      return segments;
    }
    return null;
  }

  function defaultPairCount(size) {
    var k = Math.round(size * 0.6);
    return Math.max(3, k);
  }

  function generate(size, pairCount) {
    var k = pairCount || defaultPairCount(size);
    var path = generateHamiltonianPath(size);
    var segments = cutPath(path, k);

    var pairs = segments.map(function (segment, index) {
      return {
        id: index + 1,
        endpointA: segment[0],
        endpointB: segment[segment.length - 1]
      };
    });

    return { size: size, pairs: pairs };
  }

  window.Arukone.PuzzleGenerator = {
    generate: generate,
    defaultPairCount: defaultPairCount,
    generateHamiltonianPath: generateHamiltonianPath
  };
})();
