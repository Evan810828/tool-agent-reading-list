/* ============================================================
   LLM Watermark Hub — Vanilla JS
   ============================================================ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const STATE = {
    tab: 'reading',
    mode: 'formal',         // 'formal' | 'latest' | 'cites'
    activeTag: null,
    search: '',
    formalPapers: null,
    latestPapers: null,
    citesPapers: null,
};

const DATA_URLS = {
    formal: 'data/index.json',
    latest: 'data/candidates_latest.json',
    cites: 'data/candidates_citations.json',
};

const PAPER_LIMITS = {
    latest: 200,
    cites: 200,
};

/* ===================== THEME ===================== */
function initTheme() {
    const saved = localStorage.getItem('wmhub-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
    $('#theme-toggle').addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        setTheme(cur === 'dark' ? 'light' : 'dark');
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wmhub-theme', theme);
    const btn = $('#theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ===================== UTIL ===================== */
function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function paperLink(p) {
    if (p.url) return p.url;
    if (p.arxivId) return `https://arxiv.org/abs/${p.arxivId}`;
    return '#';
}

function paperKey(p, i) {
    return p.arxivId || `${p.title || 'p'}-${i}`;
}

function citeIcon() {
    return `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2A2.5 2.5 0 0 0 4.5 9h.3l-1.7 4.2a.5.5 0 0 0 .9.4L6.2 9H7v4.5a.5.5 0 0 0 1 0V9h.8l2.2 4.6a.5.5 0 1 0 .9-.4L10.2 9h.3A2.5 2.5 0 0 0 13 6.5v-2A2.5 2.5 0 0 0 10.5 2h-6z"/></svg>`;
}

/* ===================== REVEAL ANIM ===================== */
function observeReveal(root = document) {
    const els = $$('.reveal:not(.visible)', root);
    if (!('IntersectionObserver' in window)) {
        els.forEach(e => e.classList.add('visible'));
        return;
    }
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.08 });
    els.forEach(e => io.observe(e));
}

/* ===================== ROUTING ===================== */
function activate(tab) {
    if (!['reading', 'projects', 'about'].includes(tab)) tab = 'reading';
    STATE.tab = tab;
    $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === tab));
    $('#hero').style.display = tab === 'reading' ? '' : 'none';
    history.replaceState(null, '', `#${tab}`);

    if (tab === 'reading') ensureFormalLoaded().then(() => renderHero());
    if (tab === 'projects') renderProjects();
    if (tab === 'about') renderAbout();
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 0);
    observeReveal();
}

/* ===================== DATA LOADING ===================== */
async function loadJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
    return res.json();
}

async function ensureFormalLoaded() {
    if (STATE.formalPapers) return STATE.formalPapers;
    try {
        STATE.formalPapers = await loadJSON(DATA_URLS.formal);
    } catch (e) {
        STATE.formalPapers = [];
        console.warn(e);
    }
    return STATE.formalPapers;
}

async function ensureModeLoaded(mode) {
    if (mode === 'formal') return ensureFormalLoaded();
    const key = mode === 'latest' ? 'latestPapers' : 'citesPapers';
    if (STATE[key]) return STATE[key];
    try {
        STATE[key] = await loadJSON(DATA_URLS[mode]);
    } catch (e) {
        STATE[key] = [];
        console.warn(e);
    }
    return STATE[key];
}

/* ===================== HERO ===================== */
function renderHero() {
    const papers = STATE.formalPapers || [];
    const totalCites = papers.reduce((s, p) => s + (p.citationCount || 0), 0);
    const tags = new Set();
    papers.forEach(p => (p.tags || []).forEach(t => tags.add(t)));
    const years = papers.map(p => p.year).filter(Boolean);
    const yearSpan = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';

    $('#hero-stats').innerHTML = `
        <div><div class="hero-stat-num">${papers.length}+</div><div class="hero-stat-label">Curated Papers</div></div>
        <div><div class="hero-stat-num">${totalCites.toLocaleString()}+</div><div class="hero-stat-label">Total Citations</div></div>
        <div><div class="hero-stat-num">${tags.size}</div><div class="hero-stat-label">Research Areas</div></div>
        <div><div class="hero-stat-num">${yearSpan}</div><div class="hero-stat-label">Coverage</div></div>
    `;
}

/* ===================== STATS SECTION ===================== */
function renderStatsSection() {
    const papers = STATE.formalPapers || [];
    const root = $('#stats-section');
    if (!papers.length) {
        root.innerHTML = '';
        return;
    }
    const totalCites = papers.reduce((s, p) => s + (p.citationCount || 0), 0);
    const tags = new Set();
    papers.forEach(p => (p.tags || []).forEach(t => tags.add(t)));
    const venues = new Set();
    papers.forEach(p => { if (p.venue) venues.add(p.venue); });

    // by year
    const yearCounts = {};
    papers.forEach(p => { const y = p.year || 'Unknown'; if (y !== 'Unknown') yearCounts[y] = (yearCounts[y] || 0) + 1; });
    const yearData = Object.entries(yearCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    const yMax = Math.max(1, ...yearData.map(d => d[1]));

    // tag cloud
    const tagCounts = {};
    papers.forEach(p => (p.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    // top cited
    const top = [...papers].filter(p => (p.citationCount || 0) > 0)
        .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0)).slice(0, 6);
    const tMax = top.length ? top[0].citationCount : 1;

    root.innerHTML = `
        <div class="section">
            <div class="reveal">
                <h2 class="section-title">Research Landscape</h2>
                <p class="section-sub">Statistics and distribution of curated papers</p>
            </div>
            <div class="reveal">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-card-num">${papers.length}+</div><div class="stat-card-label">Curated Papers</div></div>
                    <div class="stat-card"><div class="stat-card-num">${totalCites.toLocaleString()}</div><div class="stat-card-label">Total Citations</div></div>
                    <div class="stat-card"><div class="stat-card-num">${tags.size}</div><div class="stat-card-label">Research Areas</div></div>
                    <div class="stat-card"><div class="stat-card-num">${venues.size}</div><div class="stat-card-label">Venues</div></div>
                </div>
            </div>
            <div class="reveal">
                <div class="charts-row">
                    <div class="chart-container">
                        <div class="chart-title">Papers by Year</div>
                        ${yearData.map(([y, c]) => `
                            <div class="bar-row">
                                <span class="bar-label">${escapeHtml(y)}</span>
                                <div class="bar-track"><div class="bar-fill" style="width:${(c / yMax) * 100}%">${c}</div></div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="chart-container">
                        <div class="chart-title">Research Topics</div>
                        <div class="tags-cloud">
                            ${tagEntries.map(([t, c]) => {
        const size = 13 + Math.min(c * 2, 10);
        return `<button class="tags-cloud-item" data-tag="${escapeHtml(t)}" style="font-size:${size}px;border:0;cursor:pointer;font-family:inherit">${escapeHtml(t)} <span style="opacity:.55;font-size:11px">(${c})</span></button>`;
    }).join('')}
                        </div>
                    </div>
                </div>
            </div>
            ${top.length ? `
            <div class="reveal">
                <div class="chart-container top-cited-row" style="margin-top:16px">
                    <div class="chart-title">Most Cited Papers</div>
                    ${top.map(p => {
        const truncated = (p.title || '').length > 56 ? (p.title.slice(0, 56) + '…') : (p.title || '');
        return `
                        <div class="bar-row">
                            <div class="top-cited-label">
                                <a href="${escapeHtml(paperLink(p))}" target="_blank" rel="noopener" style="text-decoration:none">
                                    <div class="t">${escapeHtml(truncated)}</div>
                                </a>
                                <div class="v">${escapeHtml([p.venue, p.year].filter(Boolean).join(' · '))}</div>
                            </div>
                            <div class="bar-track" style="height:22px"><div class="bar-fill" style="width:${(p.citationCount / tMax) * 100}%;height:22px;font-size:11px">${p.citationCount}</div></div>
                        </div>`;
    }).join('')}
                </div>
            </div>` : ''}
        </div>
    `;

    // tag-cloud click → filter reading list
    $$('.tags-cloud-item', root).forEach(btn => {
        btn.addEventListener('click', () => {
            STATE.activeTag = btn.dataset.tag;
            STATE.mode = 'formal';
            $$('.filter-chip[data-mode]').forEach(c => c.classList.toggle('active', c.dataset.mode === 'formal'));
            renderReadingList();
            $('#reading-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

/* ===================== TAG FILTERS ===================== */
function renderTagFilters() {
    const box = $('#tag-filters');
    if (STATE.mode !== 'formal') {
        box.innerHTML = '';
        return;
    }
    const papers = STATE.formalPapers || [];
    const counts = {};
    papers.forEach(p => (p.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    box.innerHTML = top.map(([t, c]) => {
        const active = STATE.activeTag === t ? ' active' : '';
        return `<button class="filter-chip${active}" data-tag="${escapeHtml(t)}">${escapeHtml(t)} (${c})</button>`;
    }).join('');
    $$('.filter-chip[data-tag]', box).forEach(btn => {
        btn.addEventListener('click', () => {
            const t = btn.dataset.tag;
            STATE.activeTag = STATE.activeTag === t ? null : t;
            renderTagFilters();
            renderReadingList();
        });
    });
}

/* ===================== PAPER CARD ===================== */
function paperCardHTML(p, i) {
    const authors = p.authors || [];
    const display = authors.length > 4 ? authors.slice(0, 4).join(', ') + ` +${authors.length - 4}` : authors.join(', ');
    const tags = p.tags || [];
    return `
        <article class="paper-card">
            <h4 class="paper-card-title"><a href="${escapeHtml(paperLink(p))}" target="_blank" rel="noopener">${escapeHtml(p.title || 'Untitled')}</a></h4>
            <div class="paper-card-meta">
                <span>${escapeHtml(display || 'Unknown authors')}</span>
                ${p.venue ? `<span class="venue-badge">${escapeHtml(p.venue)}</span>` : ''}
                ${p.year ? `<span>${escapeHtml(p.year)}</span>` : ''}
                ${p.citationCount > 0 ? `<span class="cite-count">${citeIcon()}${p.citationCount}</span>` : ''}
                ${p.seedMatched ? `<span class="cite-count" title="Cites seed paper">↳ ${escapeHtml(p.seedMatched.length > 40 ? p.seedMatched.slice(0, 40) + '…' : p.seedMatched)}</span>` : ''}
            </div>
            ${p.abstract ? `<p class="paper-card-abstract">${escapeHtml(p.abstract)}</p>` : ''}
            ${tags.length ? `<div class="paper-card-tags">${tags.map((t, idx) => `<span class="tag-pill${idx % 2 === 1 ? ' teal' : ''}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </article>
    `;
}

/* ===================== READING LIST RENDER ===================== */
async function loadAndRenderReading() {
    const container = $('#reading-container');
    container.innerHTML = `<p class="empty">Loading…</p>`;
    await ensureModeLoaded(STATE.mode);
    renderTagFilters();
    renderReadingList();
}

function renderReadingList() {
    const container = $('#reading-container');
    const summary = $('#reading-summary');
    const mode = STATE.mode;
    let papers = (mode === 'formal' ? STATE.formalPapers : mode === 'latest' ? STATE.latestPapers : STATE.citesPapers) || [];

    // filter by tag (formal only — others have no tags)
    if (STATE.activeTag && mode === 'formal') {
        papers = papers.filter(p => (p.tags || []).includes(STATE.activeTag));
    }

    // search
    if (STATE.search.trim()) {
        const q = STATE.search.toLowerCase();
        papers = papers.filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.authors || []).some(a => a.toLowerCase().includes(q)) ||
            (p.venue || '').toLowerCase().includes(q)
        );
    }

    // sort: year desc, then citations desc
    papers = [...papers].sort((a, b) => {
        const ya = a.year || 0, yb = b.year || 0;
        if (ya !== yb) return yb - ya;
        return (b.citationCount || 0) - (a.citationCount || 0);
    });

    // limit large datasets unless searching
    const limit = PAPER_LIMITS[mode];
    const total = papers.length;
    let truncated = false;
    if (limit && papers.length > limit && !STATE.search.trim()) {
        papers = papers.slice(0, limit);
        truncated = true;
    }

    const modeLabel = mode === 'formal' ? 'Curated' : mode === 'latest' ? 'Latest (Keyword Search)' : 'Latest (Citations to Seeds)';
    const tagSuffix = STATE.activeTag ? ` · #${STATE.activeTag}` : '';
    summary.textContent = `${modeLabel}${tagSuffix}: ${total.toLocaleString()} papers${truncated ? ` (showing top ${papers.length})` : ''}`;

    if (!papers.length) {
        container.innerHTML = `<p class="empty">No papers match your filters.</p>`;
        return;
    }

    // group by year for timeline
    const groups = {};
    papers.forEach(p => {
        const y = p.year || 'Unknown';
        if (!groups[y]) groups[y] = [];
        groups[y].push(p);
    });
    const ordered = Object.entries(groups).sort(([a], [b]) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return parseInt(b) - parseInt(a);
    });

    container.innerHTML = `
        <div class="timeline">
            ${ordered.map(([year, items]) => `
                <div class="timeline-year">
                    <div class="timeline-year-marker">${escapeHtml(String(year).slice(-2))}</div>
                    <div class="timeline-year-label">${escapeHtml(year)}</div>
                    <div class="timeline-cards">
                        ${items.map((p, i) => paperCardHTML(p, i)).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/* ===================== PROJECTS ===================== */
function projectMetaHTML(project) {
    const bits = [project.kind, [project.venue, project.year].filter(Boolean).join(' ')]
        .filter(Boolean);
    if (!bits.length) return '';
    return `<div class="project-meta-line">${bits.map(escapeHtml).join(' / ')}</div>`;
}

function projectTagsHTML(project) {
    const tags = project.tags || [];
    if (!tags.length) return '';
    return `<div class="project-card-tags">${tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>`;
}

function projectLinksHTML(project, primaryDefault = 'Open Project') {
    const links = [...(project.links || [])];
    if (!links.length && project.url) {
        links.push({ label: primaryDefault, url: project.url, primary: true });
    }
    if (!links.length) return '';
    return `
        <div class="project-links">
            ${links.map(link => `
                <a class="project-link-btn${link.primary ? ' primary' : ''}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
                    ${escapeHtml(link.label || primaryDefault)} ↗
                </a>
            `).join('')}
        </div>
    `;
}

function projectDetailsHTML(project) {
    const details = project.details || [];
    if (!details.length) return '';
    return `
        <ul class="project-detail-list">
            ${details.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

async function loadProjectDetails(project) {
    let body = project.description ? `<p>${escapeHtml(project.description)}</p>` : '';
    if (!project.markdown) return { body };

    try {
        const md = await (await fetch(project.markdown, { cache: 'no-store' })).text();
        const cleaned = md
            .replace(/<p\s+align="center">\s*<img[^>]+>\s*<\/p>\s*/i, '')
            .replace(/<p\s+align="center">[\s\S]*?<\/p>\s*/gi, '');
        body = window.marked ? marked.parse(cleaned) : `<p>${escapeHtml(cleaned)}</p>`;
    } catch (e) {
        body = project.description ? `<p>${escapeHtml(project.description)}</p>` : '<p class="muted">Unable to load project description.</p>';
        console.warn(e);
    }
    return { body };
}

async function projectCardHTML(project, index) {
    const { body } = await loadProjectDetails(project);
    const authors = project.authors || [];
    const cardId = `project-card-${project.id || index}`;
    const detailsId = `${cardId}-details`;
    const expanded = false;
    return `
        <article class="project-card${expanded ? ' expanded' : ''}" id="${cardId}">
            <button class="project-card-toggle" type="button" aria-expanded="${expanded}" aria-controls="${detailsId}">
                ${project.image ? `<img class="project-card-image" src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)} preview" />` : ''}
                <span class="project-card-content">
                    ${project.featured ? '<span class="project-featured-label">Featured</span>' : ''}
                    ${projectMetaHTML(project)}
                    <span class="project-card-title">${escapeHtml(project.title)}</span>
                    ${authors.length ? `<span class="project-authors">${escapeHtml(authors.join(' · '))}</span>` : ''}
                    ${project.summary ? `<span class="project-card-summary">${escapeHtml(project.summary)}</span>` : ''}
                    ${projectTagsHTML(project)}
                </span>
                <span class="project-expand-icon" aria-hidden="true"></span>
            </button>
            <div class="project-card-details" id="${detailsId}" ${expanded ? '' : 'hidden'}>
                <div class="project-summary">${body}</div>
                ${projectDetailsHTML(project)}
                ${projectLinksHTML(project, 'Open Project')}
            </div>
        </article>
    `;
}

async function renderProjects() {
    const root = $('#project-feature');
    if (root.dataset.loaded === '1') return;

    let items = [];
    try {
        items = await loadJSON('projects/projects.json');
    } catch (e) {
        root.innerHTML = '<p class="empty">Add projects/projects.json to show your projects.</p>';
        console.warn(e);
        return;
    }

    if (!items.length) {
        root.innerHTML = '<p class="empty">No projects yet.</p>';
        return;
    }

    const featured = items.find(p => p.featured);
    const ordered = featured ? [featured, ...items.filter(p => p !== featured)] : items;
    const cards = await Promise.all(ordered.map((project, index) => projectCardHTML(project, index)));

    root.innerHTML = `
        <div class="project-grid">
            ${cards.join('')}
        </div>
    `;
    root.dataset.loaded = '1';
    $$('.project-card-toggle', root).forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.project-card');
            const details = $(`#${btn.getAttribute('aria-controls')}`, card);
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!expanded));
            card.classList.toggle('expanded', !expanded);
            if (details) details.hidden = expanded;
        });
    });
    observeReveal();
}

/* ===================== ABOUT ===================== */
const CV = {
    name: 'Zhaoxi Zhang',
    role: 'PhD Candidate · Machine Learning & Cybersecurity',
    affiliation: 'University of Technology Sydney',
    email: 'Zhaoxi.Zhang-1@student.uts.edu.au',
    github: 'https://github.com/plll4zzx',
    scholar: 'https://scholar.google.com.au/citations?user=YMcMkLcAAAAJ&hl=en&inst=8615794581978883182',
    photo: 'projects/about/photo.jpg',
    metrics: [
        { label: 'Google Scholar citations', value: '152' },
    ],
    interests: ['adversarial example', 'privacy', 'LLM watermark'],
    education: [
        { period: '2023 – Present', degree: 'PhD Candidate', school: 'University of Technology Sydney', major: 'Machine Learning & Cybersecurity' },
        { period: '2019 – 2022', degree: 'Master Degree', school: 'Southwest University', major: 'Machine Learning & Cybersecurity' },
        { period: '2015 – 2019', degree: 'Bachelor Degree', school: 'Shijiazhuang Tiedao University', major: 'Computer Science & Machine Learning' },
    ],
    employment: [
        { period: '2022.07 – 2023.10', role: 'Algorithm Engineer', company: 'Amperex Technology Limited (ATL)' },
    ],
    publications: [
        {
            title: 'Character-Level Perturbations Disrupt LLM Watermarks',
            authors: ['Z. Zhang*', 'X. Zhang*', 'Y. Zhang', 'H. Zhang', 'S. Pan', 'B. Liu', 'A. Q. Gill', 'L. Y. Zhang'],
            venue: 'Network and Distributed System Security (NDSS) Symposium 2026',
            note: 'CCF-A, Core-A*',
            citations: 1,
            highlight: true,
        },
        {
            title: 'Less Is More--Until It Breaks: Security Pitfalls of Vision Token Compression in Large Vision-Language Models',
            authors: ['X. Zhang', 'Z. Zhang', 'L. Y. Zhang', 'Y. Zhang', 'G. Tao', 'S. Pan'],
            venue: 'arXiv preprint arXiv:2601.12042',
            citations: 0,
        },
        {
            title: 'Not all edges are equally robust: Evaluating the robustness of ranking-based federated learning',
            authors: ['Z. Gong', 'Y. Zhang', 'L. Y. Zhang', 'Z. Zhang', 'Y. Xiang', 'S. Pan'],
            venue: 'IEEE Symposium on Security and Privacy (S&P) 2025',
            note: 'CCF-A, Core-A*',
            citations: 5,
        },
        {
            title: 'When Better Features Mean Greater Risks: The Performance-Privacy Trade-Off in Contrastive Learning',
            authors: ['R. Sun', 'H. Hu', 'W. Luo', 'Z. Zhang', 'Y. Zhang', 'H. Yuan', 'L. Y. Zhang'],
            venue: 'ACM ASIACCS 2025',
            note: 'Core-A',
            citations: 3,
        },
        {
            title: 'Exploring Gradient-Guided Masked Language Model to Detect Textual Adversarial Attacks',
            authors: ['X. Zhang', 'Z. Zhang', 'Y. Zhang', 'X. Zheng', 'L. Y. Zhang', 'S. Hu', 'S. Pan'],
            venue: 'IEEE Transactions on Audio, Speech and Language Processing, 2025',
            citations: 2,
        },
        {
            title: 'Stealing watermarks of large language models via mixed integer programming',
            authors: ['Z. Zhang', 'X. Zhang', 'Y. Zhang', 'L. Y. Zhang', 'C. Chen', 'S. Hu', 'A. Gill', 'S. Pan'],
            venue: 'Annual Computer Security Applications Conference (ACSAC) 2024',
            note: 'CCF-B, Core-A',
            citations: 22,
            highlight: true,
        },
        {
            title: 'Masked Language Model Based Textual Adversarial Example Detection',
            authors: ['X. Zhang', 'Z. Zhang', 'Q. Zhong', 'X. Zheng', 'Y. Zhang', 'S. Hu', 'L. Y. Zhang'],
            venue: 'ACM ASIACCS 2023',
            note: 'Core-A',
            citations: 9,
        },
        {
            title: 'Classification of motor imagery EEG based on time-domain and frequency-domain dual-stream convolutional neural network',
            authors: ['E. Huang', 'X. Zheng', 'Y. Fang', 'Z. Zhang'],
            venue: 'IRBM 43(2), 107-113, 2022',
            citations: 49,
        },
        {
            title: 'Evaluating membership inference through adversarial robustness',
            authors: ['Z. Zhang', 'L. Y. Zhang', 'X. Zheng', 'B. H. Abbasi', 'S. Hu'],
            venue: 'The Computer Journal, 2022',
            note: 'CCF-B',
            citations: 27,
        },
        {
            title: 'Self-supervised adversarial example detection by disentangled representation',
            authors: ['Z. Zhang', 'L. Y. Zhang', 'X. Zheng', 'J. Tian', 'J. Zhou'],
            venue: 'IEEE TrustCom 2022',
            citations: 11,
        },
        {
            title: 'Effective crack damage detection using multilayer sparse feature representation and incremental extreme learning machine',
            authors: ['B. Wang', 'Y. Li', 'W. Zhao', 'Z. Zhang', 'Y. Zhang', 'Z. Wang'],
            venue: 'Applied Sciences 9(3), 614, 2019',
            citations: 23,
        },
    ],
};

function renderAbout() {
    const root = $('#about-container');
    if (root.dataset.loaded === '1') return;
    const cv = CV;
    root.innerHTML = `
        <div class="reveal">
            <div class="about-header">
                <img class="about-photo" src="${escapeHtml(cv.photo)}" alt="${escapeHtml(cv.name)}" onerror="this.style.display='none'" />
                <div class="about-info">
                    <h2 class="about-name">${escapeHtml(cv.name)}</h2>
                    <p class="about-role">${escapeHtml(cv.role)}</p>
                    <p class="about-affil">${escapeHtml(cv.affiliation)}</p>
                    <div class="about-metrics">
                        ${cv.metrics.map(m => `
                            <div class="about-metric">
                                <span class="about-metric-value">${escapeHtml(m.value)}</span>
                                <span class="about-metric-label">${escapeHtml(m.label)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="about-interests">
                        ${cv.interests.map(interest => `<span>${escapeHtml(interest)}</span>`).join('')}
                    </div>
                    <div class="about-links">
                        <a class="about-link" href="mailto:${escapeHtml(cv.email)}">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2-.5a.5.5 0 0 0-.5.5v.217l4.5 3.6 4.5-3.6V4a.5.5 0 0 0-.5-.5H4zm8.5 1.883L8.357 8.74a.5.5 0 0 1-.714 0L3.5 5.383V12a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V5.383z"/></svg>
                            Email
                        </a>
                        <a class="about-link" href="${escapeHtml(cv.github)}" target="_blank" rel="noopener">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
                            GitHub
                        </a>
                        <a class="about-link" href="${escapeHtml(cv.scholar)}" target="_blank" rel="noopener">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5 1 5.1l7 3.6 7-3.6-7-3.6Zm-4.25 5.52v2.44c0 .94 1.9 2.04 4.25 2.04s4.25-1.1 4.25-2.04V7.02L8 9.2 3.75 7.02Zm9.7 1.02v2.32c0 .33.27.6.6.6s.6-.27.6-.6V6.9l-1.2.62v.52Z"/></svg>
                            Scholar
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <div class="reveal">
            <h3 class="about-section-title">Education</h3>
            <div class="edu-timeline">
                ${cv.education.map(e => `
                    <div class="edu-item">
                        <div class="edu-period">${escapeHtml(e.period)}</div>
                        <div class="edu-degree">${escapeHtml(e.degree)}</div>
                        <div class="edu-school">${escapeHtml(e.school)} · ${escapeHtml(e.major)}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="reveal">
            <h3 class="about-section-title">Experience</h3>
            <div class="edu-timeline">
                ${cv.employment.map(e => `
                    <div class="edu-item">
                        <div class="edu-period">${escapeHtml(e.period)}</div>
                        <div class="edu-degree">${escapeHtml(e.role)}</div>
                        <div class="edu-school">${escapeHtml(e.company)}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="reveal">
            <h3 class="about-section-title">Publications</h3>
            <div class="pub-list">
                ${cv.publications.map(p => `
                    <div class="pub-item${p.highlight ? ' highlighted' : ''}">
                        <div class="pub-title">${escapeHtml(p.title)}</div>
                        <div class="pub-meta">${p.authors.map(a => a.startsWith('Z. Zhang') ? `<strong>${escapeHtml(a)}</strong>` : escapeHtml(a)).join(', ')}</div>
                        <div class="pub-venue">${escapeHtml(p.venue)}${p.note ? ` <span style="opacity:.7;font-weight:500">(${escapeHtml(p.note)})</span>` : ''}${Number.isFinite(p.citations) ? ` <span class="pub-citations">${escapeHtml(String(p.citations))} citations</span>` : ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    root.dataset.loaded = '1';
    observeReveal();
}

/* ===================== INIT ===================== */
async function init() {
    initTheme();
    $('#year').textContent = new Date().getFullYear();

    // Tabs
    $$('.nav-tab').forEach(b => b.addEventListener('click', () => activate(b.dataset.tab)));
    window.addEventListener('hashchange', () => {
        const tab = (location.hash || '').replace('#', '') || 'reading';
        if (tab !== STATE.tab) activate(tab);
    });

    // Reading mode chips
    $$('.filter-chip[data-mode]').forEach(b => b.addEventListener('click', async () => {
        const m = b.dataset.mode;
        if (STATE.mode === m) return;
        STATE.mode = m;
        STATE.activeTag = null;
        $$('.filter-chip[data-mode]').forEach(c => c.classList.toggle('active', c.dataset.mode === m));
        await loadAndRenderReading();
    }));

    // Search
    let searchTimer;
    $('#search-input').addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            STATE.search = e.target.value;
            renderReadingList();
        }, 180);
    });

    // Hero CTA
    $('#hero-explore').addEventListener('click', () => {
        $('#stats-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Back to top
    const btt = $('#back-to-top');
    window.addEventListener('scroll', () => {
        btt.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Initial route
    const hash = (location.hash || '').replace('#', '') || 'reading';
    activate(hash);

    // Load formal data, then render hero + stats + list
    await ensureFormalLoaded();
    renderHero();
    renderStatsSection();
    await loadAndRenderReading();
    observeReveal();
}

document.addEventListener('DOMContentLoaded', init);
