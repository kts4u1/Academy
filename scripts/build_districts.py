"""전국 시·군·구 목록과 중심 좌표를 만든다.

입력: vuski/admdongkor 행정동 경계 GeoJSON (통계청 SGIS 경계 기반)
  https://github.com/vuski/admdongkor  (예: ver20260701/HangJeongDong_ver20260701.geojson)
출력: src/data/districts.ts

사용법:
  curl -LO https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson
  python3 scripts/build_districts.py HangJeongDong_ver20260701.geojson

중심 좌표는 거리 계산용 대표 지점이다.
- 동(洞) 지역이 있으면 동들의 면적 가중 중심 (시가지 중심)
- 없으면 읍 지역 중심 (군청 소재지 부근)
- 둘 다 없으면 전체 중심
"""

import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

# 시·도 짧은 이름. 광주 5개 자치구는 '광주'로, 나머지 전남 시·군은 '전남'으로 나눠 보여준다
# (데이터셋에는 '전남광주통합특별시'로 묶여 있지만 교육청·주소 표기는 여전히 나뉘어 쓰인다).
SIDO_SHORT = {
    '서울특별시': '서울',
    '부산광역시': '부산',
    '대구광역시': '대구',
    '인천광역시': '인천',
    '광주광역시': '광주',
    '대전광역시': '대전',
    '울산광역시': '울산',
    '세종특별자치시': '세종',
    '경기도': '경기',
    '강원특별자치도': '강원',
    '충청북도': '충북',
    '충청남도': '충남',
    '전북특별자치도': '전북',
    '전라남도': '전남',
    '경상북도': '경북',
    '경상남도': '경남',
    '제주특별자치도': '제주',
}
SIDO_ORDER = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
GWANGJU_GU = {'동구', '서구', '남구', '북구', '광산구'}


def ring_area_centroid(ring):
    """다각형 고리의 (부호 있는 면적, 중심). 경위도를 평면으로 근사한다."""
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if a == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return 0.0, (sum(xs) / len(xs), sum(ys) / len(ys))
    a *= 0.5
    return a, (cx / (6 * a), cy / (6 * a))


def feature_area_centroid(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    total = sx = sy = 0.0
    for poly in polys:
        # 바깥 고리만 사용 (구멍은 무시해도 대표 지점 계산에는 충분)
        a, (x, y) = ring_area_centroid([tuple(p[:2]) for p in poly[0]])
        a = abs(a)
        total += a
        sx += x * a
        sy += y * a
    if total == 0:
        return 0.0, None
    return total, (sx / total, sy / total)


def weighted_center(items):
    total = sum(a for a, c in items if c)
    if total == 0:
        return None
    return (sum(c[0] * a for a, c in items if c) / total, sum(c[1] * a for a, c in items if c) / total)


def display_sigungu(sggnm):
    m = re.match(r'^(.+?시)(.+구)$', sggnm)
    return f'{m.group(1)} {m.group(2)}' if m else sggnm


def normalize_dong(name):
    # '역삼1동' → '역삼동', '신림동' 그대로, '봉담읍' 그대로
    # '용현1·4동' → '용현동', '종로1·2·3·4가동' → '종로동'
    return re.sub(r'제?\d+(?:[·.,]\d+)*가?(?=동$)', '', name)


def main(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    groups = OrderedDict()
    for f in data['features']:
        p = f['properties']
        sido_full = p['sidonm']
        sgg = p['sggnm']
        if sido_full == '전남광주통합특별시':
            sido = '광주' if sgg in GWANGJU_GU else '전남'
        else:
            sido = SIDO_SHORT[sido_full]
        dong = p['adm_nm'].split()[-1]
        area, center = feature_area_centroid(f['geometry'])
        groups.setdefault((sido, sgg), {'sidoFull': sido_full, 'code': p['sgg'], 'dongs': []})
        groups[(sido, sgg)]['dongs'].append((dong, area, center))

    rows = []
    for (sido, sgg), g in groups.items():
        dongs = g['dongs']
        urban = [(a, c) for d, a, c in dongs if d.endswith('동')]
        towns = [(a, c) for d, a, c in dongs if d.endswith('읍')]
        center = weighted_center(urban) or weighted_center(towns) or weighted_center([(a, c) for _, a, c in dongs])

        names = []
        seen = set()
        preferred = [d for d, _, _ in dongs if d.endswith('동')] or [d for d, _, _ in dongs if d.endswith('읍')]
        rest = [d for d, _, _ in dongs if d not in preferred]
        for d in preferred + rest:
            n = normalize_dong(d)
            if n not in seen:
                seen.add(n)
                names.append(n)
        # 고르게 4~5개 뽑기
        k = min(5, len(names))
        step = len(names) / k
        picks = [names[int(i * step)] for i in range(k)]

        row = {
            'sido': sido,
            'sidoFull': g['sidoFull'],
            'sigungu': display_sigungu(sgg),
            'code': g['code'],
            'dongs': picks,
            'lat': round(center[1], 4),
            'lng': round(center[0], 4),
        }
        # 일반구·인천 새 구: 교육청 주소에 구 이름이 없을 때 동 이름으로 구를 가리기 위한 전체 동 목록
        if re.match(r'^.+시.+구$', sgg) or (sido == '인천' and sgg in ('제물포구', '영종구', '서해구', '검단구')):
            row['dongIndex'] = sorted(set(names))
        rows.append(row)

    rows.sort(key=lambda r: (SIDO_ORDER.index(r['sido']), r['sigungu']))
    out = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'districts.ts'
    lines = [
        '// 자동 생성 파일 – 직접 고치지 마세요. (scripts/build_districts.py)',
        '// 출처: vuski/admdongkor 행정동 경계 ver20260701 (통계청 SGIS 경계 기반)',
        '// code 는 행정구역코드 앞 5자리(시·군·구).',
        '// lat/lng 는 거리 계산용 대표 지점, dongs 는 실제 행정동 이름(숫자 제거) 일부.',
        '',
        'export interface DistrictSeed {',
        '  sido: string;',
        '  sidoFull: string;',
        '  sigungu: string;',
        '  /** 행정구역코드 앞 5자리 (시·군·구) */',
        '  code: string;',
        '  dongs: string[];',
        '  lat: number;',
        '  lng: number;',
        '  /** 일반구·인천 새 구의 전체 동 이름 (교육청 주소로 구를 가릴 때) */',
        '  dongIndex?: string[];',
        '}',
        '',
        'export const DISTRICT_SEEDS: DistrictSeed[] = [',
    ]
    for r in rows:
        lines.append('  ' + json.dumps(r, ensure_ascii=False).replace('"sido":', 'sido:').replace('"sidoFull":', 'sidoFull:')
                     .replace('"sigungu":', 'sigungu:').replace('"code":', 'code:').replace('"dongs":', 'dongs:')
                     .replace('"lat":', 'lat:').replace('"lng":', 'lng:').replace('"dongIndex":', 'dongIndex:').replace('"', "'") + ',')
    lines.append('];')
    lines.append('')
    out.write_text('\n'.join(lines), encoding='utf-8')
    print(f'{len(rows)} districts → {out}')


if __name__ == '__main__':
    main(sys.argv[1])
