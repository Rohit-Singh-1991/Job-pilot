const test = require("node:test");
const assert = require("node:assert/strict");
const { isRecent, scoreJob, normalizeJob, isLocationCompatible } = require("../scripts/job-discovery.cjs");
const { mapRemoteOkJob, isRelevant } = require("../api/jobs.js");

test("Java + Angular full-stack role receives a strong track score", () => {
  const score = scoreJob({
    title: "Senior Java Angular Full Stack Engineer",
    description: "Spring Boot microservices and REST APIs",
    location: "Remote"
  }, "javaAngular");
  assert.ok(score >= 10, "expected the role to rank strongly for Java + Angular");
});

test("Angular leadership role receives a strong lead-track score", () => {
  const score = scoreJob({
    title: "Lead Angular Developer",
    description: "TypeScript and frontend architecture",
    location: "Remote"
  }, "leadAngular");
  assert.ok(score >= 10, "expected the role to rank strongly for Lead Angular");
});

test("internship roles are penalized rather than promoted as senior matches", () => {
  const score = scoreJob({
    title: "Java Angular Intern",
    description: "Java and Angular development"
  }, "javaAngular");
  assert.ok(score < 3);
});

test("public feed excludes trainee and junior roles for senior-target tracks", () => {
  assert.equal(isRelevant({ title: "Trainee Software Engineer", searchText: "Java Angular Spring Boot" }, "javaAngular"), false);
  assert.equal(isRelevant({ title: "Junior Angular Developer", searchText: "Angular TypeScript" }, "leadAngular"), false);
  assert.equal(isRelevant({ title: "Senior Java Angular Full Stack Engineer", searchText: "Java Angular Spring Boot" }, "javaAngular"), true);
});

test("date filter rejects old listings but tolerates missing feed dates", () => {
  const now = Date.parse("2026-10-16T00:00:00Z");
  assert.equal(isRecent("2026-10-10T00:00:00Z", now), true);
  assert.equal(isRecent("2026-08-01T00:00:00Z", now), false);
  assert.equal(isRecent("", now), true);
});

test("normalizer rejects unsafe/non-HTTP links and keeps track-specific dedupe keys", () => {
  assert.equal(normalizeJob({ title: "Lead Angular Developer", url: "javascript:alert(1)" }, "leadAngular"), null);
  const safe = normalizeJob({
    id: "job-1",
    title: "Lead Angular Developer",
    company: "Example Co",
    location: "Remote",
    publishedAt: "2026-10-15T00:00:00Z",
    url: "https://example.com/jobs/1"
  }, "leadAngular", Date.parse("2026-10-16T00:00:00Z"));
  assert.equal(safe.dedupeKey, "leadAngular:job-1");
  assert.equal(safe.url, "https://example.com/jobs/1");
});


test("Java + Angular match can be found in a full-stack job description", () => {
  const match = normalizeJob({
    title: "Senior Full Stack Engineer",
    description: "Build services with Java, Angular and Spring Boot",
    location: "Remote",
    publishedAt: "2026-10-15T00:00:00Z",
    url: "https://example.com/jobs/java-angular"
  }, "javaAngular", Date.parse("2026-10-16T00:00:00Z"));
  assert.ok(match);
  assert.ok(match.score >= 6);
});

test("country-restricted roles outside India are filtered from the automated inbox", () => {
  assert.equal(isLocationCompatible("Poland, Portugal, UK"), false);
  assert.equal(isLocationCompatible("Remote (US only)"), false);
  assert.equal(isLocationCompatible("Remote"), true);
  assert.equal(isLocationCompatible("India / Worldwide"), true);
  const match = normalizeJob({
    title: "Senior Full Stack Engineer",
    description: "Java Angular Spring Boot",
    location: "Poland, Portugal, UK",
    publishedAt: "2026-10-15T00:00:00Z",
    url: "https://example.com/jobs/europe-only"
  }, "javaAngular", Date.parse("2026-10-16T00:00:00Z"));
  assert.equal(match, null);
});

test("jobs with credentials in the URL are rejected", () => {
  assert.equal(normalizeJob({
    title: "Lead Angular Developer",
    location: "Remote",
    publishedAt: "2026-10-15T00:00:00Z",
    url: "https://name:password@example.com/jobs/1"
  }, "leadAngular", Date.parse("2026-10-16T00:00:00Z")), null);
});


test("RemoteOK adapter maps a job and attributes the original posting URL", () => {
  const item = mapRemoteOkJob({
    id: 12345,
    position: "Senior Java Angular Engineer",
    company: "Example Co",
    description: "<p>Java, Spring Boot and Angular</p>",
    url: "https://remoteok.com/remote-jobs/12345",
    date: "2026-10-15T00:00:00Z",
    location: "Worldwide",
    tags: ["java", "angular", "spring-boot"],
    salary: "$140,000–$170,000"
  });
  assert.ok(item);
  assert.equal(item.source, "RemoteOK");
  assert.equal(item.sourceUrl, item.url);
  assert.equal(item.jobTitle, "Senior Java Angular Engineer");
  assert.equal(item.jobGeo, "Worldwide");
  assert.equal(item.salary, "$140,000–$170,000");
  assert.deepEqual(item.jobIndustry, ["java", "angular", "spring-boot"]);
});

test("RemoteOK adapter rejects explicit non-India-only locations", () => {
  assert.equal(mapRemoteOkJob({
    id: 1,
    position: "Java Angular Engineer",
    company: "Example Co",
    description: "Build services",
    url: "https://remoteok.com/remote-jobs/1",
    location: "USA Only"
  }), null);
  assert.equal(mapRemoteOkJob({
    id: 2,
    position: "Full Stack Developer — Remote from EU",
    company: "Example Co",
    description: "Java and Angular",
    url: "https://remoteok.com/remote-jobs/2",
    location: "Remote"
  }), null);
});

test("RemoteOK adapter rejects unsafe or non-provider listing URLs", () => {
  const base = {
    id: 3,
    position: "Lead Angular Developer",
    company: "Example Co",
    description: "Angular and TypeScript",
    location: "Worldwide"
  };
  assert.equal(mapRemoteOkJob({...base, url: "javascript:alert(1)"}), null);
  assert.equal(mapRemoteOkJob({...base, url: "https://user:secret@remoteok.com/jobs/3"}), null);
  assert.equal(mapRemoteOkJob({...base, url: "https://malicious.example/jobs/3"}), null);
});

test("RemoteOK adapter labels absent location metadata as unknown", () => {
  const item = mapRemoteOkJob({
    id: 4,
    position: "Senior Angular Engineer",
    company: "Example Co",
    description: "Angular and TypeScript",
    url: "https://remoteok.com/remote-jobs/4",
    date: Math.floor(Date.parse("2026-10-15T00:00:00Z") / 1000),
    tags: ["angular", "typescript"]
  });
  assert.ok(item);
  assert.equal(item.jobGeo, "Remote — eligibility not specified");
  assert.equal(item.pubDate, new Date("2026-10-15T00:00:00.000Z").toISOString());
});

test("Java + Angular full-stack role alone is not a lead-angular match", () => {
  const item = normalizeJob({
    title: "Full Stack Developer (Java - Angular)",
    company: "Example Co",
    location: "Remote — worldwide",
    publishedAt: "2026-10-15T00:00:00Z",
    url: "https://remoteok.com/remote-jobs/5",
    source: "RemoteOK",
    description: "Java, Angular, Spring Boot"
  }, "leadAngular", Date.parse("2026-10-16T00:00:00Z"));
  assert.equal(item, null);
});


test("discovery rejects unrelated roles even when a broad provider tag returns them", () => {
  const now = Date.parse("2026-10-26T00:00:00Z");
  assert.equal(normalizeJob({
    id: "unrelated-presales",
    title: "Presales Engineer (German Speaking)",
    company: "Example Co",
    location: "Remote",
    description: "Technical sales, customer discovery and product demos.",
    publishedAt: "2026-10-25T00:00:00Z",
    url: "https://example.com/jobs/presales"
  }, "javaAngular", now), null);
  assert.equal(normalizeJob({
    id: "unrelated-frontend",
    title: "Principal Frontend Engineer",
    company: "Example Co",
    location: "Remote",
    description: "Lead frontend architecture across React applications.",
    publishedAt: "2026-10-25T00:00:00Z",
    url: "https://example.com/jobs/frontend"
  }, "leadAngular", now), null);
});

test("lead-angular discovery accepts frontend leadership only when Angular is explicit", () => {
  const now = Date.parse("2026-10-26T00:00:00Z");
  const match = normalizeJob({
    id: "angular-architect",
    title: "Principal Frontend Engineer",
    company: "Example Co",
    location: "Remote",
    description: "Lead Angular and TypeScript architecture for enterprise products.",
    publishedAt: "2026-10-25T00:00:00Z",
    url: "https://example.com/jobs/angular-architect"
  }, "leadAngular", now);
  assert.ok(match);
  assert.equal(match.track, "leadAngular");
});


test("public jobs API never returns a broad-tag listing unrelated to the selected track", async () => {
  const originalFetch = global.fetch;
  const unrelated = {
    id: "wrong-tag-result",
    jobTitle: "Presales Engineer (German Speaking)",
    companyName: "Example Co",
    jobGeo: "Remote",
    jobDescription: "Technical sales and product demos.",
    pubDate: "2026-10-25T00:00:00Z",
    url: "https://jobicy.com/jobs/wrong-tag-result",
    jobIndustry: ["Sales"]
  };
  global.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => String(url).includes("remoteok.com") ? [] : { jobs: [unrelated] }
  });
  try {
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await require("../api/jobs.js")({ method: "GET", query: { track: "javaAngular" } }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.jobs, []);
  } finally {
    global.fetch = originalFetch;
  }
});
