const API_BASE = '';

let currentPage = 1;
let currentCategory = 'featured'; // featured, latest, rank, indo, all
let isLoading = false;

// Immersive Player State
let currentDramaId = null;
let currentEpisodes = [];
let currentEpisodeIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    loadCategory('featured');

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

    // Bottom Nav Listeners (Mobile) & Sidebar (Desktop)
    document.querySelectorAll('[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetType = e.currentTarget.dataset.target;

            if (targetType === 'home') {
                loadCategory('featured');
            } else if (targetType === 'foryou') {
                loadCategory('latest');
            } else if (targetType === 'all') {
                loadCategory('all');
            }
        });
    });

    // Check for saved state (Deep Link / Refresh)
    const savedDramaId = localStorage.getItem('lastDramaId');
    const savedEpIndex = localStorage.getItem('lastEpIndex');

    if (savedDramaId && savedEpIndex) {
        // Fetch detail and open player directly
        fetch(`${API_BASE}/enviel/drama/detail/${savedDramaId}`)
            .then(res => res.json())
            .then(result => {
                if (result.status) {
                    currentEpisodes = result.data.episodes || [];
                    openImmersivePlayer(parseInt(savedEpIndex) || 0, result.data);
                }
            })
            .catch(e => console.error("Restore error:", e));
    }

    // Modal Close Listeners (Mobile & Desktop)
    setupModalListeners();
});

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
        b.classList.remove('text-primary', 'font-bold', 'bg-primary/10');
        b.classList.add('text-slate-500', 'font-semibold');

        // Remove old indicator if any (though we are using pills now)
        const ind = b.querySelector('.indicator');
        if (ind) ind.remove();

        if (b.dataset.type === type) {
            b.classList.remove('text-slate-500', 'font-semibold');
            b.classList.add('text-primary', 'font-bold', 'bg-primary/10');
        } else {
            b.classList.add('hover:bg-slate-100', 'hover:text-secondary');
        }
    });
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
    updateNavUI('');

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
    if (grid) grid.innerHTML = '<div class="col-span-full text-center py-20 text-slate-400 w-full">Loading...</div>';
}

function renderGrid(items, append = false) {
    const grid = document.getElementById('dramaGrid');
    if (!grid) return;

    if (!append) grid.innerHTML = '';

    if (items.length === 0 && !append) {
        grid.innerHTML = '<div class="col-span-full text-center py-20 text-slate-400 w-full">No dramas found.</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'flex flex-col gap-2 cursor-pointer active:scale-95 transition-transform group fade-in';

        const badge = Math.random() > 0.5 ?
            `<div class="absolute top-1.5 right-1.5 px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded-full shadow-sm">HD</div>` :
            `<div class="absolute top-1.5 right-1.5 px-2 py-0.5 bg-secondary text-white text-[9px] font-bold rounded-full shadow-sm">HOT</div>`;

        const epCount = item.chapterCount ? item.chapterCount : '??';

        card.innerHTML = `
            <div class="relative aspect-[3/4] rounded-xl overflow-hidden shadow-sm bg-white border-2 border-white group-hover:border-primary/20 group-hover:shadow-md transition-all">
                <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                     src="${item.cover}" loading="lazy" alt="${item.title}">
                ${badge}
                <div class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-secondary/80 backdrop-blur-sm text-white text-[9px] font-bold rounded">EP ${epCount}</div>
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-4xl drop-shadow-lg">play_circle</span>
                </div>
            </div>
            <h3 class="text-[11px] md:text-sm font-bold leading-tight line-clamp-2 text-slate-700 group-hover:text-primary transition-colors">${item.title}</h3>
        `;
        card.onclick = () => openDetail(item.bookId);
        grid.appendChild(card);
    });
}

function openDetail(bookId) {
    currentDramaId = bookId;
    localStorage.setItem('lastDramaId', bookId);

    const modal = document.getElementById('detailModal');

    const setContent = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // Skeleton Loading State
    setContent('detailTitleMobile', '');
    setContent('detailTitleDesktop', '');
    setContent('detailIntro', '');

    const titleMobile = document.getElementById('detailTitleMobile');
    const titleDesktop = document.getElementById('detailTitleDesktop');
    const intro = document.getElementById('detailIntro');
    const cover = document.getElementById('detailCover');
    const epGrid = document.getElementById('episodesGrid');

    // Add skeleton classes
    if (titleMobile) { titleMobile.innerHTML = '<div class="skeleton h-6 w-3/4 mb-2"></div><div class="skeleton h-4 w-1/2"></div>'; }
    if (titleDesktop) { titleDesktop.innerHTML = '<div class="skeleton h-8 w-3/4 mb-2"></div>'; }
    if (intro) { intro.innerHTML = '<div class="skeleton h-4 w-full mb-2"></div><div class="skeleton h-4 w-full mb-2"></div><div class="skeleton h-4 w-2/3"></div>'; }
    if (cover) {
        cover.src = '';
        cover.parentElement.classList.add('skeleton'); // Add skeleton to container
    }

    // Episodes Skeleton
    epGrid.innerHTML = Array(5).fill('<div class="skeleton h-8 w-full rounded"></div>').join('');

    modal.classList.remove('hidden');

    fetch(`${API_BASE}/enviel/drama/detail/${bookId}`)
        .then(res => res.json())
        .then(result => {
            // Remove skeleton from cover container
            if (cover && cover.parentElement) cover.parentElement.classList.remove('skeleton');

            if (result.status) {
                const data = result.data;
                setContent('detailTitleMobile', data.title);
                setContent('detailTitleDesktop', data.title);
                setContent('detailIntro', data.intro);

                // Store episodes for immersive player
                currentEpisodes = data.episodes || [];

                const cover = document.getElementById('detailCover');
                if (cover) cover.src = data.cover;

                const totalEp = data.totalEpisodes || data.episodes?.length || 0;
                setContent('episodeTotalMobile', `Total Episodes: ${totalEp}`);
                setContent('episodeTotalDesktop', `${totalEp} Episodes`);

                const epGrid = document.getElementById('episodesGrid');
                epGrid.innerHTML = '';

                if (currentEpisodes.length > 0) {
                    currentEpisodes.forEach((ep, index) => {
                        const btn = document.createElement('button');
                        btn.className = 'bg-slate-100 hover:bg-primary hover:text-white text-xs py-2 rounded transition-colors truncate font-medium';
                        btn.textContent = ep.title.replace('Episode ', 'Ep ');
                        btn.onclick = () => {
                            // Determine if mobile or desktop to choose player
                            if (window.innerWidth < 768) {
                                openImmersivePlayer(index, data);
                            } else {
                                playVideo(ep.url);
                            }
                        };
                        epGrid.appendChild(btn);
                    });
                } else {
                    epGrid.innerHTML = '<p class="col-span-full text-center text-xs text-slate-400">No episodes available</p>';
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
        <div class="control-inner flex items-center gap-4 pointer-events-auto">
            <button class="play-btn bg-white/10 hover:bg-white/20 text-white rounded-full p-4 backdrop-blur-md shadow-lg pointer-events-auto" id="play-btn-${index}">
                <span class="material-symbols-outlined text-3xl">play_arrow</span>
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
