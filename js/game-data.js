// Theme data
const THEMES = [
    {
        id: 'default',
        name: '다크',
        colors: ['#1a1a2e', '#f4a261', '#e76f51', '#2a9d8f']
    },
    {
        id: 'classic',
        name: '클래식',
        colors: ['#eee4da', '#f2b179', '#f65e3b', '#edcf72']
    },
    {
        id: 'neon',
        name: '네온',
        colors: ['#1a1a2e', '#00d2ff', '#f72585', '#7209b7']
    },
    {
        id: 'candy',
        name: '캔디',
        colors: ['#fce4ec', '#f06292', '#ce93d8', '#ab47bc']
    },
    {
        id: 'ocean',
        name: '오션',
        colors: ['#1a365d', '#3182ce', '#48bb78', '#63b3ed']
    }
];

// Title/achievement data based on score
const TITLES = [
    { min: 0, title: '초보자', desc: '첫 걸음' },
    { min: 500, title: '견습생', desc: '감을 잡기 시작' },
    { min: 1000, title: '도전자', desc: '숫자의 세계로' },
    { min: 2000, title: '수학자', desc: '계산이 빨라진다' },
    { min: 3000, title: '전략가', desc: '한 수 앞을 본다' },
    { min: 5000, title: '퍼즐러', desc: '패턴을 읽는다' },
    { min: 8000, title: '마스터', desc: '숫자를 지배한다' },
    { min: 12000, title: '그랜드마스터', desc: '최고의 영역' },
    { min: 20000, title: '레전드', desc: '전설이 되다' },
    { min: 30000, title: '신화', desc: '신의 영역' },
    { min: 50000, title: '우주의 지배자', desc: '모든 것을 초월' }
];

function getTitleForScore(score) {
    let result = TITLES[0];
    for (const t of TITLES) {
        if (score >= t.min) result = t;
        else break;
    }
    return result;
}
