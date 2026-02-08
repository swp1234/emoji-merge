// === Emoji Merge - Evolution Puzzle Engine ===
(function() {
    'use strict';

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

        for (const m of moves) {
            const el = tileElements[m.id];
            if (el) {
                const pos = positionFor(m.toR, m.toC);
                el.style.transition = `top ${ANIM_MOVE_MS}ms ease, left ${ANIM_MOVE_MS}ms ease`;
                el.style.top = pos.top + 'px';
                el.style.left = pos.left + 'px';
            }
        }

        setTimeout(() => {
            for (const merge of merges) {
                for (const oldId of merge.fromIds) removeTileEl(oldId);
                createTileEl(merge.mergeId, merge.newValue, merge.toRow, merge.toCol, false);
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
                setTimeout(() => showWin(), 200);
            }

            if (isGameOver()) {
                gameOver = true;
                totalGames++;
                saveState();
                setTimeout(() => showGameOver(), 300);
            }

            if (moveCount > 0 && moveCount % 20 === 0) triggerInterstitialAd();
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
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchActive = true;
    }, { passive: true });

    board.addEventListener('touchmove', (e) => { if (touchActive) e.preventDefault(); }, { passive: false });

    board.addEventListener('touchend', (e) => {
        if (!touchActive) return;
        touchActive = false;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });

    let mouseDown = false, mouseStartX = 0, mouseStartY = 0;
    board.addEventListener('mousedown', (e) => { mouseDown = true; mouseStartX = e.clientX; mouseStartY = e.clientY; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (mouseDown) e.preventDefault(); });
    document.addEventListener('mouseup', (e) => {
        if (!mouseDown) return;
        mouseDown = false;
        const dx = e.clientX - mouseStartX;
        const dy = e.clientY - mouseStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
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
        console.log('[AD] Interstitial at move', moveCount);
    }

    // === Premium ===
    function showInterstitialAd() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('interstitial-overlay');
            const closeBtn = document.getElementById('btn-close-ad');
            const countdown1 = document.getElementById('ad-countdown');
            const countdown2 = document.getElementById('ad-countdown-btn');

            overlay.classList.remove('hidden');
            closeBtn.disabled = true;
            closeBtn.textContent = '닫기 (5)';
            let seconds = 5;
            countdown1.textContent = seconds;
            countdown2.textContent = seconds;

            const timer = setInterval(() => {
                seconds--;
                countdown1.textContent = seconds;
                countdown2.textContent = seconds;
                closeBtn.textContent = `닫기 (${seconds})`;
                if (seconds <= 0) {
                    clearInterval(timer);
                    closeBtn.disabled = false;
                    closeBtn.textContent = '닫기';
                }
            }, 1000);

            closeBtn.addEventListener('click', function handler() {
                closeBtn.removeEventListener('click', handler);
                overlay.classList.add('hidden');
                resolve();
            });
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
            strategyTip = '빈 칸이 부족합니다! 한쪽 방향으로 밀어서 공간을 확보하세요. 큰 값은 모서리에 유지하는 것이 좋습니다.';
        } else if (maxVal >= 512) {
            strategyTip = '최종 진화에 가까워지고 있습니다! 최고 값 타일을 모서리에 고정하고, 인접 타일을 순서대로 정렬하세요.';
        } else if (maxVal >= 128) {
            strategyTip = '좋은 흐름입니다! 한 방향(왼쪽 또는 아래)을 주로 사용하면서 큰 값을 한쪽에 모으세요.';
        } else {
            strategyTip = '초반에는 한 방향을 위주로 이동하면서 감을 잡으세요. 되돌리기를 활용하면 더 높은 점수를 얻을 수 있습니다.';
        }

        // Prediction
        const predictedMax = Math.min(2048, maxVal * (emptyCellCount > 4 ? 4 : 2));

        const content = document.getElementById('premium-content');
        content.innerHTML = `
            <div class="premium-stat-grid">
                <div class="premium-stat"><span class="stat-val">${score.toLocaleString()}</span><span class="stat-lbl">현재 점수</span></div>
                <div class="premium-stat"><span class="stat-val">${efficiency}</span><span class="stat-lbl">이동당 점수</span></div>
                <div class="premium-stat"><span class="stat-val">${moveCount}</span><span class="stat-lbl">총 이동 수</span></div>
                <div class="premium-stat"><span class="stat-val">${densityScore}%</span><span class="stat-lbl">보드 밀도</span></div>
            </div>
            <div class="premium-analysis-item">
                <h4>🏆 칭호: ${titleInfo.title}</h4>
                <p>${titleInfo.desc} - ${chain.name} 체인으로 ${getEmoji(maxVal)} (레벨 ${maxLevel})까지 진화했습니다.</p>
            </div>
            <div class="premium-analysis-item">
                <h4>📊 보드 상태</h4>
                <p>빈 칸 ${emptyCellCount}개, 채워진 칸 ${filledCells}개. ${Object.entries(valueCounts).map(([v, c]) => `${getEmoji(Number(v))}×${c}`).join(' ')}</p>
            </div>
            <div class="premium-analysis-item">
                <h4>💡 전략 팁</h4>
                <p>${strategyTip}</p>
            </div>
            <div class="premium-analysis-item">
                <h4>🔮 예상 최대 진화</h4>
                <p>현재 흐름이라면 ${getEmoji(predictedMax)} (${predictedMax})까지 도달할 수 있습니다. ${predictedMax >= 2048 ? '최종 진화 달성이 가능합니다!' : '조금 더 전략적으로 플레이해보세요.'}</p>
            </div>
        `;

        document.getElementById('premium-result').classList.remove('hidden');
        document.getElementById('premium-result').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    document.getElementById('btn-premium').addEventListener('click', async () => {
        if (score === 0 && moveCount === 0) {
            alert('먼저 게임을 플레이해주세요!');
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
        const text = `이모지 머지 - 진화 퍼즐\n체인: ${chain.name}\n최고 진화: ${getEmoji(maxVal)}\n점수: ${score.toLocaleString()}\n칭호: ${titleInfo.title}\n\nhttps://dopabrain.com/emoji-merge/`;
        if (navigator.share) {
            navigator.share({ title: '이모지 머지 결과', text });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => alert('결과가 복사되었습니다!'));
        }
    }

    // === Events ===
    document.getElementById('btn-new').addEventListener('click', () => {
        if (score > 0 && !gameOver) {
            if (!confirm('현재 게임을 포기하고 새 게임을 시작할까요?')) return;
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
