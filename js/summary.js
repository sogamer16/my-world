// The plain view: everything on the site as one readable, printable page.
// Kept separate from the 3D scene so it still works when WebGL does not.
import * as D from './data.js?v=8';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = document.getElementById('summary');

el.innerHTML = `
  <div class="s-bar">
    <button type="button" data-close-summary>← Back to the world</button>
    <button type="button" id="s-print">Print / save as PDF</button>
  </div>
  <article>
    <header>
      <h1>${esc(D.hero.name)} <span class="s-ar" lang="ar" dir="rtl">${esc(D.hero.nameAr)}</span></h1>
      <p class="s-role">${esc(D.hero.klass)} student · ${esc(D.hero.guild)} · ${esc(D.hero.realm)}</p>
      <p class="s-links">${D.portals.map((p) => `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.href.replace(/^https?:\/\/(www\.)?/, ''))}</a>`).join(' · ')}</p>
      <p>${esc(D.hero.lore)}</p>
      <div class="s-logos">${D.badges.map((b) => `<img src="assets/logos/${esc(b.logo)}?v=8" alt="${esc(b.name)}" title="${esc(b.name)}">`).join('')}</div>
    </header>

    <h2>Experience and projects</h2>
    ${D.quests.map((q) => `
      <section class="s-item">
        <h3>${esc(q.name)} <span>${esc(q.plain)} · ${esc(q.when)}</span></h3>
        <p class="s-sub">${esc(q.role)}</p>
        <p>${esc(q.summary)}</p>
        <ul>${q.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
        ${q.flow ? `<p class="s-flow">${q.flow.map(esc).join(' → ')}</p>` : ''}
      </section>`).join('')}

    <h2>Skills</h2>
    ${D.skillTree.map((b) => `<p><strong>${esc(b.sub)}:</strong> ${b.skills.map((s) => `${esc(s.name)}${s.rank === 1 ? ' (introductory)' : ''}`).join(', ')}</p>`).join('')}

    <h2>Education</h2>
    ${D.academies.map((a) => `<p><strong>${esc(a.name)}</strong> — ${esc(a.what)} <span class="s-when">${esc(a.when)}</span></p>`).join('')}

    <h2>Leadership</h2>
    ${D.guilds.map((g) => `<p><strong>${esc(g.role)}, ${esc(g.name)}</strong> <span class="s-when">${esc(g.when)}</span><br>${esc(g.detail)}</p>`).join('')}

    <h2>Achievements and certifications</h2>
    <ul>${D.trophies.map((t) => `<li>${esc(t.plain || t.name)} — ${esc(t.detail)}${t.when ? ` (${esc(t.when)})` : ''}</li>`).join('')}
      ${D.scrolls.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>

    <h2>Languages and interests</h2>
    <p>${D.hero.tongues.map((t) => `${esc(t.name)} (${esc(t.rank)})`).join(', ')}</p>
    <p>Lived in ${D.hero.journey.map((j) => esc(j.place)).join(', ')}.</p>
    <p>${D.pursuits.map((p) => esc(p.name)).join(', ')}</p>
  </article>`;

const open = () => { el.hidden = false; document.body.classList.add('summary-open'); el.scrollTop = 0; el.querySelector('button').focus(); };
const close = () => { el.hidden = true; document.body.classList.remove('summary-open'); };

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-summary]')) open();
  else if (e.target.closest('[data-close-summary]')) close();
  else if (e.target.closest('#s-print')) print();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) close(); });
if (location.hash === '#summary') open();

// No WebGL: the 3D world cannot run, so the plain view becomes the site.
let gl = null;
try { const c = document.createElement('canvas'); gl = c.getContext('webgl2') || c.getContext('webgl'); } catch { /* none */ }
if (!gl) {
  document.body.classList.add('no-webgl');
  el.querySelector('[data-close-summary]').remove();
  open();
}
