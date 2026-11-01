document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let allTracks = [];
    let currentTrackIndex = -1;
    let isPlaying = false;
    let isShuffle = false;
    let isRepeat = false;
    let likedSongs = JSON.parse(localStorage.getItem('sonora_liked')) || [];
    let customPlaylists = JSON.parse(localStorage.getItem('sonora_playlists')) || [];
    let activePlaylistId = null;

    // DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const audioElement = document.getElementById('audio-element');

    // Player UI
    const playPauseBtn = document.getElementById('control-play-pause');
    const prevBtn = document.getElementById('control-prev');
    const nextBtn = document.getElementById('control-next');
    const shuffleBtn = document.getElementById('control-shuffle');
    const repeatBtn = document.getElementById('control-repeat');
    const seekBar = document.getElementById('seek-bar');
    const volumeBar = document.getElementById('volume-bar');
    const muteBtn = document.getElementById('control-mute');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');
    const playerImg = document.getElementById('player-img');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const playerLikeBtn = document.getElementById('player-like-btn');

    // Check Authentication Status on Load
    fetch('/api/check-auth')
        .then(res => res.json())
        .then(data => {
            if (data.authenticated) {
                unlockApp();
            }
        });

    // Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('shared-password').value;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            
            if (data.success) {
                unlockApp();
            } else {
                loginError.textContent = data.error || 'Invalid password.';
            }
        } catch (err) {
            loginError.textContent = 'Server error during login.';
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
    });

    function unlockApp() {
        loginOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadMusicCatalogue();
        renderPlaylistsSidebar();
    }

    // Navigation System
    const navItems = document.querySelectorAll('.sidebar-menu li, .sidebar-playlists ul li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            document.querySelectorAll('.sidebar-menu li, .sidebar-playlists ul li').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'liked-view') renderLikedSongs();
            if (targetId === 'library-view') renderLibrary('all-songs');
        });
    });

    // Fetch Music Catalogue
    async function loadMusicCatalogue(searchQuery = '') {
        try {
            let url = '/api/music';
            if (searchQuery) url += `?search=${encodeURIComponent(searchQuery)}`;

            const res = await fetch(url);
            const data = await res.json();
            if (data && data.results) {
                allTracks = data.results;
                if (!searchQuery) {
                    renderHomeSections();
                    renderLibrary('all-songs');
                }
            }
        } catch (err) {
            console.error('Failed to load catalogue:', err);
        }
    }

    // Render Home Sections
    function renderHomeSections() {
        const trendingGrid = document.getElementById('trending-grid');
        const recentGrid = document.getElementById('recent-grid');
        
        trendingGrid.innerHTML = '';
        recentGrid.innerHTML = '';

        allTracks.slice(0, 6).forEach((track, index) => {
            trendingGrid.appendChild(createMediaCard(track, index));
        });

        allTracks.slice(6, 12).forEach((track, index) => {
            recentGrid.appendChild(createMediaCard(track, index + 6));
        });
    }

    // Create Media Card Component
    function createMediaCard(track, globalIndex) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <img src="${track.image || track.album_image}" alt="${track.name}">
            <h3>${track.name}</h3>
            <p>${track.artist_name}</p>
        `;
        card.addEventListener('click', () => {
            playTrack(globalIndex);
        });
        return card;
    }

    // Playback System
    function playTrack(index) {
        if (index < 0 || index >= allTracks.length) return;
        currentTrackIndex = index;
        const track = allTracks[currentTrackIndex];

        audioElement.src = track.audio;
        audioElement.play();
        isPlaying = true;
        updatePlayPauseButton();

        playerTitle.textContent = track.name;
        playerArtist.textContent = track.artist_name;
        playerImg.src = track.image || track.album_image;

        updateLikeButtonState(track.id);
    }

    playPauseBtn.addEventListener('click', () => {
        if (currentTrackIndex === -1 && allTracks.length > 0) {
            playTrack(0);
            return;
        }
        if (isPlaying) {
            audioElement.pause();
            isPlaying = false;
        } else {
            audioElement.play();
            isPlaying = true;
        }
        updatePlayPauseButton();
    });

    function updatePlayPauseButton() {
        playPauseBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    }

    nextBtn.addEventListener('click', () => {
        if (isShuffle) {
            playTrack(Math.floor(Math.random() * allTracks.length));
        } else {
            playTrack((currentTrackIndex + 1) % allTracks.length);
        }
    });

    prevBtn.addEventListener('click', () => {
        playTrack((currentTrackIndex - 1 + allTracks.length) % allTracks.length);
    });

    audioElement.addEventListener('ended', () => {
        if (isRepeat) {
            audioElement.play();
        } else {
            nextBtn.click();
        }
    });

    // Audio Progress & Seek
    audioElement.addEventListener('timeupdate', () => {
        if (audioElement.duration) {
            const progress = (audioElement.currentTime / audioElement.duration) * 100;
            seekBar.value = progress;
            currentTimeEl.textContent = formatTime(audioElement.currentTime);
            totalDurationEl.textContent = formatTime(audioElement.duration);
        }
    });

    seekBar.addEventListener('input', () => {
        if (audioElement.duration) {
            audioElement.currentTime = (seekBar.value / 100) * audioElement.duration;
        }
    });

    volumeBar.addEventListener('input', () => {
        audioElement.volume = volumeBar.value;
    });

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Liked Songs Feature
    playerLikeBtn.addEventListener('click', () => {
        if (currentTrackIndex === -1) return;
        const track = allTracks[currentTrackIndex];
        const index = likedSongs.findIndex(t => t.id === track.id);

        if (index > -1) {
            likedSongs.splice(index, 1);
            playerLikeBtn.classList.remove('liked');
            playerLikeBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        } else {
            likedSongs.push(track);
            playerLikeBtn.classList.add('liked');
            playerLikeBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
        }
        localStorage.setItem('sonora_liked', JSON.stringify(likedSongs));
    });

    function updateLikeButtonState(trackId) {
        const isLiked = likedSongs.some(t => t.id === trackId);
        if (isLiked) {
            playerLikeBtn.classList.add('liked');
            playerLikeBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
        } else {
            playerLikeBtn.classList.remove('liked');
            playerLikeBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        }
    }

    function renderLikedSongs() {
        const listEl = document.getElementById('liked-songs-list');
        const countEl = document.getElementById('liked-count');
        countEl.textContent = `${likedSongs.length} songs`;
        listEl.innerHTML = '';

        likedSongs.forEach((track, i) => {
            const row = document.createElement('div');
            row.className = 'track-row';
            row.innerHTML = `<span>${i + 1}</span> <b>${track.name}</b> - ${track.artist_name}`;
            row.addEventListener('click', () => {
                const globalIdx = allTracks.findIndex(t => t.id === track.id);
                if (globalIdx > -1) playTrack(globalIdx);
            });
            listEl.appendChild(row);
        });
    }

    // Dynamic Live Search System
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const searchResultsGrid = document.getElementById('search-results-grid');

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
            searchResultsGrid.innerHTML = '';
            return;
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/music?search=${encodeURIComponent(query)}`);
                const data = await res.json();
                
                searchResultsGrid.innerHTML = '';
                if (data && data.results && data.results.length > 0) {
                    // Update global track pool so searched songs can play seamlessly
                    allTracks = data.results;
                    data.results.forEach((track, idx) => {
                        searchResultsGrid.appendChild(createMediaCard(track, idx));
                    });
                } else {
                    searchResultsGrid.innerHTML = `<p style="color:var(--text-sub);">No tracks found for "${query}"</p>`;
                }
            } catch (err) {
                console.error('Search error:', err);
            }
        }, 400); // 400ms debounce
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        searchResultsGrid.innerHTML = '';
    });

    // Genre Filter Pills
    document.querySelectorAll('.genre-pill').forEach(pill => {
        pill.addEventListener('click', async () => {
            document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const genre = pill.getAttribute('data-genre');

            try {
                const res = await fetch(`/api/music?genre=${genre}`);
                const data = await res.json();
                if (data && data.results) {
                    allTracks = data.results;
                    searchResultsGrid.innerHTML = '';
                    data.results.forEach((track, idx) => {
                        searchResultsGrid.appendChild(createMediaCard(track, idx));
                    });
                }
            } catch (err) {
                console.error('Genre filter error:', err);
            }
        });
    });

    // Library Rendering
    function renderLibrary(tab) {
        const libContent = document.getElementById('library-content');
        libContent.innerHTML = '';

        if (tab === 'all-songs') {
            allTracks.forEach((track, idx) => {
                libContent.appendChild(createMediaCard(track, idx));
            });
        } else if (tab === 'custom-playlists') {
            customPlaylists.forEach(playlist => {
                const card = document.createElement('div');
                card.className = 'media-card';
                card.innerHTML = `
                    <div class="hero-icon" style="width:100%; aspect-ratio:1; font-size:32px;"><i class="fa-solid fa-music"></i></div>
                    <h3>${playlist.name}</h3>
                    <p>${playlist.tracks.length} songs</p>
                `;
                card.addEventListener('click', () => openPlaylistDetail(playlist.id));
                libContent.appendChild(card);
            });
        }
    }

    document.querySelectorAll('.lib-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            document.querySelectorAll('.lib-tab').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            renderLibrary(tabBtn.getAttribute('data-tab'));
        });
    });

    // Playlist Management
    document.getElementById('create-playlist-btn').addEventListener('click', () => {
        const name = prompt('Enter custom playlist name:');
        if (name) {
            const newPlaylist = {
                id: 'playlist_' + Date.now(),
                name: name,
                tracks: []
            };
            customPlaylists.push(newPlaylist);
            localStorage.setItem('sonora_playlists', JSON.stringify(customPlaylists));
            renderPlaylistsSidebar();
        }
    });

    function renderPlaylistsSidebar() {
        const playlistNavList = document.getElementById('playlist-nav-list');
        playlistNavList.innerHTML = `<li data-target="liked-view" class="liked-songs-nav"><i class="fa-solid fa-heart pulse"></i> Liked Songs</li>`;
        
        playlistNavList.querySelector('.liked-songs-nav').addEventListener('click', () => {
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById('liked-view').classList.add('active');
            renderLikedSongs();
        });

        customPlaylists.forEach(playlist => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-music"></i> ${playlist.name}`;
            li.addEventListener('click', () => openPlaylistDetail(playlist.id));
            playlistNavList.appendChild(li);
        });
    }

    function openPlaylistDetail(playlistId) {
        activePlaylistId = playlistId;
        const playlist = customPlaylists.find(p => p.id === playlistId);
        if (!playlist) return;

        document.getElementById('detail-playlist-name').textContent = playlist.name;
        document.getElementById('detail-playlist-count').textContent = `${playlist.tracks.length} songs`;
        
        const listEl = document.getElementById('playlist-tracks-list');
        listEl.innerHTML = '';
        playlist.tracks.forEach((track, i) => {
            const row = document.createElement('div');
            row.className = 'track-row';
            row.innerHTML = `<span>${i + 1}</span> <b>${track.name}</b> - ${track.artist_name}`;
            listEl.appendChild(row);
        });

        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById('playlist-detail-view').classList.add('active');
    }

    document.getElementById('delete-playlist-btn').addEventListener('click', () => {
        if (!activePlaylistId) return;
        customPlaylists = customPlaylists.filter(p => p.id !== activePlaylistId);
        localStorage.setItem('sonora_playlists', JSON.stringify(customPlaylists));
        activePlaylistId = null;
        renderPlaylistsSidebar();
        document.querySelector('[data-target="home-view"]').click();
    });
});
