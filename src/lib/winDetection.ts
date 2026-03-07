import type { PatternName } from './bingo';

// numbers is [row][col], markedNumbers is Set of drawn numbers
export function checkWin(
  numbers: number[][],
  markedNumbers: Set<number>,
  pattern: PatternName
): boolean {
  const isMarked = (row: number, col: number) => {
    if (row === 2 && col === 2) return true; // free space
    return markedNumbers.has(numbers[row]?.[col] ?? -1);
  };

  switch (pattern) {
    case 'Full House':
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++)
          if (!isMarked(r, c)) return false;
      return true;

    case 'L Shape':
      // First column + last row
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;

    case 'T Shape':
      // First row + middle column
      for (let c = 0; c < 5; c++) if (!isMarked(0, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      return true;

    case 'U Shape':
      // First col + last col + last row
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 4)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;

    case 'X Shape':
      // Both diagonals
      for (let i = 0; i < 5; i++) {
        if (!isMarked(i, i)) return false;
        if (!isMarked(i, 4 - i)) return false;
      }
      return true;

    default:
      return false;
  }
}
