const API_KEY = 'c8b7daae41ac4c6e99645993c7fec38e';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

let movies = [];
let currentPage = 1;
let isDragging = false;
let startX = 0, startY = 0, currentX = 0, currentY = 0;
let topCard = null;
let currentMovie = null;
let ratingValue = 0;

const state = {
    watchlist: JSON.parse(localStorage.getItem('cs_watchlist')) || [],
    rated: JSON.parse(localStorage.getItem('cs_rated')) || [],
    dislikes: JSON.parse(localStorage.getItem('cs_dislikes')) || []
};

const DOM = {
    stack: document.getElementById('card-stack'),
    genreSelect: document.getElementById('genre-select'),
    minRating: document.getElementById('min-rating'),
    ratingVal: document.getElementById('rating-val'),
    yearMin: document.getElementById('year-min'),
    yearMax: document.getElementById('year-max'),
    applyFilters: document.getElementById('apply-filters'),
    filterPanel: document.getElementById('filter-panel'),
    toggleFilter: document.getElementById('toggle-filter'),
    sidebar: document.getElementById('sidebar'),
    toggleSidebar: document.getElementById('toggle-sidebar'),
    closeSidebar: document.getElementById('close-sidebar'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    rateModal: document.getElementById('rate-modal'),
    infoModal: document.getElementById('info-modal'),
    rateTitle: document.getElementById('rate-title'),
    stars: document.querySelectorAll('.stars span'),
    submitRate: document.getElementById('submit-rate'),
    closeInfo: document.getElementById('close-info'),
    infoBody: document.getElementById('info-body'),
    btnDislike: document.getElementById('btn-dislike'),
    btnInfo: document.getElementById('btn-info'),
    btnRate: document.getElementById('btn-rate'),
    btnLike: document.getElementById('btn-like')
};

async function init() {
    await fetchGenres();
    await fetchMovies();
    setupEventListeners();
    renderSidebar();
}

async function fetchGenres() {
    try {
        const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=tr-TR`);
        const data = await res.json();
        data.genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            DOM.genreSelect.appendChild(opt);
        });
    } catch (e) {}
}

async function fetchMovies(reset = false) {
    if (reset) {
        movies = [];
        currentPage = 1;
        DOM.stack.innerHTML = '';
    }
    const genre = DOM.genreSelect.value;
    const minR = DOM.minRating.value;
    const yMin = DOM.yearMin.value;
    const yMax = DOM.yearMax.value;
    
    let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tr-TR&page=${currentPage}&vote_average.gte=${minR}&primary_release_date.gte=${yMin}-01-01&primary_release_date.lte=${yMax}-12-31`;
    if (genre) url += `&with_genres=${genre}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const newMovies = data.results.filter(m => m.poster_path && !isProcessed(m.id));
        movies = [...movies, ...newMovies];
        renderCards();
    } catch (e) {}
}

function isProcessed(id) {
    return state.watchlist.some(m => m.id === id) || 
           state.rated.some(m => m.id === id) || 
           state.dislikes.some(m => m.id === id);
}

function renderCards() {
    if (movies.length < 5) fetchMovies();
    
    const currentCards = Array.from(DOM.stack.children);
    const needed = 5 - currentCards.length;
    
    for (let i = 0; i < needed; i++) {
        if (movies.length === 0) break;
        const movie = movies.shift();
        const card = document.createElement('div');
        card.className = 'card';
        card.style.backgroundImage = `url(${IMG_URL}${movie.poster_path})`;
        card.dataset.id = movie.id;
        card.dataset.movie = JSON.stringify(movie);
        
        const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
        
        card.innerHTML = `
            <div class="card-info">
                <h2 class="card-title">${movie.title}</h2>
                <div class="card-meta">
                    <span>⭐ ${movie.vote_average.toFixed(1)}</span>
                    <span>📅 ${year}</span>
                </div>
                <p class="card-overview">${movie.overview}</p>
            </div>
        `;
        DOM.stack.prepend(card);
    }
    updateCardStyles();
}

function updateCardStyles() {
    const cards = Array.from(DOM.stack.children);
    cards.forEach((card, index) => {
        const reverseIndex = cards.length - 1 - index;
        card.style.transform = `translateY(${reverseIndex * -15}px) scale(${1 - reverseIndex * 0.05})`;
        card.style.zIndex = index;
        card.style.opacity = reverseIndex > 3 ? 0 : 1;
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    });
    topCard = DOM.stack.lastElementChild;
    if (topCard) {
        currentMovie = JSON.parse(topCard.dataset.movie);
        topCard.style.transition = 'none';
    }
}

function setupEventListeners() {
    DOM.minRating.addEventListener('input', e => DOM.ratingVal.textContent = e.target.value);
    DOM.toggleFilter.addEventListener('click', () => DOM.filterPanel.classList.toggle('hidden'));
    DOM.applyFilters.addEventListener('click', () => {
        DOM.filterPanel.classList.add('hidden');
        fetchMovies(true);
    });
    
    DOM.toggleSidebar.addEventListener('click', () => DOM.sidebar.classList.remove('hidden'));
    DOM.closeSidebar.addEventListener('click', () => DOM.sidebar.classList.add('hidden'));
    
    DOM.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.tabs.forEach(t => t.classList.remove('active'));
            DOM.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.target}`).classList.add('active');
        });
    });

    DOM.stack.addEventListener('mousedown', dragStart);
    DOM.stack.addEventListener('touchstart', dragStart, {passive: false});
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, {passive: false});
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);

    document.addEventListener('keydown', e => {
        if (!topCard || !DOM.rateModal.classList.contains('hidden') || !DOM.infoModal.classList.contains('hidden')) return;
        if (e.key === 'ArrowRight') handleSwipe('right');
        if (e.key === 'ArrowLeft') handleSwipe('left');
        if (e.key === 'ArrowUp') handleSwipe('up');
        if (e.key === 'ArrowDown') handleSwipe('down');
    });

    DOM.btnDislike.addEventListener('click', () => handleSwipe('left'));
    DOM.btnLike.addEventListener('click', () => handleSwipe('right'));
    DOM.btnRate.addEventListener('click', () => handleSwipe('up'));
    DOM.btnInfo.addEventListener('click', () => handleSwipe('down'));

    DOM.stars.forEach(star => {
        star.addEventListener('click', () => {
            ratingValue = parseInt(star.dataset.val);
            DOM.stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= ratingValue);
            });
        });
    });

    DOM.submitRate.addEventListener('click', () => {
        if (ratingValue > 0 && currentMovie) {
            saveToList('rated', { ...currentMovie, userRating: ratingValue });
            DOM.rateModal.classList.add('hidden');
            removeTopCard();
        }
    });

    DOM.closeInfo.addEventListener('click', () => {
        DOM.infoModal.classList.add('hidden');
        DOM.infoBody.innerHTML = '';
    });
}

function dragStart(e) {
    if (!topCard || e.target.closest('.controls')) return;
    if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    } else {
        startX = e.clientX;
        startY = e.clientY;
    }
    isDragging = true;
}

function dragMove(e) {
    if (!isDragging || !topCard) return;
    e.preventDefault();
    if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
    } else {
        currentX = e.clientX;
        currentY = e.clientY;
    }
    
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const rotate = deltaX * 0.05;
    
    topCard.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotate}deg)`;
}

function dragEnd() {
    if (!isDragging || !topCard) return;
    isDragging = false;
    
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    
    if (Math.abs(deltaX) > 100 || Math.abs(deltaY) > 100) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            handleSwipe(deltaX > 0 ? 'right' : 'left');
        } else {
            handleSwipe(deltaY > 0 ? 'down' : 'up');
        }
    } else {
        topCard.style.transition = 'transform 0.3s ease';
        topCard.style.transform = 'translate(0px, 0px) rotate(0deg)';
    }
    
    startX = 0; startY = 0; currentX = 0; currentY = 0;
}

function handleSwipe(direction) {
    if (!topCard) return;
    topCard.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    if (direction === 'right') {
        topCard.style.transform = `translate(${w}px, -100px) rotate(30deg)`;
        topCard.style.opacity = '0';
        saveToList('watchlist', currentMovie);
        setTimeout(removeTopCard, 300);
    } else if (direction === 'left') {
        topCard.style.transform = `translate(-${w}px, -100px) rotate(-30deg)`;
        topCard.style.opacity = '0';
        saveToList('dislikes', currentMovie);
        setTimeout(removeTopCard, 300);
    } else if (direction === 'up') {
        topCard.style.transform = `translate(0px, -${h}px) rotate(0deg)`;
        topCard.style.opacity = '0';
        openRateModal();
    } else if (direction === 'down') {
        topCard.style.transform = `translate(0px, 50px) rotate(0deg)`;
        setTimeout(() => {
            topCard.style.transition = 'transform 0.3s ease';
            topCard.style.transform = 'translate(0px, 0px) rotate(0deg)';
        }, 300);
        openInfoModal();
    }
}

function removeTopCard() {
    if (topCard && topCard.parentNode) {
        topCard.parentNode.removeChild(topCard);
    }
    renderCards();
}

function saveToList(listName, movie) {
    if (!state[listName].some(m => m.id === movie.id)) {
        state[listName].push(movie);
        localStorage.setItem(`cs_${listName}`, JSON.stringify(state[listName]));
        renderSidebar();
    }
}

function removeFromList(listName, id) {
    state[listName] = state[listName].filter(m => m.id !== id);
    localStorage.setItem(`cs_${listName}`, JSON.stringify(state[listName]));
    renderSidebar();
}

function renderSidebar() {
    const lists = ['watchlist', 'rated', 'dislikes'];
    lists.forEach(list => {
        const container = document.getElementById(`tab-${list}`);
        container.innerHTML = '';
        state[list].forEach(movie => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const ratingStr = movie.userRating ? `⭐ ${movie.userRating}/5` : `⭐ ${movie.vote_average.toFixed(1)}`;
            item.innerHTML = `
                <img src="${IMG_URL}${movie.poster_path}" alt="">
                <div class="list-item-info">
                    <h4>${movie.title}</h4>
                    <p>${ratingStr}</p>
                </div>
                <div class="list-item-actions">
                    <button onclick="removeFromList('${list}', ${movie.id})">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    });
}

function openRateModal() {
    DOM.rateTitle.textContent = currentMovie.title;
    ratingValue = 0;
    DOM.stars.forEach(s => s.classList.remove('active'));
    DOM.rateModal.classList.remove('hidden');
}

async function openInfoModal() {
    DOM.infoModal.classList.remove('hidden');
    DOM.infoBody.innerHTML = '<p style="text-align:center; color:var(--cyan);">Yükleniyor...</p>';
    
    try {
        const res = await fetch(`${BASE_URL}/movie/${currentMovie.id}?api_key=${API_KEY}&language=tr-TR&append_to_response=videos,credits`);
        const data = await res.json();
        
        const trailer = data.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
        const trailerHTML = trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>` : '';
        
        const castHTML = data.credits.cast.slice(0, 10).map(c => `
            <div class="cast-item">
                <img src="${c.profile_path ? IMG_URL + c.profile_path : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}" alt="">
                <p>${c.name}</p>
            </div>
        `).join('');

        const budget = data.budget > 0 ? `$${(data.budget / 1000000).toFixed(1)}M` : 'Bilinmiyor';

        DOM.infoBody.innerHTML = `
            ${trailerHTML}
            <div class="info-section">
                <h4>${data.title}</h4>
                <p style="font-size:14px; line-height:1.6; color:var(--text-light);">${data.overview}</p>
            </div>
            <div class="info-section" style="display:flex; gap:20px; font-size:13px; color:var(--cyan);">
                <span><strong>Bütçe:</strong> ${budget}</span>
                <span><strong>Süre:</strong> ${data.runtime} dk</span>
                <span><strong>Puan:</strong> ${data.vote_average.toFixed(1)}</span>
            </div>
            <div class="info-section">
                <h4>Oyuncular</h4>
                <div class="cast-list">${castHTML}</div>
            </div>
        `;
    } catch (e) {
        DOM.infoBody.innerHTML = '<p style="text-align:center; color:var(--pink);">Detaylar yüklenemedi.</p>';
    }
}

window.removeFromList = removeFromList;
init();