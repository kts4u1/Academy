// 과목 아이콘. lucide 아이콘을 쓰고, lucide 에 없는 종목은 같은 규칙(24px 격자, 2px 선, 둥근 끝)으로 직접 그렸다.

import {
  BookOpenText,
  CaseSensitive,
  CodeXml,
  Drama,
  Drum,
  Feather,
  FlaskConical,
  GraduationCap,
  Guitar,
  HandFist,
  Landmark,
  Languages,
  MicVocal,
  Mountain,
  Palette,
  Piano,
  Sigma,
  Sword,
  WavesLadder,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode, SVGProps } from 'react';

type IconProps = { className?: string; strokeWidth?: number };

function custom(children: ReactNode) {
  return function CustomIcon({ className, strokeWidth = 2 }: IconProps) {
    const props: SVGProps<SVGSVGElement> = {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      'aria-hidden': true,
    };
    return <svg {...props}>{children}</svg>;
  };
}

const Basketball = custom(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v20M2 12h20" />
    <path d="M4.9 4.9c3.9 3.9 3.9 10.3 0 14.2M19.1 4.9c-3.9 3.9-3.9 10.3 0 14.2" />
  </>,
);

const Baseball = custom(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M5.2 4.7c2.5 4.1 2.5 10.5 0 14.6M18.8 4.7c-2.5 4.1-2.5 10.5 0 14.6" />
    <path d="m6.6 8 1.6-.6M7.3 12h1.7M6.6 16l1.6.6M17.4 8l-1.6-.6M16.7 12H15M17.4 16l-1.6.6" />
  </>,
);

const SoccerBall = custom(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m12 7.5 4.3 3.1-1.6 5h-5.4l-1.6-5Z" />
    <path d="M12 7.5V2.3M16.3 10.6l4.9-1.6M14.7 15.6l3 4.2M9.3 15.6l-3 4.2M7.7 10.6 2.8 9" />
  </>,
);

const Tennis = custom(
  <>
    <ellipse cx="9.5" cy="9.5" rx="6" ry="6.8" transform="rotate(-45 9.5 9.5)" />
    <path d="M7 6.6 12.4 12M6.6 12l5.4-5.4" />
    <path d="m14.4 14.4 1.4 1.4m0 0 4.4 4.4a1.4 1.4 0 0 1-2 2l-4.4-4.4" />
    <circle cx="19" cy="5" r="2" />
  </>,
);

const Badminton = custom(
  <>
    <path d="M9 17.5a3 3 0 0 0 6 0Z" />
    <path d="M9.6 17.5 5 4.5M14.4 17.5 19 4.5M12 17.5V3.5" />
    <path d="M5 4.5c4.6-1.4 9.4-1.4 14 0M7 11h10" />
  </>,
);

const TableTennis = custom(
  <>
    <circle cx="14" cy="10" r="7" />
    <path d="M9 15.2 4.6 19.6a1.6 1.6 0 0 0 2.3 2.3l4.4-4.4" />
    <path d="M10.5 6.5a5 5 0 0 1 3.5-1.5" />
    <circle cx="4.5" cy="5.5" r="2" />
  </>,
);

const JumpRope = custom(
  <>
    <rect x="3.5" y="15" width="3" height="6.5" rx="1.5" />
    <rect x="17.5" y="15" width="3" height="6.5" rx="1.5" />
    <path d="M5 15C5 7.5 8 2.5 12 2.5s7 5 7 12.5" />
  </>,
);

/** 태권도: 매듭 지은 띠 */
const Belt = custom(
  <>
    <path d="M2 8h7.5M14.5 8H22M2 11.5h7.5M14.5 11.5H22" />
    <rect x="9.5" y="6" width="5" height="7" rx="1" />
    <path d="m10.5 13-2.5 8M13.5 13l2.5 8" />
  </>,
);

/** 주짓수: 도복 */
const Gi = custom(
  <>
    <path d="M8.5 3 3 6.5l2.5 4 2-1.3V21h9V9.2l2 1.3 2.5-4L15.5 3" />
    <path d="M8.5 3 12 9l3.5-6" />
    <path d="M7.5 14h9M11 14l-1.2 4M13 14l1.2 4" />
  </>,
);

/** 킥복싱: 발차기 */
const Kick = custom(
  <>
    <circle cx="6.5" cy="5" r="2" />
    <path d="m7.5 8 2.5 5.5" />
    <path d="M8.5 10 4.5 12" />
    <path d="M10 13.5 8 21" />
    <path d="m10 13.5 6.5-3 4-1.5" />
  </>,
);

const Golf = custom(
  <>
    <path d="M8 21V3l9 4-9 4" />
    <path d="M4 21h8" />
    <circle cx="17.5" cy="18.5" r="2.5" />
  </>,
);

/** 필라테스: 매트 위 스트레칭 */
const Pilates = custom(
  <>
    <circle cx="6.5" cy="5.5" r="2" />
    <path d="m7.5 8.2 3.5 8.3 8-6.5" />
    <path d="m8.5 10.5 8 1" />
    <path d="M3 20h18" />
  </>,
);

const Violin = custom(
  <g transform="rotate(25 12 12)">
    <path d="M12 7.5c-3.4 0-4.6 1.4-4.6 3.3 0 1.5 1.3 1.9 1.3 2.8s-1.9 1.6-1.9 4c0 3.1 2.3 4.9 5.2 4.9s5.2-1.8 5.2-4.9c0-2.4-1.9-3.1-1.9-4s1.3-1.3 1.3-2.8c0-1.9-1.2-3.3-4.6-3.3Z" />
    <path d="M12 7.5V1.5M10.8 1.5h2.4M12 10v7.5M10.3 17.5h3.4" />
  </g>,
);

/** 발레: 토슈즈와 리본 */
const Ballet = custom(
  <>
    <circle cx="12" cy="3.5" r="2" />
    <path d="M7.5 8.5C9 6.8 10.5 6 12 6s3 .8 4.5 2.5" />
    <path d="M12 6v5.5" />
    <path d="M5.5 13.5c2.1-1.6 4.3-2.3 6.5-2.3s4.4.7 6.5 2.3c-2.1.9-4.3 1.3-6.5 1.3s-4.4-.4-6.5-1.3Z" />
    <path d="m11 14.8-.5 6.7M13 14.8l.5 6.7" />
  </>,
);

/** 방송댄스: 춤추는 사람 */
const Dance = custom(
  <>
    <circle cx="13" cy="4" r="2" />
    <path d="m12.5 7-1 6" />
    <path d="m12.2 9 4.8-3M12.2 9 7 7.5" />
    <path d="m11.5 13 3.5 3.5-1 4.5M11.5 13 8 17l-3 1" />
  </>,
);

const ICONS: Record<string, LucideIcon | ReturnType<typeof custom>> = {
  korean: BookOpenText,
  english: CaseSensitive,
  math: Sigma,
  science: FlaskConical,
  social: Landmark,
  essay: Feather,
  coding: CodeXml,
  lang2: Languages,
  allsubj: GraduationCap,
  swim: WavesLadder,
  taekwondo: Belt,
  boxing: HandFist,
  kickboxing: Kick,
  kendo: Sword,
  jiujitsu: Gi,
  basketball: Basketball,
  soccer: SoccerBall,
  baseball: Baseball,
  jumprope: JumpRope,
  climbing: Mountain,
  tennis: Tennis,
  golf: Golf,
  badminton: Badminton,
  tabletennis: TableTennis,
  pilates: Pilates,
  piano: Piano,
  violin: Violin,
  guitar: Guitar,
  drum: Drum,
  vocal: MicVocal,
  art: Palette,
  ballet: Ballet,
  dance: Dance,
  acting: Drama,
};

export function SubjectIcon({ subjectId, className = 'h-5 w-5', strokeWidth = 2 }: { subjectId: string; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[subjectId] ?? GraduationCap;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export const SUBJECT_ICON_IDS = Object.keys(ICONS);
