import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

// 화면이 실제로 렌더링되는지 확인하는 스모크 테스트
describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('홈 화면', () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('학원비');
    expect(screen.getAllByText('주짓수').length).toBeGreaterThan(0);
  });

  it('검색 결과와 가격 요약', () => {
    window.location.hash = '#/search?subject=kendo&sido=%EC%84%9C%EC%9A%B8';
    render(<App />);
    expect(screen.getByLabelText('검색 결과 가격 요약')).toHaveTextContent('곳');
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });

  it('비교함 예시 불러오기', () => {
    window.location.hash = '#/compare';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '예시로 비교해 보기' }));
    expect(screen.getByRole('table', { name: '학원별 가격 비교표' })).toBeInTheDocument();
    expect(screen.getByLabelText('비교 요약')).toHaveTextContent('가장 저렴');
  });
});
