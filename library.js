'use strict';

// ── UTILS ──────────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── DARK MODE (shared with index) ───────────────────────────────────────────

const DM_KEY  = 'kiu_dark_mode';
const htmlEl  = document.documentElement;
const darkBtn = $('#dark-toggle');

const applyTheme = (dark) => {
  htmlEl.dataset.theme         = dark ? 'dark' : 'light';
  if (darkBtn) darkBtn.textContent = dark ? '☀️' : '🌙';
};

applyTheme(localStorage.getItem(DM_KEY) === 'true');
darkBtn?.addEventListener('click', () => {
  const isDark = htmlEl.dataset.theme === 'dark';
  applyTheme(!isDark);
  localStorage.setItem(DM_KEY, (!isDark).toString());
});

// CONSTANTS 

const API_BASE   = 'https://openlibrary.org/search.json';
const COVER_BASE = 'https://covers.openlibrary.org/b/id';
const PAGE_SIZE  = 10;
const LS_KEY     = 'kiu_recent_searches';
const MAX_RECENT = 5;

// PAGINATION STATE 

let currentQuery = '';
let currentPage  = 1;
let totalResults = 0;

// LOCAL STORAGE FOR RECENT SEARCHES

const getRecentSearches = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveRecentSearch = (term) => {
  const trimmed  = term.trim().toLowerCase();
  if (!trimmed) return;
  const existing = getRecentSearches().filter(s => s !== trimmed);
  const updated  = [trimmed, ...existing].slice(0, MAX_RECENT);  // spread + cap
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  renderRecentSearches();
};

/**
 * Renders recent search pills below the topic chips.
 * Uses template literals and DOM manipulation.
 */
const renderRecentSearches = () => {
  const recents = getRecentSearches();
  let wrap = $('#recent-wrap');

  // Create the container if it doesn't exist
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id        = 'recent-wrap';
    wrap.className = 'quick-topics';
    wrap.innerHTML = `<span class="topic-label">Recent:</span><span id="recent-list" style="display:contents;"></span>`;
    $('.quick-topics')?.after(wrap);
  }

  const list = $('#recent-list');
  if (!list) return;

  if (recents.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  list.innerHTML = '';

  recents.forEach(term => {
    const pill = document.createElement('button');
    pill.className   = 'topic-chip';
    pill.textContent = term;
    pill.addEventListener('click', () => {
      bookInput.value = term;
      fetchBooks(term, 1);
    });
    list.appendChild(pill);
  });
};

// DOM REFERENCES 

const bookInput     = $('#book-input');
const bookSearchBtn = $('#book-search-btn');
const bookStatusEl  = $('#book-status');
const bookResultsEl = $('#book-results');
const paginationEl  = $('#book-pagination');
const pagePrevBtn   = $('#page-prev');
const pageNextBtn   = $('#page-next');
const pageIndicator = $('#page-indicator');
const topicChips    = $$('.topic-chip');

// BOOK CARD BUILDER 

/**
 * Builds a book card from an Open Library result object.
 * Demonstrates destructuring and template literals.
 */
const buildBookCard = ({ title, author_name, first_publish_year, cover_i, key }) => {
  const card     = document.createElement('article');
  card.className  = 'book-card';

  const authors  = author_name ? author_name.slice(0, 2).join(', ') : 'Unknown author';
  const year     = first_publish_year ?? '-';
  const coverUrl = cover_i ? `${COVER_BASE}/${cover_i}-M.jpg` : null;
  const olUrl    = `https://openlibrary.org${key}`;

  const coverHtml = coverUrl
    ? `<img src="${coverUrl}" alt="Cover of ${title}" loading="lazy">`
    : `<span class="book-cover-placeholder">📖</span>`;

  card.innerHTML = `
    <div class="book-cover">${coverHtml}</div>
    <div class="book-info">
      <div class="book-title">${title}</div>
      <div class="book-author">${authors}</div>
      <div class="book-year">First published: ${year}</div>
      <a href="${olUrl}" target="_blank" rel="noopener" class="book-link">
        View on Open Library ↗
      </a>
    </div>
  `;
  return card;
};

// SPINNER (callback pattern) 

const showSpinner = (callback) => {
  bookResultsEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  setTimeout(callback, 40);
};

// PAGINATION CONTROLS 

/**
 * Renders numbered page buttons with ellipsis.
 * Demonstrates DOM creation, spread, arrow functions.
 */
const updatePagination = () => {
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);

  if (totalPages <= 1) { paginationEl.style.display = 'none'; return; }

  paginationEl.style.display = '';
  pagePrevBtn.disabled = currentPage === 1;
  pageNextBtn.disabled = currentPage >= totalPages;

  // Build window of up to 5 pages centred on current
  const WINDOW = 2;
  let start = Math.max(1, currentPage - WINDOW);
  let end   = Math.min(totalPages, currentPage + WINDOW);
  if (end - start < WINDOW * 2) {
    if (start === 1) end   = Math.min(totalPages, start + WINDOW * 2);
    else             start = Math.max(1, end - WINDOW * 2);
  }

  // Spread range into array
  const pageNums = [...Array(end - start + 1)].map((_, i) => start + i);

  pageIndicator.innerHTML = '';

  const makePageBtn = (label, page, isActive = false, isDisabled = false) => {
    const btn = document.createElement('button');
    btn.className   = `page-num-btn${isActive ? ' active' : ''}`;
    btn.textContent = label;
    btn.disabled    = isDisabled;
    if (!isDisabled) btn.addEventListener('click', () => fetchBooks(currentQuery, page));
    return btn;
  };

  const makeDots = () => {
    const s = document.createElement('span');
    s.className = 'page-dots'; s.textContent = '…';
    return s;
  };

  if (start > 1) {
    pageIndicator.appendChild(makePageBtn(1, 1));
    if (start > 2) pageIndicator.appendChild(makeDots());
  }

  pageNums.forEach(n =>
    pageIndicator.appendChild(makePageBtn(n, n, n === currentPage, n === currentPage))
  );

  if (end < totalPages) {
    if (end < totalPages - 1) pageIndicator.appendChild(makeDots());
    pageIndicator.appendChild(makePageBtn(totalPages, totalPages));
  }
};

// FETCH BOOKS

/**
 * Fetches one page of results from the Open Library API.
 *
 * @param {string} query
 * @param {number} page
 */
const fetchBooks = async (query, page = 1) => {
  const term = query.trim();
  if (!term) return;

  currentQuery = term;
  currentPage  = page;

  topicChips.forEach(chip =>
    chip.classList.toggle('active', chip.dataset.query === term.toLowerCase())
  );

  bookStatusEl.className   = 'book-status';
  bookStatusEl.textContent = page === 1 ? `Searching for "${term}"…` : `Loading page ${page}…`;

  // Callback pattern: spinner shown, async work starts inside the callback
  showSpinner(async () => {
    try {
      const offset   = (page - 1) * PAGE_SIZE;
      const url      = `${API_BASE}?q=${encodeURIComponent(term)}&fields=title,author_name,first_publish_year,cover_i,key&limit=${PAGE_SIZE}&offset=${offset}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { docs = [], numFound = 0 } = await response.json();  // destructuring

      totalResults            = numFound;
      bookResultsEl.innerHTML = '';

      if (docs.length === 0) {
        bookStatusEl.textContent   = `No results for "${term}". Try a different topic.`;
        paginationEl.style.display = 'none';
        return;
      }

      const totalPages = Math.ceil(numFound / PAGE_SIZE);
      bookStatusEl.textContent = `Page ${page} of ${totalPages} - ${numFound.toLocaleString()} results for "${term}"`;

      // Spread each doc into buildBookCard
      const fragment = document.createDocumentFragment();
      docs.forEach(doc => fragment.appendChild(buildBookCard({ ...doc })));
      bookResultsEl.appendChild(fragment);

      updatePagination();

      if (page > 1) {
        document.getElementById('library-search')?.scrollIntoView({ behavior: 'smooth' });
      }

      saveRecentSearch(term);

    } catch (err) {
      bookResultsEl.innerHTML    = '';
      paginationEl.style.display = 'none';
      bookStatusEl.className     = 'book-status error';
      bookStatusEl.textContent   = 'Could not load results - check your connection and try again.';
      console.error('Open Library fetch error:', err);
    }
  });
};

// PROMISE-BASED DEFAULT LOAD 

/**
 * Manual Promise constructor - resolves after `ms` ms.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Loads default results on page load via Promise chaining (.then / .catch).
 */
const loadDefault = () => {
  wait(400)
    .then(() => fetchBooks('computer science', 1))
    .catch(err => console.warn('Default load failed:', err));
};

// EVENT LISTENERS 

bookSearchBtn?.addEventListener('click', () => fetchBooks(bookInput.value, 1));

bookInput?.addEventListener('keydown', ({ key }) => {    // destructuring event
  if (key === 'Enter') fetchBooks(bookInput.value, 1);
});

topicChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const { query } = chip.dataset;   // destructuring dataset
    bookInput.value = query;
    fetchBooks(query, 1);
  });
});

pagePrevBtn?.addEventListener('click', () => {
  if (currentPage > 1) fetchBooks(currentQuery, currentPage - 1);
});

pageNextBtn?.addEventListener('click', () => {
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  if (currentPage < totalPages) fetchBooks(currentQuery, currentPage + 1);
});

// INIT (IIFE with rest params) 

((...fns) => {
  fns.forEach(fn => fn());
  console.log(
    '%cKIU Library loaded',
    'color:#3f5a49;font-weight:bold;font-size:13px',
    '\nFetch API ✓  Async/Await ✓  Promises ✓  localStorage ✓  ES6+ ✓'
  );
})(
  renderRecentSearches,
  loadDefault,
);