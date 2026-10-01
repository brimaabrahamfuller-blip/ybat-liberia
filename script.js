const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Menu';
  }));
}

const revealTargets = document.querySelectorAll('.section > .container, .gallery-grid img, .program-card, .involve-item');
if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches && 'IntersectionObserver' in window) {
  revealTargets.forEach((element, index) => {
    element.classList.add('reveal');
    element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  });
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach((element) => observer.observe(element));
}

const API = window.YBAT_API_URL || '';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

async function loadPublicContent() {
  try {
    const response = await fetch(`${API}/api/public`);
    if (!response.ok) return;
    const data = await response.json();
    const site = data.site || {};
    const heroTitle = document.querySelector('h1');
    if (heroTitle && site.heroTitle) { const words = site.heroTitle.split(' '); heroTitle.innerHTML = `${escapeHtml(words.slice(0, -2).join(' '))} <em>${escapeHtml(words.slice(-2).join(' '))}</em>`; }
    const heroCopy = document.querySelector('.hero-copy'); if (heroCopy && site.heroCopy) heroCopy.textContent = site.heroCopy;
    const aboutTitle = document.querySelector('#about h2'); if (aboutTitle && site.aboutTitle) aboutTitle.textContent = site.aboutTitle;
    const aboutBody = document.querySelector('.intro-copy p'); if (aboutBody && site.aboutBody) aboutBody.textContent = site.aboutBody;
    [['#contact-email', site.contactEmail, 'mailto:'], ['#contact-phone-1', site.phonePrimary, 'tel:+231'], ['#contact-phone-2', site.phoneSecondary, 'tel:+231']].forEach(([selector, value, prefix]) => { const el = document.querySelector(selector); if (el && value) { el.textContent = value; el.href = prefix === 'mailto:' ? prefix + value : prefix + value.replace(/\D/g, ''); } });
    const programs = document.querySelector('#program-grid');
    if (programs && data.programs?.length) programs.innerHTML = data.programs.map((item, index) => `<article class="program-card"><span class="program-number">${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><span class="card-arrow">↗</span></article>`).join('');
    const impact = document.querySelector('#impact-stats');
    if (impact && data.impact?.length) impact.innerHTML = data.impact.slice(0, 4).map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join('');
    const news = document.querySelector('#news-list'); const items = [...(data.events || []), ...(data.stories || [])];
    if (news) news.innerHTML = items.length ? items.slice(0, 6).map((item) => `<article class="news-card"><p class="eyebrow">${item.event_date ? new Date(item.event_date).toLocaleDateString() : 'YBAT story'}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.body)}</p>${item.location ? `<small>${escapeHtml(item.location)}</small>` : ''}</article>`).join('') : '<p>New YBAT events and activity recaps will appear here soon.</p>';
  } catch (error) { console.warn('YBAT content API unavailable; showing fallback content.', error); }
}

const contactForm = document.querySelector('#contact-form');
if (contactForm) contactForm.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const status = form.querySelector('.form-status'); const body = Object.fromEntries(new FormData(form)); body.kind = body.kind_detail || body.kind; delete body.kind_detail; try { const response = await fetch(`${API}/api/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); form.reset(); status.textContent = data.message; } catch (error) { status.textContent = error.message || 'Please try again later.'; status.classList.add('error'); } });

loadPublicContent();
