import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';

const marker = '// OVTECH_NEW_APPLICANT_PHONE_V1';
const canonicalCreate = 'validNewScholarship()';
const legacyCreate = "request.resource.data.cohortId == 'october-2026' && !request.resource.data.keys().hasAny(['attendance', 'attendanceMarkedSessions', 'lastAttendanceMarkedAt'])";
const compact = (value) => value.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');

// Generate the rules' country/calling-code table from the same pinned metadata
// as the form and the trusted payment API. Countries sharing a code stay listed
// separately, and Italy's significant national leading zero remains supported.
export function applicantPhoneRuleHelpers() {
  const codes = Object.fromEntries(getCountries().map((country) => [country, `+${getCountryCallingCode(country)}`]));
  return `${marker}
    function applicantPhoneCallingCode(country) {
      return ${JSON.stringify(codes)}.get(country, '');
    }
    function validApplicantPhone() {
      let d = request.resource.data;
      return d.keys().hasAll(['phoneCountry', 'phoneCallingCode', 'phoneNationalNumber', 'whatsapp'])
        && d.phoneCountry is string && d.phoneCountry.matches('^[A-Z]{2}$')
        && d.phoneCallingCode is string && d.phoneCallingCode != ''
        && d.phoneCallingCode == applicantPhoneCallingCode(d.phoneCountry)
        && d.phoneNationalNumber is string && d.phoneNationalNumber.matches('^[0-9]{4,14}$')
        && (d.phoneCountry != 'NG' || d.phoneNationalNumber.matches('^[1-9][0-9]{9}$'))
        && (d.phoneCountry != 'UG' || d.phoneNationalNumber.matches('^[1-9][0-9]{8}$'))
        && d.whatsapp is string && d.whatsapp == d.phoneCallingCode + d.phoneNationalNumber
        && d.whatsapp.matches('^[+][1-9][0-9]{4,14}$');
    }
    `;
}

function scholarshipBlock(source) {
  const headers = [...source.matchAll(/match\s+\/scholarshipApplications\/\{documentId\}\s*\{/g)];
  if (headers.length !== 1) throw new Error('Live scholarship rules differ from the reviewed layouts. No rules were changed.');
  const header = headers[0];
  let depth = 1, quote = '', lineComment = false, blockComment = false;
  const bodyStart = header.index + header[0].length;
  for (let cursor = bodyStart; cursor < source.length; cursor += 1) {
    const char = source[cursor], next = source[cursor + 1];
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; cursor += 1; } continue; }
    if (quote) { if (char === '\\') cursor += 1; else if (char === quote) quote = ''; continue; }
    if (char === '/' && next === '/') { lineComment = true; cursor += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; cursor += 1; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) {
      return { start: header.index, bodyStart, bodyEnd: cursor, body: source.slice(bodyStart, cursor) };
    }
  }
  throw new Error('Live scholarship rules differ from the reviewed layouts. No rules were changed.');
}

export function scholarshipPhoneRules(source) {
  const block = scholarshipBlock(source);
  const createClauses = [...block.body.matchAll(/allow\s+([^:;]+):\s*if\s*([^;]+);/g)]
    .filter((clause) => clause[1].split(',').some((method) => ['create', 'write'].includes(method.trim())));
  const fail = () => { throw new Error('Live scholarship rules differ from the reviewed layouts. No rules were changed.'); };
  if (createClauses.length !== 1 || createClauses[0][1].trim() !== 'create' || /\bmatch\s+\//.test(block.body)) fail();
  const create = createClauses[0];
  const expression = compact(create[2]);
  const bases = [canonicalCreate, legacyCreate];
  const guarded = bases.find((base) => expression === compact(`(${base}) && validApplicantPhone()`));
  if (source.includes(marker)) {
    // A marker alone is not proof that validation was deployed correctly.
    if (!guarded || !source.includes(applicantPhoneRuleHelpers())) fail();
    return source;
  }
  if (source.includes('function validApplicantPhone') || source.includes('function applicantPhoneCallingCode')) fail();
  const base = bases.find((candidate) => compact(candidate) === expression);
  if (!base || (base === canonicalCreate && !/function\s+validNewScholarship\s*\(\s*\)/.test(source))) fail();
  const absoluteCreate = block.bodyStart + create.index;
  const updated = source.slice(0, absoluteCreate)
    + `allow create: if (${create[2].trim()}) && validApplicantPhone();`
    + source.slice(absoluteCreate + create[0].length);
  return updated.slice(0, block.start) + applicantPhoneRuleHelpers() + updated.slice(block.start);
}
