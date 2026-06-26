/**
 * Frontend logic for index_v2.html (Version 2)
 * Brutalist Dark Theme with Ken Burns Slider, stats counters, interactive flip card,
 * and loading dynamic content from videos_data.json and blog_posts.json
 */

// Configuration
const CONFIG = {
    videosPerPage: 6,
    videosFile: 'videos_data.json',
    postsFile: 'blog_posts.json',
    channelUrl: 'https://www.youtube.com/@tviy_trener'
};

// State
let allVideos = [];
let filteredVideos = [];
let currentVideoPage = 1;
let currentFilter = 'all';

// DOM Elements
const videosGrid = document.getElementById('videos-grid');
const loadMoreBtn = document.getElementById('load-more-videos');
const filterTabs = document.querySelectorAll('.video-filter-tab');
const blogContainer = document.getElementById('blog-container');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

/**
 * Initialize the app
 */
async function init() {
    setupSliders();
    setupMobileMenu();
    setupFlipCard();
    setupStatsCounter();
    setupLightbox();
    setupForm();
    
    await loadVideos();
    await loadBlogPosts();
    setupVideoFilter();
}

/**
 * Setup Ken Burns hero slider
 */
function setupSliders() {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.kb-slide');
    if (slides.length <= 1) return;
    
    setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 6000);
}

/**
 * Setup Mobile Menu
 */
function setupMobileMenu() {
    if (!mobileMenuBtn || !mobileMenu) return;
    
    mobileMenuBtn.addEventListener('click', () => {
        const isHidden = mobileMenu.classList.contains('hidden');
        if (isHidden) {
            mobileMenu.classList.remove('hidden');
            mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
        } else {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });
    
    // Close menu when clicking nav links
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });
}

/**
 * Setup Trainer Flip Card
 */
function setupFlipCard() {
    const flipCard = document.getElementById('trainerFlipCard');
    if (!flipCard) return;
    
    flipCard.addEventListener('click', () => {
        flipCard.classList.toggle('flipped');
    });
}

/**
 * Setup Stats Counter
 */
function setupStatsCounter() {
    const statsSection = document.getElementById('statsSection');
    const statsElements = [
        { id: 'stat-experience', target: 20, suffix: '' },
        { id: 'stat-clients', target: 1000, suffix: '+' },
        { id: 'stat-level', target: 100, suffix: '%' }
    ];
    
    let animated = false;
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !animated) {
                animated = true;
                statsElements.forEach(elem => {
                    animateCounter(elem.id, elem.target, elem.suffix);
                });
            }
        }, { threshold: 0.3 });
        
        observer.observe(statsSection);
    }
}

function animateCounter(id, target, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let current = 0;
    const duration = 1500;
    const stepTime = 15;
    
    // If target is small, count one by one, otherwise step values
    const stepVal = target > 200 ? Math.ceil(target / (duration / stepTime)) : 1;
    const incrementInterval = target > 200 ? stepTime : Math.max(15, Math.floor(duration / target));
    
    const timer = setInterval(() => {
        current += stepVal;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = current + suffix;
    }, incrementInterval);
}

/**
 * Setup Lightbox Modal
 */
function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const closeLightbox = document.getElementById('closeLightbox');
    
    if (!lightbox || !lightboxImg) return;
    
    function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock scroll
    }
    
    function close() {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scroll
    }
    
    if (closeLightbox) {
        closeLightbox.addEventListener('click', close);
    }
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === closeLightbox) {
            close();
        }
    });
    
    // Diploma click
    const diplomaWidget = document.getElementById('diplomaWidget');
    if (diplomaWidget) {
        diplomaWidget.addEventListener('click', (e) => {
            e.stopPropagation();
            const img = diplomaWidget.querySelector('img');
            if (img) openLightbox(img.src);
        });
    }
    
    // Gallery items clicks
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const img = item.querySelector('img');
            if (img) openLightbox(img.src);
        });
    });
}

/**
 * Load videos from JSON
 */
async function loadVideos() {
    try {
        const response = await fetch(CONFIG.videosFile);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        allVideos = await response.json();
        filteredVideos = allVideos;
        renderVideos();
    } catch (error) {
        console.error('Failed to load videos:', error);
        if (videosGrid) {
            videosGrid.innerHTML = '<div class="text-center py-12 text-red-500 col-span-full">Не вдалося завантажити відео. Спробуйте пізніше.</div>';
        }
    }
}

/**
 * Render videos
 */
function renderVideos() {
    if (!videosGrid) return;
    
    const start = (currentVideoPage - 1) * CONFIG.videosPerPage;
    const end = currentVideoPage * CONFIG.videosPerPage;
    const videosToShow = filteredVideos.slice(start, end);
    
    if (currentVideoPage === 1) {
        videosGrid.innerHTML = '';
    }
    
    if (videosToShow.length === 0) {
        videosGrid.innerHTML = '<div class="text-center py-12 text-white/40 col-span-full">Немає доступних відео в цій категорії.</div>';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
    }
    
    videosToShow.forEach((video, index) => {
        const card = createVideoCardV2(video, start + index);
        videosGrid.appendChild(card);
    });
    
    // Show/hide load more button
    if (loadMoreBtn) {
        loadMoreBtn.style.display = (currentVideoPage * CONFIG.videosPerPage) < filteredVideos.length ? 'inline-block' : 'none';
    }
}

/**
 * Create video card V2 element
 */
function createVideoCardV2(video, index) {
    const card = document.createElement('article');
    card.className = 'video-card-v2 border border-white/5 bg-[var(--bg-card)] notch-corner overflow-hidden group flex flex-col';
    card.dataset.index = index;
    card.dataset.type = video.type || 'video';
    
    const videoId = video.id;
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const watchUrl = video.url || `https://www.youtube.com/watch?v=${videoId}`;
    const title = video.title || 'Без назви';
    const publishedAt = video.published_at ? new Date(video.published_at).toLocaleDateString('uk-UA') : '';
    const isShort = video.type === 'short';
    
    card.innerHTML = `
        <div class="relative aspect-video overflow-hidden bg-black">
            <iframe 
                loading="lazy" 
                class="w-full h-full object-cover img-noir group-hover:filter-none transition-all duration-500" 
                src="${embedUrl}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen
                title="${escapeHtml(title)}"
            ></iframe>
            ${isShort ? '<span class="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-wider bg-[var(--accent)] text-black px-2 py-0.5 font-bold">Shorts</span>' : ''}
        </div>
        <div class="p-6 flex flex-col justify-between flex-grow">
            <div>
                <span class="font-mono text-[9px] text-[var(--accent)] uppercase tracking-wider">${video.type === 'short' ? 'Shorts' : 'Відео'}</span>
                <h4 class="font-heading text-lg uppercase tracking-wider text-white mt-1 group-hover:text-[var(--accent)] transition-colors line-clamp-2">${escapeHtml(title)}</h4>
            </div>
            <div class="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
                ${publishedAt ? `<time class="font-mono text-[10px] text-[var(--muted)]" datetime="${video.published_at}">${publishedAt}</time>` : ''}
                <a href="${watchUrl}" target="_blank" rel="noopener" class="font-mono text-[10px] text-white hover:text-[var(--accent)] uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                    <i class="fab fa-youtube"></i> YouTube
                </a>
            </div>
        </div>
    `;
    return card;
}

/**
 * Setup Video Filter
 */
function setupVideoFilter() {
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.dataset.filter;
            currentFilter = filter;
            currentVideoPage = 1;
            
            filterTabs.forEach(t => {
                t.classList.toggle('active', t.dataset.filter === filter);
            });
            
            if (filter === 'all') {
                filteredVideos = allVideos;
            } else {
                filteredVideos = allVideos.filter(v => v.type === filter);
            }
            
            renderVideos();
        });
    });
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentVideoPage++;
            renderVideos();
        });
    }
}

/**
 * Load blog posts from JSON
 */
async function loadBlogPosts() {
    try {
        const response = await fetch(CONFIG.postsFile);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const posts = await response.json();
        renderBlogPosts(posts);
    } catch (error) {
        console.error('Failed to load blog posts:', error);
        if (blogContainer) {
            blogContainer.innerHTML = '<div class="text-center py-12 text-red-500 col-span-full">Не вдалося завантажити нотатки.</div>';
        }
    }
}

/**
 * Render blog posts
 */
function renderBlogPosts(posts) {
    if (!blogContainer) return;
    
    if (!posts || posts.length === 0) {
        blogContainer.innerHTML = '<div class="text-center py-12 text-white/40 col-span-full">Нотатки ще не додані.</div>';
        return;
    }
    
    blogContainer.innerHTML = '';
    posts.forEach(post => {
        const card = createBlogCardV2(post);
        blogContainer.appendChild(card);
    });
}

/**
 * Create blog post card V2 element
 */
function createBlogCardV2(post) {
    const card = document.createElement('article');
    card.className = 'blog-card-v2 border border-white/5 bg-[var(--bg-card)] notch-corner overflow-hidden group flex flex-col cursor-pointer';
    
    const image = post.image || 'img_new/logo.jpg';
    const title = post.title || 'Без назви';
    const description = post.description || '';
    const slug = post.slug || '';
    const date = post.date ? new Date(post.date).toLocaleDateString('uk-UA') : '';
    const category = post.category || 'general';
    const blogUrl = `blog-${slug}.html`;
    
    card.innerHTML = `
        <div class="relative aspect-[16/10] overflow-hidden bg-black border-b border-white/5">
            <img class="w-full h-full object-cover img-noir group-hover:scale-105 transition-transform duration-700" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
            <span class="absolute bottom-3 left-3 font-mono text-[9px] uppercase tracking-wider bg-black/80 text-[var(--accent)] border border-[var(--accent)]/30 px-2 py-0.5">${escapeHtml(category)}</span>
        </div>
        <div class="p-6 flex flex-col justify-between flex-grow">
            <div>
                <h3 class="font-heading text-xl uppercase tracking-wider text-white group-hover:text-[var(--accent)] transition-colors line-clamp-2">${escapeHtml(title)}</h3>
                <p class="text-[var(--fg-dim)] text-xs font-light leading-relaxed mt-3 line-clamp-3">${escapeHtml(description)}</p>
            </div>
            <div class="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
                ${date ? `<time class="font-mono text-[10px] text-[var(--muted)]" datetime="${post.date}">${date}</time>` : ''}
                <a href="${blogUrl}" class="font-mono text-[10px] text-white group-hover:text-[var(--accent)] uppercase tracking-widest transition-colors">Читати далі →</a>
            </div>
        </div>
    `;
    
    card.addEventListener('click', (e) => {
        if (!e.target.closest('a')) {
            window.location.href = blogUrl;
        }
    });
    
    return card;
}

/**
 * Setup Registration Form
 */
function setupForm() {
    const goalPills = document.querySelectorAll('.goal-pill');
    let selectedGoalText = "Схуднення";
    
    goalPills.forEach(pill => {
        pill.addEventListener('click', () => {
            goalPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedGoalText = pill.textContent;
        });
    });
    
    // Phone mask
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('0')) {
                value = '38' + value;
            } else if (value.length > 0 && !value.startsWith('38')) {
                value = '38' + value;
            }
            if (value.length > 12) value = value.slice(0, 12);
            let x = value.match(/(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
            if (!x[1]) {
                e.target.value = '';
                return;
            }
            let val = '+38';
            if (x[1] === '38') {
                if (x[2]) val += ' (' + x[2];
                if (x[3]) val += ') ' + x[3];
                if (x[4]) val += '-' + x[4];
                if (x[5]) val += '-' + x[5];
            }
            e.target.value = val;
        });
    }
    
    // Form submit
    const form = document.getElementById('trainerForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const status = document.getElementById('formStatus');
            const phoneInput = document.getElementById('phone');
            const phoneValue = phoneInput.value;
            const phoneRegex = /^\+38\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
            
            // Client rate limit checks
            const lastSentTime = localStorage.getItem('form_sent_time');
            const sentCount = parseInt(localStorage.getItem('form_sent_count') || '0');
            const blockDuration = 15 * 60 * 1000;
            
            if (lastSentTime && (Date.now() - parseInt(lastSentTime) < blockDuration)) {
                if (sentCount >= 3) {
                    const minutesLeft = Math.ceil((blockDuration - (Date.now() - parseInt(lastSentTime))) / 60000);
                    status.style.color = '#c0392b';
                    status.innerText = `Помилка: Ви перевищили ліміт відправок. Спробуйте через ${minutesLeft} хв.`;
                    return;
                }
            }
            
            if (!phoneRegex.test(phoneValue)) {
                status.style.color = '#c0392b';
                status.innerText = 'Введіть повний номер: +38 (0XX) XXX-XX-XX';
                phoneInput.focus();
                return;
            }
            
            status.style.color = 'var(--accent)';
            status.innerText = 'Надсилаємо запит...';
            
            const formData = {
                name: document.getElementById('name').value,
                phone: phoneValue,
                goal: selectedGoalText,
                message: document.getElementById('message').value,
                website: document.getElementById('website').value // Honeypot
            };
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (result.success) {
                    status.style.color = '#27ae60';
                    status.innerText = 'Заявку прийнято! Ілля зв\'яжеться з вами найближчим часом.';
                    form.reset();
                    
                    // Reset goals
                    goalPills.forEach(p => p.classList.remove('active'));
                    goalPills[0].classList.add('active');
                    selectedGoalText = "Схуднення";
                    
                    const now = Date.now();
                    const currentSentCount = lastSentTime && (now - parseInt(lastSentTime) < blockDuration) ? sentCount + 1 : 1;
                    localStorage.setItem('form_sent_count', currentSentCount.toString());
                    localStorage.setItem('form_sent_time', now.toString());
                } else {
                    status.style.color = '#c0392b';
                    status.innerText = result.error || 'Помилка відправки запиту.';
                }
            } catch (err) {
                status.style.color = '#c0392b';
                status.innerText = 'Помилка з\'єднання. Спробуйте пізніше.';
            }
        });
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start
document.addEventListener('DOMContentLoaded', init);
