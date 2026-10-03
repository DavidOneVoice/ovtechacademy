import test from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_PROGRAMMES, getCanonicalProgrammeOptions, normalizeProgrammeName } from './programmes.js';
import { CURRICULUM_GROUPS, curriculumItemMatchesStudentTrack, resolveCurriculumGroup } from '../lms/tracks.js';

test('legacy programme spellings resolve to one of the six academy courses', () => {
  const variants = {
    Cybersecurity: ['Cybersecurity', 'Cyber Security', 'cyber-security'],
    'Virtual Assistant': ['Virtual Assistant', 'Virtual Assistance'],
    'Data Analytics': ['Data Analytics', 'Data Analysis', 'data-analysis'],
    'AI Automation': ['AI Automation', 'AI & Automation', 'AI and Automation'],
    'Software Development': ['Software Development', 'Software Development (Frontend)', 'Front-end Development'],
    'Web Development': ['Web Development', 'web-development'],
  };
  for (const [course, names] of Object.entries(variants)) {
    for (const name of names) assert.equal(normalizeProgrammeName(name), course);
  }
  const options = getCanonicalProgrammeOptions(Object.values(variants).flat());
  assert.equal(options.length, 6);
  assert.deepEqual(new Set(options), new Set(CANONICAL_PROGRAMMES));
});

test('programme alias normalization preserves curriculum subjects and curriculum groups', () => {
  for (const subject of ['Microsoft Excel', 'Power Query', 'Power BI', 'SQL', 'Python']) {
    assert.equal(normalizeProgrammeName(subject), subject);
  }
  assert.equal(resolveCurriculumGroup('Cyber Security'), CURRICULUM_GROUPS.CYBERSECURITY);
  assert.equal(resolveCurriculumGroup('Virtual Assistance'), CURRICULUM_GROUPS.VIRTUAL_ASSISTANT);
  assert.equal(resolveCurriculumGroup('Data Analysis'), CURRICULUM_GROUPS.DATA_ANALYTICS);
  assert.equal(resolveCurriculumGroup('AI & Automation'), CURRICULUM_GROUPS.AI_AUTOMATION);
  assert.equal(resolveCurriculumGroup('Software Development (Frontend)'), CURRICULUM_GROUPS.COMPUTER_PROGRAMMING);
  assert.equal(resolveCurriculumGroup('Web Development'), CURRICULUM_GROUPS.COMPUTER_PROGRAMMING);
  assert.notEqual(normalizeProgrammeName('Web Development'), normalizeProgrammeName('Software Development'));
});

test('legacy enrollments match their curriculum without granting another programme', () => {
  assert.equal(curriculumItemMatchesStudentTrack({course: 'Cybersecurity'}, {track: 'Cyber Security'}), true);
  assert.equal(curriculumItemMatchesStudentTrack({course: 'Power BI'}, {track: 'Data Analysis'}), true);
  assert.equal(curriculumItemMatchesStudentTrack({course: 'Virtual Assistant'}, {track: 'Virtual Assistance'}), true);
  assert.equal(curriculumItemMatchesStudentTrack({course: 'AI Automation'}, {track: 'AI & Automation'}), true);
  assert.equal(curriculumItemMatchesStudentTrack({course: 'Web Development'}, {track: 'Software Development (Frontend)'}), false);
  assert.equal(curriculumItemMatchesStudentTrack({course: 'Cybersecurity'}, {track: 'Virtual Assistance'}), false);
});
