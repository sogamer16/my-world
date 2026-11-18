// The plain view: everything on the site as one readable, printable page.
// Kept separate from the 3D scene so it still works when WebGL does not.
import * as D from './data.js?v=57';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = document.getElementById('summary');
// a project line: plain text, or a game whose name opens it to play
const objective = (o) => (typeof o === 'string' ? esc(o)
  : `<a class="play" href="${esc(o.play)}" target="_blank" rel="noopener" title="Play ${esc(o.game)} in your browser">▶ ${esc(o.game)}</a> ${esc(o.text)}`);


const job = (q) => `
      <section class="s-item">
        <h3>${esc(q.name)} <span>${esc(q.plain)} · ${esc(q.when)}</span></h3>
        <p class="s-sub">${esc(q.role)}</p>
        <p>${esc(q.summary)}</p>
        <ul>${q.objectives.map((o) => `<li>${objective(o)}</li>`).join('')}</ul>
        ${q.links ? `<p class="s-flow">${q.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(' · ')}</p>` : ''}
      </section>`;
const keep = (x) => x.cv !== false;

// The order follows an Australian student CV: summary, education, experience, projects, skills.
el.innerHTML = `
  <div class="s-bar">
    <button type="button" data-close-summary>← Back to the world</button>
    <span class="s-actions"><a href="${esc(D.cvPdf)}" download data-track="cv-pdf">Download PDF</a><button type="button" id="s-print">Print</button></span>
  </div>
  <article>
    <header>
      <h1>${esc(D.hero.name)} <span class="s-ar" lang="ar" dir="rtl">${esc(D.hero.nameAr)}</span></h1>
      <p class="s-role">${esc(D.hero.klass)} student · ${esc(D.hero.guild)} · ${esc(D.hero.realm)}</p>
      <p class="s-links"><a href="mailto:${esc(D.email.join('@'))}">${esc(D.email.join('@'))}</a> · ${D.portals.map((p) => `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.href.replace(/^https?:\/\/(www\.)?/, ''))}</a>`).join(' · ')}</p>
      <p>${esc(D.hero.summary)}</p>
      <p class="s-seeking">${esc(D.hero.seeking)}</p>
      <div class="s-logos">${D.badges.map((b) => (b.logo ? `<img src="assets/logos/${esc(b.logo)}?v=57"${b.size ? ` width="${b.size[0]}" height="${b.size[1]}"` : ''} alt="${esc(b.name)}" title="${esc(b.name)}"${b.bg ? ` style="background:${esc(b.bg)}"` : ''}>` : `<span class="s-badge" title="${esc(b.name)}"><i lang="ar">${esc(b.ar)}</i> ${esc(b.name)}</span>`)).join('')}</div>
    </header>

    <h2>Education</h2>
    ${D.academies.map((a) => `<p><strong>${esc(a.name)}</strong> — ${esc(a.what)} <span class="s-when">${esc(a.when)}</span></p>`).join('')}

    <h2>Experience</h2>
    ${D.quests.filter((q) => q.experience).map(job).join('')}

    <h2>Projects</h2>
    ${D.areas.filter((a) => a.id !== 'games').map((a) => {
      // a project in two areas (ABAAD) is listed once, under the first
      const list = D.quests.filter((q) => (q.areas || [])[0] === a.id);
      return list.length ? `<p class="s-group">${esc(a.name)}</p>${list.map(job).join('')}` : '';
    }).join('')}
    <p class="s-group">Games</p>
    <ul class="s-games">${D.quests.filter((q) => (q.areas || []).includes('games')).map((q) => `<li><strong>${q.play ? `<a class="play" href="${esc(q.play)}" target="_blank" rel="noopener">${esc(q.name)}</a>` : esc(q.name)}</strong>${q.award ? ` (${esc(q.award)})` : ''} — ${esc(q.role)}${q.when && !q.role.includes(q.when) ? `, ${esc(q.when)}` : ''}</li>`).join('')}</ul>

    <h2>Skills</h2>
    ${D.skillTree.map((b) => `<p><strong>${esc(b.sub)}:</strong> ${b.skills.filter((s) => s.rank > 1).map((s) => esc(s.name)).join(', ')}</p>`).join('')}
    ${(() => { const f = D.skillTree.flatMap((b) => b.skills.filter((s) => s.rank === 1)); return f.length ? `<p><strong>Familiar with:</strong> ${f.map((s) => esc(s.name)).join(', ')}</p>` : ''; })()}

    <h2>Leadership</h2>
    ${D.guilds.filter(keep).map((g) => `<p><strong>${esc(g.role)}, ${esc(g.name)}</strong> <span class="s-when">${esc(g.when)}</span><br>${esc(g.detail)}</p>`).join('')}

    <h2>Achievements and certifications</h2>
    <ul>${D.trophies.filter(keep).map((t) => `<li>${esc(t.plain || t.name)} — ${esc(t.detail)}${t.when ? ` (${esc(t.when)})` : ''}</li>`).join('')}</ul>
    <p><strong>Certificates:</strong> ${D.scrolls.map(esc).join(' · ')}</p>

    <h2>Languages and interests</h2>
    <p><strong>Languages:</strong> ${D.hero.tongues.map((t) => `${esc(t.name)} (${esc(t.rank)})`).join(', ')}. <strong>Interests:</strong> ${D.pursuits.map((p) => esc(p.name)).join(', ')}.</p>
    <p class="s-updated">Updated ${esc(D.hero.updated)}</p>
  </article>`;

// Visit counts (GoatCounter: no cookies, no personal data), only when `analytics` in data.js names a site.
// Besides page views it counts the clicks that matter: the CV, the PDF, game plays and contact links.
const track = (path, title) => { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true }); } catch { /* never let counting break the page */ } };
if (/^[a-z0-9-]+$/.test(D.analytics || '')) {
  const sc = document.createElement('script'); sc.async = true; sc.src = 'https://gc.zgo.at/count.js';
  sc.dataset.goatcounter = `https://${D.analytics}.goatcounter.com/count`;
  document.head.append(sc);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a, [data-open-summary]');
    if (!a) return;
    const game = a.closest('[data-name]')?.dataset.name;
    if (a.dataset.track) track(a.dataset.track, a.textContent.trim());
    else if (a.matches('[data-open-summary]')) track('cv-view', 'Opened the plain CV');
    else if (a.matches('.play-btn, a.play, .q-shot')) track(`play/${(game || a.textContent).trim()}`, `Played ${game || a.textContent.trim()}`);
    else if (/^mailto:/.test(a.getAttribute('href') || '')) track('contact/email', 'Email');
    else { const m = (a.href || '').match(/linkedin|github|itch\.io/); if (m) track(`out/${m[0]}`, a.href); }
  }, true);
}

// The 3D world (three.js and about 8 MB of models) loads only when it will be seen: straight away for most
// visitors, but not under a #summary link or with data saver on until the reader goes back to the world,
// and never on a device without WebGL.
let world = null;
const loadWorld = () => { if (!document.body.classList.contains('no-webgl')) world ||= import('./main.js?v=57'); };
const saveData = !!(navigator.connection && navigator.connection.saveData);

// On a first visit the text waits (at most 0.8 s) for its font, so lines do not re-wrap and jump when it arrives.
const fontsIn = new Promise((done) => {
  setTimeout(done, 800);
  const go = () => document.fonts.load('400 16px Spectral').then(done, done);
  if (document.documentElement.classList.contains('fonts-css')) go();
  else new MutationObserver((_, ob) => { if (document.documentElement.classList.contains('fonts-css')) { ob.disconnect(); go(); } }).observe(document.documentElement, { attributes: true });
});
const open = () => {
  el.hidden = false; document.body.classList.add('summary-open'); el.scrollTop = 0; el.querySelector('button').focus();
  el.classList.add('wait-font'); fontsIn.then(() => el.classList.remove('wait-font'));
};
const close = () => { el.hidden = true; document.body.classList.remove('summary-open'); loadWorld(); };

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
if (gl && saveData && location.hash !== '#summary') { // data saver: the plain version first, the world on request
  el.querySelector('article').insertAdjacentHTML('afterbegin', '<p class="s-note">Data saver is on, so this is the plain version. <button type="button" data-close-summary>Load the 3D world</button> (about 8 MB).</p>');
  open();
}
if (gl && el.hidden) loadWorld();
