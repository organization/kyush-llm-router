/**
 * snakeground.js
 * Canvas animation - particles flowing left-to-right with double sine wave motion
 */
(function () {
  "use strict";

  // --- Shape generation ---
  var EDGE_LEN = 14;   // fixed distance between connected nodes
  var NODE_RADIUS = 4;
  var STROKE_WIDTH = 1.5;
  var SHAPE_COLOR = "#3b82f6";

  var MIN_ANGLE = Math.PI / 4; // 45 degrees

  // get angles of all edges connected to nodeIdx
  function edgeAngles(nodeIdx, nodes, edges) {
    var angles = [];
    for (var i = 0; i < edges.length; i++) {
      var other = -1;
      if (edges[i][0] === nodeIdx) other = edges[i][1];
      else if (edges[i][1] === nodeIdx) other = edges[i][0];
      if (other >= 0) {
        angles.push(Math.atan2(
          nodes[other].y - nodes[nodeIdx].y,
          nodes[other].x - nodes[nodeIdx].x
        ));
      }
    }
    return angles;
  }

  // check if candidate angle respects MIN_ANGLE from all existing angles
  function angleOk(candidate, existing) {
    for (var i = 0; i < existing.length; i++) {
      var diff = Math.abs(candidate - existing[i]);
      // normalize to [0, PI]
      diff = diff % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < MIN_ANGLE) return false;
    }
    return true;
  }

  // pick a random angle that respects MIN_ANGLE, with retries
  function pickAngle(rng, existing) {
    for (var attempt = 0; attempt < 36; attempt++) {
      var a = rng() * Math.PI * 2;
      if (angleOk(a, existing)) return a;
    }
    // fallback: find largest gap and place in its center
    if (existing.length === 0) return rng() * Math.PI * 2;
    var sorted = existing.slice().sort(function (a, b) { return a - b; });
    var bestGap = 0, bestMid = sorted[0];
    for (var i = 0; i < sorted.length; i++) {
      var next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
      var gap = next - sorted[i];
      if (gap > bestGap) { bestGap = gap; bestMid = sorted[i] + gap / 2; }
    }
    return bestMid;
  }

  function generateShape(rng) {
    var nodeCount = rng() < 0.5 ? 3 : 4;
    var nodes = [{ x: 0, y: 0, filled: rng() < 0.5 }];
    var edges = [];

    for (var i = 1; i < nodeCount; i++) {
      var parent = Math.floor(rng() * i);
      var existing = edgeAngles(parent, nodes, edges);
      var angle = pickAngle(rng, existing);
      nodes.push({
        x: nodes[parent].x + Math.cos(angle) * EDGE_LEN,
        y: nodes[parent].y + Math.sin(angle) * EDGE_LEN,
        filled: rng() < 0.5,
      });
      edges.push([parent, i]);
    }

    // optionally add 1 extra edge (respecting min angle at both ends)
    if (nodeCount >= 3 && rng() < 0.4) {
      var a = Math.floor(rng() * nodeCount);
      var b = Math.floor(rng() * nodeCount);
      if (a !== b) {
        var dup = false;
        for (var k = 0; k < edges.length; k++) {
          if ((edges[k][0] === a && edges[k][1] === b) ||
              (edges[k][0] === b && edges[k][1] === a)) { dup = true; break; }
        }
        if (!dup) {
          var angA = Math.atan2(nodes[b].y - nodes[a].y, nodes[b].x - nodes[a].x);
          var angB = angA + Math.PI;
          if (angleOk(angA, edgeAngles(a, nodes, edges)) &&
              angleOk(angB, edgeAngles(b, nodes, edges))) {
            edges.push([a, b]);
          }
        }
      }
    }

    // center the shape around (0,0)
    var cx = 0, cy = 0;
    for (var j = 0; j < nodes.length; j++) { cx += nodes[j].x; cy += nodes[j].y; }
    cx /= nodes.length; cy /= nodes.length;
    for (var j = 0; j < nodes.length; j++) { nodes[j].x -= cx; nodes[j].y -= cy; }

    return { nodes: nodes, edges: edges };
  }

  // --- Drawing function ---
  function drawCustom(ctx, shape, location_x, location_y, rotate) {
    ctx.save();
    ctx.translate(location_x, location_y);
    ctx.rotate(rotate);

    ctx.strokeStyle = SHAPE_COLOR;
    ctx.fillStyle = SHAPE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;

    // draw edges
    for (var e = 0; e < shape.edges.length; e++) {
      var a = shape.nodes[shape.edges[e][0]];
      var b = shape.nodes[shape.edges[e][1]];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // draw nodes — clear edge lines behind hollow circles first
    for (var n = 0; n < shape.nodes.length; n++) {
      var nd = shape.nodes[n];
      if (!nd.filled) {
        // erase the area behind the hollow circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, NODE_RADIUS + STROKE_WIDTH / 2, 0, Math.PI * 2);
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, NODE_RADIUS, 0, Math.PI * 2);
      if (nd.filled) {
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // --- Seeded RNG (mulberry32) ---
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Global wave function: y is a function of x and global time ---
  // All particles on the same x get the same y => they form a visible snake
  function waveY(x, time, opts, baseY) {
    var sin1 = Math.sin(x * opts.sinFrequency1 + time * opts.sinDrift1) * opts.sinAmplitude1;
    var sin2 = Math.sin(x * opts.sinFrequency2 + time * opts.sinDrift2) * opts.sinAmplitude2;
    return baseY + sin1 + sin2;
  }

  // Derivative of waveY w.r.t. x (for rotation / tangent direction)
  function waveDY(x, time, opts) {
    var dy =
      Math.cos(x * opts.sinFrequency1 + time * opts.sinDrift1) * opts.sinAmplitude1 * opts.sinFrequency1 +
      Math.cos(x * opts.sinFrequency2 + time * opts.sinDrift2) * opts.sinAmplitude2 * opts.sinFrequency2;
    return dy;
  }

  // --- Default options ---
  var defaults = {
    seed: null,           // null = use current wall clock time
    timeScale: 0.06,      // convert wall-clock milliseconds into wave time
    particleSpacing: 60,  // px between particles (determines count from width)
    speed: 0.3,           // horizontal px per frame
    sinAmplitude1: 25,   // small sine amplitude (px)
    sinFrequency1: 0.002, // small sine spatial frequency (per px)
    sinDrift1: 0.002,     // small sine time drift speed
    sinAmplitude2: 50,   // large sine amplitude (px)
    sinFrequency2: 0.0009, // large sine spatial frequency (per px)
    sinDrift2: 0.0005,    // large sine time drift speed
    pageHeight: 0,        // full scrollable page height (0 = auto from canvas)
  };

  // --- Particle class ---
  function Particle(canvas, rng, opts, index, pageHeight) {
    this.canvas = canvas;
    this.opts = opts;
    this.pageHeight = pageHeight;
    this.shape = generateShape(rng);
    var count = Math.max(1, Math.floor(canvas.width / opts.particleSpacing));
    var spacing = canvas.width / count;
    this.baseX = index * spacing;
    this.phase1 = rng() * Math.PI * 2;
    this.phase2 = rng() * Math.PI * 2;
  }

  Particle.prototype.update = function (time) {
    var opts = this.opts;
    var wrapWidth = this.canvas.width + 40;
    var travel = time * opts.speed;

    // absolute horizontal position from wall-clock time so remounts do not reset the pattern
    this.x = ((this.baseX + travel) % wrapWidth + wrapWidth) % wrapWidth - 20;

    // y from global wave function — baseY is center of canvas (viewport)
    this.y = waveY(this.x, time + this.phase1, opts, this.canvas.height * 0.5);

    // rotation = tangent direction of the wave at this x
    var dy = waveDY(this.x, time + this.phase2, opts);
    this.rotate = Math.atan2(dy, 1);

  };

  Particle.prototype.draw = function (ctx) {
    drawCustom(ctx, this.shape, this.x, this.y, this.rotate);
  };

  // --- Main controller ---
  function Snakeground(canvas, userOpts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = Object.assign({}, defaults, userOpts);
    this.particles = [];
    this.running = false;
    this.rafId = null;
    this.seed = typeof this.opts.seed === "number" ? this.opts.seed : Date.now();
    this._resize();
    this._initParticles();
    this._bindResize();
    this.start();
  }

  Snakeground.prototype._getPageHeight = function () {
    return this.opts.pageHeight || this.canvas.height;
  };

  Snakeground.prototype._resize = function () {
    var parent = this.canvas.parentElement || document.body;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  };

  Snakeground.prototype._bindResize = function () {
    var self = this;
    var timer;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        self._resize();
      }, 150);
    });
  };

  Snakeground.prototype._initParticles = function () {
    var rng = mulberry32(this.seed);
    var count = Math.max(1, Math.floor(this.canvas.width / this.opts.particleSpacing));
    var ph = this._getPageHeight();
    var spacing = this.canvas.width / count;
    var globalOffset = rng() * spacing;
    for (var i = 0; i < count; i++) {
      var particle = new Particle(this.canvas, rng, this.opts, i, ph);
      particle.baseX += globalOffset;
      this.particles.push(particle);
    }
  };

  Snakeground.prototype._loop = function () {
    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    var time = (Date.now() + this.seed) * this.opts.timeScale;
    for (var i = 0; i < this.particles.length; i++) {
      this.particles[i].update(time);
      this.particles[i].draw(ctx);
    }

    if (this.running) {
      this.rafId = requestAnimationFrame(this._loop.bind(this));
    }
  };

  Snakeground.prototype.start = function () {
    if (!this.running) {
      this.running = true;
      this._loop();
    }
  };

  Snakeground.prototype.stop = function () {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  Snakeground.prototype.setPageHeight = function (h) {
    this.opts.pageHeight = h;
    for (var i = 0; i < this.particles.length; i++) {
      this.particles[i].pageHeight = h;
    }
  };

  // --- Public API ---
  window.Snakeground = Snakeground;
})();
