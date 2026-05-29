#!/usr/bin/env python3
"""Deterministic builder for Diagram 3 (interaction modes). Emits the 16:9 master SVG.
Spec: diagram-3_interaction-modes_spec_v1.md. Engine-true values from ui/app.js.
Run: python3 diagram-3_build.py  ->  diagram-3_interaction-modes_v2.svg"""
import math, random

PANELS = ["DRIFT", "SWIRL", "PUSH", "ATTRACT", "RETURN"]
SUBS = {"DRIFT": "turbulence, always on", "SWIRL": "no button", "PUSH": "left click",
        "ATTRACT": "right click", "RETURN": "decays back · wake"}
PX = [64, 369.5, 675, 980.5, 1286]   # panel x origins
PY, PW, PH = 300, 250, 180
CX, CY = 125, 90                      # cursor (panel-local)
R, MAXLEN = 88.0, 20.0
XS = [32, 69, 106, 143, 180, 217]
YS = [30, 72, 114, 156]

def arrow(x1, y1, x2, y2, op=1.0, w=1.4):
    return (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="#8fb5e8" stroke-width="{w}" opacity="{op}" marker-end="url(#arrow)"/>')

def pt(x, y, r=3.0):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="url(#skyPt)"/>'

def panel_body(mode):
    random.seed(42)
    g = []
    # falloff ring + cursor for the three cursor modes
    if mode in ("SWIRL", "PUSH", "ATTRACT"):
        g.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="#6b665e" '
                 f'stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>')
    for y in YS:
        for x in XS:
            if mode == "DRIFT":
                ang = math.sin(x * 0.06) * 1.2 + math.cos(y * 0.07) * 1.2
                vx, vy = math.cos(ang) * 8, math.sin(ang) * 8
                g.append(pt(x, y)); g.append(arrow(x, y, x + vx, y + vy, op=0.8))
            elif mode == "RETURN":
                a = random.random() * 6.2832
                rad = 10 + random.random() * 16
                dx, dy = math.cos(a) * rad, math.sin(a) * rad   # displaced offset
                hx, hy = x, y                                   # home
                px, py = x + dx, y + dy
                g.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="2" fill="#6b665e"/>')   # home
                g.append(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{hx:.1f}" y2="{hy:.1f}" '
                         f'stroke="#6b665e" stroke-width="0.9" stroke-dasharray="3 3" opacity="0.7"/>')
                g.append(pt(px, py))
                g.append(arrow(px, py, px + (hx - px) * 0.55, py + (hy - py) * 0.55, op=0.85))
            else:  # SWIRL / PUSH / ATTRACT
                dx, dy = x - CX, y - CY
                dist = math.hypot(dx, dy)
                g.append(pt(x, y))
                if 6 < dist < R:
                    fo = 1 - dist / R
                    if mode == "PUSH":
                        ux, uy = dx / dist, dy / dist
                    elif mode == "ATTRACT":
                        ux, uy = -dx / dist, -dy / dist
                    else:  # SWIRL: tangential 25 + inward 6
                        tx, ty = -dy / dist, dx / dist
                        ix, iy = -dx / dist, -dy / dist
                        cx_, cy_ = tx * 25 + ix * 6, ty * 25 + iy * 6
                        m = math.hypot(cx_, cy_)
                        ux, uy = cx_ / m, cy_ / m
                    L = fo * MAXLEN
                    g.append(arrow(x, y, x + ux * L, y + uy * L, op=0.95))
    if mode in ("SWIRL", "PUSH", "ATTRACT"):
        g.append(f'<circle cx="{CX}" cy="{CY}" r="6" fill="none" stroke="#78b4ff" stroke-width="1.6"/>')
        g.append(f'<circle cx="{CX}" cy="{CY}" r="1.8" fill="#78b4ff"/>')
    return "\n      ".join(g)

panels_svg = []
for i, mode in enumerate(PANELS):
    x = PX[i]
    panels_svg.append(f'''  <svg x="{x}" y="{PY}" width="{PW}" height="{PH}" viewBox="0 0 {PW} {PH}">
    <rect x="0" y="0" width="{PW}" height="{PH}" fill="#0a0a0b"/>
      {panel_body(mode)}
  </svg>
  <rect x="{x}" y="{PY}" width="{PW}" height="{PH}" fill="none" stroke="#2a2a30" stroke-width="1.5"/>
  <text x="{x+PW/2:.1f}" y="505" fill="#ece8df" font-size="18" font-weight="300" text-anchor="middle" letter-spacing="1">{mode}</text>
  <text x="{x+PW/2:.1f}" y="528" fill="#6b665e" font-size="12.5" text-anchor="middle" font-family="ui-monospace,'SF Mono',Menlo,monospace">{SUBS[mode]}</text>''')
panels_svg = "\n".join(panels_svg)

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<!-- Pointfield - Diagram 3: interaction modes (v1, 2026-05-29). Generated, seed 42.
     Spec: launch/diagram-3_interaction-modes_spec_v1.md. Engine-true (ui/app.js). 16:9 master. Not published. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#8fb5e8"/>
    </marker>
    <radialGradient id="skyPt" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8fb5e8" stop-opacity="1"/>
      <stop offset="60%" stop-color="#8fb5e8" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#8fb5e8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="1600" height="900" fill="#0a0a0b"/>

  <text x="64" y="66" fill="#6b665e" font-size="14" letter-spacing="3" font-family="ui-monospace,'SF Mono',Menlo,monospace">POINTFIELD — INTERACTION</text>
  <text x="64" y="150" fill="#ece8df" font-size="46" font-weight="200" letter-spacing="-1.5">How the field moves</text>
  <text x="64" y="192" fill="#9a948a" font-size="20" font-weight="300">The field always drifts. The cursor swirls, pushes, or pulls the points near it, and they settle back.</text>

{panels_svg}

  <!-- MECHANISM card -->
  <rect x="64" y="596" width="700" height="186" fill="#0f0f12" stroke="#1d1d20" stroke-width="1"/>
  <text x="86" y="626" fill="#4d7fe0" font-size="13" letter-spacing="2.5" font-family="ui-monospace,'SF Mono',Menlo,monospace">MECHANISM</text>
  <g font-family="ui-monospace,'SF Mono',Menlo,monospace" font-size="13" fill="#9a948a">
    <text x="86" y="654">DRIFT — GPU turbulence, always on (TURB_AMP 2.0)</text>
    <text x="86" y="678">FALLOFF — within MOUSE_RADIUS = 278 px (fo = 1 − dist/radius)</text>
    <text x="86" y="702">SWIRL — tangential 25 + inward 6 · PUSH — out 29 · ATTRACT — in 30</text>
    <text x="86" y="726">RETURN — offset decays exp: 1.2 normal, 0.35 while large (wake)</text>
    <text x="86" y="750">COMPUTE — cursor offsets on CPU, turbulence on GPU</text>
    <text x="86" y="774">KINEMATIC offset + decay — no mass, velocity, or collisions</text>
  </g>

  <!-- NOTES card -->
  <rect x="800" y="596" width="736" height="186" fill="#0f0f12" stroke="#1d1d20" stroke-width="1"/>
  <text x="822" y="626" fill="#4d7fe0" font-size="13" letter-spacing="2.5" font-family="ui-monospace,'SF Mono',Menlo,monospace">HOW IT BEHAVES</text>
  <g font-size="15" font-weight="300" fill="#ece8df">
    <text x="822" y="654">1 — drift moves the whole field; the cursor affects only nearby points</text>
    <text x="822" y="680">2 — force is stronger near the cursor, zero past the radius</text>
    <text x="822" y="706">3 — swirl orbits the cursor with a slight inward pull</text>
    <text x="822" y="732">4 — displaced points settle back home, leaving a brief wake</text>
    <text x="822" y="758">5 — kinematic offset + decay, not a physics simulation</text>
  </g>

  <!-- footer (light technical) -->
  <line x1="64" y1="824" x2="1536" y2="824" stroke="#1d1d20" stroke-width="1"/>
  <text x="64" y="852" fill="#9a948a" font-size="16" font-weight="300">MOUSE_RADIUS = 278 px · swirl 25 (+6) · push 29 · attract 30 · return decay 1.2 / 0.35.</text>
  <text x="64" y="876" fill="#6b665e" font-size="13.5" font-weight="300">A renderer — not a filter, not AI, not a physics simulation.</text>
</svg>
'''

with open("/Users/ciamac/Developer/splat-desktop/launch/diagram-3_interaction-modes_v2.svg", "w") as f:
    f.write(svg)
print("wrote diagram-3_interaction-modes_v2.svg")
