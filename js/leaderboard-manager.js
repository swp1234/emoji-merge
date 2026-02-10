/**
 * Leaderboard Manager - Unified High Score Management
 * 모든 게임에서 사용할 수 있는 통일된 리더보드 시스템
 *
 * Usage:
 * const leaderboard = new LeaderboardManager('color-memory');
 * leaderboard.addScore(score, metadata);
 * const top10 = leaderboard.getTopScores(10);
 * const isNewRecord = leaderboard.isNewRecord(score);
 */

class LeaderboardManager {
    constructor(gameName, maxScores = 10) {
        this.gameName = gameName;
        this.maxScores = maxScores;
        this.storageKey = `dopabrain_${gameName}_highscores`;

        // StorageManager 인스턴스 생성
        this.storage = new StorageManager(`leaderboard_${gameName}`);
    }

    /**
     * 새로운 기록 추가
     * @param {number} score - 점수
     * @param {object} metadata - 추가 정보 (선택사항)
     * @returns {object} { isNewRecord: boolean, rank: number, notifications: array }
     */
    addScore(score, metadata = {}) {
        if (typeof score !== 'number' || isNaN(score) || score < 0) {
            console.warn(`[LeaderboardManager] Invalid score: ${score}`);
            return { isNewRecord: false, rank: -1, notifications: [] };
        }

        const scores = this.getScores();
        const timestamp = new Date();
        const dateStr = timestamp.toLocaleDateString();

        const newEntry = {
            score,
            date: dateStr,
            timestamp: timestamp.getTime(),
            ...metadata
        };

        // 기존 점수와 비교
        let isNewRecord = false;
        let rank = scores.length + 1;

        // 최고 기록 갱신 체크
        if (scores.length === 0 || score > scores[0].score) {
            isNewRecord = true;
            rank = 1;
        }

        // 상위 10개에 들어가는지 체크
        if (scores.length < this.maxScores) {
            scores.push(newEntry);
            rank = scores.length;
        } else if (score > scores[this.maxScores - 1].score) {
            scores[this.maxScores - 1] = newEntry;
            // 정렬
            scores.sort((a, b) => b.score - a.score);
            rank = scores.indexOf(newEntry) + 1;
        } else {
            // 상위 10개에 들지 않음
            return { isNewRecord: false, rank: -1, notifications: [] };
        }

        // 정렬
        scores.sort((a, b) => b.score - a.score);

        // 저장
        try {
            this.storage.setArray('scores', scores);
        } catch (e) {
            console.error(`[LeaderboardManager] Failed to save scores:`, e.message);
        }

        // 알림 생성
        const notifications = [];
        if (isNewRecord) {
            notifications.push({
                type: 'new-record',
                message: `🏆 New Personal Record! ${score.toLocaleString()} points!`,
                score,
                rank: 1
            });
        } else {
            notifications.push({
                type: 'leaderboard',
                message: `🎯 Score #${rank} on Leaderboard!`,
                score,
                rank
            });
        }

        return { isNewRecord, rank, notifications };
    }

    /**
     * 모든 점수 조회
     * @returns {array} 점수 배열 (내림차순)
     */
    getScores() {
        try {
            const scores = this.storage.getArray('scores', []);
            return Array.isArray(scores) ? scores.sort((a, b) => b.score - a.score) : [];
        } catch (e) {
            console.warn(`[LeaderboardManager] Failed to load scores:`, e.message);
            return [];
        }
    }

    /**
     * 상위 N개 점수 조회
     * @param {number} limit - 조회할 개수 (기본값 10)
     * @returns {array} 상위 점수 배열
     */
    getTopScores(limit = 10) {
        const scores = this.getScores();
        return scores.slice(0, limit);
    }

    /**
     * 최고 기록 조회
     * @returns {number} 최고 점수 (없으면 0)
     */
    getHighScore() {
        const scores = this.getScores();
        return scores.length > 0 ? scores[0].score : 0;
    }

    /**
     * 특정 순위의 기록 조회
     * @param {number} rank - 순위 (1부터 시작)
     * @returns {object|null} 기록 객체 또는 null
     */
    getScoreByRank(rank) {
        const scores = this.getScores();
        if (rank < 1 || rank > scores.length) return null;
        return scores[rank - 1];
    }

    /**
     * 신기록 여부 확인
     * @param {number} score - 점수
     * @returns {boolean} 신기록이면 true
     */
    isNewRecord(score) {
        if (typeof score !== 'number' || isNaN(score)) return false;
        const highScore = this.getHighScore();
        return score > highScore;
    }

    /**
     * 상위 몇 위인지 확인
     * @param {number} score - 점수
     * @returns {number} 순위 (상위 N개에 들면 N, 아니면 -1)
     */
    getRank(score) {
        const scores = this.getScores();
        let rank = scores.findIndex(s => s.score <= score) + 1;
        if (rank > this.maxScores) rank = -1;
        return rank;
    }

    /**
     * 모든 기록 리셋
     */
    resetScores() {
        try {
            this.storage.removeItem('scores');
        } catch (e) {
            console.error(`[LeaderboardManager] Failed to reset scores:`, e.message);
        }
    }

    /**
     * 기록 삭제 (특정 순위)
     * @param {number} rank - 순위
     */
    deleteScore(rank) {
        const scores = this.getScores();
        if (rank < 1 || rank > scores.length) return;

        scores.splice(rank - 1, 1);

        try {
            this.storage.setArray('scores', scores);
        } catch (e) {
            console.error(`[LeaderboardManager] Failed to delete score:`, e.message);
        }
    }

    /**
     * 리더보드를 HTML 형식으로 생성
     * @returns {string} HTML 문자열
     */
    generateHTML() {
        const scores = this.getTopScores(10);

        if (scores.length === 0) {
            return '<div class="leaderboard-empty">No records yet. Be the first to set a record!</div>';
        }

        let html = '<div class="leaderboard-container">';
        html += '<div class="leaderboard-header">🏆 Top Scores</div>';

        scores.forEach((score, index) => {
            const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            html += `
                <div class="leaderboard-entry">
                    <div class="leaderboard-rank">${rankBadge}</div>
                    <div class="leaderboard-score">${score.score.toLocaleString()}</div>
                    <div class="leaderboard-date">${score.date}</div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * 기록 통계 조회
     * @returns {object} 통계 객체
     */
    getStats() {
        const scores = this.getScores();

        if (scores.length === 0) {
            return {
                count: 0,
                highScore: 0,
                averageScore: 0,
                lowestScore: 0
            };
        }

        const allScores = scores.map(s => s.score);
        const sum = allScores.reduce((a, b) => a + b, 0);

        return {
            count: scores.length,
            highScore: allScores[0],
            averageScore: Math.round(sum / allScores.length),
            lowestScore: allScores[allScores.length - 1]
        };
    }

    /**
     * 지정된 날짜 이후의 기록 조회
     * @param {Date} date - 기준 날짜
     * @returns {array} 기록 배열
     */
    getScoresSince(date) {
        const scores = this.getScores();
        const timestamp = date.getTime();
        return scores.filter(s => s.timestamp >= timestamp);
    }

    /**
     * 저장소 상태 정보
     * @returns {object} 상태 정보
     */
    getStatus() {
        return {
            gameName: this.gameName,
            storageKey: this.storageKey,
            maxScores: this.maxScores,
            currentScoreCount: this.getScores().length,
            highScore: this.getHighScore(),
            stats: this.getStats(),
            storage: this.storage.getStatus()
        };
    }
}

// 글로벌 인스턴스 생성
window.LeaderboardManager = LeaderboardManager;
