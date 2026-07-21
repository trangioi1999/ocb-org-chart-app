import { computeGridColumns, estimateCardHeight, GRID_GROUP_THRESHOLD, shouldGridPack } from './chart-layout.utils';

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

describe('shouldGridPack', () => {
  it('is false at the threshold', () => {
    expect(shouldGridPack(GRID_GROUP_THRESHOLD)).toBe(false);
  });

  it('is true just above the threshold', () => {
    expect(shouldGridPack(GRID_GROUP_THRESHOLD + 1)).toBe(true);
  });
});

describe('computeGridColumns', () => {
  it('returns 1 column for a single leaf', () => {
    expect(computeGridColumns(1)).toBe(1);
  });

  it('returns a squarish column count for 4 leaves', () => {
    expect(computeGridColumns(4)).toBe(2);
  });

  it('caps at the default maxColumns for large leaf counts', () => {
    expect(computeGridColumns(22)).toBe(4);
  });

  it('respects a custom maxColumns', () => {
    expect(computeGridColumns(9, 3)).toBe(3);
  });
});
