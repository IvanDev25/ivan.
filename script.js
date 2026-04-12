const revealItems = document.querySelectorAll(".reveal");

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const resetScrollToTop = () => {
  window.scrollTo(0, 0);
};

window.addEventListener("load", resetScrollToTop);
window.addEventListener("pageshow", resetScrollToTop);
window.addEventListener("beforeunload", resetScrollToTop);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

const scene = document.querySelector("[data-scene]");
const depthItems = document.querySelectorAll("[data-scroll-depth]");
const monitorRig = document.querySelector(".monitor-rig");
const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
const hasLenis = typeof window.Lenis !== "undefined";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getSceneMotion = () => {
  if (window.innerWidth <= 780) {
    return {
      screenY: 4,
      badgeY: -6,
      rigScale: 5.2,
      rigShiftY: -108,
    };
  }

  return {
    screenY: 10,
    badgeY: -10,
    rigScale: 2.35,
    rigShiftY: -42,
  };
};

const syncMobileLaptopVisibility = (progress) => {
  if (!monitorRig) return;
  const shouldHide = window.innerWidth <= 780 && progress >= 0.82;
  monitorRig.classList.toggle("is-hidden", shouldHide);
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
  const viewportHeight = window.innerHeight;

  if (scene) {
    const rect = scene.getBoundingClientRect();
    const total = Math.max(scene.offsetHeight - viewportHeight, 1);
    const progress = clamp(-rect.top / total, 0, 1);
    const motion = getSceneMotion();

    scene.style.setProperty("--scene-progress", progress.toFixed(4));
    scene.style.setProperty("--parallax-backdrop-y", `${progress * -18}px`);
    scene.style.setProperty("--parallax-frame-a-y", `${progress * -54}px`);
    scene.style.setProperty("--parallax-frame-b-y", `${progress * -84}px`);
    scene.style.setProperty("--parallax-frame-c-y", `${progress * -66}px`);
    scene.style.setProperty("--parallax-screen-y", `${progress * motion.screenY}px`);
    scene.style.setProperty("--parallax-badge-y", `${progress * motion.badgeY}px`);
    scene.style.setProperty("--parallax-statement-y", `${progress * -46}px`);
    scene.style.setProperty("--rig-scale", `${1 + progress * motion.rigScale}`);
    scene.style.setProperty("--rig-shift-y", `${progress * motion.rigShiftY}px`);
    syncMobileLaptopVisibility(progress);
  }

  updateDepthItems();
};

let lenis = null;

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

  gsap.to(sceneProps, {
    progress: 1,
    ease: "none",
    scrollTrigger: {
      trigger: scene,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.2,
      onUpdate: () => {
        const progress = sceneProps.progress;
        const motion = getSceneMotion();
        scene.style.setProperty("--scene-progress", progress.toFixed(4));
        scene.style.setProperty("--parallax-backdrop-y", `${progress * -18}px`);
        scene.style.setProperty("--parallax-frame-a-y", `${progress * -54}px`);
        scene.style.setProperty("--parallax-frame-b-y", `${progress * -84}px`);
        scene.style.setProperty("--parallax-frame-c-y", `${progress * -66}px`);
        scene.style.setProperty("--parallax-screen-y", `${progress * motion.screenY}px`);
        scene.style.setProperty("--parallax-badge-y", `${progress * motion.badgeY}px`);
        scene.style.setProperty("--parallax-statement-y", `${progress * -46}px`);
        scene.style.setProperty("--rig-scale", `${1 + progress * motion.rigScale}`);
        scene.style.setProperty("--rig-shift-y", `${progress * motion.rigShiftY}px`);
        syncMobileLaptopVisibility(progress);
      },
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
    scene.style.setProperty("--scene-progress", "0");
    scene.style.setProperty("--rig-scale", "1");
    scene.style.setProperty("--rig-shift-y", "0px");
    syncMobileLaptopVisibility(0);
  });

  ScrollTrigger.refresh();
} else {
  if (lenis) {
    const raf = (time) => {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    };

    window.requestAnimationFrame(raf);
  }

  updateSceneFallback();

  if (lenis) {
    lenis.on("scroll", updateSceneFallback);
    window.addEventListener("resize", updateSceneFallback);
  } else {
    window.addEventListener("scroll", updateSceneFallback, { passive: true });
    window.addEventListener("resize", updateSceneFallback);
  }
}

const form = document.querySelector(".feature-form");
const status = document.querySelector(".form-status");

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
      form.reset();
    }, 1200);
  });
}
