import { estimateCardHeight } from './chart-layout.utils';

describe('estimateCardHeight', () => {
  it('returns the compact single-line height when name/title are short and department is absent', () => {
    expect(estimateCardHeight({ name: 'AN', title: 'CEO' })).toBe(65);
  });

  it('adds height for the department line when present', () => {
    expect(estimateCardHeight({ name: 'AN', title: 'CEO', department: 'Khoi Van hanh' })).toBe(84);
  });

  it('grows when the name wraps onto multiple lines', () => {
    const longName = 'A'.repeat(45);
    expect(estimateCardHeight({ name: longName, title: 'CEO' })).toBe(105);
  });

  it('omits the title line entirely when title is empty', () => {
    expect(estimateCardHeight({ name: 'AN', title: '' })).toBe(44);
  });
});
