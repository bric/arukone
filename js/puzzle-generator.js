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

  // Frontier-DP: entscheidet EXAKT, ob eine Verbindung aller Paare existiert,
  // die mindestens ein Feld frei lässt ('shortcut'), oder ob jede Lösung das
  // Gitter füllt ('clean'). 'toocomplex', falls die Zustandsmenge das Limit
  // sprengt; 'nosolution', falls das Rätsel gar nicht lösbar ist.
  //
  // Zellen werden zeilenweise abgearbeitet; beim Besuch von Zelle v=(r,c)
  // werden ihre Kanten nach links und oben entschieden. Der obere Nachbar ist
  // danach vollständig bestimmt und wird finalisiert (Grad 0 = unbenutzt,
  // Grad 2 = Durchgang, Terminals brauchen Grad 1).
  //
  // Frontier-Slot-Zustände:
  //   DOT (0)  Zelle bisher Grad 0
  //   XX  (1)  Zelle Grad 2 (lokal abgeschlossen)
  //   NN  (2)  Zelle existiert nicht (virtuelle Zeile -1)
  //   LBL+i    offenes Pfadende, anderes Ende ist Terminal von Paar i
  //   MATE+j   offenes Pfadende, anderes Ende liegt in Frontier-Slot j
  // plus 1 Bit hasEmpty (eine unbenutzte Zelle ist bereits festgelegt).
  // Ein Zustand wird als Zahl zur Basis (3 + Paarzahl + Slotzahl) kodiert
  // und muss in ein Double passen. step() verarbeitet eine Zelle pro Aufruf,
  // damit der Browser zwischendurch rendern kann.
  var DOT = 0, XX = 1, NN = 2, LBL = 3;

  function createShortcutCheck(size, pairs, stateCap) {
    var n = size;
    var MATE = LBL + pairs.length;
    var BASE = MATE + n;
    var verdict = null;
    if (2 * Math.pow(BASE, n) >= 9007199254740992) verdict = 'toocomplex';

    var term = new Int8Array(n * n);
    for (var p = 0; p < pairs.length; p++) {
      term[pairs[p].endpointA.row * n + pairs[p].endpointA.col] = p + 1;
      term[pairs[p].endpointB.row * n + pairs[p].endpointB.col] = p + 1;
    }

    var pow = [1];
    for (var i = 1; i <= n; i++) pow[i] = pow[i - 1] * BASE;
    var HE = pow[n];

    function encode(slots, he) {
      var v = he ? HE : 0;
      for (var j = 0; j < n; j++) v += slots[j] * pow[j];
      return v;
    }
    function decode(v, slots) {
      var he = 0;
      if (v >= HE) { he = 1; v -= HE; }
      for (var j = 0; j < n; j++) {
        slots[j] = v % BASE;
        v = (v - slots[j]) / BASE;
      }
      return he;
    }

    // Finalisiert Slot j (Zelle verlässt die Frontier ohne weitere Kanten).
    // Rückgabe: -1 invalid, sonst 0/1 = neue unbenutzte Zelle.
    function finalizeSlot(slots, j, label) {
      var s = slots[j];
      if (s === NN) return 0;
      if (label) {
        if (s >= MATE) { slots[s - MATE] = LBL + (label - 1); return 0; }
        if (s >= LBL) return (s - LBL === label - 1) ? 0 : -1;
        return -1; // Terminal braucht Grad 1
      }
      if (s === DOT) return 1;
      if (s === XX) return 0;
      return -1; // offenes Ende darf nicht enden
    }

    var states = new Set();
    states.add(encode(new Array(n).fill(NN), 0));
    var slots = new Array(n);
    var work = new Array(n);
    var r = 0, c = 0;

    function processCell() {
      var vLabel = term[r * n + c];
      var uLabel = r > 0 ? term[(r - 1) * n + c] : 0;
      var lLabel = c > 0 ? term[r * n + c - 1] : 0;
      var next = new Set();
      var iter = states.values();
      for (var e = iter.next(); !e.done; e = iter.next()) {
        var he = decode(e.value, slots);
        var l = c > 0 ? slots[c - 1] : NN;
        var u = slots[c];

        for (var S = 0; S < 4; S++) {
          var useL = (S & 1) !== 0;
          var useU = (S & 2) !== 0;
          if (useL && (c === 0 || l === XX || l === NN)) continue;
          if (useU && (u === XX || u === NN)) continue;
          if (vLabel && useL && useU) continue; // Terminal hat Grad <= 1
          // Terminal links mit Grad 1 darf keine zweite Kante bekommen
          if (useL && lLabel && l !== DOT) continue;

          for (var j = 0; j < n; j++) work[j] = slots[j];
          var vState = DOT;
          var ok = true;

          if (useL) {
            if (l === DOT) {
              work[c - 1] = MATE + c;
              vState = MATE + (c - 1);
            } else if (l >= MATE) {
              var lp = l - MATE;
              work[c - 1] = XX;
              if (lp === c) {
                // l-Fragment endete in l und u: Ende wandert von l zu v
                vState = MATE + c;
              } else {
                work[lp] = MATE + c;
                vState = MATE + lp;
              }
            } else {
              work[c - 1] = XX;
              vState = l;
            }
          }

          if (useU) {
            // u bekommt die Kante zu v und wird damit finalisiert
            var uDegAfter = (u === DOT) ? 1 : 2;
            if (uLabel && uDegAfter !== 1) continue;
            if (!uLabel && uDegAfter === 1) continue;
            // Wohin zeigt das andere Ende des u-Fragments?
            var vEnd = (u === DOT) ? LBL + (uLabel - 1) : u;

            if (!useL) {
              // v ist neues offenes Ende des u-Fragments
              if (vEnd >= MATE) {
                work[vEnd - MATE] = MATE + c;
                vState = MATE + (vEnd - MATE);
              } else {
                vState = vEnd;
              }
            } else {
              // v hat beide Kanten: Fragmente von l und u verschmelzen
              var lEnd = vState;
              vState = XX;
              if (lEnd >= MATE && lEnd - MATE === c) {
                ok = false; // l- und u-Ende gehören zum selben Fragment: Zyklus
              } else if (lEnd >= MATE) {
                var lq = lEnd - MATE;
                if (vEnd >= MATE) {
                  var uq = vEnd - MATE;
                  if (uq === lq) ok = false; // Zyklus
                  else {
                    work[lq] = MATE + uq;
                    work[uq] = MATE + lq;
                  }
                } else {
                  work[lq] = vEnd; // Label wandert ans andere Ende
                }
              } else {
                if (vEnd >= MATE) work[vEnd - MATE] = lEnd;
                else if (lEnd !== vEnd) ok = false; // Paar-Labels müssen passen
              }
            }
            if (ok) {
              work[c] = vState;
              next.add(encode(work, he));
            }
            continue;
          }

          // keine U-Kante: u regulär finalisieren
          if (vState >= MATE && vState - MATE === c) {
            // l-Fragment endete in u; u muss jetzt als Terminal retiren,
            // das Fragmentende wird zum Label an v
            if (!uLabel || u < LBL) continue;
            work[c] = LBL + (uLabel - 1);
            next.add(encode(work, he));
            continue;
          }

          var add = finalizeSlot(work, c, uLabel);
          if (add < 0) continue;
          work[c] = vState;
          next.add(encode(work, (he || add) ? 1 : 0));
        }
      }
      states = next;
      if (states.size === 0) { verdict = 'nosolution'; return; }
      if (states.size > stateCap) { verdict = 'toocomplex'; return; }
      c++;
      if (c === n) { c = 0; r++; }
      if (r === n) finish();
    }

    function finish() {
      var found = false;
      var anyValid = false;
      var iter = states.values();
      for (var e = iter.next(); !e.done && !found; e = iter.next()) {
        var he = decode(e.value, slots);
        var valid = true;
        for (var j = 0; j < n && valid; j++) {
          var add = finalizeSlot(slots, j, term[(n - 1) * n + j]);
          if (add < 0) valid = false;
          else if (add > 0) he = 1;
        }
        if (valid) anyValid = true;
        if (valid && he) found = true;
      }
      verdict = found ? 'shortcut' : (anyValid ? 'clean' : 'nosolution');
    }

    return {
      step: function () { if (!verdict) processCell(); },
      done: function () { return verdict !== null; },
      verdict: function () { return verdict; }
    };
  }

  function hasShortcutSolution(size, pairs, stateCap) {
    var check = createShortcutCheck(size, pairs, stateCap);
    while (!check.done()) check.step();
    return check.verdict();
  }

  // Erzeugungsstrategie: Kandidaten mit wenigen Paaren bauen, dann beweisen,
  // dass jede Lösung das Gitter füllt. Zwei schnelle DFS-Jagden (zielnah und
  // zielfern) sortieren offensichtliche Abkürzungs-Kandidaten billig aus,
  // die Frontier-DP liefert anschließend den exakten Beweis. Nur bewiesen
  // saubere Rätsel werden akzeptiert.
  var HUNT_PLAN = ['greedy', 'anti'];
  var HUNT_BUDGET = 1500000;
  var OPTIMIZE_SLICE_MS = 200;
  var ESCALATE_AFTER_MS = 45000;
  var STATE_CAP = 400000;

  // Resumierbare Suche: step() arbeitet ein Häppchen ab und gibt die
  // Kontrolle zurück, damit der Browser zwischendurch rendern kann.
  function createSearch(size) {
    var baseTarget = defaultPairCount(size);
    var startTime = Date.now();
    var candidate = null;
    var huntIndex = 0;
    var exact = null;
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
        exact = null;
        return;
      }

      if (huntIndex < HUNT_PLAN.length) {
        var verdict = verifyOnlyFullSolutions(
          size, shuffle(candidate.slice()), HUNT_BUDGET, HUNT_PLAN[huntIndex]);
        if (verdict === 'shortcut') {
          candidate = null;
        } else if (verdict === 'clean') {
          result = { size: size, pairs: candidate };
        } else {
          huntIndex++;
        }
        return;
      }

      if (!exact) {
        exact = createShortcutCheck(size, candidate, STATE_CAP);
        return;
      }
      exact.step();
      if (exact.done()) {
        if (exact.verdict() === 'clean') {
          result = { size: size, pairs: candidate };
        } else {
          candidate = null;
        }
        exact = null;
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
    hasShortcutSolution: hasShortcutSolution,
    cutPathForced: cutPathForced,
    optimizePath: optimizePath
  };
})();
