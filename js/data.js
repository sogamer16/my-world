// All content on the site lives here. Edit this file to update the chronicle.

export const hero = {
  name: 'Sohaib Qutub',
  title: 'Artificer of Flow & Circuit',
  klass: 'Mechanical Engineering Systems',
  guild: 'University of Melbourne',
  realm: 'Melbourne, VIC',
  year: 1,
  years: 3,
  lore:
    'I build things. An engineering student who wants to know how and why the machine works — ' +
    'then wires it, codes it and ships it. Six hackathons deep, in teams and alone, across ' +
    'mechanical engineering, embedded systems, ML and software.',
  journey: ['Makkah', 'Swansea, Wales', 'Melbourne'],
  attributes: [
    { key: 'INT', label: 'Intellect', value: 16, note: 'A* Maths & Physics · CFD · ML' },
    { key: 'DEX', label: 'Craft', value: 17, note: 'Wiring, sensors, Arduino, Raspberry Pi' },
    { key: 'CHA', label: 'Voice', value: 15, note: 'Debating · pitches · 200+ person events' },
    { key: 'STR', label: 'Discipline', value: 14, note: 'Karate medals · Duke of Edinburgh' },
    { key: 'WIS', label: 'Systems Sense', value: 15, note: 'Sees how the whole thing fits together' },
  ],
  tongues: [
    { name: 'Arabic', rank: 'Native' },
    { name: 'English', rank: 'IELTS 8.0' },
    { name: 'Welsh', rank: 'Beginner' },
  ],
};

export const quests = [
  {
    name: 'Totex Energy',
    kind: 'Main Quest',
    role: 'Engineering Intern · energy startup',
    when: 'Jul – Sep 2026',
    status: 'Complete',
    summary: 'Hands-on work across live HVAC and electrical systems.',
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
    kind: 'Epic Quest',
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
    name: 'Sentinel',
    kind: 'Raid',
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
    kind: 'Raid',
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
  },
  {
    name: 'The Flow Trials',
    kind: 'Side Quest',
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
];

// rank: 1 Novice · 2 Adept · 3 Seasoned
export const skillTree = [
  {
    branch: 'Spellcraft',
    sub: 'Programming & tools',
    color: '#7cc4ff',
    skills: [
      { name: 'Python', rank: 3 },
      { name: 'C / C++', rank: 3 },
      { name: 'Bash', rank: 2 },
      { name: 'Linux / WSL', rank: 2 },
      { name: 'Git / GitHub', rank: 2 },
      { name: 'Full-stack web', rank: 2 },
      { name: 'ML · Isolation Forest', rank: 2 },
    ],
  },
  {
    branch: 'Forgecraft',
    sub: 'Engineering & CAD',
    color: '#ffb454',
    skills: [
      { name: 'Fluid mechanics', rank: 2 },
      { name: 'CFD · SimScale', rank: 2 },
      { name: 'MATLAB', rank: 2 },
      { name: 'Blender', rank: 2 },
      { name: 'SolidWorks', rank: 1 },
      { name: 'AutoCAD', rank: 1 },
    ],
  },
  {
    branch: 'Runecraft',
    sub: 'Hardware & IoT',
    color: '#8dffb0',
    skills: [
      { name: 'Arduino', rank: 3 },
      { name: 'Sensor systems', rank: 3 },
      { name: 'Raspberry Pi', rank: 2 },
      { name: 'Modbus', rank: 2 },
      { name: 'GPIO', rank: 2 },
      { name: 'HVAC wiring', rank: 2 },
    ],
  },
];

export const rankNames = ['', 'Novice', 'Adept', 'Seasoned'];

export const trophies = [
  { name: 'McKinsey Forward', detail: 'McKinsey & Company professional development program', when: '2025', tier: 'gold' },
  { name: 'Silver Tongue', detail: '2nd place, Trinity College debating', when: '2025', tier: 'silver' },
  { name: 'Six Hackathons', detail: 'Built and shipped under the clock, six times', when: '2025–26', tier: 'gold' },
  { name: 'Duke of Edinburgh', detail: 'Bronze Award', when: '2023', tier: 'bronze' },
  { name: 'Way of the Empty Hand', detail: 'Multiple regional karate medals', when: '', tier: 'gold' },
  { name: 'Twin Stars', detail: 'A* in GCSE Mathematics and Physics', when: '2023', tier: 'gold' },
];

export const scrolls = [
  'Fundamentals of Fluid Power — NCFP',
  'Natural Gas — Coursera',
  'Introduction to Materials Science — ASU',
  'Crystal Structures & Properties of Metals — ASU',
  'Introduction to Cybersecurity Fundamentals',
];

export const guilds = [
  {
    name: 'Saudi Student Club',
    role: 'Event Coordinator',
    place: 'University of Melbourne',
    when: '2025',
    detail:
      'Planned and delivered events for 200+ attendees — volunteers, logistics, stakeholders — and co-organised a student hackathon from the ground up.',
  },
  {
    name: 'Olchfa Comprehensive',
    role: 'Form Leader',
    place: 'Swansea, Wales',
    when: '2021 – 2023',
    detail: 'Elected peer representative and trusted point of contact across the year group.',
  },
];

export const academies = [
  { name: 'University of Melbourne', what: 'Bachelor of Design — Mechanical Engineering Systems', when: '2026 – 2029' },
  { name: 'Trinity College', what: 'Foundation Studies — Physics, Maths, Chemistry · 78% overall', when: '2025' },
  { name: 'Olchfa Comprehensive School', what: '9 GCSEs', when: '2023' },
];

export const portals = [
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/sohaibqutub', hint: 'Send a raven' },
  { name: 'GitHub', href: 'https://github.com/sogamer16', hint: 'Inspect the workshop' },
];

export const realms = [
  { id: 'hero', glyph: '✦', name: 'Character', place: 'The Crystal Spire', color: '#b79bff' },
  { id: 'quests', glyph: '⚔', name: 'Quests', place: 'The Standing Stones', color: '#ff8a5c' },
  { id: 'skills', glyph: '❖', name: 'Skills', place: 'The Constellation Tree', color: '#7cc4ff' },
  { id: 'trophies', glyph: '♛', name: 'Trophies', place: 'The Hall of Deeds', color: '#ffd166' },
  { id: 'guilds', glyph: '⚑', name: 'Guilds', place: 'The Banner Camp', color: '#8dffb0' },
  { id: 'portal', glyph: '◈', name: 'Portal', place: 'The Waygate', color: '#ff7ad9' },
];
