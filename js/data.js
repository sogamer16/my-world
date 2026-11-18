// All content on the site lives here. Edit this file to update the chronicle.

export const hero = {
  name: 'Sohaib Qutub',
  nameAr: 'صهيب قطب',
  title: 'Artificer of Flow & Circuit',
  klass: 'Mechanical Engineering Systems',
  guild: 'University of Melbourne',
  realm: 'Melbourne, VIC',
  // two lines for employers: the top of the Character panel and of the CV
  summary: 'Mechanical Engineering Systems student at the University of Melbourne who builds sensor systems, robotics and software, from wiring and commissioning HVAC hardware to anomaly-detection models and live web apps.',
  // one line under the name on the title screen
  pitch: 'I build sensor systems, robotics and software.',
  seeking: 'Open to learning opportunities: a chance to work alongside engineers, learn how real systems are built, and be useful while I do it.',
  updated: 'November 2026', // shown on the CV view; change it when you update this file
  year: 1,
  years: 3,
  lore:
    'I grew up between Makkah and Swansea, and now I build things in Melbourne. I study ' +
    'mechanical engineering because I still want to answer the question every kid asks — how ' +
    'does this actually work? — and then wire it, code it and ship it. Six hackathons in, ' +
    'across mechanical engineering, embedded systems, ML and software. Off the bench: compound ' +
    'archery, karate, game jams, and a robotics program that teaches teenagers in Arabic and English.',
  journey: [
    { place: 'Makkah', ar: 'مكة', land: 'hejaz', note: 'Roots' },
    { place: 'Swansea', ar: 'سوانزي', land: 'gower', note: 'School · 9 GCSEs, 2023' },
    { place: 'Melbourne', ar: 'ملبورن', land: 'melbourne', note: 'Trinity 2025 · UniMelb 2026 →' },
  ],
  attributes: [
    { key: 'INT', label: 'Intellect', value: 16, note: 'A* Maths & Physics · CFD · ML' },
    { key: 'DEX', label: 'Craft', value: 17, note: 'Wiring, sensors, Arduino, Raspberry Pi' },
    { key: 'CHA', label: 'Voice', value: 15, note: 'Debating · pitches · 200+ person events' },
    { key: 'STR', label: 'Discipline', value: 14, note: 'Karate medals · Duke of Edinburgh' },
    { key: 'WIS', label: 'Systems Sense', value: 15, note: 'Sees how the whole thing fits together' },
    { key: 'PER', label: 'Focus', value: 15, note: 'Compound archery · draw, anchor, release, repeat' },
  ],
  tongues: [
    { name: 'Arabic', rank: 'Native', hello: 'أهلاً' },
    { name: 'English', rank: 'IELTS 8.0', hello: 'Hello' },
    { name: 'Welsh', rank: 'Beginner', hello: 'Shwmae' },
  ],
};

export const quests = [
  {
    name: 'Totex Energy',
    experience: true, // paid work: listed under Experience, apart from the projects
    kind: 'Main Quest',
    plain: 'Internship',
    role: 'Engineering Intern · energy startup · Canberra',
    when: 'Jul – Sep 2026',
    status: 'Complete',
    summary: 'Tasked with installing an HVAC system in Canberra: hands-on work across live HVAC and electrical systems.',
    objectives: [
      'Commissioned an HVAC outdoor unit from wiring to running condition',
      'Cross-referenced live wiring against documentation and troubleshot faults methodically',
      'Installed a Raspberry Pi, set up Linux and worked on Modbus wiring',
      'Fitted 3D-printed mounting brackets during hardware installation',
    ],
    loot: ['HVAC', 'Modbus', 'Raspberry Pi', 'Linux', 'Fault-finding'],
  },
  {
    name: 'AquaFlow',
    areas: ['hardware'],
    featured: true, // marked "Start here" on the Quests panel
    flow: ['Flow sensors on each branch', 'Arduino branch node', 'Central server', 'Alert on flow drop'],
    kind: 'Epic Quest',
    plain: 'Ongoing project',
    role: 'Smart drip-irrigation monitoring · personal project',
    when: '2024 – Present',
    status: 'Active',
    summary:
      "Born on my grandfather's farm: the drip lines are buried, so cracks and blockages go unseen until crops suffer.",
    objectives: [
      'Water-flow sensors on a branch topology catch flow drops and blockages early',
      'Cascading Arduino data pipeline: each branch aggregates and forwards to a central server',
      'Single sensor node built and working; designed for multi-node expansion',
      'Design target: 50–60% less water than overhead irrigation',
      'Next: stepper or solenoid valves to throttle flow at specific points',
    ],
    loot: ['Arduino', 'C/C++', 'Flow sensors', 'IoT', 'Solar'],
  },
  {
    name: 'ABAAD Robotics',
    areas: ['hardware', 'software'], // a robot and its software: shown under both
    flow: ['Build the robot', 'Code it in Arabic blocks', 'Train the AI overnight', 'Showcase'],
    kind: 'Epic Quest',
    plain: 'Ongoing project',
    role: 'AI robotics program for ages 14–18 · personal project',
    when: '2026 – Present',
    status: 'Active',
    summary:
      'A hands-on course where teenagers build a robot, train its AI themselves and show it off — designed so Arabic speakers are first-class.',
    objectives: [
      'Al-Anqa: the robot platform students assemble and drive, with wheel hardware under test',
      'Arabic block-coding interface in the spirit of Scratch, so the first program is written in the student\'s own language',
      'Hand-gesture recognition built to run on ordinary classroom laptops',
      'Three-day intensive format — build, train a model overnight, showcase — with an Australia pilot proposal drafted',
    ],
    loot: ['Robotics', 'JavaScript', 'Computer vision', 'Curriculum design', 'Proposal writing'],
  },
  {
    name: 'Sentinel',
    areas: ['software'],
    featured: true, // marked "Start here" on the Quests panel
    flow: ['Command to field device', 'Check against thermal, vibration, humidity', 'Isolation Forest verdict', 'Execute or quarantine'],
    kind: 'Raid',
    plain: 'Competition build',
    role: 'OT physical-layer intrusion detection · ICA Engineering IT Innovation Pitch',
    when: '2026',
    status: 'Complete',
    summary:
      'A guard for high-voltage substations that checks field-device commands against the physical world before they run.',
    objectives: [
      'Isolation Forest anomaly model on physics-derived features: thermal residuals, vibration, humidity drift',
      'Self-hardening response that quarantines blocked commands',
      'Prototyped on synthetic sensor data in two weeks',
      'Pitched the full architecture to a judging panel',
    ],
    loot: ['Python', 'Isolation Forest', 'OT security', 'Pitching'],
  },
  {
    name: 'Sirius',
    areas: ['software'],
    featured: true, // marked "Start here" on the Quests panel
    flow: ['A date in history', 'Distance light has travelled since', 'Stars at that distance', '3D sky map'],
    kind: 'Raid',
    plain: 'Competition build',
    role: 'Real-time astronomical web app · CISSA Codebrew Hackathon',
    when: '2026 · 60-hour build',
    status: 'Complete',
    summary:
      'Connects historical events to the real stars whose light from that moment is reaching Earth now.',
    objectives: [
      'Led backend architecture in a three-person team',
      'Navigable 3D star map with real-time sky directions',
      'Personalised constellation generation',
      'Deployed live and presented as a finished product',
    ],
    loot: ['Full-stack', 'Backend', '3D', 'Team lead'],
    links: [{ label: 'Code', href: 'https://github.com/sogamer16/codebrew2026' }],
  },
  {
    name: 'The Flow Trials',
    areas: ['hardware'],
    kind: 'Side Quest',
    plain: 'Side project',
    role: 'CFD guided project · SimScale / Coursera',
    when: '2025',
    status: 'Complete',
    summary: 'Structured computational fluid dynamics on duct and pipe geometry.',
    objectives: [
      'Mesh generation and boundary conditions',
      'Interpreted velocity and pressure fields',
    ],
    loot: ['CFD', 'SimScale', 'Fluid mechanics'],
  },
  // Games: each one is its own entry under the Games tab. `shot` is a screenshot of its title screen (assets/shots). `play` is itch.io's direct game address
  // (on the game's itch.io page, right-click the game → open frame in new tab); it opens the game straight
  // to its menu. It changes when a new build is uploaded, so update `play` after re-uploading a game.
  {
    name: 'Chimera Ants',
    areas: ['games'],
    shot: { src: 'assets/shots/chimera-ants.webp', w: 640, h: 360, alt: 'Chimera Ants title screen' },
    award: "People's Choice",
    kind: 'Raid',
    plain: 'Game jam',
    role: 'First-person action game · University of Melbourne GMC Game Jam 2026',
    when: '2026',
    status: 'Complete',
    summary: 'You wake up inside the chimera ant that ate a scientist, with his memories behind your eyes, four floors above a Queen who molts at dawn. A fast shooter inspired by Doom.',
    objectives: [
      "Won People's Choice at the University of Melbourne GMC Game Jam 2026",
      'Eat what you kill, wear its power: what you defeat becomes your ability',
      'Plays in the browser',
    ],
    loot: ['Game design', 'Action', 'Game jams'],
    play: 'https://html-classic.itch.zone/html/18668009/index.html',
    links: [{ label: 'itch.io page', href: 'https://sogamer16.itch.io/chimera-ants' }],
  },
  {
    name: 'Creep Crawlers',
    areas: ['games'],
    kind: 'Side Quest',
    plain: 'Game',
    role: 'Action game · C#',
    when: '2026',
    status: 'Complete',
    summary: 'A Doom-style shooter in an ant nest: hunt the ants and take their power-ups.',
    objectives: [
      'Kill ants to take their power-ups',
      'Built in C#',
    ],
    loot: ['C#', 'Game design', 'Action'],
  },
  {
    name: 'Riyma',
    areas: ['games'],
    shot: { src: 'assets/shots/riyma.webp', w: 640, h: 367, alt: 'Riyma (نار القِرى, Fire of Hospitality) title screen' },
    kind: 'Side Quest',
    plain: 'Game jam · host',
    role: 'Strategy game · SSAM Game Jam, which I hosted',
    when: '2026',
    status: 'Complete',
    summary: 'A strategy game set in 6th-century Arabia, titled نار القِرى, the Fire of Hospitality. Rival chiefs hoard and raid; you unite the land by giving: feed travellers at your fire and feast villages into friendship. Historical figures such as Antarah ibn Shaddad and Hatim al-Ta\'i are not played, but they shape how the game unfolds.',
    objectives: [
      'My entry to the SSAM Game Jam, which I hosted with a game-making workshop',
      'Helped three students build and submit their own games',
      'Set in pre-Islamic Arabia, with historical figures who steer the story',
    ],
    loot: ['Game design', 'Strategy', 'Workshop host'],
    play: 'https://html-classic.itch.zone/html/19296473/index.html',
    links: [{ label: 'itch.io page', href: 'https://sogamer16.itch.io/riyma' }],
  },
  {
    name: 'JarBound',
    areas: ['games'],
    shot: { src: 'assets/shots/jarbound.webp', w: 529, h: 400, alt: 'JarBound setup screen' },
    kind: 'Side Quest',
    plain: 'Game jam',
    role: 'Card-based ecosystem strategy · Click & Claw Game Jam 2026 · with Abdullah',
    when: '2026',
    status: 'Complete',
    summary: 'Keep a tiny living world in a glass jar alive by playing cards that change its fish, snails, algae, light and nitrates before it collapses.',
    objectives: [
      'A rolling three-card hand: play one card a day, then draw a replacement',
      'Ecosystem simulation with reproduction, starvation, algae blooms and collapse',
      'A 3D glass jar with water, gravel, plants and bubbles',
    ],
    loot: ['Unity', 'C#', 'Simulation', 'Game design'],
    play: 'https://html-classic.itch.zone/html/16823019/game6/index.html',
    links: [
      { label: 'Code', href: 'https://github.com/sogamer16/gamejam-2026-ecosystem' },
      { label: 'itch.io page', href: 'https://sogamer16.itch.io/jarbound' },
    ],
  },
  {
    name: 'Nuclear Robot',
    areas: ['games'],
    shot: { src: 'assets/shots/nuclear-robot.webp', w: 640, h: 383, alt: 'Nuclear Robot title screen' },
    kind: 'Side Quest',
    plain: 'Game jam',
    role: 'Team of four programmers · CISSA × UMGMC game jam',
    when: '2026',
    status: 'Complete',
    summary: 'Keep a reactor from overheating: charge and send batteries, work the coolant and keep the heat down.',
    objectives: [
      'Built in a jam with three other programmers',
      'Made in Unity',
    ],
    loot: ['Unity', 'Teamwork', 'Game jams'],
    play: 'https://html-classic.itch.zone/html/13048570/index.html',
    links: [{ label: 'itch.io page', href: 'https://sogamer16.itch.io/nuclear-robot-four-programmers-in-a-jam' }],
  },
  {
    name: 'Much Ado About Nothing',
    areas: ['games'],
    shot: { src: 'assets/shots/much-ado.webp', w: 640, h: 383, alt: 'Much Ado About Nothing: Benedick receives Don Pedro\'s summons' },
    kind: 'Side Quest',
    plain: 'Game',
    role: "A Benedick's Tale · narrative stealth game · Unity",
    when: '2025',
    status: 'Complete',
    summary: "Shakespeare's eavesdropping scene as a playable stealth game: you are Benedick, creeping through a garden of patrolling friends to overhear a conversation.",
    objectives: [
      'Don Pedro, Claudio and Leonato each patrol with their own detection pattern',
      "How well you stay hidden decides Beatrice's reaction: several endings",
      'Branching dialogue when you confront Beatrice',
    ],
    loot: ['Unity', 'C#', 'Narrative design'],
    play: 'https://html-classic.itch.zone/html/15430996/New%20folder%20(2)/index.html',
    links: [
      { label: 'Code', href: 'https://github.com/sogamer16/game-2d-lit' },
      { label: 'itch.io page', href: 'https://sogamer16.itch.io/proof-much-ado-about-nothing' },
    ],
  },
  {
    name: 'Saudi National Day VR Museum',
    areas: ['games'],
    kind: 'Side Quest',
    plain: 'VR project',
    role: 'Virtual-reality museum · Saudi National Day',
    when: '',
    status: 'Complete',
    summary: 'A virtual-reality museum for Saudi National Day, built in three days.',
    objectives: [
      'Built in three days',
      'Coming to itch.io',
    ],
    loot: ['VR', '3D', 'Rapid prototyping'],
  },
];

// The Projects realm splits into three islets; each project lists the ones it belongs to in `areas`.
export const areas = [
  { id: 'hardware', name: 'Hardware', fx: 'The Workshop', sub: 'Sensors, robots, HVAC and fluids', color: '#f4b860' },
  { id: 'software', name: 'Software', fx: 'The Observatory', sub: 'Machine learning, web and security', color: '#7cc4ff' },
  { id: 'games', name: 'Games', fx: 'The Arcade', sub: 'Game jams and games you can play', color: '#ff7ad9' },
];

// rank: 1 Novice · 2 Adept · 3 Seasoned (Novice skills show as "Familiar with" on the CV)
// used: where the skill was put to work — names of quests or pursuits; the Skills panel links to them
export const skillTree = [
  {
    branch: 'Spellcraft',
    sub: 'Programming & tools',
    color: '#7cc4ff',
    skills: [
      { name: 'Python', rank: 3, used: ['Sentinel'] },
      { name: 'C / C++', rank: 3, used: ['AquaFlow'] },
      { name: 'JavaScript', rank: 2, used: ['ABAAD Robotics'] },
      { name: 'C#', rank: 2, used: ['JarBound', 'Creep Crawlers'] },
      { name: 'Bash', rank: 2 },
      { name: 'Linux / WSL', rank: 2, used: ['Totex Energy'] },
      { name: 'Git / GitHub', rank: 2 },
      { name: 'Full-stack web', rank: 2, used: ['Sirius'] },
      { name: 'ML · Isolation Forest', rank: 2, used: ['Sentinel'] },
    ],
  },
  {
    branch: 'Forgecraft',
    sub: 'Engineering & CAD',
    color: '#ffb454',
    skills: [
      { name: 'Fluid mechanics', rank: 2, used: ['The Flow Trials'] },
      { name: 'CFD · SimScale', rank: 2, used: ['The Flow Trials'] },
      { name: 'MATLAB', rank: 2 },
      { name: 'Blender', rank: 2, used: ['Design & 3D'] },
      { name: 'SolidWorks', rank: 1 },
      { name: 'AutoCAD', rank: 1 },
    ],
  },
  {
    branch: 'Runecraft',
    sub: 'Hardware & IoT',
    color: '#8dffb0',
    skills: [
      { name: 'Arduino', rank: 3, used: ['AquaFlow'] },
      { name: 'Sensor systems', rank: 3, used: ['AquaFlow', 'Sentinel'] },
      { name: 'Raspberry Pi', rank: 2, used: ['Totex Energy'] },
      { name: 'Modbus', rank: 2, used: ['Totex Energy'] },
      { name: 'GPIO', rank: 2 },
      { name: 'HVAC wiring', rank: 2, used: ['Totex Energy'] },
      { name: 'Robot platforms', rank: 2, used: ['ABAAD Robotics'] },
      { name: 'Gesture recognition', rank: 1, used: ['ABAAD Robotics'] },
    ],
  },
];

export const rankNames = ['', 'Novice', 'Adept', 'Seasoned'];

export const trophies = [
  { name: 'McKinsey Forward', detail: 'McKinsey & Company professional development program', when: '2025', tier: 'gold' },
  { name: 'Silver Tongue', plain: 'Debating', detail: '2nd place, Trinity College debating', when: '2025', tier: 'silver' },
  { name: 'Crowd Favourite', plain: "People's Choice", detail: "University of Melbourne GMC Game Jam 2026, for Chimera Ants", when: '2026', tier: 'gold' },
  { name: 'Six Hackathons', plain: 'Hackathons', detail: 'Built and shipped under the clock, six times', when: '2025–26', tier: 'gold' },
  { name: 'Sohaib the Great', plain: 'Leavers hoodie', cv: false, detail: 'Olchfa School leavers hoodie — number 23', when: '2023', tier: 'silver' },
  // medalLogo: put the official logo file in assets/logos and name it here (e.g. 'dofe.png') to show it on the 3D medal
  { name: 'Duke of Edinburgh', detail: 'Bronze Award', when: '2023', tier: 'bronze', medalLogo: 'dofe.webp' },
  { name: 'Way of the Empty Hand', plain: 'Karate', detail: 'Multiple regional karate medals', when: '', tier: 'gold' },
  { name: 'Twin Stars', plain: 'GCSEs', detail: 'A* in GCSE Mathematics and Physics', when: '2023', tier: 'gold' },
];

export const scrolls = [
  'Fundamentals of Fluid Power — NCFP',
  'Natural Gas — Coursera',
  'Introduction to Materials Science — ASU',
  'Crystal Structures & Properties of Metals — ASU',
  'Introduction to Cybersecurity Fundamentals',
];

// Arab folklore and poetry woven through the world.
// Lines the world is built on, in my own words.
export const mottos = {
  quests: {
    ar: ['السببُ والنتيجةُ عادةٌ حتى تختبرها'],
    en: 'Cause and effect are only a habit until you test them. Every move here was planned a few turns ahead.',
  },
  guilds: {
    ar: ['كلُّ نهوضٍ يبنيه تفكيرٌ جماعي', 'وكلُّ سقوطٍ يبدأ باستهتارٍ فردي'],
    en: 'Every rise is built by people thinking together; every fall begins with one person\'s carelessness. A group holds by its solidarity before its plans.',
  },
};

export const folklore = {
  antarah: {
    ar: ['لا يَحمِلُ الحِقدَ مَن تَعلو بِهِ الرُتَبُ', 'وَلا يَنالُ العُلا مَن طَبعُهُ الغَضَبُ'],
    en: 'No one raised high carries a grudge, and no one ruled by anger reaches the heights.',
    by: 'Antarah ibn Shaddad', byAr: 'عنترة بن شداد',
    note: 'The warrior-poet of pre-Islamic Arabia. The line is attributed to him; the translation is mine.',
  },
  // Wadi Abqar: the valley of the jinn in old Arab lore. A poet too gifted to be merely human was said
  // to have a companion from Abqar, and the word for genius, ʿabqarī, comes from the valley's name.
  abqar: {
    ar: ['وادي عبقر', 'ومنه قيل للنابغ: عبقري'],
    en: 'The old Arabs told of Wadi Abqar, a valley of jinn. A poet too good to be merely human was said to have a companion from Abqar — and the word for genius, ʿabqarī, comes from its name. No jinn here: just practice, in three schools.',
  },
  juha: [
    { tale: 'Juha lost his ring inside the house, but searched for it out in the street — "the light is better out here."', moral: 'Debug where the fault is, not where it is easy to look.' },
    { tale: 'Juha rode the donkey and people called him cruel; his son rode and they called him spoilt; they both walked and people laughed at them.', moral: 'You cannot please every critic. Build it, then listen to the people who use it.' },
    { tale: "Juha told his neighbour his borrowed pot had given birth to a little pot. The neighbour happily took both — but when Juha said the pot had died, he refused to believe it.", moral: 'A test you only believe when it passes is not a test.' },
  ],
};

export const pursuits = [
  {
    name: 'Compound archery',
    glyph: '➶',
    detail:
      'Cams, let-off, a release aid and a sight to tune. It is the same loop as engineering: change one variable, watch where it lands, go again.',
  },
  {
    name: 'Karate',
    glyph: '拳',
    detail: 'Multiple regional competition medals. Where the discipline comes from.',
  },
  {
    name: 'Making games',
    glyph: '♞',
    flag: 'For Indianapolis, where I lived when I was very small',
    detail: 'Game jams and small Unity and C# games, five of them playable on itch.io — the fastest way to learn what "finished" means.',
  },
  {
    name: 'Debating',
    glyph: '❝',
    detail: 'Second place at Trinity College. Arguing a side I was handed five minutes ago.',
  },
  {
    name: 'Design & 3D',
    glyph: '✎',
    detail: 'Blender modelling and animation, and pattern work — including a camouflage built from Arabic-inspired geometry.',
  },
];

export const guilds = [
  {
    name: 'Saudi Students Association in Melbourne (SSAM)',
    nameAr: 'نادي الطلبة السعوديين في ملبورن',
    logo: 'ssam.webp',
    role: 'Event Coordinator',
    place: 'Melbourne',
    when: '2025',
    detail:
      'Planned and delivered events for 200+ attendees — volunteers, logistics, stakeholders — and co-organised a student hackathon from the ground up. Hosted the SSAM Game Jam with a game-making workshop: made my own entry, Riyma, and helped three students build and submit theirs.',
  },
  {
    name: 'CISSA',
    logo: 'cissa.svg',
    role: 'Codebrew hackathon',
    cv: false, // the same event as the Sirius project, so the CV lists it once
    place: 'University of Melbourne',
    when: '2026',
    detail: 'Built Sirius — a live 3D star map — in 60 hours at CISSA\'s Codebrew, leading the backend in a team of three.',
  },
  {
    name: 'Olchfa School',
    logo: 'olchfa.svg',
    role: 'Form Leader',
    place: 'Swansea, Wales',
    when: '2021 – 2023',
    detail: 'Elected peer representative and trusted point of contact across the year group. Left in 2023 as "Sohaib the great, 23".',
  },
];

export const academies = [
  { name: 'University of Melbourne', logo: 'unimelb.svg', what: 'Bachelor of Design — Mechanical Engineering Systems', when: '2026 – 2029' },
  { name: 'Trinity College', logo: 'trinity.png', what: 'Foundation Studies — Physics, Maths, Chemistry · 78% overall', when: '2025' },
  { name: 'Olchfa School', logo: 'olchfa.svg', what: '9 GCSEs, including A* in Maths and Physics', when: '2023' },
];

// Places I belong to, shown as a wall of logos. Logos belong to their organisations.
// size is the logo's own width and height, so the page keeps its space while it loads.
export const badges = [
  { name: 'University of Melbourne', size: [400, 400], logo: 'unimelb.svg', note: 'Studying', href: 'https://www.unimelb.edu.au' },
  { name: 'Trinity College', size: [445, 100], logo: 'trinity.png', note: 'Foundation Studies', href: 'https://www.trinity.unimelb.edu.au' },
  { name: 'CISSA', size: [165, 165], logo: 'cissa.svg', note: 'Codebrew', href: 'https://www.cissa.org.au' },
  { name: 'Saudi Students Association in Melbourne', size: [278, 360], logo: 'ssam.webp', ar: 'نادي الطلبة السعوديين في ملبورن', note: 'Event Coordinator', href: 'https://www.instagram.com/ssamelbourne/' },
  { name: 'Olchfa School', size: [256, 61], logo: 'olchfa.svg', note: 'Class of 2023', href: 'https://www.olchfa.org.uk' },
];

// email is stored in two parts and joined in the browser, so simple scrapers do not pick it up
export const email = ['sogamer16', 'gmail.com'];
// the downloadable CV, made from the plain view by tools/make-cv-pdf.mjs; remake it after changing this file
export const cvPdf = 'assets/Sohaib-Qutub-CV.pdf';

export const portals = [
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/sohaibqutub', hint: 'Message me here' },
  { name: 'GitHub', href: 'https://github.com/sogamer16', hint: 'See the code' },
  { name: 'itch.io', href: 'https://sogamer16.itch.io/', hint: 'Play my games' },
];

// The three places that shaped me; each island belongs to one of them.
export const lands = {
  // sky: [horizon, middle, zenith, haze] in linear RGB. sun: [colour, strength, elevation°, side].
  // clouds: [colour, cover 0–1]. stars: 0 day … 1 night. below: what lies under the islands.
  hejaz: { // late golden afternoon
    short: 'Makkah',
    sky: [[0.95, 0.52, 0.26], [0.42, 0.36, 0.42], [0.10, 0.17, 0.36], [1.0, 0.62, 0.30]],
    sun: ['#ffc78e', 3.4, 18, -0.8], hemi: ['#ffd9b8', '#6b4a35', 1.0], fog: ['#c99a72', 0.0045],
    clouds: ['#ffd2a6', 0.3], disc: 1, stars: 0.05, exposure: 0.95,
    ground: '#c9a06a', rock: '#9a6a44', below: 0,
  },
  gower: { // soft overcast sea light
    short: 'Swansea',
    sky: [[0.50, 0.56, 0.58], [0.40, 0.47, 0.53], [0.24, 0.32, 0.42], [0.62, 0.66, 0.66]],
    sun: ['#e9f0f4', 1.6, 52, -0.4], hemi: ['#d6e4ec', '#3c4a3c', 1.7], fog: ['#7f9198', 0.0075],
    clouds: ['#dfe6ea', 0.92], disc: 0, stars: 0, exposure: 1.0,
    ground: '#5d8a4c', rock: '#6b6e72', below: 1,
  },
  melbourne: { // blue hour, city lights coming on
    short: 'Melbourne',
    sky: [[0.48, 0.25, 0.28], [0.09, 0.11, 0.28], [0.015, 0.03, 0.10], [0.85, 0.42, 0.26]],
    sun: ['#a6b6ff', 1.7, 26, -0.7], hemi: ['#7f8fd8', '#2a2230', 0.95], fog: ['#1b1b36', 0.005],
    clouds: ['#6f5f92', 0.3], disc: 0, stars: 0.6, exposure: 1.1,
    ground: '#55703f', rock: '#6b5a50', below: 2,
  },
  neutral: { // night at the edge of the world
    short: '',
    sky: [[0.13, 0.06, 0.24], [0.05, 0.035, 0.13], [0.012, 0.01, 0.04], [0.32, 0.10, 0.30]],
    sun: ['#c8d0ff', 1.7, 38, -0.6], hemi: ['#9f8dff', '#2a1f3e', 1.15], fog: ['#120a24', 0.006],
    clouds: ['#6a4fc4', 0.18], disc: 0, stars: 1, exposure: 1.1,
    ground: '#3f6650', rock: '#4f4866', below: 3,
  },
};

// Ordered as the journey runs: Makkah, then Swansea, then Melbourne.
// name is the fantasy name (on the island); short is the plain hotbar label; heading tops the panel.
export const realms = [
  { id: 'hero', land: 'hejaz', glyph: '✦', name: 'Character', short: 'About', heading: 'About me', place: 'The Hejaz Courtyard', placeAr: 'ساحة الحجاز', color: '#f4b860' },
  { id: 'trophies', land: 'gower', glyph: '♛', name: 'Trophies', short: 'Awards', heading: 'Awards & certifications', place: 'The Gower Headland', placeAr: 'رأس غاور', color: '#e8474f' },
  { id: 'quests', land: 'melbourne', glyph: '⚔', name: 'Quests', short: 'Projects', heading: 'Experience & projects', place: 'The Pillars of Iram', placeAr: 'إرم ذات العماد', color: '#c79bff' },
  { id: 'skills', land: 'melbourne', glyph: '❖', name: 'Skills', short: 'Skills', heading: 'Skills', place: 'Wadi Abqar', placeAr: 'وادي عبقر', color: '#7cc4ff' },
  { id: 'guilds', land: 'melbourne', glyph: '⚑', name: 'Guilds', short: 'Clubs', heading: 'Clubs, leadership & education', place: 'The Kashta Camp', placeAr: 'الكشتة', color: '#8dffb0' },
  { id: 'pursuits', land: 'neutral', glyph: '➶', name: 'Pursuits', short: 'Interests', heading: 'Interests', place: 'The Archery Range', placeAr: 'ميدان الرماية', color: '#5ee6d6' },
  { id: 'portal', land: 'neutral', glyph: '◈', name: 'Portal', short: 'Contact', heading: 'Contact', place: 'The Waygate', placeAr: 'البوابة', color: '#ff7ad9' },
];
