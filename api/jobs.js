const JOBICY_ENDPOINT = "https://jobicy.com/api/v2/remote-jobs";
const REMOTEOK_ENDPOINT = "https://remoteok.com/api";
const TRACK_TAGS = {
  javaAngular: ["java", "angular", "spring boot"],
  leadAngular: ["angular", "typescript", "frontend"]
};
const REMOTEOK_TRACK_TAGS = {
  javaAngular: ["java", "angular"],
  leadAngular: ["angular", "typescript", "frontend"]
};

function parseProviderTime(value) {
  if (value === undefined || value === null || value === "") return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 100000000000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value, max = 12000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
function cleanDescription(value, max = 1600) {
  return textValue(value, 30000)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isEntryLevelTitle(title) {
  const value = String(title || "");
  if (!/\b(?:intern(?:ship)?|trainee|apprentice|graduate trainee|entry[- ]level|junior)\b/i.test(value)) return false;
  return !/\b(?:senior|lead|principal|staff|architect|manager)\b/i.test(value);
}

function isRelevant(job, track) {
  const title = String(job.title || "").toLowerCase();
  if (isEntryLevelTitle(title)) return false;
  const text = (title + " " + String(job.searchText || "") + " " + String((job.industry || []).join(" "))).toLowerCase();
  if (track === "leadAngular") {
    return title.includes("angular") || (
      text.includes("angular") &&
      /front[ -]?end|frontend|ui engineer|web engineer|typescript/i.test(title)
    );
  }
  const hasJava = /\bjava\b|spring boot|jvm/i.test(text);
  const hasAngular = /angular/i.test(text);
  // This track is specifically Java + Angular; React-only full-stack roles are false positives.
  return hasJava && hasAngular;
}

function normalize(job) {
  const url = textValue(job && job.url, 1000);
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return null; }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) return null;
  const safeUrl = parsedUrl.href;
  const salary = job && (job.salaryMin || job.salaryMax)
    ? [job.salaryMin, job.salaryMax].filter(v => v !== null && v !== undefined).join("–") + " " + textValue(job.salaryCurrency, 12) + (job.salaryPeriod ? " / " + textValue(job.salaryPeriod, 20) : "")
    : textValue(job && job.salary, 100);
  return {
    id: String((job && (job.id || job.jobSlug)) || safeUrl).slice(0, 160),
    title: textValue(job && job.jobTitle, 250) || "Untitled role",
    company: textValue(job && job.companyName, 250) || "Company not listed",
    location: textValue(job && job.jobGeo, 160) || "Remote location not specified",
    level: textValue(job && job.jobLevel, 80),
    type: Array.isArray(job && job.jobType) ? job.jobType.map(v => textValue(v, 60)).filter(Boolean).slice(0, 6) : [],
    industry: Array.isArray(job && job.jobIndustry) ? job.jobIndustry.map(v => textValue(v, 80)).filter(Boolean).slice(0, 12) : [],
    description: cleanDescription((job && job.jobDescription) || (job && job.jobExcerpt), 1600),
    searchText: cleanDescription((job && job.jobDescription) || (job && job.jobExcerpt), 10000),
    publishedAt: textValue(job && job.pubDate, 60),
    salary,
    url: safeUrl,
    source: textValue(job && job.source, 60) || "Jobicy",
    sourceUrl: textValue(job && job.sourceUrl, 300) || (String(job && job.source || "").toLowerCase() === "remoteok" ? "https://remoteok.com/faq" : "https://jobicy.com/jobs-rss-feed")
  };
}

function hasExplicitNonIndiaLocationRestriction(raw) {
  const title = String(raw && (raw.title || raw.position) || "");
  const excerpt = String(raw && (raw.excerpt || raw.description) || "");
  const location = String(raw && (raw.location || raw.jobGeo || raw.candidate_required_location) || "");
  const text = title + " " + excerpt + " " + location;
  // Only reject clear location-eligibility phrases, not incidental references to countries in a description.
  const phrases = [
    /\bremote\s+(?:from|in|within)\s+(?:the\s+)?(?:eu|europe|emea|uk|united kingdom|england|scotland|wales|us|usa|united states|canada|australia|new zealand|latam|latin america|north america)\b/i,
    /\b(?:eu|europe|emea|uk|united kingdom|england|scotland|wales|us|usa|united states|canada|australia|new zealand|latam|latin america|north america)\s+only\b/i,
    /\b(?:must|needs?\s+to|required\s+to)\s+be\s+(?:based|located)\s+in\s+(?:the\s+)?(?:eu|europe|emea|uk|united kingdom|england|scotland|wales|us|usa|united states|canada|australia|new zealand|latam|latin america|north america)\b/i,
    /\b(?:only\s+open\s+to|only\s+available\s+to|applicants?\s+(?:must|should)\s+be\s+based\s+in)\s+(?:the\s+)?(?:eu|europe|emea|uk|united kingdom|us|usa|united states|canada|australia|new zealand|latam|latin america|north america)\b/i
  ];
  return phrases.some(pattern => pattern.test(text));
}

function hasLocationOutsideIndia(value) {
  const location = String(value || "").trim();
  if (!location) return false;
  // Keep genuinely global/India/APAC roles and generic remote listings; reject explicit region/country-only locations.
  if (/\b(india|delhi|ncr|apac|asia|worldwide|global|anywhere|all countries|work from anywhere)\b/i.test(location)) return false;
  return /\b(usa|u\.s\.a\.|u\.s\.|united states|canada|uk|united kingdom|england|scotland|wales|europe|emea|poland|portugal|germany|france|spain|italy|netherlands|belgium|sweden|norway|finland|denmark|switzerland|austria|ireland|australia|new zealand|latin america|latam|middle east)\b/i.test(location);
}

function mapRemoteOkJob(raw) {
  if (!raw || typeof raw !== "object" || !raw.position || !raw.company) return null;
  const title = textValue(raw.position, 250);
  const description = cleanDescription(raw.description || "", 30000);
  const locationText = textValue(raw.location, 160);
  if (hasExplicitNonIndiaLocationRestriction({
    title,
    excerpt: textValue(description, 3000),
    location: locationText
  })) return null;

  let target;
  try { target = new URL(String(raw.url || "")); } catch { return null; }
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) return null;
  if (target.hostname !== "remoteok.com" && !target.hostname.endsWith(".remoteok.com")) return null;

  const publishedAt = parseProviderTime(raw.date);
  const tags = Array.isArray(raw.tags) ? raw.tags.map(tag => textValue(tag, 80)).filter(Boolean) : [];
  return {
    id: String(raw.id || target.href).slice(0, 160),
    jobSlug: String(raw.id || target.href).slice(0, 160),
    jobTitle: title,
    companyName: textValue(raw.company, 250),
    jobGeo: locationText || "Remote — eligibility not specified",
    jobLevel: "",
    jobType: textValue(raw.type, 60),
    jobIndustry: tags.slice(0, 15),
    jobDescription: description,
    jobExcerpt: textValue(description, 1600),
    pubDate: publishedAt ? new Date(publishedAt).toISOString() : "",
    salary: textValue(raw.salary, 100),
    salaryMin: typeof raw.salary_min === "number" ? raw.salary_min : undefined,
    salaryMax: typeof raw.salary_max === "number" ? raw.salary_max : undefined,
    salaryCurrency: textValue(raw.salary_currency, 12),
    salaryPeriod: textValue(raw.salary_period, 20),
    url: target.href,
    source: "RemoteOK",
    sourceUrl: target.href
  };
}

async function getJson(url, source) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "InterviewMate public-feed client"
    },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(source + " returned HTTP " + response.status);
  return response.json();
}

async function getJobicyTag(tag) {
  const params = new URLSearchParams({ count: "50", tag });
  const data = await getJson(JOBICY_ENDPOINT + "?" + params.toString(), "Jobicy");
  if (data && data.success === false) throw new Error("Jobicy reported an unsuccessful response");
  return Array.isArray(data && data.jobs) ? data.jobs : [];
}

async function getRemoteOkTags(track) {
  const tags = REMOTEOK_TRACK_TAGS[track] || [];
  const params = new URLSearchParams({ tags: tags.join(",") });
  const data = await getJson(REMOTEOK_ENDPOINT + "?" + params.toString(), "RemoteOK");
  if (!Array.isArray(data)) throw new Error("RemoteOK returned an invalid jobs payload");
  return data.map(mapRemoteOkJob).filter(Boolean);
}

module.exports = async function handler(req, res) {
  // These feeds are refreshed daily. The CDN caches each career-track response for a day.
  // Refresh hourly; RemoteOK allows aggregator use when every listing is credited and links to its original post.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const track = String((req.query && req.query.track) || "javaAngular");
  if (!Object.prototype.hasOwnProperty.call(TRACK_TAGS, track)) {
    return res.status(400).json({ error: "track must be javaAngular or leadAngular" });
  }

  const tags = TRACK_TAGS[track];
  const requests = [
    ...tags.map(async tag => ({ source: "Jobicy", tag, jobs: await getJobicyTag(tag) })),
    (async () => ({ source: "RemoteOK", tag: REMOTEOK_TRACK_TAGS[track].join(","), jobs: await getRemoteOkTags(track) }))()
  ];
  const results = await Promise.allSettled(requests);
  const successful = results.filter(result => result.status === "fulfilled");
  if (!successful.length) {
    return res.status(502).json({
      error: "The configured public remote-job feeds are temporarily unavailable. Try again shortly.",
      sources: ["Jobicy", "RemoteOK"]
    });
  }

  const deduped = new Map();
  for (const result of successful) {
    for (const raw of result.value.jobs) {
      const item = normalize(raw);
      if (!item || hasLocationOutsideIndia(item.location) || !isRelevant(item, track)) continue;
      const uniqueKey = item.source + ":" + item.id;
      if (!deduped.has(uniqueKey)) {
        const { searchText, ...publicItem } = item;
        deduped.set(uniqueKey, publicItem);
      }
    }
  }
  const jobs = Array.from(deduped.values()).sort((a, b) =>
    (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0)
  );
  // Defense in depth: re-check relevance after normalization/deduplication before exposing results.
  // This also protects clients if a provider adapter changes its output shape later.
  const verifiedJobs = jobs.filter(job => isRelevant({
    title: job.title,
    searchText: job.description,
    industry: job.industry
  }, track));
  const failures = results
    .filter(result => result.status === "rejected")
    .map(result => String(result.reason && result.reason.message || result.reason).slice(0, 240));
  const activeSources = Array.from(new Set(successful.map(result => result.value.source)));
  return res.status(200).json({
    track,
    sources: activeSources,
    source: activeSources.join(" + ") + " public remote-jobs API" + (activeSources.length === 1 ? "" : "s"),
    retrievedAt: new Date().toISOString(),
    partial: successful.length !== requests.length,
    sourceWarnings: failures,
    jobs: verifiedJobs.slice(0, 100),
    note: "Recent remote listings from Jobicy and RemoteOK are scored for the selected technology track. Each source is credited, and original listing links are preserved. Listings with explicit non-India location restrictions are rejected; generic remote listings still require eligibility verification on the original post. No applications are submitted."
  });
};

module.exports.mapRemoteOkJob = mapRemoteOkJob;
module.exports.isRelevant = isRelevant;
module.exports.isEntryLevelTitle = isEntryLevelTitle;
