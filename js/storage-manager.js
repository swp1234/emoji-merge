/**
 * Storage Manager - Unified Storage Interface
 * localStorage와 메모리 저장소를 통합 관리
 * localStorage 접근 불가능 상황(개인정보 보호 모드)에서 메모리 백업 사용
 */

class StorageManager {
    constructor(namespace = 'app') {
        this.namespace = namespace;
        this.memoryStorage = {}; // 메모리 백업
        this.isLocalStorageAvailable = this.checkLocalStorage();
        this.isPrivateMode = !this.isLocalStorageAvailable;

        if (this.isPrivateMode) {
            console.warn(`[${this.namespace}] Private/incognito mode detected. Using memory storage.`);
        }
    }

    // localStorage 사용 가능 여부 확인
    checkLocalStorage() {
        try {
            if (typeof localStorage === 'undefined') return false;
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    // 데이터 저장
    setItem(key, value) {
        const prefixedKey = `${this.namespace}_${key}`;
        const jsonValue = JSON.stringify(value);

        // 메모리에 저장 (항상)
        this.memoryStorage[prefixedKey] = jsonValue;

        // localStorage에 저장 시도
        if (this.isLocalStorageAvailable) {
            try {
                localStorage.setItem(prefixedKey, jsonValue);
            } catch (e) {
                console.warn(`[${this.namespace}] Failed to save to localStorage:`, e.message);
                // localStorage에 저장 실패해도 메모리에는 저장되어 있음
            }
        }
    }

    // 데이터 읽기
    getItem(key, defaultValue = null) {
        const prefixedKey = `${this.namespace}_${key}`;

        // localStorage에서 먼저 시도
        if (this.isLocalStorageAvailable) {
            try {
                const value = localStorage.getItem(prefixedKey);
                if (value !== null) {
                    try {
                        return JSON.parse(value);
                    } catch (parseErr) {
                        console.warn(`[${this.namespace}] Failed to parse localStorage value for ${key}:`, parseErr.message);
                        localStorage.removeItem(prefixedKey);
                        return defaultValue;
                    }
                }
            } catch (e) {
                console.warn(`[${this.namespace}] Failed to read from localStorage:`, e.message);
            }
        }

        // 메모리 저장소에서 읽기
        try {
            const value = this.memoryStorage[prefixedKey];
            if (value !== undefined) {
                return JSON.parse(value);
            }
        } catch (e) {
            console.warn(`[${this.namespace}] Failed to parse memory storage value for ${key}:`, e.message);
        }

        return defaultValue;
    }

    // 데이터 삭제
    removeItem(key) {
        const prefixedKey = `${this.namespace}_${key}`;

        // 메모리에서 삭제
        delete this.memoryStorage[prefixedKey];

        // localStorage에서 삭제 시도
        if (this.isLocalStorageAvailable) {
            try {
                localStorage.removeItem(prefixedKey);
            } catch (e) {
                console.warn(`[${this.namespace}] Failed to remove from localStorage:`, e.message);
            }
        }
    }

    // 모든 데이터 삭제
    clear() {
        // 메모리 정리
        const prefix = `${this.namespace}_`;
        Object.keys(this.memoryStorage).forEach(key => {
            if (key.startsWith(prefix)) {
                delete this.memoryStorage[key];
            }
        });

        // localStorage 정리 시도
        if (this.isLocalStorageAvailable) {
            try {
                const prefix = `${this.namespace}_`;
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(prefix)) {
                        localStorage.removeItem(key);
                    }
                });
            } catch (e) {
                console.warn(`[${this.namespace}] Failed to clear localStorage:`, e.message);
            }
        }
    }

    // 문자열로 저장 (JSON 파싱 없음)
    setString(key, value) {
        const prefixedKey = `${this.namespace}_${key}`;
        this.memoryStorage[prefixedKey] = value;

        if (this.isLocalStorageAvailable) {
            try {
                localStorage.setItem(prefixedKey, value);
            } catch (e) {
                console.warn(`[${this.namespace}] Failed to save string to localStorage:`, e.message);
            }
        }
    }

    // 문자열로 읽기
    getString(key, defaultValue = '') {
        const prefixedKey = `${this.namespace}_${key}`;

        if (this.isLocalStorageAvailable) {
            try {
                const value = localStorage.getItem(prefixedKey);
                if (value !== null) return value;
            } catch (e) {
                console.warn(`[${this.namespace}] Failed to read string from localStorage:`, e.message);
            }
        }

        return this.memoryStorage[prefixedKey] || defaultValue;
    }

    // 수치 저장
    setNumber(key, value) {
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn(`[${this.namespace}] Invalid number value for ${key}:`, value);
            return;
        }
        this.setString(key, String(value));
    }

    // 수치 읽기
    getNumber(key, defaultValue = 0) {
        const value = this.getString(key);
        const num = parseInt(value, 10);
        return isNaN(num) ? defaultValue : num;
    }

    // 배열 저장
    setArray(key, arr) {
        if (!Array.isArray(arr)) {
            console.warn(`[${this.namespace}] Invalid array for ${key}:`, arr);
            return;
        }
        this.setItem(key, arr);
    }

    // 배열 읽기
    getArray(key, defaultValue = []) {
        const value = this.getItem(key);
        return Array.isArray(value) ? value : defaultValue;
    }

    // 객체 저장
    setObject(key, obj) {
        if (typeof obj !== 'object' || obj === null) {
            console.warn(`[${this.namespace}] Invalid object for ${key}:`, obj);
            return;
        }
        this.setItem(key, obj);
    }

    // 객체 읽기
    getObject(key, defaultValue = {}) {
        const value = this.getItem(key);
        return typeof value === 'object' && value !== null ? value : defaultValue;
    }

    // 저장소 상태 정보
    getStatus() {
        return {
            namespace: this.namespace,
            isLocalStorageAvailable: this.isLocalStorageAvailable,
            isPrivateMode: this.isPrivateMode,
            memoryItemCount: Object.keys(this.memoryStorage).length
        };
    }

    // 저장 데이터 크기 (대략)
    getEstimatedSize() {
        let size = 0;
        for (const key in this.memoryStorage) {
            size += key.length + this.memoryStorage[key].length;
        }
        return size;
    }
}

// 글로벌 인스턴스 생성 (네임스페이스별)
window.StorageManager = StorageManager;
