window.__A = {
  cfg(c) {
    const $ = id => document.getElementById(id), P = window.__pf;
    if (c.grid && +$('grid').value !== c.grid) { $('grid').value = c.grid; $('grid').dispatchEvent(new Event('change')); }
    if (c.look) document.querySelector(`#looks [data-look=${c.look}]`).click();
    if (c.size) { $('surfScale').value = c.size; $('surfScale').dispatchEvent(new Event('input')); }
    if (c.turb !== undefined) P.U.uTurb.value = c.turb;
    if (c.dpr) { P.renderer.setPixelRatio(c.dpr); dispatchEvent(new Event('resize')); }
    P.S.sweep = false; P.S.yaw = 11; P.S.pitch = 4;
    document.getElementById('controls').classList.add('closed');
    return JSON.stringify({ cols: P.U.uCols.value, N: P.N, surf: P.U.uSurfScale.value, turb: P.U.uTurb.value, pr: P.renderer.getPixelRatio(), prim: P.S.prim, live: $('live').textContent });
  },
  cap(name) {
    requestAnimationFrame(() => {
      const c = document.getElementById('c'), u = c.toDataURL('image/png');
      fetch(u).then(r => r.blob()).then(b => fetch('/result/' + name, { method: 'POST', body: b }));
    });
    return 'queued';
  },
  stats() { return document.getElementById('stats').textContent + ' || ' + document.getElementById('log').textContent; },
};
'ok';
