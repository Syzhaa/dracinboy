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

    // Sidebar Active State
    document.querySelectorAll('[data-target]').forEach(link => {
        link.classList.remove('nav-item-active');
        link.classList.add('nav-item-inactive');

        if (link.dataset.target === type || (type === 'featured' && link.dataset.target === 'home')) {
            link.classList.remove('nav-item-inactive');
            link.classList.add('nav-item-active');
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
function openImmersivePlayer(startIndex, dramaData) {
    const playerContainer = document.getElementById('immersivePlayer');
    const feed = document.getElementById('immersiveFeed');
    playerContainer.classList.remove('hidden');
    feed.innerHTML = '';
    currentEpisodeIndex = startIndex;
    localStorage.setItem('lastEpIndex', startIndex);

    // Render initial batch (start index + next few)
    // For production, implemented infinite scroll logic. For now, render all or a batch.
    // Let's render all since episodes lists strictly < 100 usually for these short dramas or lazy load?
    // User requested "auto scroll", so let's render all but be careful.

    // Optimization: Render specific range? 
    // Let's render current + 5 next for start.

    const episodesToRender = currentEpisodes.slice(Math.max(0, startIndex - 1), startIndex + 5);
    // Actually, simple list rendering is fine for now as video elements are heavy.
    // Better to render one by one or a few.

    // We will render ALL for simplicity but only play the current one.
    // Creating elements for 50+ videos might be heavy.
    // Let's implement a dynamic renderer.

    // Render current one first
    renderSlide(currentEpisodes[startIndex], startIndex, dramaData, true);

    // Render next ones locally
    for (let i = startIndex + 1; i < Math.min(startIndex + 3, currentEpisodes.length); i++) {
        renderSlide(currentEpisodes[i], i, dramaData, false);
    }
}

function renderSlide(episode, index, dramaData, styles = false) {
    const feed = document.getElementById('immersiveFeed');
    const slide = document.createElement('div');
    slide.className = 'w-full h-full snap-center relative bg-black flex items-center justify-center';
    slide.dataset.index = index;

    const isHD = Math.random() > 0.5; // Metadata simulation

    // Using User's Design Template
    slide.innerHTML = `
        <div class="relative w-full h-full font-body">
            <!-- Background Cover (Blurred) -->
             <div class="absolute inset-0 bg-cover bg-center blur-3xl opacity-30" style="background-image: url('${dramaData.cover}');"></div>
             
             <!-- Video Player -->
             <video class="w-full h-full object-contain absolute inset-0 z-10" 
                    ${index === currentEpisodeIndex ? 'autoplay' : ''} 
                    playsinline
                    src="${episode.url}"
                    id="vid-${index}"></video>
            
            <!-- Metadata & Controls Overlay -->
            <div class="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between">
                 <!-- Top Scrim -->
                 <div class="w-full h-32 scrim-top"></div>
                 
                 <!-- Episode Badge (Right) -->
                 <div class="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-6 pointer-events-auto">
                    <div class="flex flex-col items-center gap-2">
                        <div class="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-3 flex flex-col items-center justify-center w-16 h-16 shadow-lg">
                            <span class="text-xs text-white/70 font-medium uppercase">Eps</span>
                            <span class="text-2xl font-bold text-white">${index + 1}</span>
                        </div>
                        <span class="text-[10px] uppercase tracking-widest text-white/60">Series</span>
                    </div>
                </div>

                <!-- Bottom Scrim & Info -->
                <div class="w-full pb-8 scrim-bottom pt-24 pointer-events-auto">
                    <div class="px-6">
                        <div class="flex items-center gap-2 mb-3">
                             <span class="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Hot Drama</span>
                        </div>
                        <h2 class="text-3xl font-bold mb-2 drop-shadow-md tracking-tight leading-tight text-white">${dramaData.title}</h2>
                        <p class="text-base text-white/90 line-clamp-2 max-w-[85%] leading-relaxed drop-shadow-sm font-light">
                            ${episode.title}
                        </p>
                        <div class="flex items-center gap-2 mt-4 text-sm text-white/60">
                            <span class="material-symbols-outlined !text-lg">music_note</span>
                            <span class="truncate">Original Sound - DramaShort</span>
                        </div>
                    </div>
                    
                    <!-- Progress Bar (Simple Visual) -->
                    <div class="w-full px-6 mt-4">
                        <progress class="w-full h-1 [&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-bar]:bg-slate-300 [&::-webkit-progress-value]:bg-primary" value="0" max="100" id="prog-${index}"></progress>
                    </div>
                </div>
            </div>
        </div>
    `;

    feed.appendChild(slide);

    // Video Logic
    const video = slide.querySelector('video');

    // Create controls overlay (play/pause center) and loading spinner
    const controls = document.createElement('div');
    controls.className = 'immersive-controls pointer-events-auto absolute inset-0 z-30 flex items-center justify-center';
    controls.innerHTML = `
        <div class="control-inner flex items-center gap-6 pointer-events-auto">
            <button class="prev-skip-btn text-white/70 hover:text-white pointer-events-auto transition-transform active:scale-90" onclick="document.getElementById('vid-${index}').currentTime -= 10; event.stopPropagation();">
                <span class="material-symbols-rounded text-3xl drop-shadow-md">replay_10</span>
            </button>
            
            <button class="play-btn bg-white/20 hover:bg-white/30 text-white rounded-full p-5 backdrop-blur-md shadow-xl pointer-events-auto ring-1 ring-white/20 transition-transform active:scale-95" id="play-btn-${index}">
                <span class="material-symbols-rounded text-4xl icon-filled">play_arrow</span>
            </button>

            <button class="next-btn text-white/70 hover:text-white pointer-events-auto transition-transform active:scale-90" id="next-btn-${index}">
                <span class="material-symbols-rounded text-4xl drop-shadow-md">skip_next</span>
            </button>
        </div>
        <div class="loading-spinner hidden pointer-events-none absolute inset-0 flex items-center justify-center">
            <div class="spinner border-4 border-white/20 border-t-white rounded-full w-12 h-12 animate-spin"></div>
        </div>
    `;
    slide.appendChild(controls);

    // Ensure modal/close buttons are clickable (fix edge-case where parent had pointer-events:none)
    ['closeModalMobile', 'closeModalDesktop', 'closeVideo', 'closeImmersive'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.pointerEvents = 'auto';
            el.style.zIndex = 60;
        }
    });

    const playBtn = document.getElementById(`play-btn-${index}`);
    const spinner = slide.querySelector('.loading-spinner');

    const showSpinner = () => { if (spinner) spinner.classList.remove('hidden'); };
    const hideSpinner = () => { if (spinner) spinner.classList.add('hidden'); };

    // Play/pause toggle - Core Logic based on state
    const togglePlay = async () => {
        try {
            if (video.paused) {
                showSpinner();
                // Strictly Step 1: Hide UI
                slide.classList.add('meta-hidden');
                // Strictly Step 2: Play
                await video.play();
            } else {
                // Strictly Step 1: Pause
                video.pause();
                // Strictly Step 2: Show UI
                slide.classList.remove('meta-hidden');
            }
        } catch (e) {
            console.warn('Play failed:', e);
            // Revert UI if play failed
            slide.classList.remove('meta-hidden');
        }
    };

    if (playBtn) {
        // Prevent bubbling to slide click handler to avoid double toggle
        const stopAndPlay = (ev) => {
            ev.stopPropagation();
            togglePlay();
        };
        playBtn.addEventListener('click', stopAndPlay);
        // Ensure touch doesn't double fire
        playBtn.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: true });
    }

    const nextBtn = document.getElementById(`next-btn-${index}`);
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Trigger transition to next
            video.currentTime = video.duration;
        });
    }

    // Video buffering / playing events
    video.addEventListener('waiting', showSpinner);
    video.addEventListener('canplay', hideSpinner);
    video.addEventListener('playing', () => {
        hideSpinner();
        // Clear button content so no icon is visible during playback
        if (playBtn) playBtn.innerHTML = '';
        slide.classList.add('meta-hidden');
    });
    video.addEventListener('pause', () => {
        // Show Play icon when paused
        if (playBtn) playBtn.innerHTML = '<span class="material-symbols-outlined text-3xl">play_arrow</span>';
        slide.classList.remove('meta-hidden');
    });

    // Tap Anywhere on Slide to Toggle Play/Pause (TikTok Style)
    slide.addEventListener('click', (e) => {
        // Ignore if clicking specific interactive elements (buttons, inputs, etc)
        // But allow clicking the general 'controls' container if it's just a pass-through
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;

        togglePlay();
    });

    // Start UI Logic: Show initially if paused
    if (video.paused) slide.classList.remove('meta-hidden');
    else slide.classList.add('meta-hidden');

    // Auto Scroll on End
    video.onended = () => {
        // Load Next
        const nextIndex = index + 1;
        if (nextIndex < currentEpisodes.length) {
            const nextSlide = document.querySelector(`[data-index="${nextIndex}"]`);
            if (nextSlide) {
                nextSlide.scrollIntoView({ behavior: 'smooth' });
                // Play will be handled by intersection observer or manual play
                const nextVid = document.getElementById(`vid-${nextIndex}`);
                if (nextVid) nextVid.play();
                currentEpisodeIndex = nextIndex;
                localStorage.setItem('lastEpIndex', nextIndex); // Update saved state
            } else {
                // If next slide not rendered yet
                renderSlide(currentEpisodes[nextIndex], nextIndex, dramaData);
                // Allow DOM update then scroll
                setTimeout(() => {
                    const newSlide = document.querySelector(`[data-index="${nextIndex}"]`);
                    newSlide.scrollIntoView({ behavior: 'smooth' });
                    const newVid = document.getElementById(`vid-${nextIndex}`);
                    if (newVid) newVid.play();
                    currentEpisodeIndex = nextIndex;
                    localStorage.setItem('lastEpIndex', nextIndex);
                }, 100);
            }
        }
    };

    // Update Progress
    video.ontimeupdate = () => {
        const prog = document.getElementById(`prog-${index}`);
        if (prog && video.duration) {
            prog.value = (video.currentTime / video.duration) * 100;
        }
        // Force hide check during playback to catch edge cases
        if (!video.paused && !slide.classList.contains('meta-hidden') && !interactionLocked) {
            // Only if playing for > 1s
            if (video.currentTime > 1) {
                slide.classList.add('meta-hidden');
            }
        }
    };

    // Handle Intersection (Pause off-screen videos)
    // We should implement an IntersectionObserver for the feed
}

function closeImmersivePlayer() {
    const playerContainer = document.getElementById('immersivePlayer');
    playerContainer.classList.add('hidden');

    // Clear saved state so user doesn't jump back in on refresh if they explicitly closed it
    localStorage.removeItem('lastDramaId');
    localStorage.removeItem('lastEpIndex');

    // Pause all videos
    document.querySelectorAll('#immersiveFeed video').forEach(v => {
        v.pause();
        v.src = ""; // Clear source to save memory
    });
    document.getElementById('immersiveFeed').innerHTML = ''; // Clean up
}
