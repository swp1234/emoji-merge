class I18n {
    constructor() {
        this.translations = {};
        this.supportedLanguages = ['ko', 'en', 'ja', 'es', 'pt', 'zh', 'id', 'tr', 'de', 'fr', 'hi', 'ru'];
        this.currentLang = this.detectLanguage();
    }

    detectLanguage() {
        try {
            const savedLang = localStorage.getItem('app_language');
            if (savedLang && this.supportedLanguages.includes(savedLang)) return savedLang;
        } catch (e) {
            console.warn('localStorage not available (private/incognito mode)', e);
        }
        const browserLang = (navigator.language || navigator.userLanguage).split('-')[0];
        if (this.supportedLanguages.includes(browserLang)) return browserLang;
        return 'en';
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`js/locales/${lang}.json`);
            if (!response.ok) throw new Error('Not found');
            this.translations[lang] = await response.json();
            return true;
        } catch (e) {
            if (lang !== 'en') return this.loadTranslations('en');
            return false;
        }
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];
        for (const k of keys) {
            if (value && value[k]) value = value[k];
            else return key;
        }
        return value;
    }

    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) return false;
        if (!this.translations[lang]) await this.loadTranslations(lang);
        this.currentLang = lang;
        try {
            localStorage.setItem('app_language', lang);
        } catch (e) {
            console.warn('Could not save language preference', e);
        }
        document.documentElement.lang = lang;
        this.updateUI();
        return true;
    }

    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = this.t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
        });
        document.querySelectorAll('[data-aria-label-i18n]').forEach(el => {
            el.setAttribute('aria-label', this.t(el.getAttribute('data-aria-label-i18n')));
        });
        document.title = this.t('app.title');
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.content = this.t('app.description');
    }

    getCurrentLanguage() {
        return this.currentLang;
    }

    getLanguageName(lang) {
        const names = {
            'ko': '한국어',
            'en': 'English',
            'ja': '日本語',
            'es': 'Español',
            'pt': 'Português',
            'zh': '简体中文',
            'id': 'Bahasa Indonesia',
            'tr': 'Türkçe',
            'de': 'Deutsch',
            'fr': 'Français',
            'hi': 'हिन्दी',
            'ru': 'Русский'
        };
        return names[lang] || lang;
    }
}

const i18n = new I18n();
