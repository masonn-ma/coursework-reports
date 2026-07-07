const courseList = document.querySelector("#courses");
const expandAllButton = document.querySelector("#expand-all");
const collapseAllButton = document.querySelector("#collapse-all");

let renderedCourses = [];

initDashboard();

async function initDashboard() {
  try {
    const response = await fetch("reports.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Could not load reports.json (${response.status})`);
    }

    const data = await response.json();
    const courses = Array.isArray(data.courses) ? data.courses : [];

    renderDashboard(courses);
    applyFocusedCourse();
  } catch (error) {
    renderError(error);
  }
}

function renderDashboard(courses) {
  const normalizedCourses = courses.map(normalizeCourse);
  renderedCourses = normalizedCourses;

  courseList.replaceChildren(...normalizedCourses.map(createCourseSection));
  courseList.setAttribute("aria-busy", "false");
}

function normalizeCourse(course) {
  const slug = String(course.slug || course.name || "").trim();
  const name = String(course.name || slug || "Untitled Course").trim();
  const reports = Array.isArray(course.reports) ? course.reports : [];

  return {
    name,
    slug,
    reports: reports.map((report) => ({
      title: report.title || deriveTitleFromUrl(report.pdfUrl),
      pdfUrl: report.pdfUrl || "",
      presentationUrl: report.presentationUrl || "",
    })),
  };
}

function createCourseSection(course) {
  const section = document.createElement("section");
  section.className = "course-section";
  section.id = course.slug;
  section.dataset.courseSlug = course.slug.toLowerCase();
  section.setAttribute("aria-labelledby", `${course.slug}-heading`);

  const button = document.createElement("button");
  button.className = "course-toggle";
  button.type = "button";
  button.id = `${course.slug}-heading`;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-controls", `${course.slug}-panel`);

  const title = document.createElement("span");
  title.className = "course-title";
  title.innerHTML = `<strong>${escapeHtml(course.name)}</strong><span>${course.reports.length} ${pluralize(
    course.reports.length,
    "report",
  )}</span>`;

  const icon = document.createElement("span");
  icon.className = "course-icon";
  icon.setAttribute("aria-hidden", "true");

  button.append(title, icon);

  const panel = document.createElement("div");
  panel.className = "course-panel is-open";
  panel.id = `${course.slug}-panel`;

  const inner = document.createElement("div");
  inner.className = "course-panel-inner";

  if (course.reports.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-course";
    empty.textContent = "No reports added yet.";
    inner.append(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "report-grid";
    grid.append(...course.reports.map(createReportCard));
    inner.append(grid);
  }

  panel.append(inner);
  button.addEventListener("click", () => setCourseExpanded(section, !isCourseExpanded(section)));
  section.append(button, panel);

  return section;
}

function createReportCard(report) {
  const card = document.createElement("article");
  card.className = "report-card";

  const heading = document.createElement("h2");
  heading.textContent = report.title;

  const actions = document.createElement("div");
  actions.className = "report-actions";

  if (report.pdfUrl) {
    actions.append(createLink("Open PDF", report.pdfUrl));
  } else {
    actions.append(createMutedLabel("PDF unavailable"));
  }

  if (report.presentationUrl) {
    actions.append(createLink("Open presentation", report.presentationUrl));
  } else {
    actions.append(createMutedLabel("Presentation unavailable"));
  }

  card.append(heading, actions);
  return card;
}

function createLink(label, href) {
  const link = document.createElement("a");
  link.className = "action-link";
  link.href = href;
  link.textContent = label;
  return link;
}

function createMutedLabel(label) {
  const span = document.createElement("span");
  span.className = "action-muted";
  span.textContent = label;
  return span;
}

function applyFocusedCourse() {
  const requestedCourse = getRequestedCourse();

  if (!requestedCourse) {
    return;
  }

  const target = findCourseSection(requestedCourse);

  if (!target) {
    return;
  }

  document.querySelectorAll(".course-section").forEach((section) => {
    setCourseExpanded(section, section === target);
    section.classList.toggle("is-focused", section === target);
  });

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  const toggle = target.querySelector(".course-toggle");

  if (toggle) {
    toggle.focus({ preventScroll: true });
  }
}

function getRequestedCourse() {
  const params = new URLSearchParams(window.location.search);
  const queryCourse = params.get("course");
  const hashCourse = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";

  return (queryCourse || hashCourse || "").trim().toLowerCase();
}

function findCourseSection(course) {
  return [...document.querySelectorAll(".course-section")].find(
    (section) => section.dataset.courseSlug === course,
  );
}

function setCourseExpanded(section, expanded) {
  const button = section.querySelector(".course-toggle");
  const panel = section.querySelector(".course-panel");

  if (!button || !panel) {
    return;
  }

  button.setAttribute("aria-expanded", String(expanded));
  panel.classList.toggle("is-open", expanded);
}

function isCourseExpanded(section) {
  return section.querySelector(".course-toggle")?.getAttribute("aria-expanded") === "true";
}

function deriveTitleFromUrl(url) {
  if (!url) {
    return "Untitled report";
  }

  const filename = url.split("/").pop() || url;
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pluralize(count, word) {
  return count === 1 ? word : `${word}s`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderError(error) {
  courseList.setAttribute("aria-busy", "false");
  courseList.innerHTML = "";

  const message = document.createElement("p");
  message.className = "error-state";
  message.textContent = `${error.message}. Start a local server or check that reports.json exists.`;
  courseList.append(message);
}

expandAllButton.addEventListener("click", () => {
  document.querySelectorAll(".course-section").forEach((section) => {
    section.classList.remove("is-focused");
    setCourseExpanded(section, true);
  });
});

collapseAllButton.addEventListener("click", () => {
  document.querySelectorAll(".course-section").forEach((section) => {
    section.classList.remove("is-focused");
    setCourseExpanded(section, false);
  });
});

window.addEventListener("hashchange", applyFocusedCourse);
