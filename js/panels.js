// Panel HTML: realm panels, skills, strengths, project cards, one-time hints, contact menu and Juha.
import * as D from './data.js?v=59';
import { map as MAP } from './worldmap.js?v=59';
import { TAU } from './props.js?v=59';
import { best, lightSkill, onArea, panel, playing, shots } from './main.js?v=59';

/* ================================================================== */
/*  Panels                                                             */
/* ================================================================== */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motto = (t) => `<blockquote class="verse"><p lang="ar" dir="rtl">${t.ar.map(esc).join('<br>')}</p><p>${esc(t.en)}</p></blockquote>`;
const head = (r, title) => {
  const where = (D.lands[r.land] || {}).short;
  const idx = D.realms.findIndex((x) => x.id === r.id);
  const ch = ['الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع', 'الفصل الخامس', 'الفصل السادس', 'الفصل السابع'][idx] || '';
  return `<p class="chapter"><span lang="ar">${ch}</span> · Chapter ${idx + 1} of ${D.realms.length}</p><p class="kicker">${esc(r.place)}${where ? ` · ${esc(where)}` : ''}<span class="kicker-ar" lang="ar">${esc(r.placeAr || '')}</span></p><h2>${esc(r.heading)}</h2><p class="fx-title">${esc(title)}</p>`;
};
// a plain label first, its fantasy name after it, smaller
const dual = (plain, fx) => `${esc(plain)} <span class="fx">${esc(fx)}</span>`;
function journeyMap() { // a real map: the three places I have lived, joined in the order I lived there
  const { W, H, land, at } = MAP;
  const lab = { Makkah: [10, 16, 'start'], Swansea: [10, -2, 'start'], Melbourne: [-10, -22, 'end'] };
  const pts = D.hero.journey.map((j) => at[j.place]);
  const arcs = pts.slice(1).map((b, i) => {
    const a = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.28;
    return `<path d="M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}" />`;
  }).join('');
  const dots = D.hero.journey.map((j, i) => {
    const [x, y] = pts[i], [dx, dy, anchor] = lab[j.place] || [10, 0, 'start'];
    return `<g class="jm-${j.land}"><circle class="halo" cx="${x}" cy="${y}" r="9" /><circle cx="${x}" cy="${y}" r="4.5" />
      <text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}"><tspan class="n">${i + 1}</tspan> ${esc(j.place)} <tspan class="ar">${esc(j.ar)}</tspan></text>
      <text class="sub" x="${x + dx}" y="${y + dy + 13}" text-anchor="${anchor}">${esc(j.note)}</text></g>`;
  }).join('');
  return `<svg class="journey-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="A map: Makkah, then Swansea, then Melbourne">
    <rect class="sea" width="${W}" height="${H}" rx="4" /><path class="land" d="${land}" />
    <g class="arcs">${arcs}</g>${dots}</svg>`;
}

// One school of the skill tree, grown downward through its tiers: Seasoned, Adept, Novice.
let school = 0;
const findable = (u) => (D.quests.some((q) => q.name === u) ? 'quests' : D.pursuits.some((q) => q.name === u) ? 'pursuits' : '');
// "used in" names as buttons that jump to the quest or pursuit (handled by the [data-goto] click listener)
const proofLinks = (used) => used.map((u) => {
  const where = findable(u);
  return where ? `<button type="button" data-goto="${where}" data-find="${esc(u)}">${esc(u)}</button>` : esc(u);
}).join(' · ');
function schoolPanel(bi) {
  const b = D.skillTree[bi];
  const proven = new Set(b.skills.flatMap((s) => s.used || []));
  const top = b.skills.filter((s) => s.rank === 3).length;
  const tile = (s) => `<div class="skill" data-skill="${bi}-${b.skills.indexOf(s)}" tabindex="0">
      <span class="s-name">${esc(s.name)}</span>${s.used ? `<span class="s-used">${proofLinks(s.used)}</span>` : ''}</div>`;
  return `<div class="school" style="--c:${b.color}">
    <p class="school-sum">${b.skills.length} skills${top ? ` · ${top} seasoned` : ''}${proven.size ? ` · put to work in ${proven.size} ${proven.size === 1 ? 'project' : 'projects'}` : ''}</p>
    <ol class="tiers">${[3, 2, 1].filter((rank) => b.skills.some((s) => s.rank === rank)).map((rank) => `
      <li class="tier t${rank}"><h4><span class="pips">${[1, 2, 3].map((n) => `<i class="${n <= rank ? 'on' : ''}"></i>`).join('')}</span>${D.rankNames[rank]}</h4>
        <div class="tiles">${b.skills.filter((s) => s.rank === rank).map(tile).join('')}</div></li>`).join('')}</ol>
    <p class="school-hint">${matchMedia('(hover: hover)').matches ? 'Hover' : 'Tap'} a skill to find it in the tree; tap a project to see the proof.</p>
  </div>`;
}
function pickSchool(bi, focus = false) {
  school = ((bi % D.skillTree.length) + D.skillTree.length) % D.skillTree.length;
  const body = panel.querySelector('#school');
  if (!body) return;
  body.innerHTML = schoolPanel(school);
  body.setAttribute('aria-labelledby', `school-tab-${school}`);
  panel.querySelectorAll('[data-school]').forEach((t) => {
    const on = +t.dataset.school === school;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  lightSkill(null);
}
// The Character panel's attributes: the six scores as one shape on a hexagon web (scaled 8-20 so the
// differences show), with the evidence for each listed beneath.
const attributesSection = () => {
  const A = D.hero.attributes, n = A.length, C = 130, R = 92, lo = 8, hi = 20;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i / n) * TAU; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
  const ring = (f) => A.map((_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const shape = A.map((a, i) => pt(i, R * (a.value - lo) / (hi - lo)).map((v) => v.toFixed(1)).join(',')).join(' ');
  return `<section><h3>${dual('Strengths', 'Attributes')}</h3>
    <svg class="radar" viewBox="0 0 260 260" role="img" aria-label="Strengths: ${A.map((a) => a.label).join(', ')}">
      ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon class="r-ring" points="${ring(f)}"/>`).join('')}
      ${A.map((_, i) => { const [x, y] = pt(i, R); return `<line class="r-axis" x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('')}
      <polygon class="r-shape" points="${shape}"/>
      ${A.map((a, i) => { const [x, y] = pt(i, R * (a.value - lo) / (hi - lo)); return `<circle class="r-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/>`; }).join('')}
      ${A.map((a, i) => { const [x, y] = pt(i, R + 22); return `<text class="r-key" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(a.key)}</text>`; }).join('')}
    </svg>
    <dl class="r-list">${A.map((a) => `<dt><abbr>${esc(a.key)}</abbr> ${esc(a.label)}</dt><dd>${esc(a.note)}${a.used ? `<br><span class="s-used">Proof: ${proofLinks(a.used)}</span>` : ''}</dd>`).join('')}</dl></section>`;
};

// a project line: plain text, or a game whose name opens it to play
const objective = (o) => (typeof o === 'string' ? esc(o)
  : `<a class="play" href="${esc(o.play)}" target="_blank" rel="noopener" title="Play ${esc(o.game)} in your browser">▶ ${esc(o.game)}</a> ${esc(o.text)}`);
// The Quests panel lists paid work apart from projects, so an employer sees the job first.
const questCards = (list, openFirst) => list.map((q, i) => `
      <details class="quest${q.featured ? ' featured' : ''}" data-name="${esc(q.name)}"${i === 0 && openFirst ? ' open' : ''}>
        <summary>
          ${q.featured || q.award || q.play ? `<span class="badges">${q.featured ? '<span class="start-here">★ Start here</span>' : ''}${q.award ? `<span class="start-here award">♛ ${esc(q.award)}</span>` : ''}${q.play ? '<span class="start-here playable">▶ Playable</span>' : ''}</span>` : ''}<span class="q-kind">${esc(q.plain)}${q.when ? ` · ${esc(q.when)}` : ''} <span class="fx">${esc(q.kind)}</span></span>
          <span class="q-status ${q.status === 'Active' ? 'active' : ''}">${esc(q.status)}</span>
          <span class="q-name">${esc(q.name)}</span><span class="q-role">${esc(q.role)}</span>
        </summary>
        <div class="q-body">${q.logo ? `<img class="q-logo" src="assets/logos/${esc(q.logo)}?v=59" alt="${esc(q.name)} logo">` : ''}${q.play ? `<p class="q-play"><a class="play-btn" href="${esc(q.play)}" target="_blank" rel="noopener">▶ Play ${esc(q.name)} in your browser</a></p>` : ''}<p>${esc(q.summary)}</p>
          <ul>${q.objectives.map((o) => `<li>${objective(o)}</li>`).join('')}</ul>
          ${q.flow ? `<div class="flow" aria-label="How it works">${q.flow.map((f) => `<span>${esc(f)}</span>`).join('<i>→</i>')}</div>` : ''}
          <p class="chips-label">Tools &amp; skills</p><div class="chips">${q.loot.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}</div>
          ${q.links ? `<p class="q-links">${q.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>` : ''}
        </div>
      </details>`).join('');
const questGroup = (title, list, first) => (list.length ? `<section class="q-group"><h3>${title}</h3>${questCards(list, first === 0)}</section>` : '');

// Projects split three ways, one tab per islet: Hardware (the Workshop), Software (the Observatory), Games (the Arcade).
let area = 0;
const inArea = (ai) => D.quests.filter((q) => (q.areas || []).includes(D.areas[ai].id));
function areaPanel(ai) {
  const a = D.areas[ai], list = inArea(ai);
  return `<p class="area-sum"><b>${esc(a.fx)}</b> · ${esc(a.sub)} · ${list.length} ${list.length === 1 ? 'project' : 'projects'}</p>${questCards(list, false)}`;
}
function pickArea(ai, focus = false) {
  area = ((ai % D.areas.length) + D.areas.length) % D.areas.length;
  const body = panel.querySelector('#area');
  if (!body) return;
  body.innerHTML = areaPanel(area);
  body.setAttribute('aria-labelledby', `area-tab-${area}`);
  panel.querySelectorAll('[data-area]').forEach((t) => {
    const on = +t.dataset.area === area;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  if (playing) history.replaceState(null, '', `#quests/${D.areas[area].id}`);
  onArea(area);
}
// find a project's card, switching to the tab it lives under if need be
function findCard(test) {
  let el = [...panel.querySelectorAll('[data-name]')].find(test);
  if (el || !panel.querySelector('#area')) return el;
  const q = D.quests.find((x) => x.areas && test({ dataset: { name: x.name } }));
  if (!q) return null;
  pickArea(D.areas.findIndex((a) => a.id === q.areas[0]));
  return [...panel.querySelectorAll('[data-name]')].find(test);
}

// The first thing on the Character panel: who I am in two lines, for someone hiring.
function glance() {
  const job = D.quests.find((q) => q.experience), study = D.academies[0], mail = D.email.join('@');
  return `<div class="glance">
    <p class="glance-sum">${esc(D.hero.summary)}</p>
    <dl>
      <dt>Studying</dt><dd>${esc(study.what)}, ${esc(study.name)} <span>${esc(study.when)}</span></dd>
      ${job ? `<dt>Experience</dt><dd>${esc(job.role.split(' · ')[0])}, ${esc(job.name)} <span>${esc(job.when)}</span></dd>` : ''}
      <dt>Looking for</dt><dd>${esc(D.hero.seeking)}</dd>
      <dt>Work rights</dt><dd>${esc(D.hero.rights)}</dd>
    </dl>
    <p class="glance-actions"><a href="mailto:${esc(mail)}">Email me</a><button type="button" data-open-summary>View CV</button><button type="button" data-go="quests">See my work</button></p>
  </div>`;
}

const panels = {
  hero: (r) => `${head(r, D.hero.title)}
    ${glance()}
    <p class="lore">${esc(D.hero.lore)}</p>
    <dl class="meta">
      <dt>${dual('Degree', 'Class')}</dt><dd>${esc(D.hero.klass)}</dd>
      <dt>${dual('University', 'Guild')}</dt><dd>${esc(D.hero.guild)}</dd>
      <dt>${dual('Based in', 'Realm')}</dt><dd>${esc(D.hero.realm)}</dd>
    </dl>
    ${attributesSection()}
    <section><h3>Journey</h3>${journeyMap()}</section>
    <section><h3>${dual('Languages', 'Tongues')}</h3><div class="chips">${D.hero.tongues.map((t) => `<span class="chip"><b>${esc(t.name)}</b> · ${esc(t.rank)} · <i${t.name === 'Arabic' ? ' lang="ar"' : t.name === 'Welsh' ? ' lang="cy"' : ''}>${esc(t.hello)}</i></span>`).join('')}</div></section>`,

  quests: (r) => `${head(r, 'Quest Log')}
    <p class="lore">Campaigns fought, raids survived and two epics still unfolding.</p>
    ${motto(D.mottos.quests)}
    ${questGroup('Experience', D.quests.filter((q) => q.experience), 0)}
    <section class="q-group"><h3>Projects</h3>
    <div class="schools areas" role="tablist" aria-label="Kinds of project">${D.areas.map((a, ai) => `
      <button type="button" role="tab" id="area-tab-${ai}" data-area="${ai}" aria-controls="area" aria-selected="${ai === area}" tabindex="${ai === area ? 0 : -1}" style="--c:${a.color}">
        <b>${esc(a.name)}</b><span>${esc(a.fx)} · ${inArea(ai).length}</span></button>`).join('')}</div>
    <div id="area" role="tabpanel" aria-labelledby="area-tab-${area}">${areaPanel(area)}</div></section>`,

  skills: (r) => `${head(r, 'Skill Tree')}
    <blockquote class="verse abqar"><p lang="ar" dir="rtl"><b>${esc(D.folklore.abqar.ar[0])}</b><br>${esc(D.folklore.abqar.ar[1])}</p><p>${esc(D.folklore.abqar.en)}</p></blockquote>
    <div class="schools" role="tablist" aria-label="Schools of skill">${D.skillTree.map((b, bi) => `
      <button type="button" role="tab" id="school-tab-${bi}" data-school="${bi}" aria-controls="school" aria-selected="${bi === school}" tabindex="${bi === school ? 0 : -1}" style="--c:${b.color}">
        <b>${esc(b.branch)}</b><span>${esc(b.sub)}</span></button>`).join('')}</div>
    <div id="school" role="tabpanel" aria-labelledby="school-tab-${school}">${schoolPanel(school)}</div>`,

  trophies: (r) => `${head(r, 'Deeds & Honours')}
    <section>${D.trophies.map((t) => `
      <div class="trophy"><span class="medal ${t.tier}">♛</span>
        <div><strong>${t.plain ? dual(t.plain, t.name) : esc(t.name)}</strong><span>${esc(t.detail)}</span></div><time>${esc(t.when)}</time></div>`).join('')}</section>
    <section><h3>${dual('Certifications', 'Scrolls')}</h3><ul class="scrolls">${D.scrolls.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>`,

  pursuits: (r) => `${head(r, 'Beyond the Workshop')}
    <blockquote class="verse"><p lang="ar" dir="rtl">${D.folklore.antarah.ar.map(esc).join('<br>')}</p>
      <p>${esc(D.folklore.antarah.en)}</p><cite>${esc(D.folklore.antarah.by)} · <span lang="ar">${esc(D.folklore.antarah.byAr)}</span></cite></blockquote>
    <p class="lore">What I do when nobody is marking it.</p>
    <div class="range">
      <button type="button" id="loose">Loose an arrow</button>
      <div class="score"><span>Last <b id="s-last">–</b></span><span>Best <b id="s-best">${best || '–'}</b></span><span>Shots <b id="s-n">${shots}</b></span></div>
    </div>
    <section style="margin-top:18px">${D.pursuits.map((p) => `
      <div class="pursuit" data-name="${esc(p.name)}"><span class="pg">${esc(p.glyph)}</span>${p.flag ? `<span class="chequer" role="img" title="${esc(p.flag)}" aria-label="${esc(p.flag)}"></span>` : ''}
        <div><strong>${esc(p.name)}</strong><p>${esc(p.detail)}</p>${p.extra ? `<p class="extra">${esc(p.extra)}</p>` : ''}</div></div>`).join('')}</section>`,

  guilds: (r) => `${head(r, 'Guilds & Academies')}
    ${motto(D.mottos.guilds)}
    <section><h3>Where I belong</h3><div class="logo-wall">${D.badges.map((b) => `
      <a class="logo-tile" href="${esc(b.href)}" target="_blank" rel="noopener" title="${esc(b.name)}"${b.bg ? ` style="background:${esc(b.bg)}"` : ''}>
        ${b.logo ? `<img src="assets/logos/${esc(b.logo)}?v=59" alt="${esc(b.name)} logo" loading="lazy">` : `<b class="name-badge"><i lang="ar">${esc(b.ar)}</i>${esc(b.name)}</b>`}<span>${esc(b.note)}</span></a>`).join('')}</div></section>
    <section><h3>${dual('Clubs & leadership', 'Banners carried')}</h3>${D.guilds.map((g) => `
      <div class="card">${g.logo ? `<img class="card-logo" src="assets/logos/${esc(g.logo)}?v=59" alt=""${g.logoBg ? ` style="background:${esc(g.logoBg)}"` : ''}>` : ''}<time>${esc(g.when)}</time><strong>${esc(g.name)}</strong>
        <span class="sub">${esc(g.role)} · ${esc(g.place)}</span><p>${esc(g.detail)}</p></div>`).join('')}</section>
    <section><h3>${dual('Education', 'Academies')}</h3>${D.academies.map((a) => `
      <div class="card">${a.logo ? `<img class="card-logo" src="assets/logos/${esc(a.logo)}?v=59" alt="">` : ''}<time>${esc(a.when)}</time><strong>${esc(a.name)}</strong><p>${esc(a.what)}</p></div>`).join('')}</section>`,

  portal: (r) => `${head(r, 'Open a Gate')}
    <p class="lore">Looking for an engineer who is ready to be useful from day one? Step through.</p>
    <p class="seeking">${esc(D.hero.seeking)} ${esc(D.hero.rights)}</p>
    <section style="margin-top:20px">
      <a class="gate" href="mailto:${esc(D.email.join('@'))}"><div><strong>Email</strong><br><span>${esc(D.email.join('@'))}</span></div></a>${D.portals.map((p) => `
      <a class="gate" href="${esc(p.href)}" target="_blank" rel="noopener"><div><strong>${esc(p.name)}</strong><br><span>${esc(p.hint)}</span></div></a>`).join('')}
      <button class="gate" type="button" data-open-summary><div><strong>One-page summary</strong><br><span>Plain version you can print or save as a PDF</span></div></button></section>`,
};

// One-time hints for things that are easy to miss. Remembered per browser where storage allows.
const hintEl = document.getElementById('hint');
const touch = matchMedia('(hover: none)').matches;
const hints = {
  controls: touch ? 'Swipe to travel between islands, or tap one.' : 'Scroll, use the arrow keys, press 1–7 or click an island to travel.',
  pursuits: touch ? 'Tap the target on the island to loose an arrow.' : 'Click the target on the island, or press Space, to loose an arrow.',
};
let hintTimer = 0;
function showHint(id) {
  if (!hintEl || !hints[id] || !playing) return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem('hints-seen') || '{}'); } catch { /* storage blocked: show it anyway */ }
  if (seen[id]) return;
  seen[id] = 1;
  try { localStorage.setItem('hints-seen', JSON.stringify(seen)); } catch { /* fine */ }
  hintEl.textContent = hints[id]; hintEl.classList.add('on');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => hintEl.classList.remove('on'), 6500);
}

// Title screen: who I am, what I build and how to reach me, before anyone has to play.
const mail = D.email.join('@');
const contacts = [
  { label: 'Email', href: `mailto:${mail}`, detail: mail },
  ...D.portals.map((p) => ({ label: p.name, href: p.href, detail: p.href.replace(/^https?:\/\/(www\.)?/, ''), ext: true })),
];
const ext = (c) => (c.ext ? ' target="_blank" rel="noopener"' : '');
document.getElementById('pitch').innerHTML =
  `${esc(D.hero.pitch)} <span class="seeking-tag">${esc(D.hero.seeking.split(':')[0])}</span>`;
document.getElementById('contact-strip').innerHTML =
  contacts.map((c) => `<a href="${esc(c.href)}"${ext(c)}>${esc(c.label)}</a>`).join('<i aria-hidden="true">·</i>') +
  '<i aria-hidden="true">·</i><a href="cv.pdf" download>CV (PDF)</a>';

// Contact in the header: email, LinkedIn and GitHub in one click, from any realm
const contactBtn = document.getElementById('contact-btn');
const contactPop = document.getElementById('contact-pop');
contactPop.innerHTML = contacts.map((c) => `<a href="${esc(c.href)}"${ext(c)}><strong>${esc(c.label)}</strong><span>${esc(c.detail)}</span></a>`).join('') +
  `<button type="button" id="copy-mail">Copy email address</button>`;
const setContact = (on) => { contactPop.hidden = !on; contactBtn.setAttribute('aria-expanded', String(on)); };
contactBtn.addEventListener('click', () => setContact(contactPop.hidden));
document.addEventListener('click', (e) => { if (!e.target.closest('.contact-menu')) setContact(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !contactPop.hidden) { setContact(false); contactBtn.focus(); } });
document.getElementById('copy-mail').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(mail); b.textContent = 'Copied'; } catch { b.textContent = mail; }
  setTimeout(() => { b.textContent = 'Copy email address'; }, 2000);
});

// a tale of Juha, the folk trickster, on the title screen, changing every few seconds
const juhaEl = document.getElementById('juha');
if (juhaEl) {
  let ji = Math.floor(Math.random() * D.folklore.juha.length);
  const showJuha = () => {
    const j = D.folklore.juha[ji % D.folklore.juha.length]; ji++;
    juhaEl.classList.remove('in'); void juhaEl.offsetWidth;
    juhaEl.innerHTML = `<b><span lang="ar">حكاية جحا</span> · A tale of Juha</b>${esc(j.tale)}<em>${esc(j.moral)}</em>`;
    juhaEl.classList.add('in');
  };
  showJuha(); setInterval(() => { if (!playing) showJuha(); }, 11000);
}

export { area, esc, findCard, hintEl, panels, pickArea, pickSchool, school, showHint };
