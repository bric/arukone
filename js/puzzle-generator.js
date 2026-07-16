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

  // Backbite-Zug: Ein Pfadende springt zu einem Gitternachbarn, der bereits im
  // Pfad liegt; das Teilstück dazwischen wird umgedreht. Erhält die
  // Hamiltoneigenschaft und durchmischt die Pfadform.
  function backbite(size, path) {
    var fromHead = Math.random() < 0.5;
    if (!fromHead) path.reverse();
    var endpoint = path[0];
    var ns = neighborsOf(size, endpoint.row, endpoint.col);
    var pick = ns[Math.floor(Math.random() * ns.length)];
    var idx = -1;
    for (var i = 0; i < path.length; i++) {
      if (path[i].row === pick.row && path[i].col === pick.col) {
        idx = i;
        break;
      }
    }
    var result = null;
    if (idx > 1) {
      result = path.slice(0, idx).reverse().concat(path.slice(idx));
    }
    if (!fromHead) {
      path.reverse();
      if (result) result.reverse();
    }
    return result;
  }

  // Zufällige Hamiltonpfade sind kleinteilig gewunden und zerfallen in viele
  // straffe Segmente. Ein Hügelsteigen über Backbite-Züge formt den Pfad in
  // große Strukturen um, bis er in höchstens `target` Segmente zerfällt.
  function optimizePath(size, target, deadline) {
    var best = null;
    while (Date.now() < deadline) {
      var path = generateHamiltonianPath(size);
      var score = cutPathForced(size, path).length;
      var sinceImprove = 0;
      while (sinceImprove < 2000 && score > target && Date.now() < deadline) {
        var copy = path.map(function (c) { return { row: c.row, col: c.col }; });
        var moved = backbite(size, copy);
        if (!moved) {
          sinceImprove++;
          continue;
        }
        var s = cutPathForced(size, moved).length;
        if (s <= score) {
          if (s < score) sinceImprove = 0; else sinceImprove++;
          score = s;
          path = moved;
        } else {
          sinceImprove++;
        }
      }
      if (!best || score < best.score) best = { score: score, path: path };
      if (best.score <= target) return best;
    }
    return best;
  }

  // Prüft, ob es eine Verbindung aller Paare gibt, die NICHT alle Felder füllt.
  // Rückgabe: 'clean' (jede Lösung füllt das Gitter), 'shortcut' (Abkürzung
  // gefunden) oder 'unknown' (Suchbudget überschritten).
  // `mode` steuert die Explorationsreihenfolge: 'greedy' probiert zielnahe
  // Wege zuerst (findet direkte Abkürzungen), 'anti' zielferne zuerst (findet
  // Abkürzungen mit weit ausholenden Wegen, z. B. um den Rand herum).
  function verifyOnlyFullSolutions(size, pairs, budget, mode) {
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

      var sign = mode === 'anti' ? -1 : 1;
      var ns = adj[head].slice().sort(function (x, y) {
        return sign * ((Math.abs(rowOf[x] - rowOf[target]) + Math.abs(colOf[x] - colOf[target])) -
          (Math.abs(rowOf[y] - rowOf[target]) + Math.abs(colOf[y] - colOf[target])));
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

  function defaultPairCount(size) {
    return Math.max(3, Math.round(size * 0.6));
  }

  // Bei wenigen Paaren ist ein vollständiger Beweis der Abkürzungsfreiheit
  // nicht mehr bezahlbar (der Suchraum explodiert). Stattdessen jagen mehrere
  // randomisierte Suchläufe gezielt nach Abkürzungen: Wird eine gefunden, ist
  // der Kandidat verworfen; überlebt er alle Läufe (oder wird die Suche sogar
  // erschöpft), gilt er als gut. Greedy- und Anti-Läufe wechseln sich ab, da
  // sie unterschiedliche Abkürzungsformen aufspüren.
  var HUNT_PLAN = ['greedy', 'anti', 'greedy', 'anti', 'greedy', 'anti'];
  var HUNT_BUDGET = 2500000;
  var OPTIMIZE_SLICE_MS = 200;
  var ESCALATE_AFTER_MS = 30000;

  // Resumierbare Suche: step() arbeitet ein Zeitscheibchen ab und gibt danach
  // die Kontrolle zurück, damit der Browser zwischendurch rendern kann.
  // Ergebnis über result() abfragen, sobald done() true liefert.
  function createSearch(size) {
    var baseTarget = defaultPairCount(size);
    var startTime = Date.now();
    var candidate = null;
    var huntIndex = 0;
    var result = null;

    function currentTarget() {
      var escalation = Math.floor((Date.now() - startTime) / ESCALATE_AFTER_MS);
      return baseTarget + escalation;
    }

    function step() {
      if (result) return;

      if (!candidate) {
        var target = currentTarget();
        var opt = optimizePath(size, target, Date.now() + OPTIMIZE_SLICE_MS);
        if (!opt || opt.score > target) return;
        var segments = cutPathForced(size, opt.path);
        var longEnough = segments.every(function (s) { return s.length >= 3; });
        if (segments.length < 2 || !longEnough) return;
        candidate = segmentsToPairs(segments);
        huntIndex = 0;
        return;
      }

      var verdict = verifyOnlyFullSolutions(
        size, shuffle(candidate.slice()), HUNT_BUDGET, HUNT_PLAN[huntIndex]);
      if (verdict === 'shortcut') {
        candidate = null;
      } else if (verdict === 'clean' || ++huntIndex >= HUNT_PLAN.length) {
        result = { size: size, pairs: candidate };
      }
    }

    return {
      step: step,
      done: function () { return result !== null; },
      result: function () { return result; }
    };
  }

  function generate(size) {
    var search = createSearch(size);
    while (!search.done()) search.step();
    return search.result();
  }

  function generateAsync(size, onDone) {
    var search = createSearch(size);
    function tick() {
      search.step();
      if (search.done()) {
        onDone(search.result());
      } else {
        window.setTimeout(tick, 0);
      }
    }
    window.setTimeout(tick, 0);
  }

  window.Arukone.PuzzleGenerator = {
    generate: generate,
    generateAsync: generateAsync,
    defaultPairCount: defaultPairCount,
    generateHamiltonianPath: generateHamiltonianPath,
    verifyOnlyFullSolutions: verifyOnlyFullSolutions,
    cutPathForced: cutPathForced,
    optimizePath: optimizePath
  };
})();
