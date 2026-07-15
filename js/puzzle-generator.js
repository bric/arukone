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

  // Ein Segment ist "straff", wenn keine Zelle einen nicht-aufeinanderfolgenden
  // Nachbarn im eigenen Segment hat. Berührt sich ein Segment selbst, ließe es
  // sich abkürzen — solche Rätsel hätten immer eine Lösung mit leeren Feldern.
  // Zerlegt den Pfad in möglichst wenige straffe Segmente: geschnitten wird
  // nur, wenn die nächste Zelle das aktuelle Segment berühren würde.
  function cutPathForced(size, path) {
    var segments = [];
    var current = [path[0]];
    var curSet = {};
    curSet[flat(size, path[0])] = true;

    for (var i = 1; i < path.length; i++) {
      var cell = path[i];
      var prevFlat = flat(size, path[i - 1]);
      var ns = neighborsOf(size, cell.row, cell.col);
      var touches = false;
      for (var n = 0; n < ns.length; n++) {
        var nf = flat(size, ns[n]);
        if (curSet[nf] && nf !== prevFlat) {
          touches = true;
          break;
        }
      }
      if (touches) {
        segments.push(current);
        current = [cell];
        curSet = {};
      } else {
        current.push(cell);
      }
      curSet[flat(size, cell)] = true;
    }
    segments.push(current);
    return segments;
  }


  // Prüft, ob es eine Verbindung aller Paare gibt, die NICHT alle Felder füllt.
  // Rückgabe: 'clean' (jede Lösung füllt das Gitter), 'shortcut' (Abkürzung
  // gefunden) oder 'unknown' (Suchbudget überschritten).
  function verifyOnlyFullSolutions(size, pairs, budget) {
    var total = size * size;
    var adj = [];
    var rowOf = [];
    var colOf = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var list = neighborsOf(size, r, c).map(function (n) { return flat(size, n); });
        adj.push(list);
        rowOf.push(r);
        colOf.push(c);
      }
    }

    var occupied = new Uint8Array(total);
    var mark = new Int16Array(total).fill(-1);
    var occupiedCount = 0;

    var ends = pairs.map(function (p) {
      return { a: flat(size, p.endpointA), b: flat(size, p.endpointB) };
    });
    for (var e = 0; e < ends.length; e++) {
      occupied[ends[e].a] = 1;
      occupied[ends[e].b] = 1;
      occupiedCount += 2;
    }

    var steps = 0;
    var exceeded = false;
    var shortcut = false;

    var visited = new Int32Array(total);
    var visitGen = 0;
    var queue = new Int32Array(total);

    function connected(a, b) {
      visitGen++;
      var qLen = 0;
      queue[qLen++] = a;
      visited[a] = visitGen;
      while (qLen > 0) {
        var cur = queue[--qLen];
        var ns = adj[cur];
        for (var i = 0; i < ns.length; i++) {
          var n = ns[i];
          if (n === b) return true;
          if (!occupied[n] && visited[n] !== visitGen) {
            visited[n] = visitGen;
            queue[qLen++] = n;
          }
        }
      }
      return false;
    }

    function remainingConnected(fromIdx) {
      for (var j = fromIdx; j < ends.length; j++) {
        if (!connected(ends[j].a, ends[j].b)) return false;
      }
      return true;
    }

    function tautOk(cell, pairIdx, head) {
      var ns = adj[cell];
      for (var i = 0; i < ns.length; i++) {
        if (mark[ns[i]] === pairIdx && ns[i] !== head) return false;
      }
      return true;
    }

    function routePair(idx) {
      if (idx === ends.length) {
        if (occupiedCount < total) shortcut = true;
        return;
      }
      mark[ends[idx].a] = idx;
      extend(idx, ends[idx].a, ends[idx].b);
      mark[ends[idx].a] = -1;
    }

    function extend(idx, head, target) {
      if (exceeded || shortcut) return;
      if (++steps > budget) {
        exceeded = true;
        return;
      }

      // Kürzere Wege zuerst probieren, damit Abkürzungen früh gefunden werden
      var ns = adj[head].slice().sort(function (x, y) {
        return (Math.abs(rowOf[x] - rowOf[target]) + Math.abs(colOf[x] - colOf[target])) -
          (Math.abs(rowOf[y] - rowOf[target]) + Math.abs(colOf[y] - colOf[target]));
      });

      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        if (n === target) {
          if (tautOk(n, idx, head)) {
            mark[n] = idx;
            if (remainingConnected(idx + 1)) routePair(idx + 1);
            mark[n] = -1;
            if (exceeded || shortcut) return;
          }
        } else if (!occupied[n] && tautOk(n, idx, head)) {
          occupied[n] = 1;
          occupiedCount++;
          mark[n] = idx;
          extend(idx, n, target);
          occupied[n] = 0;
          occupiedCount--;
          mark[n] = -1;
          if (exceeded || shortcut) return;
        }
      }
    }

    routePair(0);

    if (shortcut) return 'shortcut';
    if (exceeded) return 'unknown';
    return 'clean';
  }

  function segmentsToPairs(segments) {
    return segments.map(function (segment, index) {
      return {
        id: index + 1,
        endpointA: segment[0],
        endpointB: segment[segment.length - 1]
      };
    });
  }

  function generate(size) {
    var maxAttempts = 300;
    var maxPairs = Math.min(Math.round(size * size / 5), window.Arukone.Palette.length);
    var verifyBudget = 2000000;

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var path = generateHamiltonianPath(size);
      var segments = cutPathForced(size, path);
      if (segments.length < 2 || segments.length > maxPairs) continue;
      // Keine trivialen Paare: ein Segment der Länge 2 hätte zwei direkt
      // benachbarte Endpunkte. (Längere straffe Segmente können keine
      // benachbarten Endpunkte haben, da sie sich sonst selbst berührten.)
      var allLongEnough = segments.every(function (s) { return s.length >= 3; });
      if (!allLongEnough) continue;
      var pairs = segmentsToPairs(segments);
      if (verifyOnlyFullSolutions(size, pairs, verifyBudget) === 'clean') {
        return { size: size, pairs: pairs };
      }
    }

    throw new Error('Konnte kein abkürzungsfreies Rätsel erzeugen (Gittergröße ' + size + ')');
  }

  window.Arukone.PuzzleGenerator = {
    generate: generate,
    generateHamiltonianPath: generateHamiltonianPath,
    verifyOnlyFullSolutions: verifyOnlyFullSolutions,
    cutPathForced: cutPathForced
  };
})();
