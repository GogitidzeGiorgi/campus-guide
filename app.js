'use strict';

// UTILS 
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

//  DARK MODE 

const DM_KEY  = 'kiu_dark_mode';
const htmlEl  = document.documentElement;

// Both buttons do the same thing - desktop icon and mobile menu item
const darkBtns = [$('#dark-toggle'), $('#dark-toggle-mobile')].filter(Boolean);

const applyTheme = (dark) => {
  htmlEl.dataset.theme = dark ? 'dark' : 'light';
  darkBtns.forEach(btn => {
    // Desktop button shows emoji, mobile button shows text and emoji
    btn.textContent = btn.id === 'dark-toggle'
      ? (dark ? '☀️' : '🌙')
      : (dark ? '☀️ Light mode' : '🌙 Dark mode');
  });
};

const toggleDark = () => {
  const isDark = htmlEl.dataset.theme === 'dark';
  applyTheme(!isDark);
  localStorage.setItem(DM_KEY, (!isDark).toString());
};

applyTheme(localStorage.getItem(DM_KEY) === 'true');
darkBtns.forEach(btn => btn.addEventListener('click', toggleDark));

// ACTIVE NAV ON SCROLL (IntersectionObserver) 

const sectionIds = ['start', 'map', 'AcademicBuildings', 'Dormitories', 'hours'];
const navLinks   = $$('.nav-links a');

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      navLinks.forEach(link =>
        link.classList.toggle('nav-active', link.dataset.section === target.id)
      );
    });
  },
  { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
);

sectionIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) navObserver.observe(el);
});

// INTERACTIVE CAMPUS MAP

/**
 * Highlights an element with a pulse animation, then removes the class.
 * Demonstrates DOM classList manipulation and dynamic styling.
 */
const highlightSection = (el) => {
  el.classList.remove('section-highlight');
  void el.offsetWidth;                    // force reflow to restart animation
  el.classList.add('section-highlight');
  setTimeout(() => el.classList.remove('section-highlight'), 1100);
};

/**
 * Scrolls smoothly to a section, highlights it, and updates the nav.
 * Demonstrates: scrollIntoView(), classList, dataset, arrow functions.
 *
 * @param {string} targetId - id of the section to navigate to
 */
const navigateToSection = (targetId) => {
  const section = document.getElementById(targetId);
  if (!section) return;

  // Smooth scroll using JS scrollIntoView (as required by spec)
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Immediately update nav active link - destructuring in forEach
  navLinks.forEach(({ dataset, classList }) =>
    classList.toggle('nav-active', dataset.section === targetId)
  );

  // Delay highlight so it fires after scroll lands
  setTimeout(() => highlightSection(section), 500);
};

// Attach Event Listeners to every map location button
// Demonstrates: querySelectorAll, forEach, arrow functions, dataset destructuring
$$('.map-location-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const { target } = btn.dataset;   // ES6 destructuring
    navigateToSection(target);
  });
});

// INIT IIFE (rest params demo)

((...modules) => {
  modules.forEach(fn => fn());
  console.log(
    '%cKIU Campus Guide - app.js loaded',
    'color:#3f5a49;font-weight:bold;font-size:13px',
    '\nDOM ✓  ES6+ ✓  Dark Mode ✓  Interactive Map ✓  localStorage ✓'
  );
})(
  () => console.log('Nav observer active'),
  () => console.log('Map location buttons wired:', $$('.map-location-btn').length),
);