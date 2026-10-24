const courseList = document.querySelector("#course-list");
const expandAllButton = document.querySelector("#expand-all");
const collapseAllButton = document.querySelector("#collapse-all");

let revealObserver = null;

initDashboard();
initHeroCanvas();
initReveal();
initSectionNavigation();

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
  } finally {
    window.__siteReady = true;
  }
}

function renderDashboard(courses) {
  const normalizedCourses = prioritizeRequestedCourse(courses.map(normalizeCourse));

  if (normalizedCourses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No courses have been added yet.";
    courseList.replaceChildren(empty);
  } else {
    courseList.replaceChildren(...normalizedCourses.map(createCourseSection));
  }

  courseList.setAttribute("aria-busy", "false");
  setToolbarEnabled(true);
  observeRevealTargets(courseList);
}

function prioritizeRequestedCourse(courses) {
  const requestedCourse = getRequestedCourse();

  if (!requestedCourse) {
    return courses;
  }

  return [...courses].sort((a, b) => {
    const aMatches = normalizeCourseKey(a.slug) === requestedCourse;
    const bMatches = normalizeCourseKey(b.slug) === requestedCourse;

    if (aMatches === bMatches) {
      return 0;
    }

    return aMatches ? -1 : 1;
  });
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

function createCourseSection(course, index) {
  const courseElement = document.createElement("article");
  const slug = course.slug || `course-${index + 1}`;
  const baseId = `${slug}-${index + 1}`;

  courseElement.className = "course is-open";
  courseElement.id = slug;
  courseElement.dataset.courseSlug = slug.toLowerCase();
  courseElement.setAttribute("aria-labelledby", `${baseId}-heading`);
  courseElement.setAttribute("data-reveal", "");

  const heading = document.createElement("h3");
  heading.className = "course-heading";

  const button = document.createElement("button");
  button.className = "course-toggle";
  button.type = "button";
  button.id = `${baseId}-heading`;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-controls", `${baseId}-panel`);

  const kicker = document.createElement("span");
  kicker.className = "course-kicker";
  kicker.textContent =
    course.reports.length === 0
      ? "No reports"
      : `${course.reports.length} ${pluralize(course.reports.length, "report")}`;

  const title = document.createElement("span");
  title.className = "course-title";
  title.textContent = course.name;

  const cue = document.createElement("span");
  cue.className = "course-cue";
  cue.setAttribute("aria-hidden", "true");

  button.append(kicker, title, cue);
  heading.append(button);

  const panel = document.createElement("div");
  panel.className = "course-panel";
  panel.id = `${baseId}-panel`;

  const inner = document.createElement("div");
  inner.className = "course-panel-inner";

  if (course.reports.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-course";
    empty.textContent = "No reports added yet.";
    inner.append(empty);
  } else {
    const list = document.createElement("div");
    list.className = "report-list";
    list.append(...course.reports.map(createReportRow));
    inner.append(list);
  }

  panel.append(inner);
  button.addEventListener("click", () =>
    setCourseExpanded(courseElement, !isCourseExpanded(courseElement)),
  );
  courseElement.append(heading, panel);

  return courseElement;
}

function createReportRow(report) {
  const row = document.createElement("article");
  row.className = "report";

  const heading = document.createElement("h4");
  heading.className = "report-title";
  heading.textContent = report.title;

  const actions = document.createElement("div");
  actions.className = "report-actions";

  if (report.pdfUrl) {
    actions.append(createLink("PDF", report.pdfUrl, `Open PDF: ${report.title}`));
  } else {
    actions.append(createMutedLabel("PDF unavailable"));
  }

  if (report.presentationUrl) {
    actions.append(
      createLink("Presentation", report.presentationUrl, `Open presentation: ${report.title}`),
    );
  } else {
    actions.append(createMutedLabel("Presentation unavailable"));
  }

  row.append(heading, actions);
  return row;
}

function createLink(label, href, ariaLabel) {
  const link = document.createElement("a");
  link.className = "report-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;

  if (ariaLabel) {
    link.setAttribute("aria-label", ariaLabel);
  }

  return link;
}

function createMutedLabel(label) {
  const span = document.createElement("span");
  span.className = "report-missing";
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

  courseList.prepend(target);
  target.classList.add("is-revealed");

  document.querySelectorAll(".course").forEach((section) => {
    setCourseExpanded(section, section === target);
    section.classList.toggle("is-focused", section === target);
  });

  target.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
  const toggle = target.querySelector(".course-toggle");

  if (toggle) {
    toggle.focus({ preventScroll: true });
  }
}

function getRequestedCourse() {
  const params = new URLSearchParams(window.location.search);
  const queryCourse = params.get("course");
  const hashCourse = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";

  return normalizeCourseKey(queryCourse || hashCourse);
}

function findCourseSection(course) {
  return [...document.querySelectorAll(".course")].find(
    (section) => normalizeCourseKey(section.dataset.courseSlug) === course,
  );
}

function normalizeCourseKey(value) {
  return String(value || "")
    .trim()
    .replace(/^#/, "")
    .replace(/^course=/i, "")
    .replace(/\/$/, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function setCourseExpanded(section, expanded) {
  const button = section.querySelector(".course-toggle");

  if (!button) {
    return;
  }

  button.setAttribute("aria-expanded", String(expanded));
  section.classList.toggle("is-open", expanded);
}

function isCourseExpanded(section) {
  return section.querySelector(".course-toggle")?.getAttribute("aria-expanded") === "true";
}

function setToolbarEnabled(enabled) {
  [expandAllButton, collapseAllButton].forEach((button) => {
    if (button) {
      button.disabled = !enabled;
    }
  });
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

function renderError(error) {
  courseList.setAttribute("aria-busy", "false");

  const message = document.createElement("p");
  message.className = "error-state";
  message.textContent = `${error.message}. Start a local server or check that reports.json exists.`;
  courseList.replaceChildren(message);
}

/* --- Reveal on scroll --- */

function initReveal() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll("[data-reveal]").forEach((element) => {
      element.classList.add("is-revealed");
    });
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      let batchIndex = 0;

      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.style.setProperty("--reveal-delay", `${Math.min(batchIndex * 60, 180)}ms`);
        entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
        batchIndex += 1;
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  observeRevealTargets(document);
}

function observeRevealTargets(root) {
  const targets = Array.from(root.querySelectorAll("[data-reveal]"));

  if (!targets.length) {
    return;
  }

  if (!revealObserver) {
    targets.forEach((element) => element.classList.add("is-revealed"));
    return;
  }

  targets.forEach((element) => revealObserver.observe(element));
}

/* --- Active section in the nav --- */

function initSectionNavigation() {
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!links.length || !sections.length) {
    return;
  }

  const updateActiveLink = () => {
    const probe = window.innerHeight * 0.35;
    let activeId = null;

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= probe) {
        activeId = section.id;
      }
    });

    links.forEach((link) => {
      const isActive = activeId !== null && link.getAttribute("href") === `#${activeId}`;

      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  let ticking = false;

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        updateActiveLink();
        ticking = false;
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", updateActiveLink);
  updateActiveLink();
}

/* --- Hero network canvas --- */

function initHeroCanvas() {
  const canvas = document.getElementById("hero-network");

  if (!canvas) {
    return;
  }

  try {
    const heroSection = canvas.closest(".hero");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPowerMode =
      motionPreference ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.connection && navigator.connection.saveData);

    const particleCountConfig = lowPowerMode
      ? { min: 22, max: 56, divisor: 25000 }
      : { min: 36, max: 84, divisor: 18500 };
    const connectionDistance = lowPowerMode ? 108 : 142;
    const targetFps = lowPowerMode ? 25 : 32;
    const frameDuration = 1000 / targetFps;

    let particles = [];
    let canvasWidth = 0;
    let canvasHeight = 0;
    let animationFrameId = null;
    let lastFrameTime = 0;
    let inView = true;

    const createParticle = () => ({
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      vx: (Math.random() - 0.5) * (lowPowerMode ? 0.2 : 0.28),
      vy: (Math.random() - 0.5) * (lowPowerMode ? 0.2 : 0.28),
      radius: Math.random() * 1.8 + 1.1,
      accent: Math.random() < 0.14,
    });

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvasWidth = canvas.offsetWidth;
      canvasHeight = canvas.offsetHeight;
      canvas.width = Math.floor(canvasWidth * dpr);
      canvas.height = Math.floor(canvasHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const particleCount = Math.max(
        particleCountConfig.min,
        Math.min(
          particleCountConfig.max,
          Math.floor((canvasWidth * canvasHeight) / particleCountConfig.divisor),
        ),
      );
      particles = Array.from({ length: particleCount }, createParticle);
    };

    const drawScene = (timestamp = 0) => {
      if (!motionPreference && timestamp - lastFrameTime < frameDuration) {
        animationFrameId = window.requestAnimationFrame(drawScene);
        return;
      }

      lastFrameTime = timestamp;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];

        if (!motionPreference) {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < 0 || particle.x > canvasWidth) particle.vx *= -1;
          if (particle.y < 0 || particle.y > canvasHeight) particle.vy *= -1;
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.accent ? "rgba(131, 174, 221, 0.85)" : "rgba(233, 237, 244, 0.72)";
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.22;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(233, 237, 244, ${opacity.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      if (!motionPreference && inView) {
        animationFrameId = window.requestAnimationFrame(drawScene);
      }
    };

    const start = () => {
      if (motionPreference || animationFrameId) {
        return;
      }
      animationFrameId = window.requestAnimationFrame(drawScene);
    };

    const stop = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    setCanvasSize();
    drawScene();

    let canvasResizeFrameId = null;

    const resizeCanvas = () => {
      canvasResizeFrameId = null;
      stop();
      setCanvasSize();
      drawScene();
    };

    const queueCanvasResize = () => {
      if (canvasResizeFrameId) {
        window.cancelAnimationFrame(canvasResizeFrameId);
      }

      canvasResizeFrameId = window.requestAnimationFrame(resizeCanvas);
    };

    window.addEventListener("resize", queueCanvasResize);

    if ("ResizeObserver" in window) {
      const canvasResizeObserver = new ResizeObserver(queueCanvasResize);
      canvasResizeObserver.observe(canvas);
    }

    if ("IntersectionObserver" in window && heroSection) {
      const viewObserver = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);

        if (inView) {
          start();
        } else {
          stop();
        }
      });
      viewObserver.observe(heroSection);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stop();
      } else if (inView) {
        start();
      }
    });
  } catch (error) {
    console.warn("Hero canvas disabled:", error);
  }
}

/* --- Toolbar --- */

expandAllButton?.addEventListener("click", () => {
  document.querySelectorAll(".course").forEach((section) => {
    section.classList.remove("is-focused");
    setCourseExpanded(section, true);
  });
});

collapseAllButton?.addEventListener("click", () => {
  document.querySelectorAll(".course").forEach((section) => {
    section.classList.remove("is-focused");
    setCourseExpanded(section, false);
  });
});

window.addEventListener("hashchange", applyFocusedCourse);
