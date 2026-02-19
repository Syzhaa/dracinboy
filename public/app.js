const API_BASE = '';

let currentPage = 1;
let currentCategory = 'featured'; // featured, latest, rank, indo, all
let isLoading = false;

// Immersive Player State
let currentDramaId = null;
let currentEpisodes = [];
let currentEpisodeIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Theme Initialization
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    // Check saved theme
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemTheme)) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            html.classList.toggle('dark');
            const isDark = html.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // ROUTING LOGIC
    const path = window.location.pathname;
    const isDetailPage = path.includes('detail.html');

    if (isDetailPage) {
        // === DETAIL PAGE LOGIC ===
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('id');

        if (bookId) {
            loadDetail(bookId);
        } else {
            window.location.href = 'index.html'; // Fallback
        }

        // Setup Player Close Listeners
        const closeVideo = document.getElementById('closeVideo');
        if (closeVideo) closeVideo.addEventListener('click', closeVideoModal);

        const closeImmersive = document.getElementById('closeImmersive');
        if (closeImmersive) closeImmersive.addEventListener('click', closeImmersivePlayer);

    } else {
        // === INDEX PAGE LOGIC ===
        // Initial Load
        loadCategory('featured');

        // Check for Continue Watching
        const lastDramaId = localStorage.getItem('lastDramaId');
        const lastEpIndex = localStorage.getItem('lastEpIndex');

        if (lastDramaId) {
            fetch(`${API_BASE}/enviel/drama/detail/${lastDramaId}`)
                .then(res => res.json())
                .then(result => {
                    if (result.status) {
                        const data = result.data;
                        const container = document.getElementById('continueWatchingContainer');
                        const cover = document.getElementById('cwCover');
                        const title = document.getElementById('cwTitle');
                        const epIndex = document.getElementById('cwEpIndex');

                        if (container && cover && title && epIndex) {
                            cover.src = data.cover;
                            title.textContent = data.title;
                            // Display next episode if possible, or current
                            const idx = lastEpIndex ? parseInt(lastEpIndex) + 1 : 1;
                            epIndex.textContent = idx;

                            container.classList.remove('hidden');
                            container.onclick = () => {
                                window.location.href = `detail.html?id=${lastDramaId}`;
                            };
                        }
                    }
                })
                .catch(e => console.error("CW Error:", e));
        }

        // Search Listener
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSearch(searchInput.value);
            });
        }

        // Category Nav Listeners
        document.querySelectorAll('.nav-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                if (type === currentCategory) return;
                loadCategory(type);
            });
        });

        // Load More Listener
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                if (!isLoading) {
                    currentPage++;
                    fetchData(currentCategory, true);
                }
            });
        }

        // Modal Close Listeners (Mobile & Desktop) - For Index Page Only
        setupModalListeners();
    }

    // Bottom Nav Listeners (Mobile) & Sidebar (Desktop) - Common for both
    document.querySelectorAll('[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // If on detail page, some links should redirect to index
            if (isDetailPage) {
                if (btn.closest('aside')) return; // Sidebar links are already <a> tags in html
                // For mobile bottom nav
                window.location.href = 'index.html';
                return;
            }

            e.preventDefault();
            const targetType = e.currentTarget.dataset.target;

            if (targetType === 'home') {
                loadCategory('featured');
            } else if (targetType === 'foryou') {
                loadCategory('latest');
            } else if (targetType === 'all') {
                loadCategory('all');
            } else if (targetType === 'downloads') {
                loadHistory(); // Load History instead of Downloads
            }
        });
    });
});

function addToHistory(drama) {
    let history = JSON.parse(localStorage.getItem('watchHistory') || '[]');
    // Remove if exists to re-add at top
    history = history.filter(h => h.bookId !== drama.id);

    // Add new entry
    history.unshift({
        bookId: drama.id,
        title: drama.title,
        cover: drama.cover,
        chapterCount: drama.totalEpisodes || '??'
    });

    // Limit to 50 items
    if (history.length > 50) history.pop();

    localStorage.setItem('watchHistory', JSON.stringify(history));
}

function loadHistory() {
    currentCategory = 'history';
    updateNavUI('downloads'); // Highlight 'Koleksi'

    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = 'Riwayat Tontonan';

    const history = JSON.parse(localStorage.getItem('watchHistory') || '[]');
    renderGrid(history);

    const loadMoreBtn = document.getElementById('loadMoreContainer');
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
}

function setupModalListeners() {
    const modal = document.getElementById('detailModal');

    // Close on backdrop click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }

    const closeModalMobile = document.getElementById('closeModalMobile');
    if (closeModalMobile) {
        closeModalMobile.style.pointerEvents = 'auto'; // Ensure clickable
        closeModalMobile.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    const closeModalDesktop = document.getElementById('closeModalDesktop');
    if (closeModalDesktop) {
        closeModalDesktop.style.pointerEvents = 'auto';
        closeModalDesktop.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // Video Modal Close (Desktop)
    const closeVideo = document.getElementById('closeVideo');
    if (closeVideo) {
        closeVideo.addEventListener('click', () => {
            closeVideoModal();
        });
    }

    // Immersive Player Close
    const closeImmersive = document.getElementById('closeImmersive');
    if (closeImmersive) {
        closeImmersive.addEventListener('click', () => {
            closeImmersivePlayer();
        });
    }
}

function updateNavUI(type) {
    document.querySelectorAll('.nav-filter').forEach(b => {
        // Reset to inactive state
        b.className = 'nav-filter py-1.5 px-4 rounded-full text-xs font-medium text-light-muted dark:text-dark-muted hover:bg-light-surface dark:hover:bg-dark-surface hover:text-light-text dark:hover:text-dark-text transition-all whitespace-nowrap';

        if (b.dataset.type === type) {
            // Active State
            b.className = 'nav-filter relative py-1.5 px-4 rounded-full text-xs font-bold bg-primary text-white shadow-md shadow-primary/20 transition-transform active:scale-95 whitespace-nowrap';
        }
    });

    // Sidebar & Mobile Nav Active State
    document.querySelectorAll('[data-target]').forEach(link => {
        const isMobile = link.closest('.md\\:hidden'); // Identify mobile nav items

        if (isMobile) {
            // Mobile Nav Styling
            // Reset to inactive first
            link.className = 'flex flex-col items-center gap-1 transition-colors nav-btn p-1';

            if (link.dataset.target === type || (type === 'featured' && link.dataset.target === 'home')) {
                // Active: Primary Color + Icon Filled
                link.classList.add('text-primary');
                const icon = link.querySelector('.material-symbols-rounded');
                if (icon) icon.classList.add('icon-filled');
            } else {
                // Inactive: Muted Color
                link.classList.add('text-light-muted', 'dark:text-dark-muted', 'hover:text-primary');
                const icon = link.querySelector('.material-symbols-rounded');
                if (icon) icon.classList.remove('icon-filled');
            }
        } else {
            // Desktop Sidebar Styling
            link.classList.remove('nav-item-active');
            link.classList.add('nav-item-inactive');

            if (link.dataset.target === type || (type === 'featured' && link.dataset.target === 'home')) {
                link.classList.remove('nav-item-inactive');
                link.classList.add('nav-item-active');
            }
        }
    });

    // Update Section Title
    const titleMap = {
        'featured': 'Untuk Anda',
        'latest': 'Drama Terbaru',
        'rank': 'Paling Populer',
        'indo': 'Indonesian Dub',
        'all': 'Semua Koleksi',
        'search': 'Hasil Pencarian'
    };
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl && titleMap[type]) titleEl.textContent = titleMap[type];
}

function loadCategory(type) {
    currentCategory = type;
    currentPage = 1;
    updateNavUI(type);
    fetchData(type, false);
}

async function fetchData(type, append = false) {
    if (isLoading) return;
    isLoading = true;

    if (!append) showLoading();

    const loadMoreBtn = document.getElementById('loadMoreContainer');
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');

    try {
        let url = '';
        if (type === 'featured') url = `${API_BASE}/enviel/drama/featured?page=${currentPage}`;
        else if (type === 'latest') url = `${API_BASE}/enviel/drama/latest?page=${currentPage}`;
        else if (type === 'rank') url = `${API_BASE}/enviel/drama/rank?type=1&page=${currentPage}`; // Rank might not support page but keeping for consistency
        else if (type === 'indo') url = `${API_BASE}/enviel/drama/indo?page=${currentPage}`;
        else if (type === 'all') url = `${API_BASE}/enviel/drama/all?page=${currentPage}&limit=24`;

        const res = await fetch(url);
        const result = await res.json();

        if (result.status) {
            renderGrid(result.data, append);

            // Logic to show load more (simple check: if we got data, maybe there is more)
            // Ideally backend returns total pages, but for now we assume if we got full batch, there might be more
            if (result.data.length > 0 && type !== 'featured') { // Featured usually fixed
                if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');
            } else {
                if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error(`Error fetching ${type}:`, e);
    } finally {
        isLoading = false;
    }
}

async function handleSearch(query) {
    if (!query) return;
    showLoading();
    // Hide Categories active state for search
    currentCategory = 'search';
    updateNavUI('search');

    try {
        const res = await fetch(`${API_BASE}/enviel/drama/search?q=${query}`);
        const result = await res.json();
        if (result.status) {
            renderGrid(result.data);
            const grid = document.getElementById('dramaGrid');
            const msg = document.createElement('div');
            msg.className = 'col-span-full text-center text-sm font-bold text-primary mb-4 w-full';
            msg.textContent = `Results for "${query}"`;
            grid.prepend(msg);

            document.getElementById('loadMoreContainer').classList.add('hidden');
        }
    } catch (e) {
        console.error("Search error:", e);
    }
}

function showLoading() {
    const grid = document.getElementById('dramaGrid');
    if (grid) grid.innerHTML = `
        <div class="animate-pulse col-span-full py-20 flex flex-col items-center justify-center text-light-muted dark:text-dark-muted">
            <span class="material-symbols-rounded text-4xl mb-2 animate-spin">data_usage</span>
            <span class="text-sm font-medium">Memuat drama...</span>
        </div>
    `;
}

function renderGrid(items, append = false) {
    const grid = document.getElementById('dramaGrid');
    if (!grid) return;

    if (!append) grid.innerHTML = '';

    if (items.length === 0 && !append) {
        grid.innerHTML = '<div class="col-span-full text-center py-20 text-light-muted dark:text-dark-muted w-full">Tidak ada drama ditemukan.</div>';
        return;
    }

    items.forEach((item, index) => {
        const card = document.createElement('div');
        // Premium Card Construction
        card.className = 'group flex flex-col gap-2 cursor-pointer transition-transform duration-300 hover:-translate-y-1 fade-in';
        card.style.animationDelay = `${index * 50}ms`; // Staggered animation

        const isHD = Math.random() > 0.3;
        const badge = isHD ?
            `<div class="absolute top-2 right-2 px-1.5 py-0.5 bg-primary/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-md shadow-sm border border-white/10">HD</div>` :
            `<div class="absolute top-2 right-2 px-1.5 py-0.5 bg-secondary/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-md shadow-sm border border-white/10">HOT</div>`;

        const epCount = item.chapterCount ? item.chapterCount : '??';

        card.innerHTML = `
            <div class="relative aspect-[3/4] rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/20 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border group-hover:border-primary/50 transition-all">
                <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                     src="${item.cover}" loading="lazy" alt="${item.title}">
                
                <!-- Overlay Gradient -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                
                ${badge}
                
                <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div class="px-1.5 py-0.5 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold rounded flex items-center gap-1 border border-white/10">
                        <span class="material-symbols-rounded text-[10px]">movie</span>
                        ${epCount}
                    </div>
                </div>

                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center">
                    <span class="material-symbols-rounded text-white text-5xl drop-shadow-lg scale-75 group-hover:scale-100 transition-transform duration-300 icon-filled">play_circle</span>
                </div>
            </div>
            
            <div class="px-1">
                <h3 class="text-xs md:text-sm font-bold leading-tight line-clamp-2 text-light-text dark:text-dark-text group-hover:text-primary transition-colors">${item.title}</h3>
                <div class="flex items-center gap-1 mt-1">
                     <span class="text-[10px] text-light-muted dark:text-dark-muted font-medium">DramaShort</span>
                </div>
            </div>
        `;
        card.onclick = () => {
            window.location.href = `detail.html?id=${item.bookId}`;
        };
        grid.appendChild(card);
    });
}



// === DETAIL PAGE FUNCTION ===
function loadDetail(bookId) {
    // Show Loading Stats
    const setContent = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    fetch(`${API_BASE}/enviel/drama/detail/${bookId}`)
        .then(res => res.json())
        .then(result => {
            if (result.status) {
                const data = result.data;

                // Update Metadata
                document.title = `${data.title} - DramaShort`;

                setContent('detailTitleMobile', data.title);
                setContent('detailTitleDesktop', data.title);
                setContent('detailIntro', data.intro);

                // Store episodes globally for player use
                currentEpisodes = data.episodes || [];

                const cover = document.getElementById('detailCover');
                if (cover) cover.src = data.cover;

                const totalEp = data.totalEpisodes || data.episodes?.length || 0;
                setContent('episodeTotalMobile', `${totalEp} Episodes`);
                setContent('episodeTotalDesktop', `${totalEp} Episodes`);

                const badge = document.getElementById('epCountBadge');
                if (badge) badge.textContent = `${totalEp} Episodes`;

                const epGrid = document.getElementById('episodesGrid');
                epGrid.innerHTML = '';

                // Add to History
                addToHistory(data);

                if (currentEpisodes.length > 0) {
                    currentEpisodes.forEach((ep, index) => {
                        const btn = document.createElement('button');
                        // Premium Button Style
                        btn.className = 'bg-light-surface dark:bg-white/5 border border-light-border dark:border-white/10 hover:bg-primary hover:text-white hover:border-primary dark:hover:border-primary text-light-text dark:text-gray-300 text-xs py-2.5 px-2 rounded-lg transition-all font-medium truncate active:scale-95';
                        btn.textContent = ep.title.replace('Episode ', 'Ep ');
                        btn.onclick = () => {
                            if (window.innerWidth < 768) {
                                openImmersivePlayer(index, data);
                            } else {
                                playVideo(ep.url);
                            }
                        };
                        epGrid.appendChild(btn);
                    });
                } else {
                    epGrid.innerHTML = '<p class="col-span-full text-center text-xs text-light-muted">No episodes available</p>';
                }
            }
        })
        .catch(e => console.error("Detail error:", e));
}

// === DESKTOP PLAYER ===
function playVideo(url) {
    const videoModal = document.getElementById('videoModal');
    const player = document.getElementById('videoPlayer');
    player.src = url;
    videoModal.classList.remove('hidden');
    player.play();
}

function closeVideoModal() {
    const vModal = document.getElementById('videoModal');
    vModal.classList.add('hidden');
    const vid = document.getElementById('videoPlayer');
    vid.pause();
    vid.src = "";
}

// === IMMERSIVE MOBILE PLAYER ===
let observer = null;

function openImmersivePlayer(startIndex, dramaData) {
    const playerContainer = document.getElementById('immersivePlayer');
    const feed = document.getElementById('immersiveFeed');
    playerContainer.classList.remove('hidden');
    feed.innerHTML = '';
    currentEpisodeIndex = startIndex;
    localStorage.setItem('lastEpIndex', startIndex);

    // Initial Render Strategy: Render Current, Previous (if any), and Next 2
    const renderRange = (idx) => {
        const start = Math.max(0, idx - 1);
        const end = Math.min(currentEpisodes.length, idx + 3);

        feed.innerHTML = '';

        for (let i = start; i < end; i++) {
            renderSlide(currentEpisodes[i], i, dramaData);
        }
    };

    renderRange(startIndex);

    // Scroll to current
    setTimeout(() => {
        const currentSlide = document.querySelector(`[data-index="${startIndex}"]`);
        if (currentSlide) currentSlide.scrollIntoView({ behavior: 'auto' });
    }, 0);

    // Setup Intersection Observer for Single Video Playback
    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const index = parseInt(entry.target.dataset.index);
            const video = document.getElementById(`vid-${index}`);

            if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                // Video is mostly visible - PLAY
                if (video) {
                    // Pause all others first
                    document.querySelectorAll('video').forEach(v => {
                        if (v !== video && !v.paused) v.pause();
                    });

                    video.play().catch(e => console.log("Auto-play blocked:", e));
                    currentEpisodeIndex = index;
                    localStorage.setItem('lastEpIndex', index);
                }
            } else {
                // Video is not mostly visible - PAUSE
                if (video && !video.paused) {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }, { threshold: 0.6 });

    document.querySelectorAll('.snap-center').forEach(el => observer.observe(el));
}

function renderSlide(episode, index, dramaData, styles = false) {
    const feed = document.getElementById('immersiveFeed');
    // Check if exists
    if (document.querySelector(`[data-index="${index}"]`)) return;

    const slide = document.createElement('div');
    slide.className = 'w-full h-full snap-center relative bg-black flex items-center justify-center overflow-hidden';
    slide.dataset.index = index;

    slide.innerHTML = `
        <div class="relative w-full h-full font-sans group select-none">
            <!-- Background Blur -->
             <div class="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 transform scale-125 transition-opacity" style="background-image: url('${dramaData.cover}');"></div>
             
             <!-- Video Layer -->
             <video class="w-full h-full object-contain absolute inset-0 z-10" 
                    playsinline
                    webkit-playsinline
                    src="${episode.url}"
                    id="vid-${index}"></video>
            
            <!-- Tap Zones for Seek (Double Tap) -->
            <div class="absolute inset-y-0 left-0 w-1/3 z-20" id="tap-left-${index}"></div>
            <div class="absolute inset-y-0 right-0 w-1/3 z-20" id="tap-right-${index}"></div>
            <div class="absolute inset-y-0 left-1/3 right-1/3 z-20 flex items-center justify-center pointer-events-none" id="tap-center-${index}">
                 <!-- Play/Pause Animation Icon -->
                 <div id="play-anim-${index}" class="bg-black/50 rounded-full p-4 text-white opacity-0 transform scale-50 transition-all duration-200">
                    <span class="material-symbols-rounded text-5xl icon-filled">play_arrow</span>
                 </div>
            </div>

            <!-- UI Overlay -->
            <div class="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between transition-opacity duration-300" id="ui-overlay-${index}">
                 <!-- Top Gradient -->
                 <div class="w-full h-32 bg-gradient-to-b from-black/60 to-transparent"></div>
                 
                 <!-- Bottom Info Area -->
                 <div class="w-full bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-32 pb-6 px-4 pointer-events-auto">
                    <div class="mb-3">
                         <div class="flex items-center gap-2 mb-2 transparent">
                             <span class="px-2 py-0.5 bg-primary rounded text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">Episode ${index + 1}</span>
                             <span class="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] font-medium text-white shadow-sm border border-white/10">HD 1080p</span>
                         </div>
                         <h2 class="text-lg font-bold text-white leading-tight drop-shadow-md line-clamp-2 shadow-black">${dramaData.title}</h2>
                         <p class="text-sm text-gray-200 mt-1 line-clamp-1 font-light opacity-90 shadow-black">${episode.title}</p>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="relative w-full h-1 bg-gray-600/50 rounded-full overflow-hidden group/progress cursor-pointer">
                        <div class="absolute top-0 left-0 h-full bg-primary transition-all duration-100 ease-linear w-0" id="prog-bar-${index}"></div>
                        <input type="range" min="0" max="100" value="0" step="0.1" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40" id="seeker-${index}">
                    </div>
                    
                     <div class="flex items-center justify-between mt-2 text-[10px] text-gray-400 font-mono">
                        <span id="time-cur-${index}">00:00</span>
                        <div class="flex-1"></div>
                        <span id="time-dur-${index}">00:00</span>
                    </div>
                </div>
            </div>
            
            <!-- Seek Feedback Overlay -->
            <div class="absolute inset-0 z-40 pointer-events-none flex items-center justify-center opacity-0 transition-opacity duration-300" id="seek-feedback-${index}">
                <div class="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 text-white font-bold text-sm">
                    <span class="material-symbols-rounded" id="seek-icon-${index}">fast_forward</span>
                    <span id="seek-text-${index}">+10s</span>
                </div>
            </div>
        </div>
    `;

    feed.appendChild(slide);

    const video = document.getElementById(`vid-${index}`);
    const playAnim = document.getElementById(`play-anim-${index}`);
    const tapLeft = document.getElementById(`tap-left-${index}`);
    const tapRight = document.getElementById(`tap-right-${index}`);
    const seeker = document.getElementById(`seeker-${index}`);
    const progBar = document.getElementById(`prog-bar-${index}`);
    const curTimeEl = document.getElementById(`time-cur-${index}`);
    const durTimeEl = document.getElementById(`time-dur-${index}`);
    const seekFeed = document.getElementById(`seek-feedback-${index}`);
    const uiOverlay = document.getElementById(`ui-overlay-${index}`);
    const topNav = document.getElementById('immersiveTopNav');

    // Format Time Helper
    const fmt = (s) => {
        if (!s) return "00:00";
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    // --- Interaction Logic ---
    let lastTap = 0;

    // Toggle Play Function
    const togglePlay = () => {
        if (video.paused) {
            video.play();
            playAnim.innerHTML = '<span class="material-symbols-rounded text-5xl icon-filled">play_arrow</span>';
            animatePlayIcon();
            // Hide UI on Play
            uiOverlay.classList.add('opacity-0');
            if (topNav) topNav.classList.add('opacity-0');
        } else {
            video.pause();
            playAnim.innerHTML = '<span class="material-symbols-rounded text-5xl icon-filled">pause</span>';
            animatePlayIcon(true);
            // Show UI on Pause
            uiOverlay.classList.remove('opacity-0');
            if (topNav) topNav.classList.remove('opacity-0');
        }
    };

    const animatePlayIcon = (persist = false) => {
        playAnim.classList.remove('opacity-0', 'scale-50');
        playAnim.classList.add('opacity-100', 'scale-100');
        if (!persist) {
            setTimeout(() => {
                playAnim.classList.remove('opacity-100', 'scale-100');
                playAnim.classList.add('opacity-0', 'scale-50');
            }, 600);
        } else {
            setTimeout(() => {
                if (video.paused) {
                    playAnim.classList.remove('opacity-100', 'scale-100');
                    playAnim.classList.add('opacity-0', 'scale-50');
                }
            }, 800);
        }
    };

    // Generic Tap Handler
    const handleTap = (type) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            // DOUBLE TAP
            if (type === 'left') {
                video.currentTime = Math.max(0, video.currentTime - 10);
                showSeekFeedback('fast_rewind', '-10s');
                if (video.paused) video.play();
            } else if (type === 'right') {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                showSeekFeedback('fast_forward', '+10s');
                if (video.paused) video.play();
            } else {
                togglePlay();
            }
        } else {
            // SINGLE TAP
            if (type === 'center') {
                // If UI is hidden, just show it? Or Toggle Play?
                // User wants "clean" area. Standard behavior: Tap toggles UI + Play? 
                // Or Tap toggles UI Only?
                // Let's make Single Tap Toggle Play AND Toggle UI visibility sync.
                togglePlay();
            }
        }
        lastTap = now;
    };

    const showSeekFeedback = (icon, text) => {
        document.getElementById(`seek-icon-${index}`).textContent = icon;
        document.getElementById(`seek-text-${index}`).textContent = text;
        seekFeed.classList.remove('opacity-0');
        setTimeout(() => seekFeed.classList.add('opacity-0'), 800);
    };

    // Bind Taps
    slide.addEventListener('click', (e) => {
        if (e.target.closest('.pointer-events-auto')) return;
        handleTap('center');
    });

    tapLeft.addEventListener('click', (e) => { e.stopPropagation(); handleTap('left'); });
    tapRight.addEventListener('click', (e) => { e.stopPropagation(); handleTap('right'); });

    // Seeker Logic
    seeker.addEventListener('input', (e) => {
        const val = e.target.value;
        const time = (val / 100) * video.duration;
        video.currentTime = time;
    });

    // Time Update
    video.ontimeupdate = () => {
        const pct = (video.currentTime / video.duration) * 100;
        progBar.style.width = `${pct}%`;
        seeker.value = pct;
        curTimeEl.textContent = fmt(video.currentTime);
        durTimeEl.textContent = fmt(video.duration);
    };

    video.onloadedmetadata = () => durTimeEl.textContent = fmt(video.duration);

    // Video Events
    video.onplaying = () => {
        playAnim.classList.add('opacity-0', 'scale-50');
        uiOverlay.classList.add('opacity-0'); // Ensure hidden on play
        if (topNav) topNav.classList.add('opacity-0');
    };

    video.onpause = () => {
        uiOverlay.classList.remove('opacity-0'); // Ensure shown on pause
        if (topNav) topNav.classList.remove('opacity-0');
    };

    // Auto Scroll on End
    video.onended = () => {
        // Load Next
        const nextIndex = index + 1;
        if (nextIndex < currentEpisodes.length) {
            const nextSlide = document.querySelector(`[data-index="${nextIndex}"]`);
            if (nextSlide) {
                nextSlide.scrollIntoView({ behavior: 'smooth' });
                // Play is handled by IntersectionObserver
                currentEpisodeIndex = nextIndex;
                localStorage.setItem('lastEpIndex', nextIndex);
            } else {
                // If next slide not rendered yet
                renderSlide(currentEpisodes[nextIndex], nextIndex, dramaData);
                // Allow DOM update then scroll
                setTimeout(() => {
                    const newSlide = document.querySelector(`[data-index="${nextIndex}"]`);
                    if (newSlide) newSlide.scrollIntoView({ behavior: 'smooth' });
                    currentEpisodeIndex = nextIndex;
                    localStorage.setItem('lastEpIndex', nextIndex);
                }, 100);
            }
        }
    };

    // Ensure modal/close buttons are clickable
    ['closeModalMobile', 'closeModalDesktop', 'closeVideo', 'closeImmersive'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.pointerEvents = 'auto';
            el.style.zIndex = 60;
        }
    });

    // Handle Intersection (Pause off-screen videos) - Handled globally in openImmersivePlayer
}

function closeImmersivePlayer() {
    const playerContainer = document.getElementById('immersivePlayer');
    playerContainer.classList.add('hidden');
    // Show Top Nav back when closing (in case it was hidden) - though closing hides the container anyway
    const topNav = document.getElementById('immersiveTopNav');
    if (topNav) topNav.classList.remove('opacity-0');

    if (observer) observer.disconnect();
    document.querySelectorAll('#immersiveFeed video').forEach(v => {
        v.pause();
        v.src = ""; // Clear source to save memory
    });
    document.getElementById('immersiveFeed').innerHTML = ''; // Clean up
}
