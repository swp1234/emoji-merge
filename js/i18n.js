class I18n {
    constructor() {
        this.translations = {};
        this.supportedLanguages = ['ko', 'en', 'zh', 'hi', 'ru'];
        this.currentLang = this.detectLanguage();
    }

    detectLanguage() {
        const savedLang = localStorage.getItem('app_language');
        if (savedLang && this.supportedLanguages.includes(savedLang)) return savedLang;
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
        localStorage.setItem('app_language', lang);
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
            'zh': '简体中文',
            'hi': 'हिन्दी',
            'ru': 'Русский'
        };
        return names[lang] || lang;
    }
}

const i18n = new I18n();
