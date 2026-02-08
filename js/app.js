// === 2048 Game Engine (Smooth Tile Animation) ===
(function() {
    'use strict';

    const SIZE = 4;
    const ANIM_MOVE_MS = 120;
    const ANIM_APPEAR_MS = 100;

    let grid = [];          // grid[r][c] = 0 or tile value
    let tileElements = {};  // id -> DOM element
    let nextTileId = 1;
    let tileMap = [];       // tileMap[r][c] = tile id or 0

    let score = 0;
    let bestScore = 0;
    let totalGames = 0;
    let maxTileEver = 0;
    let won = false;
    let keepPlaying = false;
    let gameOver = false;
    let animating = false;
    let undoState = null;
    let currentTheme = 'default';
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
    const themeModal = document.getElementById('theme-modal');
    const themeGrid = document.getElementById('theme-grid');
    const undoBtn = document.getElementById('btn-undo');
    const statGames = document.getElementById('stat-games');
    const statBest = document.getElementById('stat-best');
    const statMaxTile = document.getElementById('stat-max-tile');

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

    function fontSize(value, tileSize) {
        if (value < 100) return tileSize * 0.45;
        if (value < 1000) return tileSize * 0.38;
        if (value < 10000) return tileSize * 0.3;
        return tileSize * 0.24;
    }

    // === Grid Helpers ===
    function createEmpty() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    }

    function cloneGrid(g) {
        return g.map(r => [...r]);
    }

    function cloneMap(m) {
        return m.map(r => [...r]);
    }

    function emptyCells() {
        const cells = [];
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (grid[r][c] === 0) cells.push({ r, c });
        return cells;
    }

    // === Tile DOM Management ===
    function createTileEl(id, value, row, col, isNew) {
        const pos = positionFor(row, col);
        const el = document.createElement('div');
        el.className = 'tile';
        el.id = 'tile-' + id;
        if (value > 2048) el.classList.add('super');
        el.setAttribute('data-value', Math.min(value, 2048));
        el.style.width = pos.size + 'px';
        el.style.height = pos.size + 'px';
        el.style.top = pos.top + 'px';
        el.style.left = pos.left + 'px';
        el.style.fontSize = fontSize(value, pos.size) + 'px';
        el.textContent = value;

        if (isNew) {
            el.style.transform = 'scale(0)';
            el.style.opacity = '0';
        }

        tilesContainer.appendChild(el);
        tileElements[id] = el;
        return el;
    }

    function updateTileEl(id, value, row, col) {
        const el = tileElements[id];
        if (!el) return;
        const pos = positionFor(row, col);
        el.style.top = pos.top + 'px';
        el.style.left = pos.left + 'px';
        el.style.width = pos.size + 'px';
        el.style.height = pos.size + 'px';
        el.style.fontSize = fontSize(value, pos.size) + 'px';
        el.setAttribute('data-value', Math.min(value, 2048));
        if (value > 2048) el.classList.add('super');
        el.textContent = value;
    }

    function removeTileEl(id) {
        const el = tileElements[id];
        if (el) {
            el.remove();
            delete tileElements[id];
        }
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
            el.style.transform = 'scale(1.15)';
            setTimeout(() => {
                el.style.transform = 'scale(1)';
            }, ANIM_APPEAR_MS);
        });
    }

    // === Spawn Tile ===
    function spawnTile(animate) {
        const cells = emptyCells();
        if (cells.length === 0) return null;
        const cell = cells[Math.floor(Math.random() * cells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        grid[cell.r][cell.c] = value;
        const id = nextTileId++;
        tileMap[cell.r][cell.c] = id;
        createTileEl(id, value, cell.r, cell.c, animate);
        if (animate) {
            setTimeout(() => animateAppear(id), 20);
        }
        return { r: cell.r, c: cell.c, value, id };
    }

    // === Move Logic ===
    function move(direction) {
        if (gameOver || animating) return false;

        // Save undo
        const prevGrid = cloneGrid(grid);
        const prevMap = cloneMap(tileMap);
        const prevScore = score;
        const prevElements = { ...tileElements };

        // Prepare move data
        const merges = [];    // [{ fromIds: [id1, id2], toRow, toCol, newValue }]
        const moves = [];     // [{ id, fromR, fromC, toR, toC }]
        let scoreGain = 0;

        // Build traversal order
        const rowOrder = direction === 'down' ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const colOrder = direction === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];

        const newGrid = createEmpty();
        const newMap = createEmpty();
        const merged = createEmpty(); // tracks merged this turn

        if (direction === 'left' || direction === 'right') {
            for (const r of rowOrder) {
                // Collect tiles in the row in movement order
                const tiles = [];
                for (const c of colOrder) {
                    if (grid[r][c] !== 0) {
                        tiles.push({ value: grid[r][c], id: tileMap[r][c], origC: c });
                    }
                }
                // Place tiles
                let targetC = direction === 'left' ? 0 : SIZE - 1;
                const step = direction === 'left' ? 1 : -1;

                for (let i = 0; i < tiles.length; i++) {
                    if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
                        // Merge
                        const newVal = tiles[i].value * 2;
                        scoreGain += newVal;
                        newGrid[r][targetC] = newVal;

                        // Move both tiles to target, then merge
                        const mergeId = nextTileId++;
                        merges.push({
                            fromIds: [tiles[i].id, tiles[i + 1].id],
                            toRow: r, toCol: targetC,
                            newValue: newVal, mergeId
                        });
                        moves.push({ id: tiles[i].id, fromR: r, fromC: tiles[i].origC, toR: r, toC: targetC });
                        moves.push({ id: tiles[i + 1].id, fromR: r, fromC: tiles[i + 1].origC, toR: r, toC: targetC });

                        newMap[r][targetC] = mergeId;
                        targetC += step;
                        i++; // skip next
                    } else {
                        newGrid[r][targetC] = tiles[i].value;
                        newMap[r][targetC] = tiles[i].id;
                        if (tiles[i].origC !== targetC) {
                            moves.push({ id: tiles[i].id, fromR: r, fromC: tiles[i].origC, toR: r, toC: targetC });
                        }
                        targetC += step;
                    }
                }
            }
        } else {
            // up or down
            for (const c of colOrder) {
                const tiles = [];
                for (const r of rowOrder) {
                    if (grid[r][c] !== 0) {
                        tiles.push({ value: grid[r][c], id: tileMap[r][c], origR: r });
                    }
                }
                let targetR = direction === 'up' ? 0 : SIZE - 1;
                const step = direction === 'up' ? 1 : -1;

                for (let i = 0; i < tiles.length; i++) {
                    if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
                        const newVal = tiles[i].value * 2;
                        scoreGain += newVal;
                        newGrid[targetR][c] = newVal;

                        const mergeId = nextTileId++;
                        merges.push({
                            fromIds: [tiles[i].id, tiles[i + 1].id],
                            toRow: targetR, toCol: c,
                            newValue: newVal, mergeId
                        });
                        moves.push({ id: tiles[i].id, fromR: tiles[i].origR, fromC: c, toR: targetR, toC: c });
                        moves.push({ id: tiles[i + 1].id, fromR: tiles[i + 1].origR, fromC: c, toR: targetR, toC: c });

                        newMap[targetR][c] = mergeId;
                        targetR += step;
                        i++;
                    } else {
                        newGrid[targetR][c] = tiles[i].value;
                        newMap[targetR][c] = tiles[i].id;
                        if (tiles[i].origR !== targetR) {
                            moves.push({ id: tiles[i].id, fromR: tiles[i].origR, fromC: c, toR: targetR, toC: c });
                        }
                        targetR += step;
                    }
                }
            }
        }

        // Check if anything changed
        let changed = false;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (newGrid[r][c] !== grid[r][c]) { changed = true; break; }
            }
            if (changed) break;
        }
        if (!changed) return false;

        // Save undo
        undoState = { grid: prevGrid, tileMap: prevMap, score: prevScore };
        undoBtn.disabled = false;

        // Apply new state
        grid = newGrid;
        tileMap = newMap;
        score += scoreGain;
        if (score > bestScore) bestScore = score;
        moveCount++;

        // Track max tile
        const currentMax = Math.max(...grid.flat());
        if (currentMax > maxTileEver) maxTileEver = currentMax;

        // === Animate ===
        animating = true;

        // Step 1: Slide tiles to new positions
        for (const m of moves) {
            const el = tileElements[m.id];
            if (el) {
                const pos = positionFor(m.toR, m.toC);
                el.style.transition = `top ${ANIM_MOVE_MS}ms ease, left ${ANIM_MOVE_MS}ms ease`;
                el.style.top = pos.top + 'px';
                el.style.left = pos.left + 'px';
            }
        }

        // Step 2: After slide, handle merges and spawn
        setTimeout(() => {
            // Process merges
            for (const merge of merges) {
                // Remove old tiles
                for (const oldId of merge.fromIds) {
                    removeTileEl(oldId);
                }
                // Create merged tile
                createTileEl(merge.mergeId, merge.newValue, merge.toRow, merge.toCol, false);
                animateMerge(merge.mergeId);
            }

            // Score popup
            if (scoreGain > 0) {
                showScorePopup(scoreGain);
            }

            // Spawn new tile
            spawnTile(true);

            updateScoreDisplay();
            updateStats();
            saveState();

            // Check win
            if (!won && !keepPlaying && currentMax >= 2048) {
                won = true;
                setTimeout(() => showWin(), 200);
            }

            // Check game over
            if (isGameOver()) {
                gameOver = true;
                totalGames++;
                saveState();
                setTimeout(() => showGameOver(), 300);
            }

            // Interstitial ad trigger
            if (moveCount > 0 && moveCount % 20 === 0) {
                triggerInterstitialAd();
            }

            animating = false;
        }, ANIM_MOVE_MS + 10);

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

    // === Full Re-render (for undo, load, resize) ===
    function renderAll() {
        tilesContainer.innerHTML = '';
        tileElements = {};
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] !== 0) {
                    const id = tileMap[r][c];
                    createTileEl(id, grid[r][c], r, c, false);
                }
            }
        }
    }

    function updateScoreDisplay() {
        currentScoreEl.textContent = score.toLocaleString();
        bestScoreEl.textContent = bestScore.toLocaleString();
    }

    function updateStats() {
        statGames.textContent = totalGames;
        statBest.textContent = bestScore.toLocaleString();
        statMaxTile.textContent = maxTileEver;
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

    // === Game State ===
    function showGameOver() {
        finalScoreEl.textContent = score.toLocaleString();
        finalBestEl.textContent = bestScore.toLocaleString();
        const titleInfo = getTitleForScore(score);
        titleBadge.textContent = `${titleInfo.title} - ${titleInfo.desc}`;
        gameOverOverlay.classList.remove('hidden');
        if (typeof gtag === 'function') {
            gtag('event', 'game_over', {
                event_category: 'number_merge',
                score: score,
                max_tile: Math.max(...grid.flat()),
                moves: moveCount
            });
        }
    }

    function showWin() {
        winScoreEl.textContent = score.toLocaleString();
        winOverlay.classList.remove('hidden');
        if (typeof gtag === 'function') {
            gtag('event', 'game_win', {
                event_category: 'number_merge',
                score: score,
                moves: moveCount
            });
        }
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
        saveState();
    }

    // === Persistence ===
    function saveState() {
        const state = {
            grid, tileMap, nextTileId, score, bestScore,
            totalGames, maxTileEver, won, keepPlaying,
            gameOver, currentTheme, moveCount
        };
        try {
            localStorage.setItem('numberMerge2048', JSON.stringify(state));
        } catch (e) { /* quota */ }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem('numberMerge2048');
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
                currentTheme = s.currentTheme || 'default';
                moveCount = s.moveCount || 0;

                // Ensure tileMap has valid IDs
                if (!tileMap || tileMap.length !== SIZE) {
                    tileMap = createEmpty();
                    for (let r = 0; r < SIZE; r++)
                        for (let c = 0; c < SIZE; c++)
                            if (grid[r][c] !== 0)
                                tileMap[r][c] = nextTileId++;
                }
                return true;
            }
        } catch (e) { /* parse error */ }
        return false;
    }

    // === Input ===
    document.addEventListener('keydown', (e) => {
        if (themeModal && !themeModal.classList.contains('hidden')) return;
        const map = {
            ArrowLeft: 'left', ArrowRight: 'right',
            ArrowUp: 'up', ArrowDown: 'down',
            a: 'left', d: 'right', w: 'up', s: 'down'
        };
        const dir = map[e.key];
        if (dir) { e.preventDefault(); move(dir); }
    });

    // Touch
    let touchStartX = 0, touchStartY = 0, touchActive = false;
    const board = document.getElementById('game-board');

    board.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchActive = true;
    }, { passive: true });

    board.addEventListener('touchmove', (e) => {
        if (touchActive) e.preventDefault();
    }, { passive: false });

    board.addEventListener('touchend', (e) => {
        if (!touchActive) return;
        touchActive = false;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const minSwipe = 30;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < minSwipe) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            move(dx > 0 ? 'right' : 'left');
        } else {
            move(dy > 0 ? 'down' : 'up');
        }
    }, { passive: true });

    // Mouse drag
    let mouseDown = false, mouseStartX = 0, mouseStartY = 0;
    board.addEventListener('mousedown', (e) => {
        mouseDown = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => { if (mouseDown) e.preventDefault(); });
    document.addEventListener('mouseup', (e) => {
        if (!mouseDown) return;
        mouseDown = false;
        const dx = e.clientX - mouseStartX;
        const dy = e.clientY - mouseStartY;
        const minSwipe = 30;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < minSwipe) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            move(dx > 0 ? 'right' : 'left');
        } else {
            move(dy > 0 ? 'down' : 'up');
        }
    });

    // === Theme ===
    function applyTheme(themeId) {
        currentTheme = themeId;
        if (themeId === 'default') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', themeId);
        }
        saveState();
        renderThemeGrid();
    }

    function renderThemeGrid() {
        themeGrid.innerHTML = '';
        THEMES.forEach(t => {
            const opt = document.createElement('div');
            opt.className = 'theme-option' + (currentTheme === t.id ? ' active' : '');
            opt.innerHTML = `
                <div class="theme-preview">
                    ${t.colors.map(c => `<div class="theme-dot" style="background:${c}"></div>`).join('')}
                </div>
                <div class="theme-name">${t.name}</div>
            `;
            opt.addEventListener('click', () => applyTheme(t.id));
            themeGrid.appendChild(opt);
        });
    }

    // === Ad ===
    function triggerInterstitialAd() {
        console.log('[AD] Interstitial at move', moveCount);
    }

    // === Share ===
    function shareResult() {
        const maxTile = Math.max(...grid.flat());
        const titleInfo = getTitleForScore(score);
        const text = `숫자 합치기 2048\n점수: ${score.toLocaleString()}\n최고 타일: ${maxTile}\n칭호: ${titleInfo.title}\n\nhttps://swp1234.github.io/number-merge/`;
        if (navigator.share) {
            navigator.share({ title: '숫자 합치기 2048', text });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => alert('결과가 복사되었습니다!'));
        }
    }

    // === Event Listeners ===
    document.getElementById('btn-new').addEventListener('click', () => {
        if (score > 0 && !gameOver) {
            if (!confirm('현재 게임을 포기하고 새 게임을 시작할까요?')) return;
        }
        totalGames++;
        newGame();
    });

    document.getElementById('btn-undo').addEventListener('click', undo);

    document.getElementById('btn-theme').addEventListener('click', () => {
        renderThemeGrid();
        themeModal.classList.remove('hidden');
    });

    document.getElementById('theme-backdrop').addEventListener('click', () => {
        themeModal.classList.add('hidden');
    });

    document.getElementById('theme-close').addEventListener('click', () => {
        themeModal.classList.add('hidden');
    });

    document.getElementById('btn-retry').addEventListener('click', () => newGame());
    document.getElementById('btn-share').addEventListener('click', shareResult);
    document.getElementById('btn-continue').addEventListener('click', () => {
        keepPlaying = true;
        winOverlay.classList.add('hidden');
    });
    document.getElementById('btn-new-after-win').addEventListener('click', () => {
        totalGames++;
        newGame();
    });

    // Resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => renderAll(), 100);
    });

    // === Init ===
    function init() {
        const loaded = loadState();
        applyTheme(currentTheme);

        if (loaded && grid.flat().some(v => v > 0) && !gameOver) {
            renderAll();
            updateScoreDisplay();
        } else {
            newGame();
        }
        updateStats();

        if (typeof gtag === 'function') {
            gtag('event', 'page_view', {
                page_title: '숫자 합치기 2048',
                page_location: window.location.href
            });
        }
    }

    init();
})();
