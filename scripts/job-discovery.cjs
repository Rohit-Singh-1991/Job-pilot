const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BASE_URL = "https://jobpilot-ai-topaz.vercel.app";
const TRACKS = [
  { key: "javaAngular", label: "Java + Angular Full Stack Developer" },
  { key: "leadAngular", label: "Lead Angular Developer" }
];
const MAX_AGE_DAYS = 30;

function parsedTime(value) {
  const n = Date.parse(value || "");
  return Number.isFinite(n) ? n : 0;
}

function isRecent(publishedAt, now = Date.now(), maxAgeDays = MAX_AGE_DAYS) {
  const published = parsedTime(publishedAt);
  if (!published) return true; // Some feeds omit dates; let the user verify the original post.
  const ageMs = now - published;
  return ageMs >= -24 * 60 * 60 * 1000 && ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function scoreJob(job, track) {
  const title = String(job.title || "").toLowerCase();
  const content = [title, job.description, job.location, job.level, job.company]
    .filter(Boolean).join(" ").toLowerCase();
  let score = 0;

  if (track === "javaAngular") {
    score += /\bjava\b|spring boot|\bjvm\b/i.test(title) ? 4 :
      (/\bjava\b|spring boot|\bjvm\b/i.test(content) ? 3 : 0);
    score += /\bangular\b/i.test(title) ? 4 :
      (/\bangular\b/i.test(content) ? 3 : 0);
    if (/spring boot/i.test(content)) score += 2;
    if (/microservices|distributed systems/i.test(content)) score += 1;
    if (/full[ -]?stack/i.test(title)) score += 2;
    if (/technical lead|team lead|lead engineer|architect/i.test(title)) score += 2;
    if (/senior|staff|principal/i.test(title)) score += 1;
  } else {
    score += /\bangular\b/i.test(title) ? 5 :
      (/\bangular\b/i.test(content) ? 3 : 0);
    if (/lead|staff|principal|architect|manager/i.test(title)) score += 3;
    if (/tech lead|team lead|engineering lead/i.test(title)) score += 3;
    if (/typescript/i.test(content)) score += 2;
    if (/design system|frontend architecture|front-end architecture/i.test(content)) score += 2;
    if (/senior/i.test(title)) score += 1;
  }

  if (/intern|internship|trainee|junior|entry[ -]?level|graduate role/.test(title)) {
    score -= 7;
  }
  return score;
}

function isLocationCompatible(value) {
  const location = String(value || "").trim().toLowerCase();
  if (!location || /not specified|not listed|unknown|remote location/.test(location)) return true;
  if (/\b(india|delhi|ncr|apac|asia|worldwide|global|anywhere|all countries|work from anywhere)\b/i.test(location)) {
    return true;
  }
  const restricted = /\b(usa|us|u\.s\.|united states|canada|uk|united kingdom|england|scotland|wales|europe|emea|poland|portugal|germany|france|spain|italy|netherlands|belgium|sweden|norway|finland|denmark|switzerland|austria|ireland|australia|new zealand|latin america|latam|middle east)\b/i;
  if (restricted.test(location)) return false;
  if (/\bremote\b/i.test(location)) return true;
  return true;
}

function normalizeJob(job, track, now = Date.now()) {
  if (!job || typeof job !== "object") return null;
  let parsedUrl;
  try {
    parsedUrl = new URL(String(job.url || ""));
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) return null;
  const url = parsedUrl.href;
  const publishedAt = String(job.publishedAt || "");
  if (!isRecent(publishedAt, now)) return null;
  const id = String(job.id || url).slice(0, 180);
  const title = String(job.title || "Untitled role").slice(0, 180);
  const description = String(job.description || "").replace(/\s+/g, " ").slice(0, 700);
  const company = String(job.company || "Company not listed").slice(0, 140);
  const location = String(job.location || "Remote — verify eligibility").slice(0, 120);
  const score = scoreJob({ title, description, location, level: job.level, company }, track);
  const minimumScore = 6;
  if (score < minimumScore || !isLocationCompatible(location)) return null;
  return {
    track,
    trackLabel: TRACKS.find(item => item.key === track).label,
    dedupeKey: track + ":" + id,
    id,
    title,
    company,
    location,
    level: String(job.level || "").slice(0, 80),
    publishedAt,
    salary: String(job.salary || "").slice(0, 100),
    score,
    url,
    source: String(job.source || "Jobicy").slice(0, 60),
    description
  };
}

async function fetchTrack(baseUrl, track, fetchImpl = fetch) {
  const url = new URL("/api/jobs", baseUrl);
  url.searchParams.set("track", track);
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(track + " API returned HTTP " + response.status);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.jobs)) {
    throw new Error(track + " API returned an invalid jobs payload");
  }

  const jobs = payload.jobs
    .map(job => normalizeJob(job, track))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || parsedTime(b.publishedAt) - parsedTime(a.publishedAt));
  const sources = Array.isArray(payload.sources) ? payload.sources :
    (payload.source ? [String(payload.source)] : []);
  const sourceWarnings = Array.isArray(payload.sourceWarnings)
    ? payload.sourceWarnings.map(value => String(value).slice(0, 240)).slice(0, 8)
    : [];

  return {
    jobs,
    rawListings: payload.jobs.length,
    filteredOut: payload.jobs.length - jobs.length,
    sources,
    sourceWarnings,
    feedNote: String(payload.note || "").slice(0, 500)
  };
}

async function discover({ baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, now = new Date().toISOString() } = {}) {
  const outcomes = await Promise.all(TRACKS.map(async track => {
    try {
      const result = await fetchTrack(baseUrl, track.key, fetchImpl);
      return { track: track.key, ...result };
    } catch (error) {
      return {
        track: track.key,
        jobs: [],
        rawListings: 0,
        filteredOut: 0,
        sources: [],
        sourceWarnings: [],
        error: String(error && error.message || error)
      };
    }
  }));
  const successful = outcomes.filter(item => !item.error);
  const jobs = outcomes.flatMap(item => item.jobs);
  return {
    checkedAt: now,
    source: "Jobicy + RemoteOK through InterviewMate's public feed endpoint",
    maxAgeDays: MAX_AGE_DAYS,
    trackStatus: outcomes.map(({ track, jobs: items, rawListings, filteredOut, sources, sourceWarnings, feedNote, error }) => ({
      track,
      count: items.length,
      rawListings,
      filteredOut,
      sources,
      sourceWarnings,
      ...(feedNote ? { feedNote } : {}),
      ...(error ? { error } : {})
    })),
    errors: outcomes.filter(item => item.error).map(item => ({ track: item.track, error: item.error })),
    sourceWarnings: outcomes.flatMap(item => item.sourceWarnings.map(warning => ({ track: item.track, warning }))),
    successfulTracks: successful.length,
    jobs
  };
}

async function main() {
  const outputPath = path.resolve(process.env.JOBPILOT_SCAN_OUTPUT || "jobpilot-scan.json");
  const result = await discover({
    baseUrl: process.env.JOBPILOT_BASE_URL || DEFAULT_BASE_URL
  });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log("JOBPILOT_SCAN " + JSON.stringify({
    checkedAt: result.checkedAt,
    successfulTracks: result.successfulTracks,
    trackStatus: result.trackStatus,
    errors: result.errors,
    sourceWarnings: result.sourceWarnings,
    candidates: result.jobs.length
  }));
  if (result.successfulTracks === 0) {
    throw new Error("Both job-track feeds failed; leaving persistent state unchanged.");
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("InterviewMate discovery failed: " + String(error && error.message || error));
    process.exitCode = 1;
  });
}

module.exports = { MAX_AGE_DAYS, TRACKS, isRecent, isLocationCompatible, scoreJob, normalizeJob, fetchTrack, discover };
