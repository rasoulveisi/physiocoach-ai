import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const datasetPath = process.argv[2] ?? '../physiocoach-ai-api/seed-input/exercises.json';
const outputDir = process.argv[3] ?? 'public/images/exercises/catalog';
const exercises = JSON.parse(await readFile(datasetPath, 'utf8'));
await mkdir(outputDir, { recursive: true });

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const palettes = [
  ['#36b49b', '#eef8f7', '#dcecf4'],
  ['#4c8dff', '#eef3ff', '#e4edff'],
  ['#9b72e8', '#f4efff', '#e8e1fb'],
  ['#e7795c', '#fff1ec', '#fbe1d7'],
  ['#d29a3a', '#fff8e8', '#f5e6bf'],
  ['#3caaa8', '#e9f9f8', '#d8efed'],
];

function patternFor(exercise) {
  const text = `${exercise.name} ${exercise.category} ${exercise.target} ${exercise.equipment}`.toLowerCase();
  if (/squat|leg press|sit-up|curl squat/.test(text)) return 'squat';
  if (/deadlift|good morning|hinge|pull through|hip thrust|bridge/.test(text)) return 'hinge';
  if (/lunge|split squat|step-up|step up|curtsey/.test(text)) return 'lunge';
  if (/row|pull-up|pull up|chin-up|chin up|pulldown|pullover|face pull/.test(text)) return 'pull';
  if (/press|push-up|push up|bench|fly|pushdown|extension|raise|dip/.test(text)) return 'push';
  if (/curl|biceps|triceps|wrist|forearm/.test(text)) return 'arms';
  if (/carry|farmer|suitcase|walk/.test(text)) return 'carry';
  if (/plank|crunch|twist|rotation|v-up|sit up|dead bug|bird dog|hollow/.test(text)) return 'core';
  if (/stretch|mobility|rotation|neck|yoga|flex|warm/.test(text)) return 'mobility';
  return 'full-body';
}

const poses = {
  squat: { head: [322, 76], torso: 'M300 112 Q322 96 344 112 L360 190 Q322 210 284 190 Z', limbs: ['M300 122 L248 178 L205 230', 'M344 122 L396 178 L438 230', 'M294 187 L252 250 L205 292', 'M350 187 L399 250 L450 292'], equipment: '<path d="M220 226H450" stroke="#f6c453" stroke-width="10" stroke-linecap="round"/><path d="M220 211V242M450 211V242" stroke="#f6c453" stroke-width="8"/>' },
  hinge: { head: [340, 96], torso: 'M318 122 Q340 105 362 122 L420 184 Q386 210 350 190 Z', limbs: ['M332 132 L280 185 L225 230', 'M360 140 L414 190 L458 232', 'M355 188 L300 252 L258 294', 'M390 186 L420 252 L462 294'], equipment: '<path d="M205 226H465" stroke="#f6c453" stroke-width="10" stroke-linecap="round"/><path d="M205 211V242M465 211V242" stroke="#f6c453" stroke-width="8"/>' },
  lunge: { head: [320, 70], torso: 'M300 110 Q320 95 340 110 L350 190 Q320 205 290 190 Z', limbs: ['M302 122 L245 170 L205 215', 'M338 122 L390 170 L445 195', 'M300 185 L250 245 L190 294', 'M340 185 L390 230 L500 252'], equipment: '' },
  pull: { head: [320, 72], torso: 'M300 110 Q320 94 340 110 L348 192 Q320 206 292 192 Z', limbs: ['M300 122 L235 155 L185 125', 'M340 122 L405 155 L455 125', 'M300 190 L270 250 L245 294', 'M340 190 L375 250 L400 294'], equipment: '<path d="M172 100H468" stroke="#f6c453" stroke-width="10" stroke-linecap="round"/><path d="M172 100V315M468 100V315" stroke="#f6c453" stroke-width="7"/><path d="M230 100Q320 180 410 100" fill="none" stroke="#f6c453" stroke-width="6"/>' },
  push: { head: [320, 72], torso: 'M300 110 Q320 94 340 110 L348 190 Q320 206 292 190 Z', limbs: ['M300 122 L240 145 L185 126', 'M340 122 L400 145 L455 126', 'M300 190 L270 250 L245 294', 'M340 190 L375 250 L400 294'], equipment: '<path d="M155 118H485" stroke="#f6c453" stroke-width="9" stroke-linecap="round"/><path d="M205 104V132M435 104V132" stroke="#f6c453" stroke-width="8"/>' },
  arms: { head: [320, 72], torso: 'M300 110 Q320 94 340 110 L348 192 Q320 206 292 192 Z', limbs: ['M300 122 L245 170 L205 220', 'M340 122 L395 170 L435 220', 'M300 190 L270 250 L245 294', 'M340 190 L375 250 L400 294'], equipment: '<path d="M198 218H228M422 218H452" stroke="#f6c453" stroke-width="9" stroke-linecap="round"/>' },
  carry: { head: [320, 72], torso: 'M300 110 Q320 94 340 110 L348 192 Q320 206 292 192 Z', limbs: ['M300 122 L250 175 L220 225', 'M340 122 L390 175 L420 225', 'M300 190 L270 250 L245 294', 'M340 190 L375 250 L400 294'], equipment: '<rect x="205" y="220" width="28" height="48" rx="8" fill="#f6c453"/><rect x="407" y="220" width="28" height="48" rx="8" fill="#f6c453"/>' },
  core: { head: [318, 140], torso: 'M294 158 Q318 142 342 158 L382 202 Q340 222 300 204 Z', limbs: ['M300 170 L245 205 L195 235', 'M338 170 L400 190 L460 206', 'M320 204 L270 260 L220 286', 'M350 204 L400 250 L455 270'], equipment: '<path d="M165 292H480" stroke="#a6b4c8" stroke-width="6" stroke-linecap="round"/>' },
  mobility: { head: [320, 72], torso: 'M300 110 Q320 94 340 110 L348 192 Q320 206 292 192 Z', limbs: ['M300 122 L245 150 L190 125', 'M340 122 L395 150 L450 125', 'M300 190 L270 250 L245 294', 'M340 190 L375 250 L400 294'], equipment: '<circle cx="320" cy="155" r="105" fill="none" stroke="#51d6b2" stroke-width="4" stroke-dasharray="10 14"/>' },
  'full-body': { head: [320, 72], torso: 'M300 110 Q320 94 340 110 L348 192 Q320 206 292 192 Z', limbs: ['M300 122 L245 170 L205 220', 'M340 122 L395 170 L435 220', 'M300 190 L270 250 L245 294', 'M340 190 L375 250 L400 294'], equipment: '' },
};

function render(exercise) {
  const pattern = patternFor(exercise);
  const pose = poses[pattern];
  const variant = Number.parseInt(String(exercise.id), 10) || 0;
  const [accent, backgroundStart, backgroundEnd] = palettes[variant % palettes.length];
  const [headX, headY] = pose.head;
  const lines = pose.limbs.map((line) => `<path d="${line}" fill="none" stroke="#17324d" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const equipment = pose.equipment.replaceAll('#f6c453', accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-labelledby="title desc"><title id="title">${escape(exercise.name)}</title><desc id="desc">PhysioCoach-owned ${pattern} movement illustration, variant ${variant % palettes.length + 1}.</desc><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${backgroundStart}"/><stop offset="1" stop-color="${backgroundEnd}"/></linearGradient></defs><rect width="640" height="360" rx="28" fill="url(#bg)"/><path d="M72 310H568" stroke="#b6ced8" stroke-width="4" stroke-linecap="round"/><g>${equipment}<circle cx="${headX}" cy="${headY}" r="25" fill="#ffcf9d" stroke="#17324d" stroke-width="8"/><path d="${pose.torso}" fill="${accent}" stroke="#17324d" stroke-width="8"/>${lines}<circle cx="${headX - 8}" cy="${headY - 4}" r="3" fill="#17324d"/><path d="M${headX - 2} ${headY + 10}Q${headX + 8} ${headY + 16} ${headX + 15} ${headY + 8}" fill="none" stroke="#17324d" stroke-width="3"/></g><rect x="36" y="28" width="158" height="30" rx="15" fill="#17324d" opacity=".92"/><text x="115" y="49" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#fff" letter-spacing="1">PHYSIOCOACH</text><text x="36" y="342" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#17324d">${escape(exercise.name.slice(0, 54))}</text><text x="604" y="48" text-anchor="end" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${accent}">${pattern.toUpperCase()}</text></svg>`;
}

for (const exercise of exercises) {
  const file = join(outputDir, `${String(exercise.id).padStart(4, '0')}.svg`);
  await writeFile(file, render(exercise));
}
console.log(JSON.stringify({ outputDir, generated: exercises.length }));
