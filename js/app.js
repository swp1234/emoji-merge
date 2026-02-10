// === Emoji Merge - Evolution Puzzle Engine ===
(async function() {
    'use strict';

    // Initialize i18n with error handling
    try {
        await i18n.loadTranslations(i18n.getCurrentLanguage());
        i18n.updateUI();
    } catch (e) {
        console.warn('i18n load failed:', e.message);
    }

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

    // Leaderboard system
    let leaderboard = null;
    if (typeof LeaderboardManager !== 'undefined') {
        leaderboard = new LeaderboardManager('emoji-merge', 10);
    }

    // Dopamine enhancements
    let mergeCombo = 0;
    let lastMergeScore = 0;
    let reachedStages = {}; // Track which stages have been reached

    // Collection & Analytics
    let discoveredEmojis = {}; // Track discovered emoji values
    let totalMerges = 0; // Total merge count for milestone tracking
    let mergeHistory = []; // Last 5 merges
    let dailyChallenges = {}; // Daily challenge tracking
    let milestoneRewards = {}; // Milestone achievements

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

    // === Collection & Discovery System ===
    function updateDiscoveredEmojis() {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] > 0) {
                    discoveredEmojis[grid[r][c]] = true;
                }
            }
        }
    }

    function getCollectionStats() {
        const chain = EVOLUTION_CHAINS[currentChain];
        const allValues = Object.keys(chain.map).map(Number).sort((a, b) => a - b);
        const discovered = allValues.filter(v => discoveredEmojis[v]).length;
        const percentage = Math.round((discovered / allValues.length) * 100);
        return { discovered, total: allValues.length, percentage, allValues };
    }

    function trackMerge(fromValue, toValue) {
        totalMerges++;
        mergeHistory.unshift({ from: fromValue, to: toValue, time: Date.now() });
        if (mergeHistory.length > 5) mergeHistory.pop();

        // Update daily challenge
        const today = new Date().toDateString();
        if (!dailyChallenges[today]) {
            dailyChallenges[today] = {
                goal: getDailyGoal(),
                progress: 0,
                completed: false
            };
        }

        // Check if daily challenge is completed
        const dailyGoal = dailyChallenges[today].goal;
        if (dailyGoal.type === 'merges') {
            dailyChallenges[today].progress = totalMerges;
            if (totalMerges >= dailyGoal.target && !dailyChallenges[today].completed) {
                dailyChallenges[today].completed = true;
                showDailyChallengeComplete(dailyGoal);
            }
        }
    }

    function getDailyGoal() {
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        const goalTypes = [
            { type: 'merges', targets: [10, 20, 30] },
            { type: 'maxValue', targets: [256, 512, 1024] },
            { type: 'score', targets: [1000, 2000, 5000] }
        ];

        const goalType = goalTypes[seed % goalTypes.length];
        const target = goalType.targets[Math.floor(seed / goalTypes.length) % goalType.targets.length];

        return { type: goalType.type, target, seed };
    }

    function checkMilestones() {
        const milestones = [10, 50, 100, 500, 1000];
        for (const milestone of milestones) {
            if (totalMerges === milestone && !milestoneRewards[milestone]) {
                milestoneRewards[milestone] = true;
                score += milestone * 10;
                showMilestoneReward(milestone);
                return true;
            }
        }
        return false;
    }

    function showMilestoneReward(milestone) {
        const badge = document.createElement('div');
        badge.className = 'milestone-reward-badge';
        badge.innerHTML = `
            <div class="milestone-emoji">🏅</div>
            <div class="milestone-text">${i18n.t('collection.milestoneReached')}</div>
            <div class="milestone-count">${milestone} ${i18n.t('collection.merges')}</div>
            <div class="milestone-bonus">+${milestone * 10} ${i18n.t('game.score')}</div>
        `;
        document.body.appendChild(badge);
        triggerScreenFlash('flash-success', 150);
        if (sfx) sfx.levelUp();
        setTimeout(() => badge.remove(), 1300);
    }

    function showDailyChallengeComplete(goal) {
        const banner = document.createElement('div');
        banner.className = 'daily-challenge-complete';
        const goalText = goal.type === 'merges' ? `${goal.target} ${i18n.t('collection.merges')}` :
                        goal.type === 'maxValue' ? `${getEmoji(goal.target)} ${i18n.t('collection.create')}` :
                        `${goal.target} ${i18n.t('game.score')}`;
        banner.innerHTML = `
            <span class="icon">⭐</span>
            <div>${i18n.t('collection.dailyComplete')}: ${goalText}</div>
        `;
        document.body.appendChild(banner);
        if (sfx) sfx.levelUp();
        setTimeout(() => banner.remove(), 1500);
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
        // Improved difficulty curve: always spawn 2 early game, then gradually 90%
        // First 5 moves: 100% chance of 2 (easier early game for flow state)
        // Moves 6-15: 95% chance of 2
        // Moves 15+: 90% chance of 2 (normal difficulty)
        let prob2 = 0.9;
        if (moveCount <= 5) prob2 = 1.0;
        else if (moveCount <= 15) prob2 = 0.95;

        const value = Math.random() < prob2 ? 2 : 4;
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

        // Dopamine effects on move
        mergeCombo++;
        lastMergeScore = scoreGain;

        // Track merges and discoveries
        for (const merge of merges) {
            trackMerge(merge.fromIds[0], merge.newValue);
            updateDiscoveredEmojis();
            checkMilestones();
        }

        const currentMax = Math.max(...grid.flat(), 0);
        if (currentMax > maxTileEver) maxTileEver = currentMax;

        // Check for stage milestones
        const currentStage = getStageForValue(currentMax);
        if (currentStage && !reachedStages[currentStage.value]) {
            reachedStages[currentStage.value] = true;
            score += currentStage.bonus;
            showStagePopup(currentStage);
        }

        // Dopamine enhancement: screen effects and popups
        if (merges.length > 0) {
            triggerScreenShake(250);
            // Show score popup for first merge location
            if (merges.length > 0) {
                const firstMerge = merges[0];
                const pos = positionFor(firstMerge.toRow, firstMerge.toCol);
                spawnScorePopup(pos.left + pos.size / 2, pos.top + pos.size / 2, `+${scoreGain}`);
            }

            // Combo bonus every 5 merges
            if (mergeCombo % 5 === 0) {
                triggerScreenFlash('flash-success', 150);
                showMergeIndicator(scoreGain, mergeCombo);
                spawnConfetti(window.innerWidth / 2, window.innerHeight / 2, 15);
            }

            // Milestone every 500 score points
            const prevScoreMilestone = Math.floor((score - scoreGain) / 500);
            const newScoreMilestone = Math.floor(score / 500);
            if (newScoreMilestone > prevScoreMilestone) {
                const milestoneText = `${newScoreMilestone * 500} ${i18n.t('milestone.achievement') || '점 달성!'}`;
                showMilestoneBanner(milestoneText);
            }
        }

        // Animate
        animating = true;
        let moveCompleted = false;

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
            if (moveCompleted) return;
            moveCompleted = true;
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

                if (moveCount > 0 && moveCount % 100 === 0) triggerInterstitialAd();
            } catch(e) {
                console.error('Animation callback error:', e);
            } finally {
                animating = false;
            }
        }

        if (moves.length > 0 && sfx) sfx.swoosh();

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
        const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];  // IMPROVED: Added 4096 milestone
        const maxInGrid = Math.max(...grid.flat(), 0);

        let nextTargetIdx = -1;
        for (let i = 0; i < values.length; i++) {
            if (maxInGrid < values[i]) {
                nextTargetIdx = i;
                break;
            }
        }

        evolutionBar.innerHTML = values.map((v, i) => {
            const emoji = chain.map[v];
            const reached = maxInGrid >= v;
            const isNextTarget = i === nextTargetIdx;
            const arrow = i < values.length - 1 ? '<span class="evo-arrow">→</span>' : '';
            let badge = '';
            if (reached && i > 0) {
                // Check if this value was a stage milestone
                const stage = getStageForValue(v);
                if (stage && reachedStages[stage.value]) {
                    badge = '<span class="evo-badge">🎖️</span>';
                }
            }
            if (isNextTarget) {
                badge = '<span class="evo-target">⭐</span>';
            }
            return `<span class="evo-step${isNextTarget ? ' target' : ''}"><span class="evo-emoji${reached ? ' reached' : ''}">${emoji}</span>${badge}${arrow}</span>`;
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

    // === DOPAMINE EFFECT FUNCTIONS ===
    function triggerScreenShake(duration = 300) {
        const container = document.querySelector('.container');
        if (!container) return;
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), duration);
    }

    function triggerScreenFlash(color = 'flash', duration = 200) {
        const container = document.querySelector('.container');
        if (!container) return;
        container.classList.add(color);
        setTimeout(() => container.classList.remove(color), duration);
    }

    function spawnScorePopup(x, y, text) {
        const popup = document.createElement('div');
        popup.className = 'score-popup normal';
        popup.textContent = text;
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }

    function showMergeIndicator(score, combo) {
        const indicator = document.createElement('div');
        indicator.className = 'merge-indicator';
        indicator.style.left = '50%';
        indicator.style.top = '50%';
        indicator.style.transform = 'translate(-50%, -50%)';

        const text = document.createElement('div');
        text.className = 'merge-text';
        text.textContent = `+${score}!`;
        indicator.appendChild(text);

        document.body.appendChild(indicator);
        setTimeout(() => indicator.remove(), 600);
    }

    function spawnConfetti(x, y, count = 12) {
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = `confetti type-${(i % 5) + 1}`;
            confetti.style.left = x + 'px';
            confetti.style.top = y + 'px';
            confetti.style.transform = `translate(${(Math.random() - 0.5) * 200}px, 0) rotateZ(${Math.random() * 360}deg)`;

            document.body.appendChild(confetti);

            // Animate confetti fall
            const duration = 800 + Math.random() * 400;
            confetti.style.animation = `confetti-fall ${duration}ms linear forwards`;

            setTimeout(() => confetti.remove(), duration);
        }
    }

    function showMilestoneBanner(text) {
        const banner = document.createElement('div');
        banner.className = 'milestone-banner';
        banner.innerHTML = `
            <span class="icon">🎉</span>
            <div>${text}</div>
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 1000);
    }

    function showStagePopup(stage) {
        const overlay = document.createElement('div');
        overlay.className = 'stage-popup-overlay';
        const achievedText = window.i18n?.t('stage.achieved') || 'Achieved!';
        const bonusText = window.i18n?.t('stage.bonus') || 'Bonus Points!';
        overlay.innerHTML = `
            <div class="stage-popup">
                <div class="stage-emoji">${stage.emoji}</div>
                <div class="stage-title">${stage.name} ${achievedText}</div>
                <div class="stage-bonus">+${stage.bonus} ${bonusText}</div>
            </div>
        `;
        document.body.appendChild(overlay);

        triggerScreenFlash('flash-success', 150);
        if (sfx) sfx.levelUp();

        setTimeout(() => overlay.remove(), 1300);
    }

    // === Overlays ===
    function showGameOver() {
        if (finalScoreEl) finalScoreEl.textContent = score.toLocaleString();
        if (finalBestEl) finalBestEl.textContent = bestScore.toLocaleString();
        const maxVal = Math.max(...grid.flat());
        const finalMaxEmoji = document.getElementById('final-max-emoji');
        if (finalMaxEmoji) finalMaxEmoji.textContent = getEmoji(maxVal);
        const titleInfo = getTitleForScore(score);
        if (titleBadge) titleBadge.textContent = `${titleInfo.title} - ${titleInfo.desc}`;

        // Add stage stats to overlay
        const statsDiv = document.createElement('div');
        statsDiv.className = 'game-over-stats';
        const reachedStagesList = Object.keys(reachedStages)
            .map(v => getStageForValue(Number(v)))
            .filter(s => s)
            .map(s => `${s.emoji} ${s.name}`)
            .join(' • ');

        const totalMergesLabel = window.i18n?.t('stats.totalMerges') || 'Total Merges';
        const maxEmojiLabel = window.i18n?.t('stats.maxEmoji') || 'Max Emoji';
        const stagesLabel = window.i18n?.t('stats.stages') || 'Stages Reached';
        statsDiv.innerHTML = `
            <div class="stat-row">
                <span>${totalMergesLabel}</span>
                <span class="stat-value">${moveCount}</span>
            </div>
            <div class="stat-row">
                <span>${maxEmojiLabel}</span>
                <span class="stat-value">${getEmoji(maxVal)}</span>
            </div>
            ${reachedStagesList ? `<div class="stat-row"><span>${stagesLabel}</span><span class="stat-value">${reachedStagesList}</span></div>` : ''}
        `;

        // Insert stats after the title badge
        const badgeEl = document.querySelector('.overlay-title-badge');
        if (badgeEl && badgeEl.nextSibling) {
            badgeEl.parentNode.insertBefore(statsDiv, badgeEl.nextSibling);
        }

        // Dopamine effects on game over
        triggerScreenShake(500);
        triggerScreenFlash('flash-danger', 300);
        mergeCombo = 0; // Reset combo on game over

        // Add score to leaderboard
        if (leaderboard) {
            const leaderboardResult = leaderboard.addScore(score, {
                chain: currentChain,
                moves: moveCount,
                maxTile: maxVal
            });

            if (leaderboardResult.isNewRecord) {
                bestScore = score;
            }

            // Display leaderboard
            displayEmojiMergeLeaderboard(leaderboardResult);
        }

        if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
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
        mergeCombo = 0; // Reset combo at game start
        reachedStages = {}; // Reset stages for new game
        if (undoBtn) undoBtn.disabled = true;
        if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
        if (winOverlay) winOverlay.classList.add('hidden');

        // Clear game-over stats if exists
        const statsDiv = document.querySelector('.game-over-stats');
        if (statsDiv) statsDiv.remove();

        spawnTile(false);
        spawnTile(false);
        updateScoreDisplay();
        updateEvolutionBar();
        updateCollectionUI();
        saveState();
    }

    function undo() {
        if (!undoState) return;
        grid = undoState.grid;
        tileMap = undoState.tileMap;
        score = undoState.score;
        undoState = null;
        if (undoBtn) undoBtn.disabled = true;
        gameOver = false;
        animating = false;
        if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
        renderAll();
        updateScoreDisplay();
        updateEvolutionBar();
        saveState();
    }

    // === Persistence ===
    function saveState() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem('emojiMerge', JSON.stringify({
                grid, tileMap, nextTileId, score, bestScore,
                totalGames, maxTileEver, won, keepPlaying,
                gameOver, currentChain, moveCount, reachedStages,
                discoveredEmojis, totalMerges, mergeHistory, dailyChallenges, milestoneRewards
            }));
        } catch (e) {
            console.warn('Could not save game state:', e.message);
        }
    }

    function loadState() {
        try {
            if (typeof localStorage === 'undefined') return false;

            const saved = localStorage.getItem('emojiMerge');
            if (!saved) return false;

            let s = null;
            try {
                s = JSON.parse(saved);
            } catch (parseErr) {
                console.warn('Save data corrupted:', parseErr.message);
                localStorage.removeItem('emojiMerge');
                return false;
            }

            if (!s || typeof s !== 'object') return false;

            grid = s.grid || createEmpty();
            tileMap = s.tileMap || createEmpty();
            nextTileId = (s.nextTileId && !isNaN(s.nextTileId)) ? s.nextTileId : 1;
            score = (s.score && !isNaN(s.score)) ? s.score : 0;
            bestScore = (s.bestScore && !isNaN(s.bestScore)) ? s.bestScore : 0;
            totalGames = (s.totalGames && !isNaN(s.totalGames)) ? s.totalGames : 0;
            maxTileEver = (s.maxTileEver && !isNaN(s.maxTileEver)) ? s.maxTileEver : 0;
            won = !!s.won;
            keepPlaying = !!s.keepPlaying;
            gameOver = !!s.gameOver;
            currentChain = s.currentChain || 'animal';
            if (!EVOLUTION_CHAINS[currentChain]) currentChain = 'animal';
            moveCount = (s.moveCount && !isNaN(s.moveCount)) ? s.moveCount : 0;
            reachedStages = s.reachedStages || {};
            discoveredEmojis = s.discoveredEmojis || {};
            totalMerges = (s.totalMerges && !isNaN(s.totalMerges)) ? s.totalMerges : 0;
            mergeHistory = Array.isArray(s.mergeHistory) ? s.mergeHistory : [];
            dailyChallenges = s.dailyChallenges || {};
            milestoneRewards = s.milestoneRewards || {};

            if (!tileMap || tileMap.length !== SIZE) {
                tileMap = createEmpty();
                for (let r = 0; r < SIZE; r++)
                    for (let c = 0; c < SIZE; c++)
                        if (grid[r] && grid[r][c] !== 0)
                            tileMap[r][c] = nextTileId++;
            }
            return true;
        } catch (e) {
            console.warn('Error loading game state:', e.message);
            return false;
        }
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
    board.addEventListener('mouseup', (e) => {
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

    // === Collection UI ===
    function updateCollectionUI() {
        const stats = getCollectionStats();
        const collectionBtn = document.getElementById('btn-collection');
        if (collectionBtn) {
            collectionBtn.innerHTML = `
                <span style="font-size:16px">📖</span>
                <span data-i18n="collection.title">도감</span>
                <span class="collection-badge">${stats.discovered}/${stats.total}</span>
            `;
        }
    }

    function showCollectionModal() {
        const stats = getCollectionStats();
        const chain = EVOLUTION_CHAINS[currentChain];
        const modal = document.createElement('div');
        modal.className = 'modal hidden collection-modal';
        modal.id = 'collection-modal';

        const collectionGrid = stats.allValues.map(value => {
            const discovered = discoveredEmojis[value];
            const emoji = discovered ? chain.map[value] : '?';
            const name = discovered ? `${chain.map[value]} Lv.${Math.log2(value).toFixed(0)}` : '???';
            return `
                <div class="collection-item${discovered ? ' discovered' : ''}">
                    <div class="collection-emoji">${emoji}</div>
                    <div class="collection-name">${name}</div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-backdrop" id="collection-backdrop"></div>
            <div class="modal-content collection-content">
                <div class="modal-header">
                    <h3 class="modal-title" data-i18n="collection.title">Collection</h3>
                    <div class="collection-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${stats.percentage}%"></div>
                        </div>
                        <div class="progress-text">${stats.discovered}/${stats.total} (${stats.percentage}%)</div>
                    </div>
                </div>
                <div class="collection-grid">${collectionGrid}</div>
                <button class="modal-close" id="collection-close" data-i18n="game.close">Close</button>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hidden'), 10);

        document.getElementById('collection-backdrop').addEventListener('click', () => {
            modal.remove();
        });
        document.getElementById('collection-close').addEventListener('click', () => {
            modal.remove();
        });
    }

    function showMergeHistoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal hidden history-modal';
        modal.id = 'history-modal';

        const historyItems = mergeHistory.length > 0 ? mergeHistory.map((item, i) => `
            <div class="history-item">
                <span class="history-emoji">${getEmoji(item.from)}</span>
                <span class="history-arrow">→</span>
                <span class="history-emoji">${getEmoji(item.to)}</span>
                <span class="history-time">${new Date(item.time).toLocaleTimeString()}</span>
            </div>
        `).join('') : `<p class="history-empty" data-i18n="collection.noHistory">No merge history yet</p>`;

        const maxEmoji = Object.keys(discoveredEmojis).length > 0 ?
            getEmoji(Math.max(...Object.keys(discoveredEmojis).map(Number))) : '-';

        modal.innerHTML = `
            <div class="modal-backdrop" id="history-backdrop"></div>
            <div class="modal-content history-content">
                <div class="modal-header">
                    <h3 class="modal-title" data-i18n="collection.recentMerges">Recent Merges</h3>
                </div>
                <div class="history-stats">
                    <div class="history-stat">
                        <span class="stat-label" data-i18n="collection.totalMerges">Total Merges</span>
                        <span class="stat-value">${totalMerges}</span>
                    </div>
                    <div class="history-stat">
                        <span class="stat-label" data-i18n="collection.maxEmoji">Highest Emoji</span>
                        <span class="stat-value">${maxEmoji}</span>
                    </div>
                </div>
                <div class="history-list">${historyItems}</div>
                <button class="modal-close" id="history-close" data-i18n="game.close">Close</button>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hidden'), 10);

        document.getElementById('history-backdrop').addEventListener('click', () => {
            modal.remove();
        });
        document.getElementById('history-close').addEventListener('click', () => {
            modal.remove();
        });
    }

    function showDailyChallengeModal() {
        const today = new Date().toDateString();
        const challenge = dailyChallenges[today] || { goal: getDailyGoal(), progress: 0, completed: false };
        const goal = challenge.goal;
        const progress = challenge.progress;
        const isCompleted = challenge.completed;

        const goalText = goal.type === 'merges' ? `${goal.target} ${i18n.t('collection.merges')}` :
                        goal.type === 'maxValue' ? `${getEmoji(goal.target)} ${i18n.t('collection.create')}` :
                        `${goal.target} ${i18n.t('game.score')}`;

        const progressPercent = Math.min(100, Math.round((progress / (goal.type === 'merges' ? goal.target : goal.target)) * 100));

        const modal = document.createElement('div');
        modal.className = 'modal hidden daily-modal';
        modal.id = 'daily-modal';

        modal.innerHTML = `
            <div class="modal-backdrop" id="daily-backdrop"></div>
            <div class="modal-content daily-content">
                <div class="modal-header">
                    <h3 class="modal-title" data-i18n="collection.dailyChallenge">Daily Challenge</h3>
                </div>
                <div class="daily-challenge-container">
                    <div class="daily-goal">
                        <span class="goal-icon">⭐</span>
                        <span class="goal-text">${goalText}</span>
                    </div>
                    <div class="daily-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="progress-text">${progress}/${goal.type === 'merges' ? goal.target : goal.target}</div>
                    </div>
                    ${isCompleted ? `<div class="daily-badge">✅ ${window.i18n?.t('collection.dailyComplete') || 'Daily Challenge Complete'}</div>` : ''}
                </div>
                <button class="modal-close" id="daily-close" data-i18n="game.close">Close</button>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hidden'), 10);

        document.getElementById('daily-backdrop').addEventListener('click', () => {
            modal.remove();
        });
        document.getElementById('daily-close').addEventListener('click', () => {
            modal.remove();
        });
    }

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
        const titleLabel = i18n.t('premium.titleBadge') || '칭호';
        const text = `Emoji Merge\n${chainLabel}: ${chain.name}\n${maxEvoLabel}: ${getEmoji(maxVal)}\n${scoreLabel}: ${score.toLocaleString()}\n${titleLabel}: ${titleInfo.title}\n\nhttps://dopabrain.com/emoji-merge/`;
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
    document.getElementById('btn-retry')?.addEventListener('click', () => newGame());
    document.getElementById('btn-share')?.addEventListener('click', shareResult);
    document.getElementById('btn-continue').addEventListener('click', () => { keepPlaying = true; winOverlay.classList.add('hidden'); });
    document.getElementById('btn-new-after-win').addEventListener('click', () => { totalGames++; newGame(); });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => { if (!animating) renderAll(); }, 100);
    });

    // === Init ===
    function init() {
        const loaded = loadState();
        if (loaded && grid.flat().some(v => v > 0) && !gameOver) {
            renderAll();
            updateScoreDisplay();
            updateDiscoveredEmojis();
        } else {
            newGame();
        }
        updateEvolutionBar();
        updateStats();
        updateCollectionUI();

        // Setup collection UI event listeners
        const collectionBtn = document.getElementById('btn-collection');
        const historyBtn = document.getElementById('btn-history');
        const dailyBtn = document.getElementById('btn-daily');

        if (collectionBtn) collectionBtn.addEventListener('click', showCollectionModal);
        if (historyBtn) historyBtn.addEventListener('click', showMergeHistoryModal);
        if (dailyBtn) dailyBtn.addEventListener('click', showDailyChallengeModal);

        if (typeof gtag === 'function') {
            const pageTitle = i18n.t('analytics.pageTitle') || 'Emoji Merge';
            gtag('event', 'page_view', { page_title: pageTitle, page_location: window.location.href });
        }
    }

    function displayEmojiMergeLeaderboard(leaderboardResult) {
        if (!leaderboard) return;

        let leaderboardContainer = document.querySelector('.leaderboard-section');
        if (!leaderboardContainer) {
            leaderboardContainer = document.createElement('div');
            leaderboardContainer.className = 'leaderboard-section';
            if (gameOverOverlay) gameOverOverlay.appendChild(leaderboardContainer);
        }

        const topScores = leaderboard.getTopScores(5);
        let html = '<div class="leaderboard-title">🏆 Top 5 Scores</div>';
        html += '<div class="leaderboard-list">';

        topScores.forEach((entry, index) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const isCurrentScore = entry.score === score && leaderboardResult.isNewRecord;
            const classes = isCurrentScore ? 'leaderboard-item highlight' : 'leaderboard-item';

            html += `
                <div class="${classes}">
                    <span class="medal">${medals[index] || (index + 1) + '.'}</span>
                    <span class="score-value">${entry.score}</span>
                    <span class="score-date">${entry.date}</span>
                </div>
            `;
        });

        html += '</div>';

        leaderboardContainer.innerHTML = html;
    }

    try {
        init();
    } catch (e) {
        console.warn('Init error:', e);
    }

    // Hide app loader
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 300);
    }
})();
