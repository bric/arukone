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

  // Gewicht, mit dem Endpunkte am Rand bestraft werden. Hoch genug, damit die
  // Suche sie klar gegenüber Wandkanten und Knicken meidet, aber weich: Wenn
  // ein Rätsel ohne Rand-Endpunkte nicht erreichbar ist, gewinnt trotzdem der
  // beste Kandidat, statt dass die Erzeugung scheitert.
  var EDGE_END_WEIGHT = 25;

  function isBorderCell(size, c) {
    return c.row === 0 || c.row === size - 1 || c.col === 0 || c.col === size - 1;
  }

  function isCornerCell(size, c) {
    return (c.row === 0 || c.row === size - 1) && (c.col === 0 || c.col === size - 1);
  }

  // Kennzahlen der Lösungsform. Bei Voll-Lösungen sind immer alle Randzellen
  // belegt — entscheidend ist, ob Segmente LÄNGS der Wand laufen (lange
  // Wandkanten = Zwiebelringe, sofort erkennbar) oder sie nur kreuzen, und
  // wie oft sie abknicken (verwinkelt = schwer zu lesen).
  // edgeEnds zählt Endpunkte am Rand: Eine Randzelle hat nur 3 Nachbarn (in
  // der Ecke 2), der Pfadanfang ist dort also stark vorgezeichnet. Endpunkte
  // im Feldinneren lassen dem Spieler mehr Möglichkeiten offen.
  function shapeStats(size, segments) {
    var turns = 0, wallEdges = 0, cells = 0, minLen = Infinity;
    var edgeEnds = 0, cornerEnds = 0;
    function onWall(a, b) {
      return (a.row === 0 && b.row === 0) || (a.row === size - 1 && b.row === size - 1) ||
        (a.col === 0 && b.col === 0) || (a.col === size - 1 && b.col === size - 1);
    }
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      if (seg.length < minLen) minLen = seg.length;
      cells += seg.length;
      var ends = [seg[0], seg[seg.length - 1]];
      for (var e = 0; e < ends.length; e++) {
        if (isBorderCell(size, ends[e])) edgeEnds++;
        if (isCornerCell(size, ends[e])) cornerEnds++;
      }
      for (var i = 1; i < seg.length; i++) {
        if (onWall(seg[i - 1], seg[i])) wallEdges++;
        if (i < seg.length - 1) {
          var sameDir = (seg[i].row - seg[i - 1].row) === (seg[i + 1].row - seg[i].row) &&
            (seg[i].col - seg[i - 1].col) === (seg[i + 1].col - seg[i].col);
          if (!sameDir) turns++;
        }
      }
    }
    return {
      turns: turns, wallEdges: wallEdges, cells: cells, minLen: minLen,
      edgeEnds: edgeEnds, cornerEnds: cornerEnds
    };
  }

  function shapeCost(size, segments) {
    var st = shapeStats(size, segments);
    var cost = 3 * st.wallEdges - 2 * st.turns +
      EDGE_END_WEIGHT * st.edgeEnds + EDGE_END_WEIGHT * st.cornerEnds;
    if (st.minLen < 3) cost += 100000; // triviale Paare vermeiden
    return cost;
  }

  function difficultyScore(size, segments) {
    var st = shapeStats(size, segments);
    return (st.turns - st.wallEdges - 6 * st.edgeEnds - 6 * st.cornerEnds) / st.cells;
  }

  // Zufällige Hamiltonpfade sind kleinteilig gewunden und zerfallen in viele
  // straffe Segmente. Ein Hügelsteigen über Backbite-Züge formt den Pfad in
  // große Strukturen um, bis er in höchstens `target` Segmente zerfällt.
  // Bei gleicher Segmentzahl entscheidet die Lösungsform (shapeCost) —
  // sonst landet die Suche fast immer bei leicht erratbaren Zwiebelringen.
  function optimizePath(size, target, deadline) {
    var best = null;
    while (Date.now() < deadline) {
      var path = generateHamiltonianPath(size);
      var segs = cutPathForced(size, path);
      var score = segs.length;
      var cost = shapeCost(size, segs);
      var sinceImprove = 0;
      while (sinceImprove < 2000 && score > target && Date.now() < deadline) {
        var copy = path.map(function (c) { return { row: c.row, col: c.col }; });
        var moved = backbite(size, copy);
        if (!moved) {
          sinceImprove++;
          continue;
        }
        var movedSegs = cutPathForced(size, moved);
        var s = movedSegs.length;
        if (s < score || (s === score && shapeCost(size, movedSegs) <= cost)) {
          if (s < score) sinceImprove = 0; else sinceImprove++;
          score = s;
          cost = shapeCost(size, movedSegs);
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

  // Mutation auf Partitionsebene: Der Segmentschnitt eines Hamiltonpfads
  // liefert fast immer Zwiebelringe. Endzellen-Transfers zwischen benachbart
  // endenden Pfaden erhalten Gültigkeit (Abdeckung, Straffheit, Mindestlänge,
  // Segmentzahl), können die Lösung aber aus der Ringform herauswandern
  // lassen. Simulated-Annealing-artig: Form-Verbesserungen immer, kleine
  // Rückschritte selten annehmen.
  // `edgeAllowance` gibt an, wie viele Endpunkte am Rand geduldet werden.
  // Je strenger (0), desto schwerer sind die Rätsel — aber desto seltener
  // bestehen sie die Abkürzungsprüfung, weil sich Paare, die alle im Inneren
  // enden, meist auch komplett innen verbinden lassen (Randring bliebe leer).
  function mutatePartition(size, segments, moves, edgeAllowance) {
    var allowance = edgeAllowance || 0;
    var paths = segments.map(function (p) {
      return p.map(function (c) { return { row: c.row, col: c.col }; });
    });
    var owner = new Int8Array(size * size).fill(-1);
    for (var i = 0; i < paths.length; i++) {
      for (var j = 0; j < paths[i].length; j++) {
        owner[flat(size, paths[i][j])] = i;
      }
    }

    function eq(a, b) { return a.row === b.row && a.col === b.col; }

    function shapeJ() {
      var st = shapeStats(size, paths);
      var over = Math.max(0, st.edgeEnds - allowance);
      return 2 * st.turns - 3 * st.wallEdges -
        EDGE_END_WEIGHT * over - EDGE_END_WEIGHT * st.cornerEnds;
    }

    // Alle legalen Endzellen-Transfers aufzählen: Endzelle x von Pfad A geht
    // an das benachbarte Ende y von Pfad B. Dabei hört y auf, Endpunkt zu
    // sein, und A rückt seinen Endpunkt eine Zelle nach innen — genau so
    // wandern Endpunkte über das Brett.
    function legalMoves() {
      var result = [];
      for (var ai = 0; ai < paths.length; ai++) {
        var A = paths[ai];
        if (A.length <= 3) continue; // Mindestlänge halten
        for (var h = 0; h < 2; h++) {
          var fromHead = h === 0;
          var x = fromHead ? A[0] : A[A.length - 1];
          var ns = neighborsOf(size, x.row, x.col);
          for (var i = 0; i < ns.length; i++) {
            var bi = owner[flat(size, ns[i])];
            if (bi === -1 || bi === ai) continue;
            var B = paths[bi];
            var toHead;
            if (eq(B[0], ns[i])) toHead = true;
            else if (eq(B[B.length - 1], ns[i])) toHead = false;
            else continue;
            // Straffheit: x darf in B außer an y nichts berühren
            var taut = true;
            for (var n = 0; n < ns.length; n++) {
              if (owner[flat(size, ns[n])] === bi && !eq(ns[n], ns[i])) {
                taut = false;
                break;
              }
            }
            if (!taut) continue;
            result.push({ ai: ai, fromHead: fromHead, x: x, bi: bi, toHead: toHead, y: ns[i] });
          }
        }
      }
      return result;
    }

    // Blind gewürfelte Züge treffen selten den einen, der einen Rand-Endpunkt
    // auflöst. Darum bevorzugt solche Züge vorschlagen — angenommen werden sie
    // weiterhin nur, wenn die Zielfunktion zustimmt.
    function proposeMove() {
      var all = legalMoves();
      if (all.length === 0) return null;
      if (Math.random() < 0.85) {
        var targeted = [];
        for (var i = 0; i < all.length; i++) {
          if (isBorderCell(size, all[i].y)) targeted.push(all[i]);
        }
        if (targeted.length > 0) {
          return targeted[Math.floor(Math.random() * targeted.length)];
        }
      }
      return all[Math.floor(Math.random() * all.length)];
    }

    function apply(t) {
      if (t.fromHead) paths[t.ai].shift(); else paths[t.ai].pop();
      if (t.toHead) paths[t.bi].unshift(t.x); else paths[t.bi].push(t.x);
      owner[flat(size, t.x)] = t.bi;
    }

    function undo(t) {
      if (t.toHead) paths[t.bi].shift(); else paths[t.bi].pop();
      if (t.fromHead) paths[t.ai].unshift(t.x); else paths[t.ai].push(t.x);
      owner[flat(size, t.x)] = t.ai;
    }

    var J = shapeJ();
    for (var m = 0; m < moves; m++) {
      var t = proposeMove();
      if (!t) break; // keine legalen Züge mehr
      apply(t);
      var J2 = shapeJ();
      if (J2 >= J || Math.random() < 0.03) {
        J = J2;
      } else {
        undo(t);
      }
    }
    return paths;
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
  var ESCALATE_AFTER_MS = 90000;
  var ESCALATE_EDGE_MS = 6000;
  // Niedrig gehalten: Ein hoher Deckel lässt die DP an einzelnen Kandidaten
  // sekundenlang rechnen. Lieber früh als 'toocomplex' verwerfen und dafür
  // viel mehr Kandidaten prüfen — gemessen vervierfacht das den Durchsatz.
  var STATE_CAP = 150000;
  var MUTATE_MOVES = 5000;
  var BESTOF_EXTRA_MS = 10000;
  var BESTOF_MIN_CANDIDATES = 6;
  var BESTOF_STAGNATION_MS = 3000;

  // Endpunkte am Rand sind das stärkste Schwierigkeits-Leck: Eine Randzelle
  // hat nur 3 Nachbarn, eine Ecke 2 — der Anfang liegt dort auf der Hand.
  // Ganz ohne Rand-Endpunkte geht es allerdings nicht: Wenn kein Pfad am Rand
  // endet, lassen sich die Paare praktisch immer im Inneren verbinden und der
  // Randring bleibt frei — solche Rätsel sind also abkürzbar und fallen durch
  // die Prüfung. Darum wird nicht auf 0 gezielt, sondern auf ein erreichbares
  // Minimum: Sobald ein bewiesen sauberer Kandidat das Ziel erreicht, gewinnt
  // er sofort; sonst gewinnt nach Ablauf des Fensters der beste Fund.
  function edgeEndGoal(pairCount) {
    return Math.max(1, Math.round(pairCount / 3));
  }

  // Resumierbare Suche: step() arbeitet ein Häppchen ab und gibt die
  // Kontrolle zurück, damit der Browser zwischendurch rendern kann.
  // Bewiesen saubere Kandidaten werden gesammelt (Best-of-N nach
  // Schwierigkeits-Score), damit nicht das erstbeste, womöglich langweilige
  // Rätsel gewinnt.
  function createSearch(size) {
    var baseTarget = defaultPairCount(size);
    var startTime = Date.now();
    var candidate = null;
    var candidateSegments = null;
    var huntIndex = 0;
    var exact = null;
    var best = null;
    var cleanCount = 0;
    var firstCleanAt = 0;
    var lastImproveAt = 0;
    var frozenTarget = null;
    var frozenAllowance = null;
    var result = null;

    // Die Paarzahl wird nur gelockert, solange noch gar kein brauchbares
    // Rätsel gefunden ist. Sobald eines vorliegt, bleibt sie eingefroren —
    // die Zeit im Auswahlfenster darf das Rätsel nicht leichter machen.
    function currentTarget() {
      if (frozenTarget !== null) return frozenTarget;
      var escalation = Math.floor((Date.now() - startTime) / ESCALATE_AFTER_MS);
      return baseTarget + escalation;
    }

    // Solange nichts Sauberes gefunden ist, wird das Randziel schrittweise
    // gelockert. Lieber ein Endpunkt am Rand als endloses Warten — und
    // lieber das, als die Paarzahl zu erhöhen (darum lockert diese Schraube
    // deutlich früher als die Paarzahl).
    function currentAllowance() {
      if (frozenAllowance !== null) return frozenAllowance;
      var steps = Math.floor((Date.now() - startTime) / ESCALATE_EDGE_MS);
      // Höchstens die Hälfte der Endpunkte darf am Rand landen; darüber
      // hinaus zu lockern würde nichts mehr beschleunigen.
      return Math.min(steps, currentTarget());
    }

    // Rangfolge unter bewiesen sauberen Kandidaten: zuerst möglichst wenige
    // Endpunkte am Rand (Ecken zählen doppelt), erst danach die Verwinkelung.
    function acceptClean() {
      var st = shapeStats(size, candidateSegments);
      var found = {
        pairs: candidate,
        edgePenalty: st.edgeEnds + st.cornerEnds,
        score: difficultyScore(size, candidateSegments)
      };
      if (!best || found.edgePenalty < best.edgePenalty ||
        (found.edgePenalty === best.edgePenalty && found.score > best.score)) {
        best = found;
        lastImproveAt = Date.now();
      }
      cleanCount++;
      if (!firstCleanAt) {
        firstCleanAt = Date.now();
        frozenTarget = found.pairs.length;
        frozenAllowance = currentAllowance();
      }
      candidate = null;
    }

    function step() {
      if (result) return;

      // Fertig, sobald das Ziel erreicht ist. Sonst weitersuchen, bis das
      // Fenster abläuft oder sich nichts mehr verbessert (kleine Bretter
      // erreichen das Ziel nie — dort ist im Inneren schlicht zu wenig Platz).
      if (best) {
        var stagnant = cleanCount >= BESTOF_MIN_CANDIDATES &&
          Date.now() - lastImproveAt >= BESTOF_STAGNATION_MS;
        if (best.edgePenalty <= edgeEndGoal(best.pairs.length) || stagnant ||
          Date.now() - firstCleanAt >= BESTOF_EXTRA_MS) {
          result = { size: size, pairs: best.pairs };
          return;
        }
      }

      if (!candidate) {
        var target = currentTarget();
        var opt = optimizePath(size, target, Date.now() + OPTIMIZE_SLICE_MS);
        if (!opt || opt.score > target) return;
        var segments = cutPathForced(size, opt.path);
        var longEnough = segments.every(function (s) { return s.length >= 3; });
        if (segments.length < 2 || !longEnough) return;
        segments = mutatePartition(size, segments, MUTATE_MOVES, currentAllowance());
        candidate = segmentsToPairs(segments);
        candidateSegments = segments;
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
          acceptClean();
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
          acceptClean();
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

  // Pro Timer-Tick so viele Schritte wie in dieses Zeitbudget passen. Ein
  // Schritt je Tick wäre verschwenderisch: setTimeout kostet einige
  // Millisekunden, und ein Kandidat besteht aus hunderten kurzen Schritten.
  var TICK_BUDGET_MS = 40;

  function generateAsync(size, onDone) {
    var search = createSearch(size);
    function tick() {
      var deadline = Date.now() + TICK_BUDGET_MS;
      do {
        search.step();
      } while (!search.done() && Date.now() < deadline);
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
    optimizePath: optimizePath,
    mutatePartition: mutatePartition,
    shapeStats: shapeStats,
    difficultyScore: difficultyScore
  };
})();
