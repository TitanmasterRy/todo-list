import { describe, expect, it } from 'vitest';
import { latestGrade, matchToCourses, parseGradeCell, parsePowerSchoolHTML, parsePowerSchoolText, type PSCourse } from './powerschool';

// ───────────────────────── fixtures ─────────────────────────

const days = '<td>&nbsp;</td>'.repeat(10);

/** Classic PowerSchool student-portal "Grades and Attendance" (guardian/home.html). */
const CLASSIC = `<!DOCTYPE html>
<html><head><title>Grades and Attendance</title></head>
<body>
<div id="header"><span id="firstlast">Doe, Jane</span></div>
<table border="0" cellpadding="3" cellspacing="1" align="center" width="100%" id="quickLookup" class="linkDescList grid">
  <tr class="center th2">
    <th rowspan="2">Exp</th><th colspan="5">Last Week</th><th colspan="5">This Week</th>
    <th rowspan="2">Course</th>
    <th rowspan="2">Q1</th><th rowspan="2">Q2</th><th rowspan="2">S1</th><th rowspan="2">Q3</th><th rowspan="2">Q4</th><th rowspan="2">S2</th>
    <th rowspan="2">Absences</th><th rowspan="2">Tardies</th>
  </tr>
  <tr class="center th2"><th>M</th><th>T</th><th>W</th><th>H</th><th>F</th><th>M</th><th>T</th><th>W</th><th>H</th><th>F</th></tr>
  <tr class="center">
    <td>1(A)</td>${days}
    <td class="table-element-text-align-start">AP&nbsp;Biology<br>&nbsp;&nbsp;<a href="mailto:jsmith@school.org">Email Smith, John</a></td>
    <td><a href="scores.html?frn=004123&amp;fg=Q1">A<br>94</a></td>
    <td><a href="scores.html?frn=004123&amp;fg=Q2">B+<br>88</a></td>
    <td><a href="scores.html?frn=004123&amp;fg=S1">A-<br>91</a></td>
    <td>[ i ]</td><td>--</td><td>--</td>
    <td><a href="attendance.html?frn=004123">2</a></td><td>1</td>
  </tr>
  <tr class="center">
    <td>2(B)</td>${days}
    <td class="table-element-text-align-start">Algebra II &amp; Trig<br>&nbsp;&nbsp;<a href="mailto:m.garcia@school.org">Email Garc&iacute;a, Mar&iacute;a</a></td>
    <td><a href="scores.html?frn=004124&amp;fg=Q1">B<br>85.5</a></td>
    <td>--</td><td>--</td><td>--</td><td>--</td><td>--</td>
    <td>0</td><td>3</td>
  </tr>
  <tr class="center">
    <td>3(A-B)</td>${days}
    <td class="table-element-text-align-start">Advisory<br>&nbsp;&nbsp;<a href="mailto:p@school.org">Email Patel, Ravi</a></td>
    <td>--</td><td>--</td><td>--</td><td>--</td><td>--</td><td>--</td>
    <td>0</td><td>0</td>
  </tr>
  <tr class="center">
    <td>4(B)</td>${days}
    <td class="table-element-text-align-start"><br>&nbsp;&nbsp;</td>
    <td>--</td><td>--</td><td>--</td><td>--</td><td>--</td><td>--</td>
    <td>0</td><td>0</td>
  </tr>
  <tr><td align="center" colspan="20">Attendance Totals</td></tr>
</table>
<table class="grid"><tr><th>Legend</th></tr><tr><td>[ i ] Grade not yet available</td></tr></table>
</body></html>`;

/** Newer PowerSchool UI: <thead>, spans in the course cell, Details link, "--" cells. */
const NEWER = `<html><head><title>Grades and Attendance: Sam Lee</title></head><body>
<div id="userName"><span class="name">Lee, Sam</span></div>
<div class="box-round">
<table class="grid linkDescList" id="quickLookup">
<thead>
<tr>
  <th>Exp</th><th class="left">Course</th>
  <th>T1</th><th>T2</th><th>T3</th><th>Y1</th>
  <th>Absences</th><th>Tardies</th>
</tr>
</thead>
<tbody>
<tr class="center">
  <td class="center">1(A)</td>
  <td class="table-element-text-align-start"><span class="course-name">Honors Chemistry</span><br><span>&nbsp;</span><a class="detail-link" href="teacherinfo.html?frn=005">Details</a>&nbsp;<a href="mailto:kwong@school.org">Email Wong, Karen</a></td>
  <td class="center"><a href="scores.html?frn=0051&amp;fg=T1">A<br>96.4</a></td>
  <td class="center"><a href="scores.html?frn=0051&amp;fg=T2">A-<br>90</a></td>
  <td class="center">--</td>
  <td class="center"><a href="scores.html?frn=0051&amp;fg=Y1">A<br>93</a></td>
  <td class="center"><a href="attendance.html?frn=0051">1</a></td>
  <td class="center">0</td>
</tr>
<tr class="center">
  <td class="center">2(B)</td>
  <td class="table-element-text-align-start"><span>Spanish III</span><br><span>&nbsp;</span><a href="mailto:alopez@school.org">Lopez, Ana</a></td>
  <td class="center"><a href="scores.html?frn=0052&amp;fg=T1">B<br>85</a></td>
  <td class="center">[ i ]</td>
  <td class="center">--</td>
  <td class="center"><a href="scores.html?frn=0052&amp;fg=Y1">B<br>85</a></td>
  <td class="center">4</td>
  <td class="center">2</td>
</tr>
<tr class="center">
  <td class="center">3(A)</td>
  <td class="table-element-text-align-start"><span>PE 10</span><br><span>&nbsp;</span><a href="mailto:x@school.org">Email Brown, Terry</a></td>
  <td class="center"><a href="scores.html?frn=0053&amp;fg=T1">P</a></td>
  <td class="center">--</td>
  <td class="center">--</td>
  <td class="center">--</td>
  <td class="center">0</td>
  <td class="center">0</td>
</tr>
</tbody>
</table>
</div></body></html>`;

// ───────────────────────── tests ─────────────────────────

describe('parseGradeCell', () => {
  it('parses letter + percent, letter only, percent only', () => {
    expect(parseGradeCell('A\n95')).toEqual({ letter: 'A', percent: 95 });
    expect(parseGradeCell('B+ 88')).toEqual({ letter: 'B+', percent: 88 });
    expect(parseGradeCell('91.5%')).toEqual({ percent: 91.5 });
    expect(parseGradeCell('P')).toEqual({ letter: 'P' });
  });
  it('treats placeholders as no grade', () => {
    expect(parseGradeCell('--')).toBeNull();
    expect(parseGradeCell('[ i ]')).toBeNull();
    expect(parseGradeCell('')).toBeNull();
    expect(parseGradeCell('  ')).toBeNull();
  });
});

describe('parsePowerSchoolHTML (classic markup)', () => {
  const r = parsePowerSchoolHTML(CLASSIC);
  it('finds the student name', () => {
    expect(r.student).toBe('Doe, Jane');
  });
  it('lists the term columns in order', () => {
    expect(r.terms).toEqual(['Q1', 'Q2', 'S1', 'Q3', 'Q4', 'S2']);
  });
  it('ignores rows without a course name and the legend table', () => {
    expect(r.courses.map((c) => c.name)).toEqual(['AP Biology', 'Algebra II & Trig', 'Advisory']);
  });
  it('extracts teachers, periods and attendance', () => {
    expect(r.courses[0].teacher).toBe('Smith, John');
    expect(r.courses[0].period).toBe('1(A)');
    expect(r.courses[0].absences).toBe(2);
    expect(r.courses[0].tardies).toBe(1);
    expect(r.courses[1].teacher).toBe('García, María');
    expect(r.courses[1].absences).toBe(0);
    expect(r.courses[1].tardies).toBe(3);
    expect(r.courses[2].period).toBe('3(A-B)');
  });
  it('extracts per-term letters and percents, skipping -- and [ i ]', () => {
    expect(r.courses[0].terms).toEqual({ Q1: { letter: 'A', percent: 94 }, Q2: { letter: 'B+', percent: 88 }, S1: { letter: 'A-', percent: 91 } });
    expect(r.courses[1].terms).toEqual({ Q1: { letter: 'B', percent: 85.5 } });
    expect(r.courses[2].terms).toEqual({});
  });
});

describe('parsePowerSchoolHTML (newer markup)', () => {
  const r = parsePowerSchoolHTML(NEWER);
  it('finds the student name from #userName', () => {
    expect(r.student).toBe('Lee, Sam');
  });
  it('lists the term columns', () => {
    expect(r.terms).toEqual(['T1', 'T2', 'T3', 'Y1']);
  });
  it('parses course names from <span> cells and strips the Details link', () => {
    expect(r.courses.map((c) => c.name)).toEqual(['Honors Chemistry', 'Spanish III', 'PE 10']);
  });
  it('parses teachers with or without the "Email" prefix', () => {
    expect(r.courses[0].teacher).toBe('Wong, Karen');
    expect(r.courses[1].teacher).toBe('Lopez, Ana');
    expect(r.courses[2].teacher).toBe('Brown, Terry');
  });
  it('parses grades, including letter-only and decimals', () => {
    expect(r.courses[0].terms).toEqual({ T1: { letter: 'A', percent: 96.4 }, T2: { letter: 'A-', percent: 90 }, Y1: { letter: 'A', percent: 93 } });
    expect(r.courses[1].terms).toEqual({ T1: { letter: 'B', percent: 85 }, Y1: { letter: 'B', percent: 85 } });
    expect(r.courses[2].terms).toEqual({ T1: { letter: 'P' } });
    expect(r.courses[0].absences).toBe(1);
    expect(r.courses[1].absences).toBe(4);
    expect(r.courses[1].tardies).toBe(2);
    expect(r.courses[1].period).toBe('2(B)');
  });
});

describe('parsePowerSchoolHTML (edge cases)', () => {
  it('returns an empty result for junk input', () => {
    expect(parsePowerSchoolHTML('')).toEqual({ courses: [], terms: [] });
    expect(parsePowerSchoolHTML('<p>hello</p>')).toEqual({ courses: [], terms: [] });
    expect(parsePowerSchoolHTML('<table><tr><td>no header</td></tr></table>')).toEqual({ courses: [], terms: [] });
  });
  it('falls back to any table with a term-code header when there is no id', () => {
    const html = `<table><tr><th>Course</th><th>Q1</th><th>Q2</th></tr>
      <tr><td>World History<br><a href="mailto:a@b.c">Email Adams, Kim</a></td><td>A<br>97</td><td>--</td></tr></table>`;
    const r = parsePowerSchoolHTML(html);
    expect(r.terms).toEqual(['Q1', 'Q2']);
    expect(r.courses).toEqual([{ name: 'World History', teacher: 'Adams, Kim', terms: { Q1: { letter: 'A', percent: 97 } } }]);
  });
});

describe('parsePowerSchoolText', () => {
  it('parses inline term-labelled lines', () => {
    const text = `AP Biology  Q1 A 94  Q2 B+ 88
Honors Chemistry\tQ1 A- 91.5\tQ2 --\tS1 [ i ]
Spanish III  Email Lopez, Ana  Q1 B 85  Q2 B 86  S1 B 85.5  Absences 2 Tardies 0

`;
    const r = parsePowerSchoolText(text);
    expect(r.terms).toEqual(['Q1', 'Q2', 'S1']);
    expect(r.courses.map((c) => c.name)).toEqual(['AP Biology', 'Honors Chemistry', 'Spanish III']);
    expect(r.courses[0].terms).toEqual({ Q1: { letter: 'A', percent: 94 }, Q2: { letter: 'B+', percent: 88 } });
    expect(r.courses[1].terms).toEqual({ Q1: { letter: 'A-', percent: 91.5 } });
    expect(r.courses[2].teacher).toBe('Lopez, Ana');
    expect(r.courses[2].terms).toEqual({ Q1: { letter: 'B', percent: 85 }, Q2: { letter: 'B', percent: 86 }, S1: { letter: 'B', percent: 85.5 } });
    expect(r.courses[2].absences).toBe(2);
    expect(r.courses[2].tardies).toBe(0);
  });
  it('parses a copied table with a header line of term codes', () => {
    const text = `Exp\tCourse\tQ1\tQ2\tS1\tAbsences\tTardies
1(A)\tAP Biology\tA 94\tB+ 88\t--\t2\t1
2(B)\tHonors Chemistry\tA- 91.5\t[ i ]\t--\t0\t3
3(A)\tPE 10\tEmail Brown, Terry\tP\t--\t--\t0\t0`;
    const r = parsePowerSchoolText(text);
    expect(r.terms).toEqual(['Q1', 'Q2', 'S1']);
    expect(r.courses.map((c) => c.name)).toEqual(['AP Biology', 'Honors Chemistry', 'PE 10']);
    expect(r.courses[0].period).toBe('1(A)');
    expect(r.courses[0].terms).toEqual({ Q1: { letter: 'A', percent: 94 }, Q2: { letter: 'B+', percent: 88 } });
    expect(r.courses[0].absences).toBe(2);
    expect(r.courses[0].tardies).toBe(1);
    expect(r.courses[1].terms).toEqual({ Q1: { letter: 'A-', percent: 91.5 } });
    expect(r.courses[2].teacher).toBe('Brown, Terry');
    expect(r.courses[2].terms).toEqual({ Q1: { letter: 'P' } });
  });
  it('returns nothing for text with no grades', () => {
    expect(parsePowerSchoolText('just some notes\nnothing here')).toEqual({ courses: [], terms: [] });
    expect(parsePowerSchoolText('')).toEqual({ courses: [], terms: [] });
  });
});

describe('matchToCourses', () => {
  const ps: PSCourse[] = [
    { name: 'AP Biology', terms: {} },
    { name: 'Algebra II & Trig', terms: {} },
    { name: 'Honors Chemistry', terms: {} },
    { name: 'Advisory', terms: {} },
  ];
  const courses = [
    { id: 'c1', name: 'Biology' },
    { id: 'c2', name: 'algebra ii and trig' },
    { id: 'c3', name: 'Chemistry (Honors)' },
    { id: 'c4', name: 'English 10' },
  ];
  it('matches exact (case/punctuation-insensitive), then contains-either-way, else undefined', () => {
    const r = matchToCourses(ps, courses);
    expect(r.map((x) => x.courseId)).toEqual(['c1', 'c2', undefined, undefined]);
    expect(r[0].ps).toBe(ps[0]);
  });
  it('prefers exact matches over partial ones and uses each course once', () => {
    const r = matchToCourses(
      [
        { name: 'Chem', terms: {} },
        { name: 'Chemistry', terms: {} },
      ],
      [
        { id: 'a', name: 'Chemistry' },
        { id: 'b', name: 'AP Chemistry' },
      ],
    );
    expect(r[1].courseId).toBe('a');
    expect(r[0].courseId).toBe('b');
  });
  it('handles empty inputs', () => {
    expect(matchToCourses([], courses)).toEqual([]);
    expect(matchToCourses(ps, [])).toEqual(ps.map((p) => ({ ps: p })));
  });
});

describe('latestGrade', () => {
  const c: PSCourse = { name: 'X', terms: { Q1: { letter: 'A', percent: 94 }, Q2: { letter: 'B+', percent: 88 }, S1: { letter: 'A-' }, Q3: {} } };
  it('prefers the given term when it has a grade', () => {
    expect(latestGrade(c, 'Q1')).toEqual({ term: 'Q1', percent: 94, letter: 'A' });
    expect(latestGrade(c, 'q1')).toEqual({ term: 'Q1', percent: 94, letter: 'A' });
    expect(latestGrade(c, 'S1')).toEqual({ term: 'S1', letter: 'A-' });
  });
  it('falls back to the last term with a percent', () => {
    expect(latestGrade(c)).toEqual({ term: 'Q2', percent: 88, letter: 'B+' });
    expect(latestGrade(c, 'Q3')).toEqual({ term: 'Q2', percent: 88, letter: 'B+' });
    expect(latestGrade(c, 'Q4')).toEqual({ term: 'Q2', percent: 88, letter: 'B+' });
  });
  it('falls back to a letter-only term, else null', () => {
    expect(latestGrade({ name: 'Y', terms: { T1: { letter: 'P' } } })).toEqual({ term: 'T1', letter: 'P' });
    expect(latestGrade({ name: 'Z', terms: {} })).toBeNull();
    expect(latestGrade({ name: 'W', terms: { Q1: {} } })).toBeNull();
  });
});
