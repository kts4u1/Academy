/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  // 터치 화면에서는 hover 효과가 눌린 채로 남지 않게 마우스가 있을 때만 적용
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        'ink-3': token('ink-3'),
        line: token('line'),
        accent: token('accent'),
        'accent-soft': token('accent-soft'),
        'on-accent': token('on-accent'),
        tag: token('tag'),
        'tag-ink': token('tag-ink'),
        cheap: token('cheap'),
        'cheap-soft': token('cheap-soft'),
        pricey: token('pricey'),
        'pricey-soft': token('pricey-soft'),
        academic: token('academic'),
        'academic-soft': token('academic-soft'),
        sports: token('sports'),
        'sports-soft': token('sports-soft'),
        arts: token('arts'),
        'arts-soft': token('arts-soft'),
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans KR"',
          'Pretendard',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
      },
      maxWidth: {
        app: '1120px',
      },
    },
  },
  plugins: [],
};
