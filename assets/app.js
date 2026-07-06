/* ============================================================
   Tool Agent Reading List — Vanilla JS
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const STATE = {
    mode: 'latest',
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

function currentModePapers() {
    if (STATE.mode === 'formal') return STATE.formalPapers || [];
    if (STATE.mode === 'latest') return STATE.latestPapers || [];
    return STATE.citesPapers || [];
}

function modeFacetEntries(papers) {
    const counts = {};
    if (STATE.mode === 'formal') {
        papers.forEach(paper => (paper.tags || []).forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        }));
    } else {
        papers.forEach(paper => (paper.discoveredBy || []).forEach(item => {
            if (!item.query) return;
            counts[item.query] = (counts[item.query] || 0) + 1;
        }));
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function initTheme() {
    const saved = localStorage.getItem('agent-reading-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
    $('#theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agent-reading-theme', theme);
    const btn = $('#theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function paperLink(paper) {
    if (paper.url) return paper.url;
    if (paper.arxivId) return `https://arxiv.org/abs/${paper.arxivId}`;
    if (paper.externalIds && paper.externalIds.DOI) return `https://doi.org/${paper.externalIds.DOI}`;
    return '#';
}

function citationIcon() {
    return `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2A2.5 2.5 0 0 0 4.5 9h.3l-1.7 4.2a.5.5 0 0 0 .9.4L6.2 9H7v4.5a.5.5 0 0 0 1 0V9h.8l2.2 4.6a.5.5 0 1 0 .9-.4L10.2 9h.3A2.5 2.5 0 0 0 13 6.5v-2A2.5 2.5 0 0 0 10.5 2h-6z"/></svg>`;
}

function observeReveal(root = document) {
    const elements = $$('.reveal:not(.visible)', root);
    if (!('IntersectionObserver' in window)) {
        elements.forEach(element => element.classList.add('visible'));
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08 });
    elements.forEach(element => observer.observe(element));
}

async function loadJSON(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed ${url}: ${response.status}`);
    return response.json();
}

async function ensureFormalLoaded() {
    if (STATE.formalPapers) return STATE.formalPapers;
    try {
        STATE.formalPapers = await loadJSON(DATA_URLS.formal);
    } catch (error) {
        STATE.formalPapers = [];
        console.warn(error);
    }
    return STATE.formalPapers;
}

async function ensureModeLoaded(mode) {
    if (mode === 'formal') return ensureFormalLoaded();
    const key = mode === 'latest' ? 'latestPapers' : 'citesPapers';
    if (STATE[key]) return STATE[key];
    try {
        STATE[key] = await loadJSON(DATA_URLS[mode]);
    } catch (error) {
        STATE[key] = [];
        console.warn(error);
    }
    return STATE[key];
}

function renderHero() {
    const papers = currentModePapers();
    const totalCites = papers.reduce((sum, paper) => sum + (paper.citationCount || 0), 0);
    const facetEntries = modeFacetEntries(papers);
    const years = papers.map(paper => paper.year).filter(Boolean);
    const yearSpan = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : 'Ready';
    const paperLabel = STATE.mode === 'formal' ? 'Curated Papers' : STATE.mode === 'latest' ? 'Latest Papers' : 'Citation Candidates';
    const facetLabel = STATE.mode === 'formal' ? 'Topics' : 'Queries';

    $('#hero-stats').innerHTML = `
        <div><div class="hero-stat-num">${papers.length.toLocaleString()}</div><div class="hero-stat-label">${paperLabel}</div></div>
        <div><div class="hero-stat-num">${totalCites.toLocaleString()}</div><div class="hero-stat-label">Citations</div></div>
        <div><div class="hero-stat-num">${facetEntries.length.toLocaleString()}</div><div class="hero-stat-label">${facetLabel}</div></div>
        <div><div class="hero-stat-num">${escapeHtml(yearSpan)}</div><div class="hero-stat-label">Coverage</div></div>
    `;
}

function renderStatsSection() {
    const papers = currentModePapers();
    const root = $('#stats-section');
    if (!papers.length) {
        root.innerHTML = '';
        return;
    }

    const tags = new Set();
    const venues = new Set();
    papers.forEach(paper => {
        (paper.tags || []).forEach(tag => tags.add(tag));
        if (paper.venue) venues.add(paper.venue);
    });
    const facetEntries = modeFacetEntries(papers);
    const facetLabel = STATE.mode === 'formal' ? 'Research Topics' : 'Discovery Queries';

    const yearCounts = {};
    papers.forEach(paper => {
        if (paper.year) yearCounts[paper.year] = (yearCounts[paper.year] || 0) + 1;
    });
    const yearData = Object.entries(yearCounts).sort((a, b) => Number(a[0]) - Number(b[0]));
    const yearMax = Math.max(1, ...yearData.map(([, count]) => count));

    const top = [...papers]
        .filter(paper => (paper.citationCount || 0) > 0)
        .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
        .slice(0, 6);
    const citationMax = top.length ? top[0].citationCount : 1;

    root.innerHTML = `
        <div class="section">
            <div class="reveal">
                <h2 class="section-title">Research Landscape</h2>
                <p class="section-sub">A focused map of tool-agent reliability, verification, monitoring, and failure detection work.</p>
            </div>
            <div class="reveal">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-card-num">${papers.length.toLocaleString()}</div><div class="stat-card-label">${STATE.mode === 'formal' ? 'Curated Papers' : 'Candidate Papers'}</div></div>
                    <div class="stat-card"><div class="stat-card-num">${venues.size}</div><div class="stat-card-label">Venues</div></div>
                    <div class="stat-card"><div class="stat-card-num">${facetEntries.length.toLocaleString()}</div><div class="stat-card-label">${facetLabel}</div></div>
                    <div class="stat-card"><div class="stat-card-num">${yearData.length}</div><div class="stat-card-label">Active Years</div></div>
                </div>
            </div>
            <div class="reveal">
                <div class="charts-row">
                    <div class="chart-container">
                        <div class="chart-title">Papers by Year</div>
                        ${yearData.map(([year, count]) => `
                            <div class="bar-row">
                                <span class="bar-label">${escapeHtml(year)}</span>
                                <div class="bar-track"><div class="bar-fill" style="width:${(count / yearMax) * 100}%">${count}</div></div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="chart-container">
                        <div class="chart-title">${facetLabel}</div>
                        <div class="tags-cloud">
                            ${facetEntries.slice(0, 30).map(([tag, count]) => `
                                <button class="tags-cloud-item" data-tag="${escapeHtml(tag)}" type="button">${escapeHtml(tag)} <span>(${count})</span></button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            ${top.length ? `
            <div class="reveal">
                <div class="chart-container top-cited-row">
                    <div class="chart-title">Most Cited Papers</div>
                    ${top.map(paper => {
                        const title = paper.title && paper.title.length > 64 ? `${paper.title.slice(0, 64)}...` : paper.title;
                        return `
                            <div class="bar-row">
                                <div class="top-cited-label">
                                    <a href="${escapeHtml(paperLink(paper))}" target="_blank" rel="noopener">
                                        <div class="t">${escapeHtml(title || 'Untitled')}</div>
                                    </a>
                                    <div class="v">${escapeHtml([paper.venue, paper.year].filter(Boolean).join(' / '))}</div>
                                </div>
                                <div class="bar-track"><div class="bar-fill" style="width:${(paper.citationCount / citationMax) * 100}%">${paper.citationCount}</div></div>
                            </div>`;
                    }).join('')}
                </div>
            </div>` : ''}
        </div>
    `;

    if (STATE.mode !== 'formal') return;
    $$('.tags-cloud-item', root).forEach(button => {
        button.addEventListener('click', () => {
            STATE.activeTag = button.dataset.tag;
            STATE.mode = 'formal';
            $$('.filter-chip[data-mode]').forEach(chip => chip.classList.toggle('active', chip.dataset.mode === 'formal'));
            renderTagFilters();
            renderReadingList();
            $('#reading-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function renderTagFilters() {
    const box = $('#tag-filters');
    if (STATE.mode !== 'formal') {
        box.innerHTML = '';
        return;
    }

    const counts = {};
    (STATE.formalPapers || []).forEach(paper => (paper.tags || []).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
    }));

    box.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => {
            const active = STATE.activeTag === tag ? ' active' : '';
            return `<button class="filter-chip${active}" data-tag="${escapeHtml(tag)}" type="button">${escapeHtml(tag)} (${count})</button>`;
        })
        .join('');

    $$('.filter-chip[data-tag]', box).forEach(button => {
        button.addEventListener('click', () => {
            const tag = button.dataset.tag;
            STATE.activeTag = STATE.activeTag === tag ? null : tag;
            renderTagFilters();
            renderReadingList();
        });
    });
}

function paperCardHTML(paper) {
    const authors = paper.authors || [];
    const authorText = authors.length > 4 ? `${authors.slice(0, 4).join(', ')} +${authors.length - 4}` : authors.join(', ');
    const tags = paper.tags || [];
    const provenance = paper.seedMatched || (paper.discoveredBy || []).map(item => item.query).filter(Boolean).slice(0, 1).join('');

    return `
        <article class="paper-card">
            <h4 class="paper-card-title"><a href="${escapeHtml(paperLink(paper))}" target="_blank" rel="noopener">${escapeHtml(paper.title || 'Untitled')}</a></h4>
            <div class="paper-card-meta">
                <span>${escapeHtml(authorText || 'Unknown authors')}</span>
                ${paper.venue ? `<span class="venue-badge">${escapeHtml(paper.venue)}</span>` : ''}
                ${paper.year ? `<span>${escapeHtml(paper.year)}</span>` : ''}
                ${paper.citationCount > 0 ? `<span class="cite-count">${citationIcon()}${paper.citationCount}</span>` : ''}
                ${provenance ? `<span class="source-badge">${escapeHtml(provenance.length > 58 ? `${provenance.slice(0, 58)}...` : provenance)}</span>` : ''}
            </div>
            ${paper.abstract ? `<p class="paper-card-abstract">${escapeHtml(paper.abstract)}</p>` : ''}
            ${tags.length ? `<div class="paper-card-tags">${tags.map((tag, index) => `<span class="tag-pill${index % 2 ? ' teal' : ''}">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </article>
    `;
}

async function loadAndRenderReading() {
    $('#reading-container').innerHTML = `<p class="empty">Loading...</p>`;
    await ensureModeLoaded(STATE.mode);
    renderHero();
    renderStatsSection();
    renderTagFilters();
    renderReadingList();
}

function renderReadingList() {
    const container = $('#reading-container');
    const summary = $('#reading-summary');
    let papers = (STATE.mode === 'formal' ? STATE.formalPapers : STATE.mode === 'latest' ? STATE.latestPapers : STATE.citesPapers) || [];

    if (STATE.activeTag && STATE.mode === 'formal') {
        papers = papers.filter(paper => (paper.tags || []).includes(STATE.activeTag));
    }

    const search = STATE.search.trim().toLowerCase();
    if (search) {
        papers = papers.filter(paper =>
            (paper.title || '').toLowerCase().includes(search) ||
            (paper.abstract || '').toLowerCase().includes(search) ||
            (paper.venue || '').toLowerCase().includes(search) ||
            (paper.authors || []).some(author => author.toLowerCase().includes(search)) ||
            (paper.tags || []).some(tag => tag.toLowerCase().includes(search))
        );
    }

    papers = [...papers].sort((a, b) => {
        const yearA = a.year || 0;
        const yearB = b.year || 0;
        if (yearA !== yearB) return yearB - yearA;
        return (b.citationCount || 0) - (a.citationCount || 0);
    });

    const limit = PAPER_LIMITS[STATE.mode];
    const total = papers.length;
    let truncated = false;
    if (limit && papers.length > limit && !search) {
        papers = papers.slice(0, limit);
        truncated = true;
    }

    const modeLabel = STATE.mode === 'formal' ? 'Curated' : STATE.mode === 'latest' ? 'Latest (Keyword Search)' : 'Latest (Citations to Seeds)';
    const tagSuffix = STATE.activeTag ? ` / #${STATE.activeTag}` : '';
    summary.textContent = `${modeLabel}${tagSuffix}: ${total.toLocaleString()} papers${truncated ? ` (showing ${papers.length})` : ''}`;

    if (!papers.length) {
        container.innerHTML = `<p class="empty">No papers match your filters.</p>`;
        return;
    }

    const groups = {};
    papers.forEach(paper => {
        const year = paper.year || 'Unknown';
        if (!groups[year]) groups[year] = [];
        groups[year].push(paper);
    });

    const ordered = Object.entries(groups).sort(([a], [b]) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return Number(b) - Number(a);
    });

    container.innerHTML = `
        <div class="timeline">
            ${ordered.map(([year, items]) => `
                <div class="timeline-year">
                    <div class="timeline-year-marker">${escapeHtml(String(year).slice(-2))}</div>
                    <div class="timeline-year-label">${escapeHtml(year)}</div>
                    <div class="timeline-cards">
                        ${items.map(paper => paperCardHTML(paper)).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function init() {
    initTheme();
    $('#year').textContent = new Date().getFullYear();

    $$('.filter-chip[data-mode]').forEach(button => {
        button.addEventListener('click', async () => {
            const mode = button.dataset.mode;
            if (STATE.mode === mode) return;
            STATE.mode = mode;
            STATE.activeTag = null;
            $$('.filter-chip[data-mode]').forEach(chip => chip.classList.toggle('active', chip.dataset.mode === mode));
            await loadAndRenderReading();
        });
    });

    let searchTimer;
    $('#search-input').addEventListener('input', event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            STATE.search = event.target.value;
            renderReadingList();
        }, 180);
    });

    $('#hero-explore').addEventListener('click', () => {
        $('#reading').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const backToTop = $('#back-to-top');
    window.addEventListener('scroll', () => {
        backToTop.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    await ensureFormalLoaded();
    await loadAndRenderReading();
    observeReveal();
}

document.addEventListener('DOMContentLoaded', init);
