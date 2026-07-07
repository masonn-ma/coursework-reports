const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const reportsDir = path.join(repoRoot, "reports");
const manifestPath = path.join(repoRoot, "reports.json");
const presentationExtensions = new Set([".ppt", ".pptx", ".key", ".odp"]);

function main() {
  ensureReportsDirectory();

  const existingManifest = readExistingManifest();
  const existingCourses = new Map(
    (existingManifest.courses || []).map((course) => [course.slug, course]),
  );
  const existingReports = new Map();

  for (const course of existingManifest.courses || []) {
    for (const report of course.reports || []) {
      if (report.pdfUrl) {
        existingReports.set(normalizeUrl(report.pdfUrl), report);
      }
    }
  }

  const courses = fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => buildCourse(entry.name, existingCourses, existingReports))
    .sort((a, b) => a.name.localeCompare(b.name));

  const manifest = { courses };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const reportCount = courses.reduce((total, course) => total + course.reports.length, 0);
  console.log(`Updated reports.json with ${courses.length} courses and ${reportCount} reports.`);
}

function ensureReportsDirectory() {
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`Missing reports directory: ${reportsDir}`);
  }
}

function readExistingManifest() {
  if (!fs.existsSync(manifestPath)) {
    return { courses: [] };
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function buildCourse(slug, existingCourses, existingReports) {
  const courseDir = path.join(reportsDir, slug);
  const existingCourse = existingCourses.get(slug) || {};
  const files = fs
    .readdirSync(courseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile());
  const presentationByBaseName = new Map();

  for (const file of files) {
    const extension = path.extname(file.name).toLowerCase();

    if (presentationExtensions.has(extension)) {
      presentationByBaseName.set(stripExtension(file.name), toManifestUrl(slug, file.name));
    }
  }

  const reports = files
    .filter((file) => path.extname(file.name).toLowerCase() === ".pdf")
    .map((file) => {
      const pdfUrl = toManifestUrl(slug, file.name);
      const existingReport = existingReports.get(normalizeUrl(pdfUrl)) || {};
      const detectedPresentationUrl = presentationByBaseName.get(stripExtension(file.name)) || "";

      return {
        title: existingReport.title || deriveTitle(file.name),
        pdfUrl,
        presentationUrl: existingReport.presentationUrl || detectedPresentationUrl,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    name: existingCourse.name || deriveCourseName(slug),
    slug,
    reports,
  };
}

function toManifestUrl(courseSlug, filename) {
  return path.posix.join("reports", courseSlug, filename);
}

function normalizeUrl(value) {
  return String(value).replaceAll("\\", "/");
}

function stripExtension(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function deriveTitle(filename) {
  return stripExtension(filename)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveCourseName(slug) {
  return slug
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

main();
