import { describe, expect, it } from 'vitest';
import { baseDateOf, csvToRawRows, decodeKorean, latestFile, parseCsv } from './neisFile';

describe('교육청 전국 파일', () => {
  it('파일 이름의 기준일', () => {
    expect(baseDateOf('학원교습소정보_2026년09월30일기준')).toBe('2026-09-30');
    expect(baseDateOf('학원교습소정보_2026년07월31일 기준')).toBe('2026-07-31');
    expect(baseDateOf('학원교습소정보_2026년3월')).toBe('2026-03-31');
    expect(baseDateOf('학원교습소정보_2024년2월')).toBe('2024-02-29');
    expect(baseDateOf('설명서')).toBeNull();
  });

  it('가장 최근 기준일의 CSV 를 고른다 (목록 순서·이름 형식과 무관)', () => {
    const list = [
      { fileSeq: 104, viewFileNm: '학원교습소정보_2026년09월30일기준', fileExt: 'csv' },
      { fileSeq: 98, viewFileNm: '학원교습소정보_2026년3월', fileExt: 'csv' },
      { fileSeq: 105, viewFileNm: '학원교습소정보_2026년10월31일기준', fileExt: 'xlsx' },
      { fileSeq: 103, viewFileNm: '학원교습소정보_2026년08월31일기준', fileExt: 'csv' },
    ];
    expect(latestFile(list)).toEqual({ fileSeq: 104, name: '학원교습소정보_2026년09월30일기준', baseDate: '2026-09-30' });
    expect(latestFile([])).toBeNull();
  });

  it('따옴표 안의 쉼표·줄바꿈·"" 를 처리한다', () => {
    expect(parseCsv('a,b,c\r\n1,", 4층 (대치동)","x""y"\n2,"줄\n바꿈",\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', ', 4층 (대치동)', 'x"y'],
      ['2', '줄\n바꿈', ''],
    ]);
  });

  it('CP949 파일도 읽는다', () => {
    expect(decodeKorean(new Uint8Array([0xc7, 0xd0, 0xbf, 0xf8]))).toBe('학원');
    expect(decodeKorean(new TextEncoder().encode('﻿학원'))).toBe('학원');
  });

  it('머리글을 API 필드 이름으로 바꾼다', () => {
    const csv = [
      '시도교육청코드,시도교육청명,행정구역명,학원교습소명,학원지정번호,학원명,개설일자,등록일자,등록상태명,휴원시작일자,휴원종료일자,정원합계,일시수용능력인원합계,분야명,교습계열명,교습과정목록명,교습과정명,인당수강료,수강료공개여부,기숙사학원여부,도로명주소,도로명상세주소,도로명우편번호,전화번호,수정일자',
      'B10,서울특별시교육청,강남구,교습소,3000042509,BT수학교습소,20221027,20221027,개원,        ,99991231,36,9,입시.검정 및 보습,보통교과,,보습,"중등수학:320000, 고등수학:450000",Y,N,서울특별시 강남구 선릉로 38,", 4층 (개포동)",06325,02-555-1234,20231018',
    ].join('\n');
    const [row] = csvToRawRows(csv);
    expect(row).toMatchObject({
      ATPT_OFCDC_SC_CODE: 'B10',
      ADMST_ZONE_NM: '강남구',
      ACA_INSTI_SC_NM: '교습소',
      ACA_ASNUM: '3000042509',
      TOFOR_SMTOT: 36,
      PSNBY_THCC_CNTNT: '중등수학:320000, 고등수학:450000',
      FA_RDNDA: ', 4층 (개포동)',
      LOAD_DTM: '20231018',
    });
    expect(() => csvToRawRows('가,나\n1,2')).toThrow(/형식이 바뀌었습니다/);
  });
});
