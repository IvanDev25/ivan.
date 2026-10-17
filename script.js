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
    const deltaTime = clamp(time - (lastTime || time), 0, 64);
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

  // The logo shows for at least 1.3s, and until the fonts and laptop image are in (max 4s).
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const assetsReady = Promise.race([
    Promise.all([document.fonts?.ready, whenImageReady(document.querySelector(".monitor-asset"))]),
    wait(4000),
  ]);

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
      document.querySelectorAll(".laptop-meta > :not([data-clock])").forEach((item, index) => {
        scrambleText(item, { duration: 1000, delay: index * 140 });
      });
    }, 1250);

    window.setTimeout(() => {
      root.classList.add("is-intro-done");
      preloader.remove();
    }, 3600);
  };

  Promise.all([assetsReady, wait(1300)]).then(() => window.setTimeout(finish, 220));
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

  // Files: sidebar tabs for Projects (folders that scroll to the Projects section),
  // Resume (the PDF, opened in a new tab) and Contact (shortcuts to the contact links).
  const resume = { name: "Ivan_Joshua_Merete - Resume.pdf", href: "asset/Ivan_Joshua_Merete - Resume.pdf" };
  const filesWindow = windows.get("files");
  const filesGrid = filesWindow?.querySelector(".files-grid");
  const filesStatus = filesWindow?.querySelector(".files-status");
  const filesTitle = filesWindow?.querySelector(".window-title");
  const filesTabs = [...(filesWindow?.querySelectorAll(".files-tab") ?? [])];
  const folderIcon =
    '<svg viewBox="0 0 48 40" aria-hidden="true"><path fill="#4d97ec" d="M2 8a4 4 0 0 1 4-4h12l4 4h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/><path fill="#7cb9f7" d="M2 14h44v20a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/></svg>';
  const pdfIcon =
    '<svg viewBox="0 0 40 48" aria-hidden="true"><path fill="#f6f8fb" stroke="rgba(0,0,0,0.14)" d="M7 1.5h19l10.5 10.5v32A2.5 2.5 0 0 1 34 46.5H7A2.5 2.5 0 0 1 4.5 44V4A2.5 2.5 0 0 1 7 1.5Z"/><path fill="#d3dae6" d="M26 1.5V10a2 2 0 0 0 2 2h8.5Z"/><path stroke="#c9d1de" stroke-width="1.6" stroke-linecap="round" d="M11 17h18M11 21.5h18M11 26h12"/><rect x="1" y="31" width="27" height="11" rx="2.5" fill="#e5383b"/><text x="14.5" y="39.3" text-anchor="middle" fill="#fff" font-family="Manrope, Arial, sans-serif" font-size="7.4" font-weight="800">PDF</text></svg>';

  const projectNames = [
    ...[...document.querySelectorAll(".project-list span")].map((item) => item.textContent.trim()),
    ...(document.querySelector(".image-caption strong")?.textContent.split(",") ?? []).map((name) => name.trim()),
  ].filter(Boolean);

  // Contact shortcuts come from the contact section and reuse the dock's matching app icon.
  const contactLinks = [...document.querySelectorAll(".feature-detail")]
    .map((detail) => ({ label: detail.querySelector("span")?.textContent.trim(), link: detail.querySelector("a") }))
    .filter(({ label, link }) => label && link);

  const showProjects = () => {
    const target = document.querySelector("#about");
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: -24, duration: 2.4 });
    else target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const fileItem = ({ name, icon, href, onClick, title = name, wide = false }) => {
    const item = document.createElement(href ? "a" : "button");
    const label = document.createElement("span");

    item.className = wide ? "file-item is-wide" : "file-item";
    item.title = title;

    if (href) {
      item.href = href;
      if (!href.startsWith("mailto:")) {
        item.target = "_blank";
        item.rel = "noreferrer";
      }
    } else {
      item.type = "button";
      item.addEventListener("click", onClick);
    }

    if (typeof icon === "string") item.innerHTML = icon;
    else item.append(icon);

    label.className = "file-name";
    label.textContent = name;
    item.append(label);
    return item;
  };

  const fileTabs = {
    projects: {
      title: "Projects",
      status: `${projectNames.length} items · click a folder to see the work`,
      items: () => projectNames.map((name) => fileItem({ name, icon: folderIcon, onClick: showProjects })),
    },
    resume: {
      title: "Resume",
      status: "1 item · PDF document · click to open",
      items: () => [fileItem({ name: resume.name, icon: pdfIcon, href: encodeURI(resume.href), wide: true })],
    },
    contact: {
      title: "Contact",
      status: `${contactLinks.length} shortcuts · reach out directly`,
      items: () =>
        contactLinks.map(({ label, link }) =>
          fileItem({
            name: label,
            title: link.textContent.trim(),
            href: link.getAttribute("href"),
            icon: dock.querySelector(`a[href="${link.getAttribute("href")}"] .dock-icon`)?.cloneNode(true) ?? folderIcon,
          })
        ),
    },
  };

  const showFilesTab = (key) => {
    const tab = fileTabs[key];
    if (!tab || !filesGrid) return;

    filesTabs.forEach((button) => {
      if (button.dataset.tab === key) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });

    // Fresh items replay the staggered pop-in animation on every switch.
    filesGrid.replaceChildren(
      ...tab.items().map((item, index) => {
        item.style.setProperty("--i", index);
        return item;
      })
    );

    if (filesTitle) filesTitle.textContent = tab.title;
    if (filesStatus) filesStatus.textContent = tab.status;
  };

  filesTabs.forEach((button) => button.addEventListener("click", () => showFilesTab(button.dataset.tab)));
  showFilesTab("projects");

  const iconFor = (name) => dock.querySelector(`[data-app="${name}"]`);

  const raise = (win) => {
    topLayer += 1;
    win.style.zIndex = topLayer;
  };

  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smooth = (value) => value * value * (3 - 2 * value);

  // A rect in the desktop's own (unzoomed) pixels, whatever the laptop's current zoom.
  const localRect = (element) => {
    const desk = desktop.getBoundingClientRect();
    const scale = desk.width / desktop.offsetWidth || 1;
    const rect = element.getBoundingClientRect();
    return {
      left: (rect.left - desk.left) / scale,
      top: (rect.top - desk.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    };
  };

  // Perspective matrix that maps the band [0, width] x [bandTop, bandTop + bandHeight] of an
  // element onto any four corners (top-left, top-right, bottom-right, bottom-left).
  const quadMatrix = (width, bandTop, bandHeight, [p0, p1, p2, p3]) => {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    const det = dx1 * dy2 - dx2 * dy1 || 1e-6;
    const g = (dx3 * dy2 - dx2 * dy3) / det;
    const h = (dx1 * dy3 - dx3 * dy1) / det;
    const a = p1.x - p0.x + g * p1.x;
    const b = p3.x - p0.x + h * p3.x;
    const d = p1.y - p0.y + g * p1.y;
    const e = p3.y - p0.y + h * p3.y;
    const shift = bandTop / bandHeight;
    const m = [
      a / width, d / width, 0, g / width,
      b / bandHeight, e / bandHeight, 0, h / bandHeight,
      0, 0, 1, 0,
      p0.x - b * shift, p0.y - e * shift, 0, 1 - h * shift,
    ];
    return `matrix3d(${m.map((value) => value.toFixed(6)).join(",")})`;
  };

  // macOS "Genie": the window is cut into horizontal strips (copies clipped to one band each).
  // Each strip is warped onto a trapezoid whose edges meet its neighbours', so together they
  // form one smooth funnel that pours into the dock icon. Played backwards, it pours back out.
  const genie = (win, name, direction) =>
    new Promise((resolve) => {
      const from = localRect(win);
      const to = localRect(iconFor(name).querySelector(".dock-icon"));
      const funnel = Math.max(to.top - from.top, from.height * 0.6);
      const count = hasFinePointer ? 32 : 22;
      const duration = direction === "reverse" ? 560 : 640;
      const strips = [];
      // Copying a <canvas> doesn't copy its pixels, so the strips show a snapshot instead.
      const sourceCanvas = win.querySelector("canvas");
      const snapshot = sourceCanvas?.width ? sourceCanvas.toDataURL("image/jpeg", 0.85) : null;

      for (let index = 0; index < count; index += 1) {
        const strip = document.createElement("div");
        const copy = win.cloneNode(true);
        const v0 = index / count;
        const v1 = (index + 1) / count;

        copy.querySelectorAll("canvas").forEach((canvas) => {
          const image = new Image();
          image.alt = "";
          if (snapshot) image.src = snapshot;
          canvas.replaceWith(image);
        });

        strip.className = "genie-strip";
        strip.setAttribute("aria-hidden", "true");
        strip.inert = true;
        Object.assign(strip.style, {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          zIndex: win.style.zIndex,
          clipPath: `inset(${v0 * from.height}px 0 ${Math.max((1 - v1) * from.height - 0.75, 0)}px 0)`,
        });

        ["data-window", "role", "aria-label", "tabindex"].forEach((attribute) => copy.removeAttribute(attribute));
        copy.hidden = false;
        Object.assign(copy.style, {
          left: "0",
          top: "0",
          width: "100%",
          height: "100%",
          translate: "none",
          transform: "none",
          visibility: "visible",
        });
        strip.append(copy);
        strips.push({ strip, v0, v1 });
      }

      // The funnel's edges at a given height: wide at the window's top, icon-wide at the dock.
      const edgesAt = (y, bend) => {
        const pinch = smooth(clamp((y - from.top) / funnel, 0, 1)) * bend;
        return [lerp(from.left, to.left, pinch), lerp(from.left + from.width, to.left + to.width, pinch)];
      };

      const render = (t) => {
        const bend = smooth(clamp(t / 0.42, 0, 1));
        const slide = clamp((t - 0.24) / 0.76, 0, 1) ** 2;
        // Lower parts of the window drop first, so it drains into the dock bottom-first.
        const yAt = (v) =>
          lerp(from.top + v * from.height, to.top + v * to.height, clamp(slide * 1.4 - (1 - v) * 0.4, 0, 1));
        const opacity = String(t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2);

        strips.forEach(({ strip, v0, v1 }) => {
          const top = yAt(v0);
          const bottom = yAt(v1);
          const [topLeft, topRight] = edgesAt(top, bend);
          const [bottomLeft, bottomRight] = edgesAt(bottom, bend);
          strip.style.transform = quadMatrix(from.width, v0 * from.height, (v1 - v0) * from.height, [
            { x: topLeft - from.left, y: top - from.top },
            { x: topRight - from.left, y: top - from.top },
            { x: bottomRight - from.left, y: Math.max(bottom, top + 0.01) - from.top },
            { x: bottomLeft - from.left, y: Math.max(bottom, top + 0.01) - from.top },
          ]);
          strip.style.opacity = opacity;
        });
      };

      render(direction === "reverse" ? 1 : 0);
      strips.forEach(({ strip }) => desktop.append(strip));

      let elapsed = 0;
      const step = (deltaTime) => {
        elapsed += deltaTime;
        const progress = Math.min(elapsed / duration, 1);
        render(direction === "reverse" ? 1 - progress : progress);
        if (progress < 1) return;
        ticker.remove(step);
        resolve(strips);
      };

      ticker.add(step);
    });

  const removeStrips = (strips) => strips.forEach(({ strip }) => strip.remove());

  // open: window showing · minimized: hidden, keeps its state and dock dot · closed: app quit.
  const markState = (name, state) => {
    const icon = iconFor(name);
    icon?.classList.toggle("is-open", state !== "closed");
    icon?.setAttribute("aria-expanded", String(state === "open"));
  };

  // Close and minimize both genie into the dock; only minimize keeps the window as it was.
  const genieAway = (name, mode) => {
    const win = windows.get(name);
    if (!win || win.hidden || win.dataset.busy) return;

    const finish = () => {
      delete win.dataset.busy;
      if (mode === "closed") {
        win.classList.remove("is-maximized");
        if (name === "code") ticker.remove(typeStep);
      }
    };

    markState(name, mode);
    if (mode === "minimized") win.dataset.minimized = "true";
    win.dispatchEvent(new Event(mode === "closed" ? "app:close" : "app:minimize"));

    if (prefersReducedMotion) {
      win.hidden = true;
      finish();
      return;
    }

    win.dataset.busy = "true";
    const done = genie(win, name, "normal");
    win.hidden = true;
    done.then((strips) => {
      removeStrips(strips);
      finish();
    });
  };

  const closeWindow = (name) => genieAway(name, "closed");
  const minimizeWindow = (name) => genieAway(name, "minimized");

  const restoreWindow = (name) => {
    const win = windows.get(name);
    if (!win || win.dataset.busy) return;

    delete win.dataset.minimized;
    raise(win);
    markState(name, "open");
    win.hidden = false;

    if (prefersReducedMotion) {
      win.focus({ preventScroll: true });
      return;
    }

    // Lay the window out invisibly so the genie knows where it pours back to.
    win.dataset.busy = "true";
    win.style.visibility = "hidden";
    genie(win, name, "reverse").then((strips) => {
      win.style.visibility = "";
      removeStrips(strips);
      delete win.dataset.busy;
      win.focus({ preventScroll: true });
    });
  };

  const openWindow = (name) => {
    const win = windows.get(name);
    if (!win) return;
    if (win.dataset.minimized) {
      restoreWindow(name);
      return;
    }

    raise(win);
    if (!win.hidden) return;

    win.hidden = false;
    markState(name, "open");
    win.focus({ preventScroll: true });
    win.dispatchEvent(new Event("app:open"));
    if (name === "code") typeCode();

    // A freshly launched app zooms out of its dock icon.
    if (!prefersReducedMotion) {
      const icon = iconFor(name).getBoundingClientRect();
      const box = win.getBoundingClientRect();
      win.style.transformOrigin = `${((icon.left + icon.width / 2 - box.left) / box.width) * 100}% ${
        ((icon.top + icon.height / 2 - box.top) / box.height) * 100
      }%`;
      win.animate(
        [
          { transform: "scale(0.1)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }
  };

  const frontWindow = () =>
    [...windows.values()]
      .filter((win) => !win.hidden && !win.dataset.busy)
      .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];

  // Like a taskbar: an app's icon opens its window, restores or raises it, or (if it's in front) minimizes it.
  const toggleWindow = (name) => {
    const win = windows.get(name);
    if (win && win === frontWindow()) minimizeWindow(name);
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
    const win = name && windows.get(name);
    // Only launching bounces; restoring a minimized window doesn't.
    if (!name || (win?.hidden && !win.dataset.minimized)) bounce(app);
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
    win.querySelector(".window-min")?.addEventListener("click", () => minimizeWindow(name));
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

/* ---------- Laptop game: full screen on phones ---------- */

// Phones play the laptop's game full screen, outside the small laptop window.
const createFullScreen = (stage, label, onExit) => {
  const home = stage.parentElement;
  let overlay = null;

  const exit = () => {
    if (!overlay) return;
    onExit();
    home.append(stage);
    overlay.remove();
    overlay = null;
    root.classList.remove("is-gaming");
    lenis?.start();
  };

  const enter = () => {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "game-overlay";
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", label);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-exit";
    button.setAttribute("aria-label", "Exit game");
    button.textContent = "✕";
    button.addEventListener("click", exit);

    overlay.append(stage, button);
    document.body.append(overlay);
    root.classList.add("is-gaming");
    lenis?.stop();
    if (!prefersReducedMotion) {
      overlay.animate([{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], {
        duration: 320,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
    }
  };

  return {
    enter,
    exit,
    get element() {
      return overlay;
    },
  };
};

/* ---------- Road Hop (mini game) ---------- */

// Hop across roads without getting hit. Adapted from the Three.js "Crossy Road" tutorial at
// javascriptgametutorials.com (video: https://youtu.be/vNr3_hQ3Bws), shared on CodePen under MIT.
// Three.js only downloads when the app is first opened.
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

const buildRoadHop = (THREE, canvas) => {
  const minTileIndex = -8;
  const maxTileIndex = 8;
  const tilesPerRow = maxTileIndex - minTileIndex + 1;
  const tileSize = 42;
  const stepTime = 0.2;

  const randomElement = (array) => array[Math.floor(Math.random() * array.length)];

  const Texture = (width, height, rects) => {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = width;
    textureCanvas.height = height;
    const context = textureCanvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(0,0,0,0.6)";
    rects.forEach((rect) => context.fillRect(rect.x, rect.y, rect.w, rect.h));
    return new THREE.CanvasTexture(textureCanvas);
  };

  const carFrontTexture = Texture(40, 80, [{ x: 0, y: 10, w: 30, h: 60 }]);
  const carBackTexture = Texture(40, 80, [{ x: 10, y: 10, w: 30, h: 60 }]);
  const carRightSideTexture = Texture(110, 40, [
    { x: 10, y: 0, w: 50, h: 30 },
    { x: 70, y: 0, w: 30, h: 30 },
  ]);
  const carLeftSideTexture = Texture(110, 40, [
    { x: 10, y: 10, w: 50, h: 30 },
    { x: 70, y: 10, w: 30, h: 30 },
  ]);
  const truckFrontTexture = Texture(30, 30, [{ x: 5, y: 0, w: 10, h: 30 }]);
  const truckRightSideTexture = Texture(25, 30, [{ x: 15, y: 5, w: 10, h: 10 }]);
  const truckLeftSideTexture = Texture(25, 30, [{ x: 15, y: 15, w: 10, h: 10 }]);

  const box = (width, depth, height, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const Wheel = (x) => {
    const wheel = new THREE.Mesh(
      new THREE.BoxGeometry(12, 33, 12),
      new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true })
    );
    wheel.position.x = x;
    wheel.position.z = 6;
    return wheel;
  };

  const Car = (initialTileIndex, direction, color) => {
    const car = new THREE.Group();
    car.position.x = initialTileIndex * tileSize;
    if (!direction) car.rotation.z = Math.PI;

    const main = box(60, 30, 15, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    main.position.z = 12;
    car.add(main);

    const cabin = box(
      33,
      24,
      12,
      [carBackTexture, carFrontTexture, carRightSideTexture, carLeftSideTexture, null, null].map(
        (map) => new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map })
      )
    );
    cabin.position.x = -6;
    cabin.position.z = 25.5;
    car.add(cabin, Wheel(18), Wheel(-18));
    return car;
  };

  const Truck = (initialTileIndex, direction, color) => {
    const truck = new THREE.Group();
    truck.position.x = initialTileIndex * tileSize;
    if (!direction) truck.rotation.z = Math.PI;

    const cargo = box(70, 35, 35, new THREE.MeshLambertMaterial({ color: 0xb4c6fc, flatShading: true }));
    cargo.position.x = -15;
    cargo.position.z = 25;

    const cabin = box(
      30,
      30,
      30,
      [truckFrontTexture, null, truckLeftSideTexture, truckRightSideTexture, null, null].map(
        (map) => new THREE.MeshLambertMaterial({ color, flatShading: true, map })
      )
    );
    cabin.position.x = 35;
    cabin.position.z = 20;
    truck.add(cargo, cabin, Wheel(37), Wheel(5), Wheel(-35));
    return truck;
  };

  const Tree = (tileIndex, height) => {
    const tree = new THREE.Group();
    tree.position.x = tileIndex * tileSize;

    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(15, 15, 20),
      new THREE.MeshLambertMaterial({ color: 0x4d2926, flatShading: true })
    );
    trunk.position.z = 10;

    const crown = box(30, 30, height, new THREE.MeshLambertMaterial({ color: 0x7aa21d, flatShading: true }));
    crown.position.z = height / 2 + 20;
    tree.add(trunk, crown);
    return tree;
  };

  // A row strip, with darker copies either side so the board's edges read clearly.
  const Strip = (rowIndex, middleColor, sideColor, flat) => {
    const row = new THREE.Group();
    row.position.y = rowIndex * tileSize;
    [middleColor, sideColor, sideColor].forEach((color, index) => {
      const section = new THREE.Mesh(
        flat
          ? new THREE.PlaneGeometry(tilesPerRow * tileSize, tileSize)
          : new THREE.BoxGeometry(tilesPerRow * tileSize, tileSize, 3),
        new THREE.MeshLambertMaterial({ color })
      );
      section.position.x = [0, -1, 1][index] * tilesPerRow * tileSize;
      section.receiveShadow = index === 0;
      row.add(section);
    });
    return row;
  };

  const Grass = (rowIndex) => Strip(rowIndex, 0xbaf455, 0x99c846, false);
  const Road = (rowIndex) => Strip(rowIndex, 0x454a59, 0x393d49, true);

  const Player = () => {
    const body = box(15, 15, 20, new THREE.MeshLambertMaterial({ color: "white", flatShading: true }));
    body.position.z = 10;
    const cap = box(2, 4, 2, new THREE.MeshLambertMaterial({ color: 0xf0619a, flatShading: true }));
    cap.position.z = 21;

    const hopper = new THREE.Group();
    hopper.add(body, cap);
    const container = new THREE.Group();
    container.add(hopper);
    return container;
  };

  const freeTile = (occupied, spread) => {
    let tileIndex;
    do {
      tileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex);
    } while (occupied.has(tileIndex));
    for (let offset = -spread; offset <= spread; offset += 1) occupied.add(tileIndex + offset);
    return tileIndex;
  };

  const generateRow = () => {
    const type = randomElement(["car", "truck", "forest"]);
    const occupied = new Set();

    if (type === "forest") {
      return {
        type,
        trees: Array.from({ length: 4 }, () => ({ tileIndex: freeTile(occupied, 0), height: randomElement([20, 45, 60]) })),
      };
    }

    return {
      type,
      direction: randomElement([true, false]),
      speed: randomElement([125, 156, 188]),
      vehicles: Array.from({ length: type === "car" ? 3 : 2 }, () => ({
        initialTileIndex: freeTile(occupied, type === "car" ? 1 : 2),
        color: randomElement([0xa52523, 0xbdb638, 0x78b14b]),
      })),
    };
  };

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const map = new THREE.Group();
  const player = Player();
  const hopper = player.children[0];
  const metadata = [];
  const movesQueue = [];
  const position = { currentRow: 0, currentTile: 0 };
  let moveTime = 0;
  let maxRow = 0;

  scene.add(player, map, new THREE.AmbientLight());

  const dirLight = new THREE.DirectionalLight();
  dirLight.position.set(-100, -100, 200);
  dirLight.up.set(0, 0, 1);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  Object.assign(dirLight.shadow.camera, { left: -400, right: 400, top: 400, bottom: -400, near: 50, far: 400 });
  dirLight.shadow.camera.up.set(0, 0, 1);
  dirLight.target = player;
  player.add(dirLight);

  const camera = new THREE.OrthographicCamera(-150, 150, 150, -150, 100, 900);
  camera.up.set(0, 0, 1);
  camera.position.set(300, -300, 300);
  camera.lookAt(0, 0, 0);
  player.add(camera);

  // Free the GPU memory of rows thrown away on restart (textures are shared, so they stay).
  const dispose = (object) =>
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      [].concat(child.material).forEach((material) => material.dispose());
    });

  const addRows = () => {
    const startIndex = metadata.length;
    const rows = Array.from({ length: 20 }, generateRow);
    metadata.push(...rows);

    rows.forEach((rowData, index) => {
      const rowIndex = startIndex + index + 1;

      if (rowData.type === "forest") {
        const row = Grass(rowIndex);
        rowData.trees.forEach(({ tileIndex, height }) => row.add(Tree(tileIndex, height)));
        map.add(row);
        return;
      }

      const row = Road(rowIndex);
      rowData.vehicles.forEach((vehicle) => {
        vehicle.ref = (rowData.type === "car" ? Car : Truck)(vehicle.initialTileIndex, rowData.direction, vehicle.color);
        row.add(vehicle.ref);
      });
      map.add(row);
    });
  };

  const reset = () => {
    map.children.slice().forEach((row) => {
      map.remove(row);
      dispose(row);
    });
    metadata.length = 0;
    for (let rowIndex = 0; rowIndex > -10; rowIndex -= 1) map.add(Grass(rowIndex));
    addRows();

    player.position.set(0, 0, 0);
    hopper.position.z = 0;
    hopper.rotation.z = 0;
    position.currentRow = 0;
    position.currentTile = 0;
    movesQueue.length = 0;
    moveTime = 0;
    maxRow = 0;
  };

  const finalPosition = (moves) =>
    moves.reduce(
      ({ rowIndex, tileIndex }, direction) => ({
        rowIndex: rowIndex + (direction === "forward") - (direction === "backward"),
        tileIndex: tileIndex + (direction === "right") - (direction === "left"),
      }),
      { rowIndex: position.currentRow, tileIndex: position.currentTile }
    );

  const queueMove = (direction) => {
    if (movesQueue.length > 2) return;
    const { rowIndex, tileIndex } = finalPosition([...movesQueue, direction]);
    if (rowIndex === -1 || tileIndex < minTileIndex || tileIndex > maxTileIndex) return;
    const row = metadata[rowIndex - 1];
    if (row?.type === "forest" && row.trees.some((tree) => tree.tileIndex === tileIndex)) return;
    movesQueue.push(direction);
  };

  const animatePlayer = (delta) => {
    if (!movesQueue.length) return;
    moveTime += delta;
    const progress = Math.min(1, moveTime / stepTime);
    const direction = movesQueue[0];

    const startX = position.currentTile * tileSize;
    const startY = position.currentRow * tileSize;
    player.position.x = THREE.MathUtils.lerp(startX, startX + ((direction === "right") - (direction === "left")) * tileSize, progress);
    player.position.y = THREE.MathUtils.lerp(startY, startY + ((direction === "forward") - (direction === "backward")) * tileSize, progress);
    hopper.position.z = Math.sin(progress * Math.PI) * 8;

    const turn = { forward: 0, left: Math.PI / 2, right: -Math.PI / 2, backward: Math.PI }[direction];
    hopper.rotation.z = THREE.MathUtils.lerp(hopper.rotation.z, turn, progress);

    if (progress < 1) return;
    movesQueue.shift();
    moveTime = 0;
    if (direction === "forward") position.currentRow += 1;
    if (direction === "backward") position.currentRow -= 1;
    if (direction === "left") position.currentTile -= 1;
    if (direction === "right") position.currentTile += 1;
    maxRow = Math.max(maxRow, position.currentRow);
    if (position.currentRow > metadata.length - 10) addRows();
  };

  const animateVehicles = (delta) => {
    const beginningOfRow = (minTileIndex - 2) * tileSize;
    const endOfRow = (maxTileIndex + 2) * tileSize;

    metadata.forEach((rowData) => {
      if (rowData.type === "forest") return;
      rowData.vehicles.forEach(({ ref }) => {
        if (rowData.direction) {
          ref.position.x = ref.position.x > endOfRow ? beginningOfRow : ref.position.x + rowData.speed * delta;
        } else {
          ref.position.x = ref.position.x < beginningOfRow ? endOfRow : ref.position.x - rowData.speed * delta;
        }
      });
    });
  };

  const playerBox = new THREE.Box3();
  const vehicleBox = new THREE.Box3();

  const hit = () => {
    const row = metadata[position.currentRow - 1];
    if (!row || row.type === "forest") return false;
    playerBox.setFromObject(player);
    return row.vehicles.some(({ ref }) => playerBox.intersectsBox(vehicleBox.setFromObject(ref)));
  };

  reset();

  return {
    reset,
    queueMove,
    // Advances the world; returns true when the hopper gets hit.
    update(delta) {
      animateVehicles(delta);
      animatePlayer(delta);
      return hit();
    },
    render: () => renderer.render(scene, camera),
    resize(width, height) {
      const size = 300;
      const ratio = width / height;
      const viewWidth = ratio < 1 ? size : size * ratio;
      const viewHeight = ratio < 1 ? size / ratio : size;
      Object.assign(camera, { left: -viewWidth / 2, right: viewWidth / 2, top: viewHeight / 2, bottom: -viewHeight / 2 });
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
    },
    get score() {
      return maxRow;
    },
  };
};

const initRoadHop = () => {
  const win = document.querySelector('[data-window="hop"]');
  const stage = win?.querySelector(".game-stage");
  const canvas = stage?.querySelector("canvas");
  if (!win || !stage || !canvas) return;

  const panel = stage.querySelector(".game-panel");
  const panelTitle = panel.querySelector(".game-panel-title");
  const panelText = panel.querySelector(".game-panel-text");
  const playButton = panel.querySelector(".game-play");
  const scoreLabel = stage.querySelector(".hop-score");
  const touchPlay = !hasFinePointer;
  const fullScreen = createFullScreen(stage, "Road Hop", () => pause());

  let game = null;
  let loading = null;
  let state = "idle";
  let best = 0;
  let newBest = false;

  try {
    best = Number(localStorage.getItem("road-hop-best")) || 0;
  } catch {}

  const setPanel = (title, text, button) => {
    panelTitle.textContent = title;
    panelText.textContent = text;
    playButton.textContent = button;
    panel.hidden = false;
  };

  const showState = (next) => {
    state = next;
    stage.dataset.state = next;
    const score = game?.score ?? 0;

    if (next === "idle") {
      setPanel(
        "Road Hop",
        touchPlay
          ? "Hop across the roads without getting hit. Tap to hop forward, swipe or use the arrows to move."
          : "Hop across the roads without getting hit. Arrow keys or WASD to move. Click to hop forward.",
        game ? "Play" : "Loading…"
      );
    } else if (next === "paused") {
      setPanel("Paused", `Score ${score}`, "Resume");
    } else if (next === "over") {
      setPanel("Splat!", `Score ${score} · Best ${best}${newBest ? " · New best!" : ""}`, "Play again");
    } else if (next === "error") {
      setPanel("Couldn't load", "The game needs an internet connection to load. Please try again.", "Retry");
    } else {
      panel.hidden = true;
    }

    playButton.disabled = next === "idle" && !game;
    scoreLabel.textContent = score;
    canvas.setAttribute("aria-label", `Road Hop game, score ${score}`);
  };

  const measure = () => {
    if (!game || !stage.clientWidth || !stage.clientHeight) return;
    game.resize(stage.clientWidth, stage.clientHeight);
    game.render();
  };

  const load = () => {
    loading ??= import(THREE_URL)
      .then((THREE) => {
        game = buildRoadHop(THREE, canvas);
        measure();
        if (state === "idle" || state === "error") showState("idle");
      })
      .catch(() => {
        loading = null;
        showState("error");
      });
    return loading;
  };

  const tick = (deltaTime) => {
    if (win.hidden || (!fullScreen.element && scene?.classList.contains("is-diving"))) {
      pause();
      return;
    }

    const hitByVehicle = game.update(Math.min(deltaTime / 1000, 0.05));
    scoreLabel.textContent = game.score;
    game.render();

    if (!hitByVehicle) return;
    ticker.remove(tick);
    if (game.score > best) {
      best = game.score;
      newBest = true;
      try {
        localStorage.setItem("road-hop-best", String(best));
      } catch {}
    }
    showState("over");
  };

  function pause() {
    ticker.remove(tick);
    if (state === "playing") showState("paused");
  }

  const play = () => {
    if (state === "error") {
      showState("idle");
      load();
      return;
    }
    if (!game || state === "playing") return;
    if (touchPlay) fullScreen.enter();
    if (state !== "paused") {
      game.reset();
      newBest = false;
    }
    showState("playing");
    (fullScreen.element ?? win).focus({ preventScroll: true });
    measure();
    ticker.add(tick);
  };

  playButton.addEventListener("click", play);

  const move = (direction) => {
    if (state === "playing") game.queueMove(direction);
  };

  // Keys only move the hopper while this game's window (or its full screen) has focus.
  const keys = {
    ArrowUp: "forward", KeyW: "forward",
    ArrowDown: "backward", KeyS: "backward",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
  };

  // The on-screen keycap guide lights up while its key (WASD or arrow) is held.
  const keycaps = Object.fromEntries([...stage.querySelectorAll(".hop-key")].map((key) => [key.dataset.key, key]));
  const lightKey = (direction, on) => keycaps[direction]?.classList.toggle("is-pressed", on);

  document.addEventListener("keyup", (event) => {
    if (keys[event.code]) lightKey(keys[event.code], false);
  });

  document.addEventListener("keydown", (event) => {
    if (!fullScreen.element && !win.contains(document.activeElement)) return;
    if (keys[event.code]) {
      lightKey(keys[event.code], state === "playing");
      if (!event.repeat) move(keys[event.code]);
    } else if (event.code === "Space" || (event.code === "Enter" && state !== "playing")) {
      if (state === "playing") move("forward");
      else play();
    } else if (event.code === "Escape" && fullScreen.element) fullScreen.exit();
    else return;
    event.preventDefault();
  });

  stage.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      move(button.dataset.move);
    });
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });

  // Tap (or click) to hop forward; swipe to hop in that direction.
  let swipeStart = null;
  canvas.addEventListener("pointerdown", (event) => {
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.hypot(dx, dy) < 18) move("forward");
    else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy < 0 ? "forward" : "backward");
  });
  canvas.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  if (touchPlay) stage.classList.add("has-touch");

  win.addEventListener("app:open", () => {
    showState("idle");
    load();
  });
  win.addEventListener("app:minimize", pause);
  win.addEventListener("app:close", () => {
    fullScreen.exit();
    ticker.remove(tick);
    if (state === "playing" || state === "paused") showState("idle");
  });

  new ResizeObserver(measure).observe(stage);
  showState("idle");
};

initRoadHop();

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
