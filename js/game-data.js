// Emoji evolution chains (value → emoji mapping)
const EVOLUTION_CHAINS = {
    animal: {
        name: '알에서 용까지',
        nameKey: 'chain.animal.name',
        icon: '🐉',
        desc: '알이 부화하고, 새가 자라 전설의 용이 되다!',
        descKey: 'chain.animal.desc',
        map: {
            2: '🥚', 4: '🐣', 8: '🐥', 16: '🐔', 32: '🦆',
            64: '🦅', 128: '🦖', 256: '🐲', 512: '🐉',
            1024: '🔥', 2048: '👑'
        },
        bg: ['#2d1b00', '#3a2510', '#4a3520', '#5a4530']
    },
    plant: {
        name: '씨앗에서 세계수까지',
        nameKey: 'chain.plant.name',
        icon: '🌍',
        desc: '작은 씨앗이 싹트고 자라 거대한 숲이 되다!',
        descKey: 'chain.plant.desc',
        map: {
            2: '🌱', 4: '🌿', 8: '☘️', 16: '🌾', 32: '🌻',
            64: '🌹', 128: '🌲', 256: '🌳', 512: '🏔️',
            1024: '🌍', 2048: '✨'
        },
        bg: ['#1a2e0a', '#253a15', '#304520', '#3b502b']
    },
    space: {
        name: '물방울에서 은하까지',
        nameKey: 'chain.space.name',
        icon: '🌌',
        desc: '한 방울의 물이 바다가 되고, 별이 되어 우주를 채우다!',
        descKey: 'chain.space.desc',
        map: {
            2: '💧', 4: '🌊', 8: '❄️', 16: '🌀', 32: '🌑',
            64: '🌍', 128: '☀️', 256: '⭐', 512: '💫',
            1024: '🌌', 2048: '✨'
        },
        bg: ['#0a0a2e', '#101040', '#151555', '#1a1a6a']
    },
    emotion: {
        name: '감정 레벨업',
        nameKey: 'chain.emotion.name',
        icon: '🤩',
        desc: '차분한 시작에서 점점 뜨거워지는 감정의 폭발!',
        descKey: 'chain.emotion.desc',
        map: {
            2: '😶', 4: '🙂', 8: '😊', 16: '😄', 32: '😁',
            64: '😆', 128: '🤣', 256: '🥳', 512: '😎',
            1024: '🤩', 2048: '👑'
        },
        bg: ['#2e1a2e', '#3a2540', '#453050', '#503b60']
    }
};

// Tile background colors by value tier
const TILE_COLORS = {
    2:    { bg: 'rgba(255,255,255,0.06)', glow: false },
    4:    { bg: 'rgba(255,255,255,0.08)', glow: false },
    8:    { bg: 'rgba(255,255,255,0.10)', glow: false },
    16:   { bg: 'rgba(244,162,97,0.15)', glow: false },
    32:   { bg: 'rgba(244,162,97,0.22)', glow: false },
    64:   { bg: 'rgba(231,111,81,0.28)', glow: false },
    128:  { bg: 'rgba(231,111,81,0.35)', glow: true },
    256:  { bg: 'rgba(233,196,106,0.35)', glow: true },
    512:  { bg: 'rgba(42,157,143,0.35)', glow: true },
    1024: { bg: 'rgba(38,70,83,0.5)', glow: true },
    2048: { bg: 'rgba(244,162,97,0.5)', glow: true }
};

function getTileColor(value) {
    return TILE_COLORS[value] || { bg: 'rgba(244,162,97,0.6)', glow: true };
}

// Title/achievement data based on score
const TITLES = [
    { min: 0, title: '초보 연구원', titleKey: 'title.novice.name', desc: '진화의 시작', descKey: 'title.novice.desc' },
    { min: 500, title: '견습 조련사', titleKey: 'title.apprentice.name', desc: '감을 잡기 시작', descKey: 'title.apprentice.desc' },
    { min: 1000, title: '진화 도전자', titleKey: 'title.challenger.name', desc: '합치기의 재미', descKey: 'title.challenger.desc' },
    { min: 2000, title: '돌연변이 학자', titleKey: 'title.mutant.name', desc: '패턴이 보인다', descKey: 'title.mutant.desc' },
    { min: 3000, title: '유전공학자', titleKey: 'title.geneticist.name', desc: '전략적 합치기', descKey: 'title.geneticist.desc' },
    { min: 5000, title: '진화 마스터', titleKey: 'title.master.name', desc: '고도의 전략', descKey: 'title.master.desc' },
    { min: 8000, title: '생명의 건축가', titleKey: 'title.architect.name', desc: '자유자재로', descKey: 'title.architect.desc' },
    { min: 12000, title: '조물주 견습생', titleKey: 'title.demigod.name', desc: '거의 신의 영역', descKey: 'title.demigod.desc' },
    { min: 20000, title: '창조의 신', titleKey: 'title.creator.name', desc: '전설의 시작', descKey: 'title.creator.desc' },
    { min: 30000, title: '만물의 지배자', titleKey: 'title.ruler.name', desc: '모든 진화를 이끌다', descKey: 'title.ruler.desc' },
    { min: 50000, title: '우주 창조자', titleKey: 'title.cosmic.name', desc: '새로운 우주를 여는 자', descKey: 'title.cosmic.desc' }
];

function getTitleForScore(score) {
    let result = TITLES[0];
    for (const t of TITLES) {
        if (score >= t.min) result = t;
        else break;
    }
    return result;
}

// Stage system for progression
const STAGES = [
    { value: 128, name: '도입', nameKey: 'stage.intro.name', emoji: '🌤️', bonus: 200, desc: '128 달성', descKey: 'stage.intro.desc' },
    { value: 256, name: '입문', nameKey: 'stage.beginner.name', emoji: '🌱', bonus: 500, desc: '256 달성', descKey: 'stage.beginner.desc' },
    { value: 512, name: '중급', nameKey: 'stage.intermediate.name', emoji: '🌳', bonus: 1000, desc: '512 달성', descKey: 'stage.intermediate.desc' },
    { value: 1024, name: '고급', nameKey: 'stage.advanced.name', emoji: '🌲', bonus: 2000, desc: '1024 달성', descKey: 'stage.advanced.desc' },
    { value: 2048, name: '마스터', nameKey: 'stage.master.name', emoji: '👑', bonus: 5000, desc: '2048 달성', descKey: 'stage.master.desc' },
    { value: 4096, name: '전설', nameKey: 'stage.legend.name', emoji: '🔥', bonus: 10000, desc: '4096 달성', descKey: 'stage.legend.desc' }
];

function getStageForValue(value) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (value >= STAGES[i].value) return STAGES[i];
    }
    return null;
}

function getAllStages() {
    return STAGES;
}
