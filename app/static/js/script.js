/* =========================================================
   Future Era — Landing Page Animation Timeline
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pick(list) {
  return list.flat().filter(Boolean);
}

function splitWords(el) {
  const lines = el.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  el.textContent = "";
  el.setAttribute("aria-label", lines.join(" ").replace(/\s+/g, " "));

  const lineInners = [];

  lines.forEach((lineText) => {
    const lineEl = document.createElement("span");
    lineEl.className = "title-line";

    const words = lineText.split(/\s+/);
    const lineWords = [];

    words.forEach((word, i) => {
      const mask = document.createElement("span");
      mask.className = "line-mask";
      const inner = document.createElement("span");
      inner.textContent = word;
      mask.appendChild(inner);
      lineEl.appendChild(mask);
      if (i < words.length - 1) lineEl.appendChild(document.createTextNode(" "));
      lineWords.push(inner);
    });

    lineInners.push(lineWords);
    el.appendChild(lineEl);
  });

  return lineInners;
}

function initIntro() {
  const titleEls = gsap.utils.toArray(".intro__title, .intro__title1");
  const subEl = document.querySelector(".intro__subtitle");
  if (!titleEls.length || !subEl) return;

  const titleGroups = titleEls.map((el) => splitWords(el).flat());
  const titleWords = titleGroups.flat();

  const els = {
    eyebrow: document.querySelector(".intro__eyebrow"),
    glowWrap: document.querySelector(".intro__glow-wrap"),
    glow: document.querySelector(".intro__glow"),
    glow2: document.querySelector(".intro__glow-secondary"),
    subtitle: subEl,
    tags: document.querySelectorAll(".intro__tag"),
    actions: document.querySelector(".intro__actions"),
  };

  if (reduceMotion) {
    gsap.set(
      pick([els.eyebrow, els.actions, titleWords, els.subtitle, els.tags, els.glow, els.glow2]),
      { opacity: 1, y: 0, x: 0, scale: 1, yPercent: 0 }
    );
    return;
  }

  // Set initial hidden states
  if (els.eyebrow) gsap.set(els.eyebrow, { opacity: 0, y: -22, scale: 0.92 });
  gsap.set(pick([titleWords]), { yPercent: 120, opacity: 0 });
  gsap.set(pick([els.subtitle]), { opacity: 0, y: 22 });
  gsap.set(pick([els.tags]), { opacity: 0, y: 16, scale: 0.9 });
  gsap.set(pick([els.actions]), { opacity: 0, y: 24 });
  gsap.set(pick([els.glow, els.glow2]), { opacity: 0, scale: 0.6 });

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // 1. Ambient Glow Bloom
  tl.to(pick([els.glow, els.glow2]), {
    opacity: 1,
    scale: 1,
    duration: 1.8,
    ease: "power2.out",
    stagger: 0.2,
  }, 0);

  // 2. Eyebrow Badge Pop (if present)
  if (els.eyebrow) {
    tl.to(els.eyebrow, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: "back.out(1.5)",
    }, 0.2);
  }

  // 3. Staggered Masked Title Reveal
  titleGroups.forEach((group, i) => {
    tl.to(
      pick([group]),
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.95,
        stagger: 0.05,
        ease: "power4.out",
      },
      i === 0 ? 0.35 : "-=0.65"
    );
  });

  // 4. Subtitle Smooth Reveal
  tl.to(
    pick([els.subtitle]),
    {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: "power2.out",
    },
    "-=0.4"
  );

  // 5. Feature Tag Pills Stagger
  tl.to(
    pick([els.tags]),
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      stagger: 0.07,
      ease: "back.out(1.4)",
    },
    "-=0.5"
  );

  // 6. Action CTA Buttons Reveal
  tl.to(
    pick([els.actions]),
    {
      opacity: 1,
      y: 0,
      duration: 0.75,
      ease: "power3.out",
    },
    "-=0.4"
  );

  // Gentle continuous ambient breathing float for glow orbs
  if (els.glow) {
    gsap.to(els.glow, {
      y: 18,
      x: -12,
      scale: 1.08,
      duration: 5.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }
  if (els.glow2) {
    gsap.to(els.glow2, {
      y: -15,
      x: 14,
      scale: 1.06,
      duration: 6.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 0.5,
    });
  }

  // Hero parallax scrub on scroll
  gsap.to(".intro__inner", {
    yPercent: -15,
    opacity: 0.2,
    ease: "none",
    scrollTrigger: {
      trigger: ".intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.5,
    },
  });
}

function initAbout() {
  if (reduceMotion) return;

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 50,
      opacity: 0,
      duration: 1.1,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  gsap.utils.toArray(".card").forEach((card) => {
    const h3 = card.querySelector("h3");
    gsap.from(card.querySelector("p"), {
      y: 20,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      delay: 0.15,
      scrollTrigger: { trigger: card, start: "top 85%" },
    });
    card.addEventListener("mouseenter", () =>
      gsap.to(h3, { letterSpacing: "0.3em", duration: 0.5, ease: "expo.out" })
    );
    card.addEventListener("mouseleave", () =>
      gsap.to(h3, { letterSpacing: "0.2em", duration: 0.5, ease: "expo.out" })
    );
  });
}

function init() {
  // Clear any hash like #about from the address bar on load so URL stays clean
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname);
  }

  // Intercept anchor clicks to smoothly scroll without appending #about to URL bar
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  gsap.registerPlugin(ScrollTrigger);
  initIntro();
  initAbout();
}

if (document.readyState === "complete") {
  init();
} else {
  window.addEventListener("load", init);
}
