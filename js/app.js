// === Emoji Merge - Evolution Puzzle Engine ===
(async function() {
    'use strict';

    // Initialize i18n
    await i18n.loadTranslations(i18n.getCurrentLanguage());
    i18n.updateUI();

    const langToggle = document.getElementById('lang-toggle');
    const langMenu = document.getElementById('lang-menu');
    const langOptions = document.querySelectorAll('.lang-option');

    document.querySelector(`[data-lang="${i18n.getCurrentLanguage()}"]`)?.classList.add('active');

    langToggle?.addEventListener('click', () => langMenu.classList.toggle('hidden'));

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language-selector')) langMenu?.classList.add('hidden');
    });

    langOptions.forEach(opt => {
        opt.addEventListener('click', async () => {
            await i18n.setLanguage(opt.getAttribute('data-lang'));
            langOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            langMenu.classList.add('hidden');
        });
    });

    const SIZE = 4;
    const ANIM_MOVE_MS = 120;
    const ANIM_APPEAR_MS = 100;

    let grid = [];
    let tileElements = {};
    let nextTileId = 1;
    let tileMap = [];

    let score = 0;
    let bestScore = 0;
    let totalGames = 0;
    let maxTileEver = 0;
    let won = false;
    let keepPlaying = false;
    let gameOver = false;
    let animating = false;
    let undoState = null;
    let currentChain = 'animal';
    let moveCount = 0;

    // DOM
    const tilesContainer = document.getElementById('tiles-container');
    const currentScoreEl = document.getElementById('current-score');
    const bestScoreEl = document.getElementById('best-score');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const winOverlay = document.getElementById('win-overlay');
    const finalScoreEl = document.getElementById('final-score');
    const finalBestEl = document.getElementById('final-best');
    const winScoreEl = document.getElementById('win-score');
    const titleBadge = document.getElementById('title-badge');
    const chainModal = document.getElementById('chain-modal');
    const chainGrid = document.getElementById('chain-grid');
    const undoBtn = document.getElementById('btn-undo');
    const statGames = document.getElementById('stat-games');
    const statBest = document.getElementById('stat-best');
    const statMaxEmoji = document.getElementById('stat-max-emoji');
    const evolutionBar = document.getElementById('evolution-bar');

    // === Emoji Helpers ===
    function getEmoji(value) {
        const chain = EVOLUTION_CHAINS[currentChain];
        if (!chain) return value;
        return chain.map[value] || '✨';
    }

    function getMaxReachedEmoji() {
        if (maxTileEver === 0) return '-';
        return getEmoji(maxTileEver);
    }

    // === Position Calculations ===
    function getBoardMetrics() {
        const board = document.getElementById('game-board');
        const boardSize = board.offsetWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell-gap')) || 8;
        const tileSize = (boardSize - gap * 5) / 4;
        return { boardSize, gap, tileSize };
    }

    function positionFor(row, col) {
        const { gap, tileSize } = getBoardMetrics();
        return {
            top: gap + row * (tileSize + gap),
            left: gap + col * (tileSize + gap),
            size: tileSize
        };
    }

    function emojiFontSize(tileSize) {
        return tileSize * 0.55;
    }

    // === Grid Helpers ===
    function createEmpty() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    }

    function cloneGrid(g) { return g.map(r => [...r]); }
    function cloneMap(m) { return m.map(r => [...r]); }

    function emptyCells() {
        const cells = [];
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (grid[r][c] === 0) cells.push({ r, c });
        return cells;
    }

    // === Tile DOM ===
    function createTileEl(id, value, row, col, isNew) {
        const pos = positionFor(row, col);
        const el = document.createElement('div');
        el.className = 'tile';
        el.id = 'tile-' + id;

        // Style
        const color = getTileColor(value);
        el.style.width = pos.size + 'px';
        el.style.height = pos.size + 'px';
        el.style.top = pos.top + 'px';
        el.style.left = pos.left + 'px';
        el.style.fontSize = emojiFontSize(pos.size) + 'px';
        el.style.background = color.bg;
        if (color.glow) {
            el.style.boxShadow = '0 0 16px rgba(244,162,97,0.3)';
        }

        el.textContent = getEmoji(value);

        if (isNew) {
            el.style.transform = 'scale(0)';
            el.style.opacity = '0';
        }

        tilesContainer.appendChild(el);
        tileElements[id] = el;
        return el;
    }

    function removeTileEl(id) {
        const el = tileElements[id];
        if (el) { el.remove(); delete tileElements[id]; }
    }

    function animateAppear(id) {
        const el = tileElements[id];
        if (!el) return;
        requestAnimationFrame(() => {
            el.style.transition = `transform ${ANIM_APPEAR_MS}ms ease, opacity ${ANIM_APPEAR_MS}ms ease`;
            el.style.transform = 'scale(1)';
            el.style.opacity = '1';
        });
    }

    function animateMerge(id) {
        const el = tileElements[id];
        if (!el) return;
        el.style.transition = 'none';
        el.style.transform = 'scale(1)';
        requestAnimationFrame(() => {
            el.style.transition = `transform ${ANIM_APPEAR_MS}ms ease`;
            el.style.transform = 'scale(1.2)';
            setTimeout(() => { el.style.transform = 'scale(1)'; }, ANIM_APPEAR_MS);
        });
    }

    // === Spawn ===
    function spawnTile(animate) {
        const cells = emptyCells();
        if (cells.length === 0) return null;
        const cell = cells[Math.floor(Math.random() * cells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        grid[cell.r][cell.c] = value;
        const id = nextTileId++;
        tileMap[cell.r][cell.c] = id;
        createTileEl(id, value, cell.r, cell.c, animate);
        if (animate) setTimeout(() => animateAppear(id), 20);
        return { r: cell.r, c: cell.c, value, id };
    }

    // === Move Logic ===
    function move(direction) {
        if (gameOver || animating) return false;

        const prevGrid = cloneGrid(grid);
        const prevMap = cloneMap(tileMap);
        const prevScore = score;

        const merges = [];
        const moves = [];
        let scoreGain = 0;

        const rowOrder = direction === 'down' ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const colOrder = direction === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];

        const newGrid = createEmpty();
        const newMap = createEmpty();

        if (direction === 'left' || direction === 'right') {
            for (const r of rowOrder) {
                const tiles = [];
                for (const c of colOrder) {
                    if (grid[r][c] !== 0)
                        tiles.push({ value: grid[r][c], id: tileMap[r][c], origC: c });
                }
                let targetC = direction === 'left' ? 0 : SIZE - 1;
                const step = direction === 'left' ? 1 : -1;

                for (let i = 0; i < tiles.length; i++) {
                    if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
                        const newVal = tiles[i].value * 2;
                        scoreGain += newVal;
                        newGrid[r][targetC] = newVal;
                        const mergeId = nextTileId++;
                        merges.push({ fromIds: [tiles[i].id, tiles[i + 1].id], toRow: r, toCol: targetC, newValue: newVal, mergeId });
                        moves.push({ id: tiles[i].id, toR: r, toC: targetC });
                        moves.push({ id: tiles[i + 1].id, toR: r, toC: targetC });
                        newMap[r][targetC] = mergeId;
                        targetC += step;
                        i++;
                    } else {
                        newGrid[r][targetC] = tiles[i].value;
                        newMap[r][targetC] = tiles[i].id;
                        if (tiles[i].origC !== targetC)
                            moves.push({ id: tiles[i].id, toR: r, toC: targetC });
                        targetC += step;
                    }
                }
            }
        } else {
            for (const c of colOrder) {
                const tiles = [];
                for (const r of rowOrder) {
                    if (grid[r][c] !== 0)
                        tiles.push({ value: grid[r][c], id: tileMap[r][c], origR: r });
                }
                let targetR = direction === 'up' ? 0 : SIZE - 1;
                const step = direction === 'up' ? 1 : -1;

                for (let i = 0; i < tiles.length; i++) {
                    if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
                        const newVal = tiles[i].value * 2;
                        scoreGain += newVal;
                        newGrid[targetR][c] = newVal;
                        const mergeId = nextTileId++;
                        merges.push({ fromIds: [tiles[i].id, tiles[i + 1].id], toRow: targetR, toCol: c, newValue: newVal, mergeId });
                        moves.push({ id: tiles[i].id, toR: targetR, toC: c });
                        moves.push({ id: tiles[i + 1].id, toR: targetR, toC: c });
                        newMap[targetR][c] = mergeId;
                        targetR += step;
                        i++;
                    } else {
                        newGrid[targetR][c] = tiles[i].value;
                        newMap[targetR][c] = tiles[i].id;
                        if (tiles[i].origR !== targetR)
                            moves.push({ id: tiles[i].id, toR: targetR, toC: c });
                        targetR += step;
                    }
                }
            }
        }

        // Changed?
        let changed = false;
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (newGrid[r][c] !== grid[r][c]) { changed = true; break; }
        if (!changed) return false;

        undoState = { grid: prevGrid, tileMap: prevMap, score: prevScore };
        undoBtn.disabled = false;

        grid = newGrid;
        tileMap = newMap;
        score += scoreGain;
        if (score > bestScore) bestScore = score;
        moveCount++;

        const currentMax = Math.max(...grid.flat());
        if (currentMax > maxTileEver) maxTileEver = currentMax;

        // Animate
        animating = true;

        // Use transitionend to safely complete animation
        let transitionCount = 0;
        const totalTransitions = moves.length;

        const onTransitionEnd = () => {
            transitionCount++;
            if (transitionCount >= totalTransitions) {
                completeMove();
            }
        };

        for (const m of moves) {
            const el = tileElements[m.id];
            if (el) {
                const pos = positionFor(m.toR, m.toC);
                el.style.transition = `top ${ANIM_MOVE_MS}ms ease, left ${ANIM_MOVE_MS}ms ease`;
                el.addEventListener('transitionend', onTransitionEnd, { once: true });
                el.style.top = pos.top + 'px';
                el.style.left = pos.left + 'px';
            }
        }

        // Fallback timeout in case transitionend doesn't fire
        const timeoutId = setTimeout(completeMove, ANIM_MOVE_MS + 50);

        function completeMove() {
            clearTimeout(timeoutId);
            try {
                for (const merge of merges) {
                    for (const oldId of merge.fromIds) removeTileEl(oldId);
                    createTileEl(merge.mergeId, merge.newValue, merge.toRow, merge.toCol, false);
                    if (sfx) sfx.merge();
                    animateMerge(merge.mergeId);
                }

                if (scoreGain > 0) showScorePopup(scoreGain);
                spawnTile(true);
                updateScoreDisplay();
                updateStats();
                updateEvolutionBar();
                saveState();

                if (!won && !keepPlaying && currentMax >= 2048) {
                    won = true;
                    if (sfx) sfx.levelUp();
                    setTimeout(() => showWin(), 200);
                }

                if (isGameOver()) {
                    gameOver = true;
                    totalGames++;
                    if (sfx) sfx.gameOver();
                    saveState();
                    setTimeout(() => showGameOver(), 300);
                }

                if (moveCount > 0 && moveCount % 50 === 0) triggerInterstitialAd();
            } catch(e) {
                console.error('Animation callback error:', e);
            } finally {
                animating = false;
            }
        }

        if (moves.length > 0 && sfx) sfx.swoosh();

        // If no moves, reset immediately
        if (moves.length === 0) {
            animating = false;
        }

        return true;
    }

    function isGameOver() {
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (grid[r][c] === 0) return false;
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++) {
                const v = grid[r][c];
                if (c + 1 < SIZE && grid[r][c + 1] === v) return false;
                if (r + 1 < SIZE && grid[r + 1][c] === v) return false;
            }
        return true;
    }

    // === Render All (undo, load, resize) ===
    function renderAll() {
        tilesContainer.innerHTML = '';
        tileElements = {};
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (grid[r][c] !== 0)
                    createTileEl(tileMap[r][c], grid[r][c], r, c, false);
    }

    // === Evolution Bar ===
    function updateEvolutionBar() {
        const chain = EVOLUTION_CHAINS[currentChain];
        if (!chain) return;
        const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
        const maxInGrid = Math.max(...grid.flat(), 0);

        evolutionBar.innerHTML = values.map((v, i) => {
            const emoji = chain.map[v];
            const reached = maxInGrid >= v;
            const arrow = i < values.length - 1 ? '<span class="evo-arrow">→</span>' : '';
            return `<span class="evo-step"><span class="evo-emoji${reached ? ' reached' : ''}">${emoji}</span>${arrow}</span>`;
        }).join('');
    }

    function updateScoreDisplay() {
        currentScoreEl.textContent = score.toLocaleString();
        bestScoreEl.textContent = bestScore.toLocaleString();
    }

    function updateStats() {
        statGames.textContent = totalGames;
        statBest.textContent = bestScore.toLocaleString();
        statMaxEmoji.textContent = getMaxReachedEmoji();
    }

    function showScorePopup(points) {
        const container = document.getElementById('score-popup-container');
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = '+' + points;
        popup.style.left = '50%';
        popup.style.top = '-20px';
        popup.style.transform = 'translateX(-50%)';
        container.appendChild(popup);
        setTimeout(() => popup.remove(), 700);
    }

    // === Overlays ===
    function showGameOver() {
        finalScoreEl.textContent = score.toLocaleString();
        finalBestEl.textContent = bestScore.toLocaleString();
        const maxVal = Math.max(...grid.flat());
        document.getElementById('final-max-emoji').textContent = getEmoji(maxVal);
        const titleInfo = getTitleForScore(score);
        titleBadge.textContent = `${titleInfo.title} - ${titleInfo.desc}`;
        gameOverOverlay.classList.remove('hidden');
        if (typeof gtag === 'function')
            gtag('event', 'game_over', { event_category: 'emoji_merge', score, max_tile: maxVal, chain: currentChain, moves: moveCount });
    }

    function showWin() {
        winScoreEl.textContent = score.toLocaleString();
        document.getElementById('win-emoji').textContent = getEmoji(2048);
        winOverlay.classList.remove('hidden');
        if (typeof gtag === 'function')
            gtag('event', 'game_win', { event_category: 'emoji_merge', score, chain: currentChain, moves: moveCount });
    }

    function newGame() {
        grid = createEmpty();
        tileMap = createEmpty();
        tilesContainer.innerHTML = '';
        tileElements = {};
        nextTileId = 1;
        score = 0;
        won = false;
        keepPlaying = false;
        gameOver = false;
        animating = false;
        undoState = null;
        moveCount = 0;
        undoBtn.disabled = true;
        gameOverOverlay.classList.add('hidden');
        winOverlay.classList.add('hidden');
        spawnTile(false);
        spawnTile(false);
        updateScoreDisplay();
        updateEvolutionBar();
        saveState();
    }

    function undo() {
        if (!undoState) return;
        grid = undoState.grid;
        tileMap = undoState.tileMap;
        score = undoState.score;
        undoState = null;
        undoBtn.disabled = true;
        gameOver = false;
        animating = false;
        gameOverOverlay.classList.add('hidden');
        renderAll();
        updateScoreDisplay();
        updateEvolutionBar();
        saveState();
    }

    // === Persistence ===
    function saveState() {
        try {
            localStorage.setItem('emojiMerge', JSON.stringify({
                grid, tileMap, nextTileId, score, bestScore,
                totalGames, maxTileEver, won, keepPlaying,
                gameOver, currentChain, moveCount
            }));
        } catch (e) {}
    }

    function loadState() {
        try {
            const saved = localStorage.getItem('emojiMerge');
            if (saved) {
                const s = JSON.parse(saved);
                grid = s.grid || createEmpty();
                tileMap = s.tileMap || createEmpty();
                nextTileId = s.nextTileId || 1;
                score = s.score || 0;
                bestScore = s.bestScore || 0;
                totalGames = s.totalGames || 0;
                maxTileEver = s.maxTileEver || 0;
                won = s.won || false;
                keepPlaying = s.keepPlaying || false;
                gameOver = s.gameOver || false;
                currentChain = s.currentChain || 'animal';
                if (!EVOLUTION_CHAINS[currentChain]) currentChain = 'animal';
                moveCount = s.moveCount || 0;

                if (!tileMap || tileMap.length !== SIZE) {
                    tileMap = createEmpty();
                    for (let r = 0; r < SIZE; r++)
                        for (let c = 0; c < SIZE; c++)
                            if (grid[r][c] !== 0)
                                tileMap[r][c] = nextTileId++;
                }
                return true;
            }
        } catch (e) {}
        return false;
    }

    // === Input ===
    document.addEventListener('keydown', (e) => {
        if (chainModal && !chainModal.classList.contains('hidden')) return;
        const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
        const dir = map[e.key];
        if (dir) { e.preventDefault(); move(dir); }
    });

    let touchStartX = 0, touchStartY = 0, touchActive = false;
    const board = document.getElementById('game-board');

    board.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) {
            touchActive = false;
            return;
        }
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchActive = true;
    }, { passive: true });

    board.addEventListener('touchmove', (e) => { if (touchActive && e.touches.length === 1) e.preventDefault(); }, { passive: false });

    board.addEventListener('touchend', (e) => {
        if (!touchActive || e.changedTouches.length === 0) {
            touchActive = false;
            return;
        }
        touchActive = false;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });

    let mouseDown = false, mouseStartX = 0, mouseStartY = 0;
    board.addEventListener('mousedown', (e) => {
        mouseDown = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (mouseDown) e.preventDefault();
    });
    document.addEventListener('mouseup', (e) => {
        if (!mouseDown) return;
        mouseDown = false;
        try {
            const dx = e.clientX - mouseStartX;
            const dy = e.clientY - mouseStartY;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
            move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        } catch(e) {
            console.error('Mouse move error:', e);
            mouseDown = false;
        }
    });

    // === Chain Selection ===
    function renderChainGrid() {
        chainGrid.innerHTML = '';
        Object.entries(EVOLUTION_CHAINS).forEach(([key, chain]) => {
            const opt = document.createElement('div');
            opt.className = 'chain-option' + (currentChain === key ? ' active' : '');
            const previewValues = [2, 4, 8, 16, 32, 64];
            opt.innerHTML = `
                <div class="chain-header">
                    <span class="chain-icon">${chain.icon}</span>
                    <span class="chain-name">${chain.name}</span>
                </div>
                <div class="chain-desc">${chain.desc}</div>
                <div class="chain-preview">${previewValues.map(v => chain.map[v]).join(' → ')}</div>
            `;
            opt.addEventListener('click', () => {
                if (currentChain !== key) {
                    currentChain = key;
                    renderAll();
                    updateEvolutionBar();
                    updateStats();
                    saveState();
                    renderChainGrid();
                }
            });
            chainGrid.appendChild(opt);
        });
    }

    // === Ad ===
    function triggerInterstitialAd() {
        showInterstitialAd();
    }

    // === Premium ===
    let adTimer = null;
    let adCloseHandler = null;

    function showInterstitialAd() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('interstitial-overlay');
            const closeBtn = document.getElementById('btn-close-ad');
            const countdown1 = document.getElementById('ad-countdown');

            // Clean up any previous ad state
            if (adTimer) { clearInterval(adTimer); adTimer = null; }
            if (adCloseHandler) {
                closeBtn.removeEventListener('click', adCloseHandler);
                adCloseHandler = null;
            }

            overlay.classList.remove('hidden');
            closeBtn.disabled = true;
            let seconds = 5;

            // Update countdown displays safely
            function updateCountdown(sec) {
                if (countdown1) countdown1.textContent = sec;
                const btnCountdown = document.getElementById('ad-countdown-btn');
                if (btnCountdown) btnCountdown.textContent = sec;
            }

            updateCountdown(seconds);

            adTimer = setInterval(() => {
                seconds--;
                updateCountdown(seconds);
                if (seconds <= 0) {
                    clearInterval(adTimer);
                    adTimer = null;
                    closeBtn.disabled = false;
                }
            }, 1000);

            // Fallback: force-enable close button after 6 seconds
            const fallbackTimeout = setTimeout(() => {
                if (adTimer) { clearInterval(adTimer); adTimer = null; }
                closeBtn.disabled = false;
            }, 6500);

            function closeAd() {
                clearTimeout(fallbackTimeout);
                if (adTimer) { clearInterval(adTimer); adTimer = null; }
                closeBtn.removeEventListener('click', closeAd);
                adCloseHandler = null;
                overlay.classList.add('hidden');
                resolve();
            }

            adCloseHandler = closeAd;
            closeBtn.addEventListener('click', closeAd);
        });
    }

    function generatePremiumAnalysis() {
        const maxVal = Math.max(...grid.flat(), 0);
        const filledCells = grid.flat().filter(v => v > 0).length;
        const emptyCellCount = 16 - filledCells;
        const chain = EVOLUTION_CHAINS[currentChain];
        const titleInfo = getTitleForScore(score);
        const efficiency = moveCount > 0 ? (score / moveCount).toFixed(1) : 0;
        const maxLevel = Math.log2(maxVal || 2);

        // Value distribution
        const valueCounts = {};
        grid.flat().filter(v => v > 0).forEach(v => {
            valueCounts[v] = (valueCounts[v] || 0) + 1;
        });

        // Board density score
        const densityScore = Math.round((filledCells / 16) * 100);

        // Strategy tips based on state
        let strategyTip = '';
        if (emptyCellCount <= 3) {
            strategyTip = i18n.t('premium.tooFewEmpty');
        } else if (maxVal >= 512) {
            strategyTip = i18n.t('premium.nearEnd');
        } else if (maxVal >= 128) {
            strategyTip = i18n.t('premium.goodFlow');
        } else {
            strategyTip = i18n.t('premium.beginnerTip');
        }

        // Prediction
        const predictedMax = Math.min(2048, maxVal * (emptyCellCount > 4 ? 4 : 2));

        const content = document.getElementById('premium-content');
        content.innerHTML = `
            <div class="premium-stat-grid">
                <div class="premium-stat"><span class="stat-val">${score.toLocaleString()}</span><span class="stat-lbl">${i18n.t('premium.currentScore')}</span></div>
                <div class="premium-stat"><span class="stat-val">${efficiency}</span><span class="stat-lbl">${i18n.t('premium.scorePerMove')}</span></div>
                <div class="premium-stat"><span class="stat-val">${moveCount}</span><span class="stat-lbl">${i18n.t('premium.totalMoves')}</span></div>
                <div class="premium-stat"><span class="stat-val">${densityScore}%</span><span class="stat-lbl">${i18n.t('premium.boardDensity')}</span></div>
            </div>
            <div class="premium-analysis-item">
                <h4>🏆 ${i18n.t('premium.titleBadge')}: ${titleInfo.title}</h4>
                <p>${titleInfo.desc} - ${chain.name} ${i18n.t('premium.chainWith')} ${getEmoji(maxVal)} (${i18n.t('premium.level')} ${maxLevel}) ${i18n.t('premium.until')}</p>
            </div>
            <div class="premium-analysis-item">
                <h4>📊 ${i18n.t('premium.boardStatus')}</h4>
                <p>${i18n.t('premium.emptyCount')} ${emptyCellCount}, ${i18n.t('premium.filledCount')} ${filledCells}. ${Object.entries(valueCounts).map(([v, c]) => `${getEmoji(Number(v))}×${c}`).join(' ')}</p>
            </div>
            <div class="premium-analysis-item">
                <h4>💡 ${i18n.t('premium.strategyTip')}</h4>
                <p>${strategyTip}</p>
            </div>
            <div class="premium-analysis-item">
                <h4>🔮 ${i18n.t('premium.predictedMax')}</h4>
                <p>${getEmoji(predictedMax)} (${predictedMax}). ${predictedMax >= 2048 ? i18n.t('premium.canAchieveMax') : i18n.t('premium.playMore')}</p>
            </div>
        `;

        document.getElementById('premium-result').classList.remove('hidden');
        document.getElementById('premium-result').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    document.getElementById('btn-premium').addEventListener('click', async () => {
        if (score === 0 && moveCount === 0) {
            alert(i18n.t('game.alertPlayFirst'));
            return;
        }
        await showInterstitialAd();
        generatePremiumAnalysis();
    });

    // === Share ===
    function shareResult() {
        const maxVal = Math.max(...grid.flat());
        const titleInfo = getTitleForScore(score);
        const chain = EVOLUTION_CHAINS[currentChain];
        const chainLabel = i18n.t('premium.chainWith');
        const maxEvoLabel = i18n.t('game.maxEvolution');
        const scoreLabel = i18n.t('game.score');
        const titleLabel = '칭호';
        const text = `Emoji Merge\n${chainLabel}: ${chain.name}\n${maxEvoLabel}: ${getEmoji(maxVal)}\n${scoreLabel}: ${score.toLocaleString()}\nTitle: ${titleInfo.title}\n\nhttps://dopabrain.com/emoji-merge/`;
        if (navigator.share) {
            navigator.share({ title: i18n.t('game.resultTitle'), text });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => alert(i18n.t('game.resultCopied')));
        }
    }

    // === Events ===
    document.getElementById('btn-new').addEventListener('click', () => {
        if (score > 0 && !gameOver) {
            if (!confirm(i18n.t('game.confirmNewGame'))) return;
        }
        totalGames++;
        newGame();
    });

    document.getElementById('btn-undo').addEventListener('click', undo);

    document.getElementById('btn-chain').addEventListener('click', () => {
        renderChainGrid();
        chainModal.classList.remove('hidden');
    });

    document.getElementById('chain-backdrop').addEventListener('click', () => chainModal.classList.add('hidden'));
    document.getElementById('chain-close').addEventListener('click', () => chainModal.classList.add('hidden'));
    document.getElementById('btn-retry').addEventListener('click', () => newGame());
    document.getElementById('btn-share').addEventListener('click', shareResult);
    document.getElementById('btn-continue').addEventListener('click', () => { keepPlaying = true; winOverlay.classList.add('hidden'); });
    document.getElementById('btn-new-after-win').addEventListener('click', () => { totalGames++; newGame(); });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => renderAll(), 100);
    });

    // === Init ===
    function init() {
        const loaded = loadState();
        if (loaded && grid.flat().some(v => v > 0) && !gameOver) {
            renderAll();
            updateScoreDisplay();
        } else {
            newGame();
        }
        updateEvolutionBar();
        updateStats();
        if (typeof gtag === 'function')
            gtag('event', 'page_view', { page_title: '이모지 머지', page_location: window.location.href });
    }

    init();
})();
