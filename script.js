const root = document.documentElement;
const revealItems = document.querySelectorAll(".reveal");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const resetScrollToTop = () => {
  window.scrollTo(0, 0);
};

window.addEventListener("load", resetScrollToTop);
window.addEventListener("pageshow", resetScrollToTop);
window.addEventListener("beforeunload", resetScrollToTop);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Frame-rate independent easing toward a target (smoothing is per 60fps frame).
const damp = (current, target, smoothing, deltaTime) =>
  current + (target - current) * (1 - Math.pow(1 - smoothing, deltaTime / 16.67));

// Shared rAF loop that sleeps whenever nothing is animating.
const ticker = (() => {
  const callbacks = new Set();
  let frame = 0;
  let lastTime = 0;

  const loop = (time) => {
    const deltaTime = Math.min(time - (lastTime || time), 64);
    lastTime = time;
    callbacks.forEach((callback) => callback(deltaTime, time));
    frame = callbacks.size ? window.requestAnimationFrame(loop) : 0;
    if (!frame) lastTime = 0;
  };

  return {
    add(callback) {
      callbacks.add(callback);
      if (!frame) frame = window.requestAnimationFrame(loop);
    },
    remove(callback) {
      callbacks.delete(callback);
    },
  };
})();

/* ---------- Text effects ---------- */

const splitWords = (element, { mask = false } = {}) => {
  let count = 0;

  const splitNode = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        splitNode(child);
        return;
      }

      if (child.nodeType !== Node.TEXT_NODE) return;

      const fragment = document.createDocumentFragment();

      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;

        if (!part.trim()) {
          fragment.append(" ");
          return;
        }

        const word = document.createElement("span");
        word.className = "word";
        word.textContent = part;
        word.style.setProperty("--i", count);
        count += 1;

        if (mask) {
          const wordMask = document.createElement("span");
          wordMask.className = "word-mask";
          wordMask.append(word);
          fragment.append(wordMask);
        } else {
          fragment.append(word);
        }
      });

      child.replaceWith(fragment);
    });
  };

  splitNode(element);
  element.style.setProperty("--word-count", count);
};

const splitLetters = (element) => {
  const letters = [...element.textContent.trim()].map((char, index) => {
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = char;
    letter.style.setProperty("--i", index);
    return letter;
  });

  element.replaceChildren(...letters);
};

const glyphPools = [
  [/[A-Z]/, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  [/[a-z]/, "abcdefghijklmnopqrstuvwxyz"],
  [/[0-9]/, "0123456789"],
];

const randomGlyph = (char) => {
  const match = glyphPools.find(([pattern]) => pattern.test(char));
  if (!match) return char;
  return match[1][Math.floor(Math.random() * match[1].length)];
};

// Decodes text from random glyphs, keeping the real text available to screen readers.
const scrambleText = (element, { duration = 900, delay = 0 } = {}) => {
  if (!element.dataset.scrambleText) {
    const label = document.createElement("span");
    const visual = document.createElement("span");
    element.dataset.scrambleText = element.textContent.trim();
    label.className = "sr-only";
    label.textContent = element.dataset.scrambleText;
    visual.setAttribute("aria-hidden", "true");
    element.replaceChildren(label, visual);
  }

  const finalText = element.dataset.scrambleText;
  const visual = element.lastElementChild;

  if (prefersReducedMotion) {
    visual.textContent = finalText;
    return;
  }

  const chars = [...finalText];
  const settleAt = chars.map(
    (_, index) => delay + (index / chars.length) * duration * 0.6 + Math.random() * duration * 0.4
  );
  const endTime = Math.max(...settleAt);
  let glyphs = chars.map(randomGlyph);
  let startTime = 0;
  let lastShuffle = 0;

  const step = (deltaTime, time) => {
    if (!startTime) startTime = time;
    const elapsed = time - startTime;

    if (time - lastShuffle > 55) {
      glyphs = chars.map(randomGlyph);
      lastShuffle = time;
    }

    visual.textContent = chars.map((char, index) => (elapsed >= settleAt[index] ? char : glyphs[index])).join("");

    if (elapsed >= endTime) ticker.remove(step);
  };

  ticker.add(step);
};

const statementText = document.querySelector(".statement-text");

if (statementText) {
  splitWords(statementText);
}

if (!prefersReducedMotion) {
  document.querySelectorAll(".section-heading.reveal, .feature-copy.reveal").forEach((block) => {
    block.classList.add("reveal-text");
    block.querySelectorAll("h2").forEach((heading) => splitWords(heading, { mask: true }));
    block.querySelectorAll(".feature-detail").forEach((detail, index) => detail.style.setProperty("--i", index));
  });
}

document.querySelectorAll(".project-list span").forEach((project, index) => {
  project.style.setProperty("--i", index);
});

const footer = document.querySelector(".site-footer");
const footerBrand = footer?.querySelector(".scene-brand");

if (footerBrand) {
  splitLetters(footerBrand);
}

/* ---------- Scroll reveals ---------- */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries
      .filter((entry) => entry.isIntersecting)
      .forEach((entry, index) => {
        const delay = index * 0.09;

        entry.target.style.setProperty("--reveal-delay", `${delay}s`);
        entry.target.classList.add("is-visible");
        entry.target.querySelectorAll(".eyebrow").forEach((eyebrow) => {
          scrambleText(eyebrow, { duration: 800, delay: delay * 1000 });
        });
        revealObserver.unobserve(entry.target);
      });
  },
  {
    threshold: 0.18,
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

if (footer) {
  revealObserver.observe(footer);
}

/* ---------- Hero scene ---------- */

const scene = document.querySelector("[data-scene]");
const depthItems = document.querySelectorAll("[data-scroll-depth]");
const heroStage = document.querySelector(".hero-stage");
const monitorRig = document.querySelector(".monitor-rig");
// The transparent screen opening in laptop-realistic.png (a square image), as fractions of its size.
const screenOpening = { side: 0.1685, top: 0.2825, bottom: 0.304 };
const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
const hasLenis = typeof window.Lenis !== "undefined" && !prefersReducedMotion;
const sceneValues = new Map();
const dive = { cover: 2.5, shiftY: 0 };
const diveEnd = 0.55;
let sceneProgress = 0;
let wakeHeroMotion = null;

const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// How far the laptop must scale for its screen to fill the stage, and how far to move it so
// the screen ends up centred. Measured against the 100vh stage (not innerHeight) so it still
// covers once a phone's browser toolbar collapses.
const measureDive = () => {
  if (!heroStage || !monitorRig) return;
  const rigSize = monitorRig.offsetWidth;
  const openingWidth = rigSize * (1 - screenOpening.side * 2);
  const openingHeight = rigSize * (1 - screenOpening.top - screenOpening.bottom);
  const openingCenterY = monitorRig.offsetTop - rigSize / 2 + rigSize * screenOpening.top + openingHeight / 2;
  dive.cover = Math.max(heroStage.offsetWidth / openingWidth, heroStage.offsetHeight / openingHeight) * 1.04;
  dive.shiftY = heroStage.offsetHeight / 2 - openingCenterY;
};

const setSceneValue = (name, value) => {
  if (sceneValues.get(name) === value) return;
  sceneValues.set(name, value);
  scene.style.setProperty(name, value);
};

// 0 → 0.55: dive through the bezel until the screen fills the view (its headline flies past).
// 0.55 → 1: inside the screen, the statement appears and lights up word by word.
const applySceneProgress = (progress) => {
  const diveProgress = easeInOutQuad(clamp(progress / diveEnd, 0, 1));
  const passThrough = clamp((progress - 0.12) / 0.3, 0, 1);
  sceneProgress = progress;

  setSceneValue("--scene-progress", progress.toFixed(4));
  setSceneValue("--parallax-backdrop-y", `${(progress * -18).toFixed(2)}px`);
  setSceneValue("--parallax-frame-a-y", `${(progress * -54).toFixed(2)}px`);
  setSceneValue("--parallax-frame-b-y", `${(progress * -84).toFixed(2)}px`);
  setSceneValue("--parallax-frame-c-y", `${(diveProgress * 160).toFixed(2)}px`);
  setSceneValue("--parallax-badge-y", `${(progress * -10).toFixed(2)}px`);
  setSceneValue("--parallax-statement-y", `${(progress * -46).toFixed(2)}px`);
  setSceneValue("--rig-scale", Math.pow(dive.cover, diveProgress).toFixed(4));
  setSceneValue("--rig-shift-y", `${(dive.shiftY * diveProgress).toFixed(2)}px`);
  setSceneValue("--dive", diveProgress.toFixed(4));
  setSceneValue("--screen-content-opacity", (1 - passThrough).toFixed(3));
  setSceneValue("--screen-content-scale", (1 + passThrough * passThrough * 0.9).toFixed(4));
  setSceneValue("--statement-fill", clamp((progress - 0.6) / 0.35, 0, 1).toFixed(4));
  setSceneValue("--tilt-strength", (1 - clamp(progress / 0.3, 0, 1)).toFixed(3));
  scene.classList.toggle("is-diving", progress > 0.06);
  scene.classList.toggle("is-through", passThrough >= 1);
  scene.classList.toggle("is-inside", progress > diveEnd);
  if (progress < 0.3) wakeHeroMotion?.();
};

const updateDepthItems = () => {
  const viewportHeight = window.innerHeight;

  depthItems.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const depth = Number(item.dataset.scrollDepth || 0);
    const centerOffset = rect.top + rect.height / 2 - viewportHeight / 2;
    const translateY = centerOffset * depth;
    item.style.transform = `translate3d(0, ${translateY}px, 0)`;
  });
};

const updateSceneFallback = () => {
  if (scene) {
    const rect = scene.getBoundingClientRect();
    const total = Math.max(scene.offsetHeight - window.innerHeight, 1);
    applySceneProgress(clamp(-rect.top / total, 0, 1));
  }

  updateDepthItems();
};

let lenis = null;

measureDive();

if (hasLenis) {
  lenis = new Lenis({
    duration: 1.15,
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.1,
    lerp: 0.085,
  });

  lenis.scrollTo(0, { immediate: true });
}

if (hasGsap && scene) {
  gsap.registerPlugin(ScrollTrigger);

  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  const sceneProps = {
    progress: 0,
  };

  // onUpdate lives on the tween (not the ScrollTrigger) so every frame of the
  // scrub smoothing reaches the screen, not only frames that had a scroll event.
  gsap.to(sceneProps, {
    progress: 1,
    ease: "none",
    onUpdate: () => applySceneProgress(sceneProps.progress),
    scrollTrigger: {
      trigger: scene,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
    },
  });

  depthItems.forEach((item) => {
    const depth = Number(item.dataset.scrollDepth || 0.1);

    gsap.to(item, {
      y: () => window.innerHeight * depth * -0.4,
      ease: "none",
      scrollTrigger: {
        trigger: item,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      },
    });
  });

  ScrollTrigger.addEventListener("refreshInit", () => {
    sceneValues.clear();
    scene.style.setProperty("--scene-progress", "0");
    scene.style.setProperty("--rig-scale", "1");
    scene.style.setProperty("--rig-shift-y", "0px");
    measureDive();
  });

  ScrollTrigger.addEventListener("refresh", () => applySceneProgress(sceneProps.progress));

  ScrollTrigger.refresh();
} else {
  if (lenis) {
    const raf = (time) => {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    };

    window.requestAnimationFrame(raf);
  }

  window.addEventListener("resize", measureDive);
  updateSceneFallback();

  if (lenis) {
    lenis.on("scroll", updateSceneFallback);
    window.addEventListener("resize", updateSceneFallback);
  } else {
    window.addEventListener("scroll", updateSceneFallback, { passive: true });
    window.addEventListener("resize", updateSceneFallback);
  }
}

/* ---------- Intro ---------- */

const preloader = document.querySelector(".preloader");

const whenImageReady = (image) =>
  new Promise((resolve) => {
    if (!image || image.complete) {
      resolve();
      return;
    }

    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  });

const playIntro = () => {
  if (!preloader) return;

  if (!root.classList.contains("is-loading")) {
    preloader.remove();
    return;
  }

  const counter = preloader.querySelector("[data-preloader-count]");
  const bar = preloader.querySelector(".preloader-bar span");
  const minDuration = 1300;
  let assetsReady = false;
  let shown = 0;
  let startTime = 0;

  Promise.race([
    Promise.all([document.fonts?.ready, whenImageReady(document.querySelector(".monitor-asset"))]),
    new Promise((resolve) => window.setTimeout(resolve, 4000)),
  ]).then(() => {
    assetsReady = true;
  });

  // iOS Safari can ignore overflow: hidden for touch scrolling, so block it directly.
  const blockTouchScroll = (event) => event.preventDefault();

  lenis?.stop();
  document.addEventListener("touchmove", blockTouchScroll, { passive: false });

  const finish = () => {
    root.classList.remove("is-loading");
    root.classList.add("is-ready");
    document.removeEventListener("touchmove", blockTouchScroll);
    resetScrollToTop();
    lenis?.start();

    window.setTimeout(() => {
      document.querySelectorAll(".laptop-meta > span:not([data-clock])").forEach((item, index) => {
        scrambleText(item, { duration: 1000, delay: index * 140 });
      });
    }, 1250);

    window.setTimeout(() => {
      root.classList.add("is-intro-done");
      preloader.remove();
    }, 3600);
  };

  const step = (deltaTime, time) => {
    if (!startTime) startTime = time;
    const linear = Math.min((time - startTime) / minDuration, 1);
    const eased = 1 - Math.pow(1 - linear, 3);
    const target = assetsReady ? eased * 100 : Math.min(eased * 100, 92);

    shown = damp(shown, target, 0.16, deltaTime);
    if (assetsReady && linear === 1 && shown > 99.5) shown = 100;

    counter.textContent = String(Math.round(shown)).padStart(3, "0");
    bar.style.transform = `scaleX(${(shown / 100).toFixed(4)})`;

    if (shown === 100 || root.classList.contains("is-ready")) {
      ticker.remove(step);
      window.setTimeout(finish, 220);
    }
  };

  ticker.add(step);
};

playIntro();

/* ---------- Theme ---------- */

// The head script sets data-theme before first paint; this keeps it in sync afterwards.
const themeToggle = document.querySelector(".theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)");

const readStoredTheme = () => {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
};

const applyTheme = (theme) => {
  root.dataset.theme = theme;
  themeColor?.setAttribute("content", theme === "light" ? "#f7f9fd" : "#05070c");
  themeToggle?.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
};

// The new theme spreads out as a circle from the toggle where View Transitions are supported.
const switchTheme = () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";

  try {
    localStorage.setItem("theme", next);
  } catch {}

  if (!document.startViewTransition || prefersReducedMotion) {
    applyTheme(next);
    return;
  }

  const rect = themeToggle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => applyTheme(next));

  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 750, easing: "cubic-bezier(0.76, 0, 0.24, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
};

applyTheme(root.dataset.theme === "light" ? "light" : "dark");
themeToggle?.addEventListener("click", switchTheme);

// Follow the system setting live until the visitor picks a theme themselves.
systemPrefersLight.addEventListener("change", (event) => {
  if (!readStoredTheme()) applyTheme(event.matches ? "light" : "dark");
});

/* ---------- Pointer & touch effects ---------- */

// The laptop tilts toward the mouse on desktop. Phones use the gyroscope where it needs
// no permission prompt; elsewhere (including iPhones) the laptop floats on its own.
const initHeroMotion = () => {
  if (!scene || prefersReducedMotion) return;

  const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };

  const render = () => {
    scene.style.setProperty("--tilt-x", `${(tilt.y * -5).toFixed(3)}deg`);
    scene.style.setProperty("--tilt-y", `${(tilt.x * 7).toFixed(3)}deg`);
    scene.style.setProperty("--glare-dx", `${(tilt.x * -17.5).toFixed(2)}%`);
    scene.style.setProperty("--glare-dy", `${(-10 - tilt.y * 12.5).toFixed(2)}%`);
    scene.style.setProperty("--glow-x", `${(tilt.x * 36).toFixed(2)}px`);
    scene.style.setProperty("--glow-y", `${(tilt.y * 24).toFixed(2)}px`);
  };

  const follow = (deltaTime) => {
    tilt.x = damp(tilt.x, tilt.targetX, 0.07, deltaTime);
    tilt.y = damp(tilt.y, tilt.targetY, 0.07, deltaTime);
    render();

    if (Math.abs(tilt.targetX - tilt.x) < 0.001 && Math.abs(tilt.targetY - tilt.y) < 0.001) {
      ticker.remove(follow);
    }
  };

  const aim = (x, y) => {
    tilt.targetX = clamp(x, -1, 1);
    tilt.targetY = clamp(y, -1, 1);
    ticker.add(follow);
  };

  if (hasFinePointer) {
    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType !== "mouse" || sceneProgress >= 1) return;
        // Hold the laptop almost still while the pointer is on its screen, so the desktop is easy to use.
        const steady = event.target instanceof Element && event.target.closest(".laptop-screen") ? 0.2 : 1;
        aim(((event.clientX / window.innerWidth) * 2 - 1) * steady, ((event.clientY / window.innerHeight) * 2 - 1) * steady);
      },
      { passive: true }
    );

    root.addEventListener("mouseleave", () => aim(0, 0));
    return;
  }

  let floatTime = 0;

  const float = (deltaTime) => {
    if (sceneProgress >= 0.3) {
      ticker.remove(float);
      return;
    }

    floatTime += deltaTime;
    tilt.x = Math.sin(floatTime / 1700) * 0.9;
    tilt.y = Math.sin(floatTime / 2200 + 1.2) * 0.7;
    render();
  };

  // Float until real sensor data arrives. Phones that only share motion after a
  // permission prompt (iPhones) never send any, so they keep floating and never see a prompt.
  wakeHeroMotion = () => ticker.add(float);
  wakeHeroMotion();

  let neutral = null;
  let receiving = false;

  window.addEventListener("deviceorientation", (event) => {
    if (event.beta === null || event.gamma === null) return;

    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    const landscape = Math.abs(angle) === 90 || angle === 270;
    const sign = angle === 90 ? 1 : -1;
    const x = landscape ? event.beta * sign : event.gamma;
    const y = landscape ? -event.gamma * sign : event.beta;

    // The neutral pose slowly follows however the phone is being held.
    if (!neutral) neutral = { x, y };
    neutral.x += (x - neutral.x) * 0.012;
    neutral.y += (y - neutral.y) * 0.012;

    if (!receiving) {
      receiving = true;
      wakeHeroMotion = null;
      ticker.remove(float);
    }

    if (sceneProgress < 0.3) aim((x - neutral.x) / 16, (y - neutral.y) / 16);
  });
};

const initMagnetic = () => {
  if (!hasFinePointer || prefersReducedMotion) return;

  document.querySelectorAll("[data-magnetic]").forEach((element) => {
    const strength = Number(element.dataset.magnetic) || 0.3;
    let offsetX = 0;
    let offsetY = 0;

    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      offsetX = (event.clientX - (rect.left - offsetX + rect.width / 2)) * strength;
      offsetY = (event.clientY - (rect.top - offsetY + rect.height / 2)) * strength;
      element.style.translate = `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px`;
    });

    element.addEventListener("pointerleave", () => {
      offsetX = 0;
      offsetY = 0;
      element.style.translate = "";
    });
  });
};

const initSpotlight = () => {
  const placeLight = (card, event) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${(event.clientX - rect.left).toFixed(1)}px`);
    card.style.setProperty("--my", `${(event.clientY - rect.top).toFixed(1)}px`);
  };

  document.querySelectorAll(".service-card, .process-item, .statement-card, .image-card, .feature-form").forEach((card) => {
    let fadeTimer = 0;
    card.classList.add("spotlight");

    if (hasFinePointer) {
      card.addEventListener("pointermove", (event) => placeLight(card, event));
      return;
    }

    // Touch: the glow lights up under the finger and fades after release.
    const release = () => {
      window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(() => card.classList.remove("is-touched"), 250);
    };

    card.addEventListener("pointerdown", (event) => {
      window.clearTimeout(fadeTimer);
      placeLight(card, event);
      card.classList.add("is-touched");
    });
    card.addEventListener("pointerup", release);
    card.addEventListener("pointercancel", release);
  });
};

// Phones: a ring pulses out from each tap (swipes don't count), and :active press styles work on iOS.
const initTapFeedback = () => {
  if (hasFinePointer) return;

  document.addEventListener("touchstart", () => {}, { passive: true });

  if (prefersReducedMotion) return;

  let tapStart = null;

  document.addEventListener("pointerdown", (event) => {
    tapStart = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY, time: event.timeStamp };
  });

  document.addEventListener("pointercancel", () => {
    tapStart = null;
  });

  document.addEventListener("pointerup", (event) => {
    const isTap =
      tapStart &&
      Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) < 12 &&
      event.timeStamp - tapStart.time < 600;

    tapStart = null;
    if (!isTap || (event.target instanceof Element && event.target.closest("input, textarea, select"))) return;

    const ripple = document.createElement("span");
    ripple.className = "tap-ripple";
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    document.body.append(ripple);

    ripple.animate([{ transform: "scale(0.3)" }, { transform: "scale(1.8)" }], {
      duration: 700,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
    ripple.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 700, easing: "ease-in" }).onfinish = () =>
      ripple.remove();
  });
};

initHeroMotion();
initMagnetic();
initSpotlight();
initTapFeedback();

/* ---------- Laptop desktop ---------- */

// The laptop screen works like a small desktop: the hero design is the wallpaper and the dock
// opens app windows (VS Code, Files) or links. Windows can be dragged, maximized and closed.
const initLaptopDesktop = () => {
  const desktop = document.querySelector(".laptop-screen-inner");
  const dock = desktop?.querySelector(".screen-dock");
  if (!desktop || !dock) return;

  const apps = [...dock.querySelectorAll(".dock-app")];
  const windows = new Map([...desktop.querySelectorAll("[data-window]")].map((win) => [win.dataset.window, win]));
  const offsets = new Map();
  let topLayer = 10;

  const clock = desktop.querySelector("[data-clock]");
  const updateClock = () => {
    clock.textContent = new Date().toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  };

  if (clock) {
    updateClock();
    window.setInterval(updateClock, 15000);
  }

  // VS Code: a snippet built from the site's own copy types itself out whenever the window opens.
  const code = windows.get("code")?.querySelector("code");
  const codeLines = [
    [["// Design better. Build smarter. Grow faster.", "c"]],
    [["const ", "k"], ["ivan", "v"], [" = {", "p"]],
    [["  services", "pr"], [": [", "p"], ['"Websites"', "s"], [", ", "p"], ['"Redesigns"', "s"], [",", "p"]],
    [["             ", "p"], ['"Ecommerce"', "s"], [", ", "p"], ['"Motion"', "s"], ["],", "p"]],
    [["  process", "pr"], [": [", "p"], ['"Strategy"', "s"], [", ", "p"], ['"Design"', "s"], [", ", "p"], ['"Launch"', "s"], ["],", "p"]],
    [["  reply", "pr"], [": ", "p"], ['"within 24 hours"', "s"], [",", "p"]],
    [["  email", "pr"], [": ", "p"], ['"ivanm.dev25@gmail.com"', "s"], [",", "p"]],
    [["};", "p"]],
    [],
    [["ivan", "v"], [".", "p"], ["build", "f"], ["(", "p"], ['"your brand"', "s"], [");", "p"]],
  ];
  const tokens = [];
  let caret = null;
  let typedAt = 0;

  codeLines.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "code-line";
    row.dataset.line = index + 1;

    line.forEach(([text, kind]) => {
      const span = document.createElement("span");
      span.className = `tok-${kind}`;
      row.append(span);
      tokens.push({ span, text });
    });

    code?.append(row);
  });

  const setCaret = (span) => {
    if (caret === span) return;
    caret?.classList.remove("is-caret");
    span?.classList.add("is-caret");
    caret = span;
  };

  const typeStep = (deltaTime, time) => {
    if (!typedAt) typedAt = time;
    let budget = Math.floor((time - typedAt) / 12);
    let current = tokens[0].span;

    tokens.forEach(({ span, text }) => {
      const shown = clamp(budget, 0, text.length);
      if (span.textContent.length !== shown) span.textContent = text.slice(0, shown);
      if (budget > 0) current = span;
      budget -= text.length;
    });

    setCaret(current);
    if (budget >= 0) ticker.remove(typeStep);
  };

  const typeCode = () => {
    if (!tokens.length) return;

    if (prefersReducedMotion) {
      tokens.forEach(({ span, text }) => (span.textContent = text));
      setCaret(tokens[tokens.length - 1].span);
      return;
    }

    tokens.forEach(({ span }) => (span.textContent = ""));
    typedAt = 0;
    ticker.add(typeStep);
  };

  // Files: one folder per project listed on the page; opening one scrolls to the Projects section.
  const filesWindow = windows.get("files");
  const filesGrid = filesWindow?.querySelector(".files-grid");
  const filesStatus = filesWindow?.querySelector(".files-status");
  const folderIcon =
    '<svg viewBox="0 0 48 40" aria-hidden="true"><path fill="#4d97ec" d="M2 8a4 4 0 0 1 4-4h12l4 4h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/><path fill="#7cb9f7" d="M2 14h44v20a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/></svg>';
  const projectNames = [
    ...[...document.querySelectorAll(".project-list span")].map((item) => item.textContent.trim()),
    ...(document.querySelector(".image-caption strong")?.textContent.split(",") ?? []).map((name) => name.trim()),
  ].filter(Boolean);

  const showProjects = () => {
    const target = document.querySelector("#about");
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: -24, duration: 2.4 });
    else target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  projectNames.forEach((name) => {
    const item = document.createElement("button");
    const label = document.createElement("span");
    item.type = "button";
    item.className = "file-item";
    item.title = name;
    item.innerHTML = folderIcon;
    label.textContent = name;
    item.append(label);
    item.addEventListener("click", showProjects);
    filesGrid?.append(item);
  });

  if (filesStatus) filesStatus.textContent = `${projectNames.length} items · click a folder to see the work`;

  const iconFor = (name) => dock.querySelector(`[data-app="${name}"]`);

  const raise = (win) => {
    topLayer += 1;
    win.style.zIndex = topLayer;
  };

  // Windows grow out of, and shrink back into, their dock icon.
  const zoomFromDock = (win, name, opening) => {
    if (prefersReducedMotion) return null;
    const icon = iconFor(name).getBoundingClientRect();
    const box = win.getBoundingClientRect();
    const originX = ((icon.left + icon.width / 2 - box.left) / box.width) * 100;
    const originY = ((icon.top + icon.height / 2 - box.top) / box.height) * 100;
    const frames = [
      { transform: "scale(0.1)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ];

    win.style.transformOrigin = `${originX}% ${originY}%`;
    return win.animate(opening ? frames : frames.reverse(), {
      duration: opening ? 520 : 360,
      easing: opening ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.7, 0, 0.84, 0)",
      fill: opening ? "none" : "forwards",
    });
  };

  const markOpen = (name, open) => {
    const icon = iconFor(name);
    icon?.classList.toggle("is-open", open);
    icon?.setAttribute("aria-expanded", String(open));
  };

  const openWindow = (name) => {
    const win = windows.get(name);
    if (!win) return;
    raise(win);
    if (!win.hidden) return;

    win.hidden = false;
    markOpen(name, true);
    zoomFromDock(win, name, true);
    win.focus({ preventScroll: true });
    if (name === "code") typeCode();
  };

  const closeWindow = (name) => {
    const win = windows.get(name);
    if (!win || win.hidden || win.dataset.closing) return;

    const animation = zoomFromDock(win, name, false);
    const finish = () => {
      win.hidden = true;
      win.classList.remove("is-maximized");
      delete win.dataset.closing;
      animation?.cancel();
      if (name === "code") ticker.remove(typeStep);
    };

    win.dataset.closing = "true";
    markOpen(name, false);
    if (animation) animation.finished.then(finish, finish);
    else finish();
  };

  const frontWindow = () =>
    [...windows.values()]
      .filter((win) => !win.hidden && !win.dataset.closing)
      .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];

  // Like a taskbar: an app's icon opens its window, brings it forward, or (if it's already in front) minimizes it.
  const toggleWindow = (name) => {
    const win = windows.get(name);
    if (win && win === frontWindow()) closeWindow(name);
    else openWindow(name);
  };

  const bounce = (app) => {
    if (prefersReducedMotion) return;
    app.querySelector(".dock-icon")?.animate(
      [{ translate: "0 0" }, { translate: "0 -42%" }, { translate: "0 0" }, { translate: "0 -16%" }, { translate: "0 0" }],
      { duration: 750, easing: "ease-out" }
    );
  };

  dock.addEventListener("click", (event) => {
    const app = event.target.closest(".dock-app");
    if (!app) return;
    const name = app.dataset.app;
    if (!name || windows.get(name)?.hidden) bounce(app);
    if (name) toggleWindow(name);
  });

  // macOS-style magnification: icons near the pointer grow and push their neighbours apart.
  if (hasFinePointer && !prefersReducedMotion) {
    dock.addEventListener("pointermove", (event) => {
      const reach = dock.getBoundingClientRect().height * 2.2;
      const centers = apps.map((app) => {
        const rect = app.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });

      apps.forEach((app, index) => {
        app.style.setProperty("--mag", Math.max(0, 1 - Math.abs(event.clientX - centers[index]) / reach).toFixed(3));
      });
    });

    dock.addEventListener("pointerleave", () => apps.forEach((app) => app.style.setProperty("--mag", "0")));
  }

  windows.forEach((win, name) => {
    const bar = win.querySelector(".window-bar");
    let drag = null;

    win.querySelector(".window-close")?.addEventListener("click", () => closeWindow(name));
    win.querySelector(".window-min")?.addEventListener("click", () => closeWindow(name));
    win.querySelector(".window-max")?.addEventListener("click", () => win.classList.toggle("is-maximized"));
    win.addEventListener("pointerdown", () => raise(win));
    win.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeWindow(name);
      iconFor(name)?.focus({ preventScroll: true });
    });

    // Drag by the title bar; pointer movement is divided by the laptop's current zoom.
    bar?.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".window-dot") || win.classList.contains("is-maximized")) return;
      const [x, y] = offsets.get(win) ?? [0, 0];
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        x,
        y,
        scale: monitorRig.getBoundingClientRect().width / monitorRig.offsetWidth,
      };
      bar.setPointerCapture(event.pointerId);
    });

    bar?.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const x = clamp(
        drag.x + (event.clientX - drag.startX) / drag.scale,
        40 - win.offsetLeft - win.offsetWidth,
        desktop.clientWidth - win.offsetLeft - 40
      );
      const y = clamp(
        drag.y + (event.clientY - drag.startY) / drag.scale,
        -win.offsetTop,
        desktop.clientHeight - win.offsetTop - bar.offsetHeight
      );
      offsets.set(win, [x, y]);
      win.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    });

    const endDrag = () => {
      drag = null;
    };

    bar?.addEventListener("pointerup", endDrag);
    bar?.addEventListener("pointercancel", endDrag);
  });
};

initLaptopDesktop();

/* ---------- Scroll effects ---------- */

const progressBar = document.createElement("div");
const processList = document.querySelector(".process-list");
const processItems = processList ? [...processList.querySelectorAll(".process-item")] : [];
let processColumns = 1;
let scrollEffectsFrame = 0;

progressBar.className = "scroll-progress";
progressBar.setAttribute("aria-hidden", "true");
document.body.append(progressBar);

processItems.forEach((item, index) => {
  const beam = document.createElement("div");
  const step = document.createElement("div");
  beam.className = "process-beam";
  step.className = "process-step";
  step.textContent = String(index + 1).padStart(2, "0");
  beam.setAttribute("aria-hidden", "true");
  step.setAttribute("aria-hidden", "true");
  item.append(beam, step);
});

const measureProcess = () => {
  if (!processItems.length) return;
  processColumns = processItems.filter((item) => item.offsetTop === processItems[0].offsetTop).length || 1;
};

// Each step's beam fills in sequence: left to right on desktop, top to bottom when stacked.
const updateProcess = () => {
  const viewportHeight = window.innerHeight;
  const tops = processItems.map((item) => item.getBoundingClientRect().top);

  processItems.forEach((item, index) => {
    const progress = clamp((viewportHeight * 0.85 - tops[index]) / (viewportHeight * 0.45), 0, 1);
    const fill = clamp(progress * processColumns - (index % processColumns), 0, 1);
    item.style.setProperty("--fill", fill.toFixed(3));
    item.classList.toggle("is-lit", fill >= 1);
  });
};

const updateProgressBar = () => {
  const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 1);
  progressBar.style.transform = `scaleX(${clamp(window.scrollY / maxScroll, 0, 1).toFixed(4)})`;
};

const updateScrollEffects = () => {
  scrollEffectsFrame = 0;
  updateProgressBar();
  updateProcess();
};

const requestScrollEffects = () => {
  if (!scrollEffectsFrame) scrollEffectsFrame = window.requestAnimationFrame(updateScrollEffects);
};

window.addEventListener("scroll", requestScrollEffects, { passive: true });
window.addEventListener("resize", () => {
  measureProcess();
  requestScrollEffects();
});

measureProcess();
updateScrollEffects();

// Two counter-scrolling rows that speed up, reverse and skew with scroll velocity.
const initMarquee = () => {
  const locations = document.querySelector(".locations");
  if (!locations || prefersReducedMotion) return;

  const pills = [...locations.children];
  const typeTrack = document.createElement("div");
  const pillTrack = document.createElement("div");
  const typeGroup = document.createElement("div");
  const pillGroup = document.createElement("div");

  const createRow = (variant, track) => {
    const row = document.createElement("div");
    row.className = `marquee marquee-${variant}`;
    track.className = "marquee-track";
    row.append(track);
    return row;
  };

  pills.forEach((pill, index) => {
    const word = document.createElement("div");
    const separator = document.createElement("div");
    word.className = index % 2 ? "marquee-word is-outline" : "marquee-word";
    word.textContent = pill.textContent.trim();
    separator.className = "marquee-sep";
    separator.textContent = "✦";
    typeGroup.append(word, separator);
  });

  typeGroup.className = "marquee-group";
  pillGroup.className = "marquee-group";
  pillGroup.append(...pills);
  typeTrack.append(typeGroup);
  pillTrack.append(pillGroup);

  const typeRow = createRow("type", typeTrack);
  typeRow.setAttribute("aria-hidden", "true");
  locations.classList.add("is-marquee");
  locations.append(typeRow, createRow("pills", pillTrack));

  const rows = [
    { track: typeTrack, group: typeGroup, direction: -1, speed: 0.045, offset: 0, width: 1 },
    { track: pillTrack, group: pillGroup, direction: 1, speed: 0.03, offset: 0, width: 1 },
  ];

  const fill = () => {
    rows.forEach((row) => {
      row.width = Math.max(row.group.offsetWidth, 1);
      const needed = Math.ceil(window.innerWidth / row.width) + 1;

      while (row.track.children.length < needed) {
        const clone = row.group.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        row.track.append(clone);
      }

      while (row.track.children.length > needed) {
        row.track.lastElementChild.remove();
      }

      row.offset %= row.width;
      if (row.offset > 0) row.offset -= row.width;
    });
  };

  let lastScrollY = window.scrollY;
  let velocity = 0;
  let scrollDirection = 1;
  let skew = 0;

  const step = (deltaTime) => {
    const scrollY = window.scrollY;
    const delta = scrollY - lastScrollY;
    lastScrollY = scrollY;

    velocity = damp(velocity, deltaTime ? delta / deltaTime : 0, 0.12, deltaTime);
    if (Math.abs(delta) > 0.5) scrollDirection = Math.sign(delta);
    skew = damp(skew, clamp(velocity * -2.4, -9, 9), 0.12, deltaTime);
    const boost = 1 + Math.min(Math.abs(velocity) * 3.5, 9);

    rows.forEach((row) => {
      row.offset += row.direction * scrollDirection * row.speed * boost * deltaTime;
      if (row.offset <= -row.width) row.offset += row.width;
      if (row.offset > 0) row.offset -= row.width;
      row.track.style.transform = `translate3d(${row.offset.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
    });
  };

  fill();
  document.fonts?.ready.then(fill);
  window.addEventListener("resize", fill);

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      lastScrollY = window.scrollY;
      ticker.add(step);
    } else {
      ticker.remove(step);
    }
  }).observe(locations);
};

initMarquee();

/* ---------- Contact form ---------- */

const form = document.querySelector(".feature-form");
const status = document.querySelector(".form-status");

const burstFrom = (element) => {
  if (prefersReducedMotion) return;

  const rect = element.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const colors = ["#34c7a1", "#5ee1b7", "#55a9ff", getComputedStyle(root).getPropertyValue("--text").trim()];
  const total = 18;

  for (let index = 0; index < total; index += 1) {
    const particle = document.createElement("span");
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.35;
    const distance = 70 + Math.random() * 80;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const size = 6 + Math.random() * 5;

    particle.className = "burst-particle";
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.background = colors[index % colors.length];
    document.body.append(particle);

    // Ease only the flight; the fade waits for the last 40% so particles stay visible.
    const animation = particle.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.85)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${x * 1.08}px), calc(-50% + ${y * 1.08 + 26}px)) scale(0)`, opacity: 0 },
      ],
      { duration: 1000 + Math.random() * 400 }
    );

    animation.onfinish = () => particle.remove();
  }
};

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const textFields = [
      ...form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea'),
    ];
    const invalidField = textFields.find((field) => !field.checkValidity() || !field.value.trim());
    const serviceFields = [...form.querySelectorAll('input[name="service"]')];
    const hasService = serviceFields.some((field) => field.checked);

    status.classList.remove("is-error", "is-success");

    if (invalidField) {
      status.textContent = "Please complete all required fields before sending your request.";
      status.classList.add("is-error");
      invalidField.focus();
      return;
    }

    if (!hasService) {
      status.textContent = "Please select at least one service.";
      status.classList.add("is-error");
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    status.textContent = "Preparing your request...";

    window.setTimeout(() => {
      status.textContent = "Request sent. We'll get back to you within 24 hours.";
      status.classList.add("is-success");
      submitButton.disabled = false;
      submitButton.textContent = "Request";
      burstFrom(submitButton);
      form.reset();
    }, 1200);
  });
}
