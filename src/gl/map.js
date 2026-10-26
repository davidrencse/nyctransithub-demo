// WebGL2 subway map: glowing route ribbons on a tilted dot-grid ground plane,
// station markers, and trains running between stops.

import { ROUTE_GROUPS } from '../data/subway.js';
import { perspective, lookAt, multiply, invert, transform } from './math.js';

const FOV = (34 * Math.PI) / 180;
const SMOOTH_STEPS = 10;
const TRAIN_SPACING = 0.32; // world units between trains on a line
const TRAIN_SPEED = 0.11; // world units per second
const DWELL = 0.7; // seconds at each stop
const DELAY_FACTOR = 0.4;

const HOME = { tx: 0.18, tz: 0.05, dist: 4.1, pitch: 0.9, yaw: -0.32 };

const GROUND_VS = `#version 300 es
in vec2 aPos;
uniform mat4 uViewProj;
out vec2 vWorld;
void main() {
  vWorld = aPos;
  gl_Position = uViewProj * vec4(aPos.x, 0.0, aPos.y, 1.0);
}`;

const GROUND_FS = `#version 300 es
precision highp float;
in vec2 vWorld;
uniform vec2 uTarget;
uniform vec2 uCursor;
uniform float uCursorOn;
uniform vec3 uAccent;
out vec4 outColor;
void main() {
  float spacing = 0.045;
  vec2 cell = fract(vWorld / spacing) - 0.5;
  float d = length(cell) * spacing;
  float aa = fwidth(d) * 1.2;
  float dot = 1.0 - smoothstep(0.0028 - aa, 0.0028 + aa, d);
  float fade = 1.0 - smoothstep(0.8, 3.0, length(vWorld - uTarget));
  float near = uCursorOn * exp(-pow(length(vWorld - uCursor) / 0.38, 2.0));
  vec3 col = mix(vec3(1.0), uAccent, near);
  float a = dot * fade * (0.11 + near * 0.32) + near * 0.035;
  outColor = vec4(col * a, a);
}`;

const LINE_VS = `#version 300 es
in vec2 aPos;
in vec2 aNormal;
in float aSide;
in float aAlong;
in float aTotal;
in vec3 aColor;
in float aGroup;
uniform mat4 uViewProj;
uniform float uWidth;
out float vSide;
out float vAlong;
out float vTotal;
out vec3 vColor;
out float vGroup;
void main() {
  vec2 p = aPos + aNormal * aSide * uWidth;
  vSide = aSide; vAlong = aAlong; vTotal = aTotal; vColor = aColor; vGroup = aGroup;
  gl_Position = uViewProj * vec4(p.x, 0.0, p.y, 1.0);
}`;

const LINE_FS = `#version 300 es
precision highp float;
in float vSide;
in float vAlong;
in float vTotal;
in vec3 vColor;
in float vGroup;
uniform float uTime;
uniform float uReveal;
uniform float uFocus;
uniform float uGlow;
uniform float uColorMix;
uniform float uDelayed[16];
out vec4 outColor;
void main() {
  float head = uReveal * vTotal;
  if (vAlong > head) discard;
  float d = abs(vSide);
  float a = uGlow > 0.5 ? exp(-d * d * 5.5) * 0.16 : 1.0 - smoothstep(0.55, 1.0, d);
  float headGlow = (1.0 - step(1.0, uReveal)) * smoothstep(0.25, 0.0, head - vAlong) * 1.5;
  float comet = pow(fract(vAlong * 0.55 - uTime * 0.12), 28.0) * 0.9;
  int g = int(vGroup + 0.5);
  float delayed = uDelayed[g];
  float breathe = mix(1.0, 0.55 + 0.45 * sin(uTime * 3.2), delayed);
  bool focused = abs(vGroup - uFocus) < 0.5;
  float dim = (uFocus < 0.0 || focused) ? 1.0 : 0.1;
  // Monochrome by default; a focused line shows its real route colour.
  float grey = 0.66 + 0.34 * dot(vColor, vec3(0.3, 0.55, 0.15));
  vec3 base = mix(vec3(grey), vColor, focused ? uColorMix : 0.0);
  vec3 col = base * (1.0 + comet + headGlow) * breathe;
  float alpha = a * dim;
  outColor = vec4(col * alpha, alpha);
}`;

const POINT_VS = `#version 300 es
in vec2 aPos;
in vec3 aColor;
in float aSize;
in float aMask;
uniform mat4 uViewProj;
uniform float uPx;
uniform float uFocus;
uniform float uReveal;
uniform float uColorMix;
out vec3 vColor;
out float vDim;
void main() {
  gl_Position = uViewProj * vec4(aPos.x, 0.003, aPos.y, 1.0);
  gl_PointSize = clamp(aSize * uPx / gl_Position.w, 2.0, 48.0);
  int mask = int(aMask + 0.5);
  bool on = uFocus < 0.0 || ((mask >> int(uFocus + 0.5)) & 1) == 1;
  vColor = mix(vec3(0.85), aColor, uFocus >= 0.0 && on ? uColorMix : 0.0);
  vDim = (on ? 1.0 : 0.12) * smoothstep(0.75, 1.0, uReveal);
}`;

const STATION_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vDim;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float edge = 1.0 - smoothstep(0.78, 1.0, r);
  float ring = smoothstep(0.42, 0.58, r);
  vec3 col = mix(vec3(0.03), vec3(0.94), ring);
  float a = edge * vDim;
  outColor = vec4(col * a, a);
}`;

const TRAIN_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vDim;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.16, 0.3, r);
  float halo = exp(-r * r * 9.0) * 0.5;
  vec3 col = mix(vColor * 1.2, vec3(1.0), core * 0.8);
  float a = max(core, halo) * vDim;
  outColor = vec4(col * a, a);
}`;

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i).name.replace('[0]', '');
    loc[name] = gl.getUniformLocation(prog, name);
  }
  return { prog, loc };
}

// attribs: [name, size] in interleaved order
function makeVao(gl, prog, data, attribs, usage = gl.STATIC_DRAW) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  const stride = attribs.reduce((s, [, n]) => s + n, 0) * 4;
  let offset = 0;
  for (const [name, size] of attribs) {
    const loc = gl.getAttribLocation(prog, name);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    }
    offset += size * 4;
  }
  gl.bindVertexArray(null);
  return { vao, buf };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Dark route colours (8 Av blue, Nassau brown) vanish on black; lift them.
function displayColor(hex) {
  let c = hexToRgb(hex);
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  if (lum < 0.3) c = c.map((v) => v + (1 - v) * 0.28);
  return c;
}

function catmullRom(points, steps) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(i + 2, n - 1)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0.x, p1.x, p2.x, p3.x), f(p0.z, p1.z, p2.z, p3.z)]);
    }
  }
  out.push([points[n - 1].x, points[n - 1].z]);
  return out;
}

function buildPath(line, groupIndex) {
  const pts = catmullRom(line.points, SMOOTH_STEPS);
  const along = [0];
  for (let i = 1; i < pts.length; i++) {
    along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const normals = pts.map((_, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  });
  return {
    line, groupIndex, pts, along, normals,
    total: along[along.length - 1],
    stopS: line.points.map((_, i) => along[i * SMOOTH_STEPS]),
    color: displayColor(line.color),
  };
}

function samplePath(path, s) {
  const { along, pts, normals } = path;
  let lo = 0, hi = along.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (along[mid] <= s) lo = mid; else hi = mid;
  }
  const t = (s - along[lo]) / (along[hi] - along[lo] || 1);
  return [
    pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t,
    pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t,
    normals[lo][0], normals[lo][1],
  ];
}

export function createTransitMap(canvas, { lines, stations, labels = [], onHover, onSelect, reducedMotion }) {
  const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error('WebGL2 unavailable');

  const groupIndex = Object.fromEntries(ROUTE_GROUPS.map((g, i) => [g.id, i]));
  const paths = lines.map((l) => buildPath(l, groupIndex[l.group]));

  // ---- ground
  const ground = compile(gl, GROUND_VS, GROUND_FS);
  const G = 6;
  const groundGeo = makeVao(gl, ground.prog, new Float32Array([-G, -G, G, -G, -G, G, G, G]), [['aPos', 2]]);

  // ---- route ribbons
  const line = compile(gl, LINE_VS, LINE_FS);
  const lv = [], li = [];
  for (const p of paths) {
    const base = lv.length / 11;
    p.pts.forEach((pt, i) => {
      for (const side of [-1, 1]) {
        lv.push(pt[0], pt[1], p.normals[i][0], p.normals[i][1], side, p.along[i], p.total, ...p.color, p.groupIndex);
      }
      if (i > 0) {
        const a = base + (i - 1) * 2;
        li.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
  }
  const lineGeo = makeVao(gl, line.prog, new Float32Array(lv), [
    ['aPos', 2], ['aNormal', 2], ['aSide', 1], ['aAlong', 1], ['aTotal', 1], ['aColor', 3], ['aGroup', 1],
  ]);
  gl.bindVertexArray(lineGeo.vao);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(li), gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // ---- stations
  const stationProg = compile(gl, POINT_VS, STATION_FS);
  const sv = [];
  for (const st of stations) {
    let mask = 0;
    for (const id of st.lines) mask |= 1 << groupIndex[lines.find((l) => l.id === id).group];
    st.mask = mask;
    const transfer = st.lines.length > 1;
    sv.push(st.x, st.z, 1, 1, 1, transfer ? 0.038 : 0.026, mask);
  }
  const stationGeo = makeVao(gl, stationProg.prog, new Float32Array(sv), [['aPos', 2], ['aColor', 3], ['aSize', 1], ['aMask', 1]]);

  // ---- trains
  const trainProg = compile(gl, POINT_VS, TRAIN_FS);
  const trains = [];
  for (const p of paths) {
    const count = Math.max(2, Math.round(p.total / TRAIN_SPACING));
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const s = ((i + Math.random() * 0.6) / count) * p.total;
      trains.push({ path: p, s, dir, dwell: Math.random() * DWELL, next: nextStop(p, s, dir), speed: TRAIN_SPEED * (0.85 + Math.random() * 0.3) });
    }
  }
  const trainData = new Float32Array(trains.length * 7);
  const trainGeo = makeVao(gl, trainProg.prog, trainData, [['aPos', 2], ['aColor', 3], ['aSize', 1], ['aMask', 1]], gl.DYNAMIC_DRAW);

  function nextStop(p, s, dir) {
    const st = p.stopS;
    if (dir > 0) { const i = st.findIndex((v) => v > s); return i < 0 ? st.length - 1 : i; }
    for (let i = st.length - 1; i >= 0; i--) if (st[i] < s) return i;
    return 0;
  }

  // ---- state
  const cam = { ...HOME }, goal = { ...HOME };
  const delayed = new Float32Array(16);
  let focus = -1, colorMix = 0, reveal = reducedMotion ? 1 : 0, time = 0, active = true, raf = 0, last = performance.now();
  let viewProj = new Float32Array(16), invViewProj = null, shift = 0;
  let width = 1, height = 1, dpr = 1;
  const cursor = { x: 0, z: 0, on: 0, onGoal: 0, sx: 0, sy: 0 };
  const parallax = { x: 0, y: 0 };
  let drag = null, hovered = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth; height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    shift = width > 900 ? 0.3 : 0;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function updateCamera() {
    const yaw = cam.yaw + parallax.x * 0.06 + (reducedMotion ? 0 : Math.sin(time * 0.07) * 0.05);
    const pitch = cam.pitch + parallax.y * 0.04;
    // Portrait screens see less of the city across; pull back to compensate.
    const aspect = width / height, dist = cam.dist * (aspect < 1 ? 1 / Math.sqrt(aspect) : 1);
    const eye = [
      cam.tx + dist * Math.sin(yaw) * Math.cos(pitch),
      dist * Math.sin(pitch),
      cam.tz + dist * Math.cos(yaw) * Math.cos(pitch),
    ];
    const proj = perspective(FOV, width / height, 0.05, 40, shift);
    viewProj = multiply(proj, lookAt(eye, [cam.tx, 0, cam.tz], [0, 1, 0]));
    invViewProj = invert(viewProj);
  }

  function toScreen(x, z) {
    const c = transform(viewProj, x, 0, z);
    if (c[3] <= 0) return null;
    return [((c[0] / c[3]) * 0.5 + 0.5) * width, (1 - ((c[1] / c[3]) * 0.5 + 0.5)) * height];
  }

  function toGround(px, py) {
    if (!invViewProj) return null;
    const nx = (px / width) * 2 - 1, ny = 1 - (py / height) * 2;
    const a = transform(invViewProj, nx, ny, -1), b = transform(invViewProj, nx, ny, 1);
    const p0 = a.map((v) => v / a[3]), p1 = b.map((v) => v / b[3]);
    const t = p0[1] / (p0[1] - p1[1]);
    if (!(t > 0)) return null;
    return [p0[0] + (p1[0] - p0[0]) * t, p0[2] + (p1[2] - p0[2]) * t];
  }

  function stepTrains(dt) {
    for (let i = 0; i < trains.length; i++) {
      const t = trains[i], p = t.path;
      if (t.dwell > 0) t.dwell -= dt;
      else {
        t.s += t.dir * t.speed * dt * (delayed[p.groupIndex] ? DELAY_FACTOR : 1);
        const target = p.stopS[t.next];
        if ((t.dir > 0 && t.s >= target) || (t.dir < 0 && t.s <= target)) {
          t.s = target;
          t.dwell = DWELL;
          const last = p.stopS.length - 1;
          if (t.dir > 0) { if (t.next >= last) { t.dir = -1; t.next = last - 1; } else t.next++; }
          else if (t.next <= 0) { t.dir = 1; t.next = 1; } else t.next--;
        }
      }
      const [x, z, nx, nz] = samplePath(p, t.s);
      const o = i * 7, off = 0.014 * t.dir; // each direction runs on its own track
      trainData[o] = x + nx * off; trainData[o + 1] = z + nz * off;
      trainData[o + 2] = p.color[0]; trainData[o + 3] = p.color[1]; trainData[o + 4] = p.color[2];
      trainData[o + 5] = 0.05; trainData[o + 6] = 1 << p.groupIndex;
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    if (reveal < 1) reveal = Math.min(1, reveal + dt / 2.6);
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of Object.keys(goal)) cam[key] += (goal[key] - cam[key]) * k;
    cursor.on += (cursor.onGoal - cursor.on) * k;
    colorMix += ((focus >= 0 ? 1 : 0) - colorMix) * k;
    updateCamera();
    stepTrains(dt);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(ground.prog);
    gl.uniformMatrix4fv(ground.loc.uViewProj, false, viewProj);
    gl.uniform2f(ground.loc.uTarget, cam.tx, cam.tz);
    gl.uniform2f(ground.loc.uCursor, cursor.x, cursor.z);
    gl.uniform1f(ground.loc.uCursorOn, cursor.on);
    gl.uniform3f(ground.loc.uAccent, 1, 1, 1);
    gl.bindVertexArray(groundGeo.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(line.prog);
    gl.uniformMatrix4fv(line.loc.uViewProj, false, viewProj);
    gl.uniform1f(line.loc.uTime, time);
    gl.uniform1f(line.loc.uReveal, reveal);
    gl.uniform1f(line.loc.uFocus, focus);
    gl.uniform1fv(line.loc.uDelayed, delayed);
    gl.uniform1f(line.loc.uColorMix, colorMix);
    gl.bindVertexArray(lineGeo.vao);
    gl.blendFunc(gl.ONE, gl.ONE); // additive halo
    gl.uniform1f(line.loc.uGlow, 1);
    gl.uniform1f(line.loc.uWidth, 0.07);
    gl.drawElements(gl.TRIANGLES, li.length, gl.UNSIGNED_INT, 0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(line.loc.uGlow, 0);
    gl.uniform1f(line.loc.uWidth, 0.012);
    gl.drawElements(gl.TRIANGLES, li.length, gl.UNSIGNED_INT, 0);

    const px = (canvas.height * 0.5) / Math.tan(FOV / 2);
    for (const [prog, geo, count] of [[stationProg, stationGeo, stations.length], [trainProg, trainGeo, trains.length]]) {
      gl.useProgram(prog.prog);
      gl.uniformMatrix4fv(prog.loc.uViewProj, false, viewProj);
      gl.uniform1f(prog.loc.uPx, px);
      gl.uniform1f(prog.loc.uFocus, focus);
      gl.uniform1f(prog.loc.uReveal, reveal);
      gl.uniform1f(prog.loc.uColorMix, colorMix);
      gl.bindVertexArray(geo.vao);
      if (prog === trainProg) {
        gl.bindBuffer(gl.ARRAY_BUFFER, geo.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, trainData);
        gl.blendFunc(gl.ONE, gl.ONE);
      }
      gl.drawArrays(gl.POINTS, 0, count);
    }
    gl.bindVertexArray(null);

    for (const l of labels) {
      const s = toScreen(l.x, l.z);
      l.el.style.transform = s ? `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)` : 'translate(-999px, 0)';
      l.el.style.opacity = reveal < 1 ? reveal : '';
    }
    if (hovered && onHover) {
      const s = toScreen(hovered.x, hovered.z);
      if (s) onHover(hovered, s[0], s[1]);
    }
    if (active) raf = requestAnimationFrame(frame);
  }

  function pick(px, py, radius = 16) {
    let best = null, bestD = radius;
    for (const st of stations) {
      if (focus >= 0 && !((st.mask >> focus) & 1)) continue;
      const s = toScreen(st.x, st.z);
      if (!s) continue;
      const d = Math.hypot(s[0] - px, s[1] - py);
      if (d < bestD) { bestD = d; best = st; }
    }
    return best;
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // no hover or parallax on touch
    const [px, py] = local(e);
    parallax.x = (px / width) * 2 - 1;
    parallax.y = (py / height) * 2 - 1;
    const g = toGround(px, py);
    if (g) { cursor.x = g[0]; cursor.z = g[1]; cursor.onGoal = 1; }
    if (drag) {
      const now = toGround(px, py);
      if (now && drag.anchor) {
        goal.tx -= now[0] - drag.anchor[0];
        goal.tz -= now[1] - drag.anchor[1];
        cam.tx = goal.tx; cam.tz = goal.tz;
        updateCamera();
        drag.anchor = toGround(px, py);
      }
      drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      return;
    }
    const st = pick(px, py);
    if (st !== hovered) {
      hovered = st;
      canvas.style.cursor = st ? 'pointer' : 'grab';
      if (!st && onHover) onHover(null);
    }
  });
  canvas.addEventListener('pointerleave', () => {
    cursor.onGoal = 0;
    parallax.x = parallax.y = 0;
    if (hovered) { hovered = null; onHover && onHover(null); }
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return; // touch scrolls the page; use the zoom buttons
    const [px, py] = local(e);
    drag = { anchor: toGround(px, py), moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  const endDrag = (e) => {
    if (!drag && e.pointerType === 'mouse') return;
    const [px, py] = local(e);
    const wasClick = !drag || drag.moved < 4;
    drag = null;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    if (wasClick) {
      const st = pick(px, py, e.pointerType === 'mouse' ? 16 : 28); // fingers are less precise
      if (st && onSelect) onSelect(st, px, py);
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; });

  function setActive(on) {
    active = on;
    if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  setActive(true);

  function fitPoints(pts, minDist = 1.2) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    goal.tx = (x0 + x1) / 2; goal.tz = (z0 + z1) / 2;
    goal.dist = Math.max(minDist, Math.max(x1 - x0, z1 - z0) * 1.7);
  }

  return {
    stations,
    trainCount: trains.length,
    setActive,
    focusGroup(id) {
      focus = id == null ? -1 : groupIndex[id];
      if (focus < 0) { Object.assign(goal, HOME); return; }
      fitPoints(lines.filter((l) => l.group === id).flatMap((l) => l.points));
    },
    flyTo(st) {
      goal.tx = st.x; goal.tz = st.z; goal.dist = 1.1;
      hovered = st;
    },
    zoom(factor) { goal.dist = Math.min(7, Math.max(0.5, goal.dist * factor)); },
    reset() { focus = -1; Object.assign(goal, HOME); },
    setDelayed(groupIds) {
      delayed.fill(0);
      for (const id of groupIds) if (id in groupIndex) delayed[groupIndex[id]] = 1;
    },
    clearHover() { hovered = null; },
  };
}
