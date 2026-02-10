/**
 * Global Error Handler Utility
 * 모든 앱에서 공통으로 사용하는 에러 핸들러
 */

class ErrorHandler {
    constructor() {
        this.setupGlobalErrorHandlers();
        this.errorTimeout = null;
    }

    // 전역 에러 핸들러 설정
    setupGlobalErrorHandlers() {
        // Uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError(
                event.error || new Error(event.message),
                'Uncaught Error'
            );
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(
                event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
                'Unhandled Promise Rejection'
            );
        });

        // Console error interception
        const originalError = console.error;
        console.error = (...args) => {
            originalError.apply(console, args);
            if (args[0] instanceof Error) {
                this.handleError(args[0], 'Console Error');
            }
        };
    }

    // 에러 처리 메인 함수
    handleError(error, context = '') {
        console.error(`[${context}]`, error);

        // 사용자에게 표시할 메시지 결정
        const userMessage = this.getUserFriendlyMessage(error);

        // UI에 에러 표시
        this.showErrorUI(userMessage, error);

        // 분석용으로 에러 로깅 (선택사항)
        if (typeof gtag === 'function') {
            gtag('event', 'exception', {
                description: `${context}: ${error.message}`,
                fatal: false
            });
        }
    }

    // 사용자 친화적 메시지 생성
    getUserFriendlyMessage(error) {
        const message = error.message || String(error);

        if (message.includes('localStorage') || message.includes('Storage')) {
            return '개인 정보 보호 모드에서는 일부 기능이 제한될 수 있습니다. 계속 사용 가능합니다.';
        }

        if (message.includes('JSON.parse') || message.includes('JSON')) {
            return '데이터 로드 중 문제가 발생했습니다. 페이지를 새로고침해주세요.';
        }

        if (message.includes('Canvas') || message.includes('2d')) {
            return '그래픽 렌더링 중 문제가 발생했습니다. 다시 시도해주세요.';
        }

        if (message.includes('Audio') || message.includes('audioContext')) {
            return '음성 기능을 사용할 수 없습니다. 계속 진행하실 수 있습니다.';
        }

        if (message.includes('network') || message.includes('fetch')) {
            return '네트워크 연결을 확인해주세요. 다시 시도해주세요.';
        }

        // 기본 메시지
        return '문제가 발생했습니다. 페이지를 새로고침하거나 다시 시도해주세요.';
    }

    // 에러 UI 표시
    showErrorUI(message, error) {
        // 기존 에러 UI 제거
        const existing = document.getElementById('error-notification');
        if (existing) existing.remove();

        // 에러 알림 생성
        const notification = document.createElement('div');
        notification.id = 'error-notification';
        notification.setAttribute('role', 'alert');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 99999;
            max-width: 90%;
            animation: slideUp 0.3s ease;
        `;

        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        const icon = document.createElement('span');
        icon.style.fontSize = '18px';
        icon.textContent = '⚠️';

        const text = document.createElement('span');
        text.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            margin-left: auto;
        `;
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => notification.remove());

        container.appendChild(icon);
        container.appendChild(text);
        container.appendChild(closeBtn);
        notification.appendChild(container);

        document.body.appendChild(notification);

        // 자동 제거 (5초 후)
        if (this.errorTimeout) clearTimeout(this.errorTimeout);
        this.errorTimeout = setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // try-catch 래퍼
    static wrap(fn, context = '') {
        return function(...args) {
            try {
                return fn.apply(this, args);
            } catch (error) {
                new ErrorHandler().handleError(error, context);
            }
        };
    }

    // async 함수 래퍼
    static async asyncWrap(fn, context = '') {
        try {
            return await fn();
        } catch (error) {
            new ErrorHandler().handleError(error, context);
        }
    }
}

// 전역 인스턴스 생성
window.errorHandler = new ErrorHandler();

// CSS 애니메이션 추가
if (!document.getElementById('error-handler-styles')) {
    const style = document.createElement('style');
    style.id = 'error-handler-styles';
    style.textContent = `
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}
