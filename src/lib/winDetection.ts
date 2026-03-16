import type { PatternName } from './bingo';

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

    case 'Single Line H':
      for (let r = 0; r < 5; r++) {
        let ok = true;
        for (let c = 0; c < 5; c++) if (!isMarked(r, c)) { ok = false; break; }
        if (ok) return true;
      }
      return false;

    case 'Single Line V':
      for (let c = 0; c < 5; c++) {
        let ok = true;
        for (let r = 0; r < 5; r++) if (!isMarked(r, c)) { ok = false; break; }
        if (ok) return true;
      }
      return false;

    case 'Single Line D':
      { let d1 = true, d2 = true;
        for (let i = 0; i < 5; i++) {
          if (!isMarked(i, i)) d1 = false;
          if (!isMarked(i, 4 - i)) d2 = false;
        }
        return d1 || d2;
      }

    case 'Two Lines': {
      let lineCount = 0;
      // horizontal
      for (let r = 0; r < 5; r++) {
        let ok = true;
        for (let c = 0; c < 5; c++) if (!isMarked(r, c)) { ok = false; break; }
        if (ok) lineCount++;
      }
      // vertical
      for (let c = 0; c < 5; c++) {
        let ok = true;
        for (let r = 0; r < 5; r++) if (!isMarked(r, c)) { ok = false; break; }
        if (ok) lineCount++;
      }
      // diagonals
      let d1 = true, d2 = true;
      for (let i = 0; i < 5; i++) {
        if (!isMarked(i, i)) d1 = false;
        if (!isMarked(i, 4 - i)) d2 = false;
      }
      if (d1) lineCount++;
      if (d2) lineCount++;
      return lineCount >= 2;
    }

    case 'Four Corners':
      return isMarked(0, 0) && isMarked(0, 4) && isMarked(4, 0) && isMarked(4, 4);

    case 'X Shape':
      for (let i = 0; i < 5; i++) {
        if (!isMarked(i, i)) return false;
        if (!isMarked(i, 4 - i)) return false;
      }
      return true;

    case 'T Shape':
      for (let c = 0; c < 5; c++) if (!isMarked(0, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      return true;

    case 'L Shape':
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;

    case 'Cross':
      for (let c = 0; c < 5; c++) if (!isMarked(2, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      return true;

    case 'Frame':
      for (let i = 0; i < 5; i++) {
        if (!isMarked(0, i)) return false;
        if (!isMarked(4, i)) return false;
        if (!isMarked(i, 0)) return false;
        if (!isMarked(i, 4)) return false;
      }
      return true;

    case 'Postage Stamp':
      // Any 2x2 corner
      const corners = [[0,0],[0,3],[3,0],[3,3]];
      for (const [sr, sc] of corners) {
        if (isMarked(sr, sc) && isMarked(sr, sc+1) && isMarked(sr+1, sc) && isMarked(sr+1, sc+1)) return true;
      }
      return false;

    case 'Small Diamond':
      return isMarked(0, 2) && isMarked(1, 1) && isMarked(1, 3) && isMarked(2, 0) && isMarked(2, 4) && isMarked(3, 1) && isMarked(3, 3) && isMarked(4, 2);

    case 'Arrow Up':
      // column 2 full + diagonals from top
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      if (!isMarked(1, 1) || !isMarked(1, 3)) return false;
      if (!isMarked(0, 0) || !isMarked(0, 4)) return false;
      return true;

    case 'Pyramid':
      // rows 0-4, centered triangle
      if (!isMarked(0, 2)) return false;
      if (!isMarked(1, 1) || !isMarked(1, 2) || !isMarked(1, 3)) return false;
      if (!isMarked(2, 0) || !isMarked(2, 1) || !isMarked(2, 2) || !isMarked(2, 3) || !isMarked(2, 4)) return false;
      return true;

    case 'U Shape':
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 4)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;

    default:
      return false;
  }
}

/** Get pattern cell map for visual display */
export function getPatternCells(pattern: string): boolean[][] {
  const empty = () => Array.from({ length: 5 }, () => Array(5).fill(false));
  
  switch (pattern) {
    case 'Full House': return Array.from({ length: 5 }, () => Array(5).fill(true));
    case 'Single Line H': { const g = empty(); for (let c = 0; c < 5; c++) g[2][c] = true; return g; }
    case 'Single Line V': { const g = empty(); for (let r = 0; r < 5; r++) g[r][2] = true; return g; }
    case 'Single Line D': { const g = empty(); for (let i = 0; i < 5; i++) g[i][i] = true; return g; }
    case 'Two Lines': { const g = empty(); for (let c = 0; c < 5; c++) { g[1][c] = true; g[3][c] = true; } return g; }
    case 'Four Corners': { const g = empty(); g[0][0] = g[0][4] = g[4][0] = g[4][4] = true; return g; }
    case 'X Shape': { const g = empty(); for (let i = 0; i < 5; i++) { g[i][i] = true; g[i][4-i] = true; } return g; }
    case 'T Shape': { const g = empty(); for (let c = 0; c < 5; c++) g[0][c] = true; for (let r = 0; r < 5; r++) g[r][2] = true; return g; }
    case 'L Shape': { const g = empty(); for (let r = 0; r < 5; r++) g[r][0] = true; for (let c = 0; c < 5; c++) g[4][c] = true; return g; }
    case 'Cross': { const g = empty(); for (let i = 0; i < 5; i++) { g[2][i] = true; g[i][2] = true; } return g; }
    case 'Frame': { const g = empty(); for (let i = 0; i < 5; i++) { g[0][i] = g[4][i] = g[i][0] = g[i][4] = true; } return g; }
    case 'Postage Stamp': { const g = empty(); g[0][0] = g[0][1] = g[1][0] = g[1][1] = true; return g; }
    case 'Small Diamond': { const g = empty(); g[0][2] = g[1][1] = g[1][3] = g[2][0] = g[2][4] = g[3][1] = g[3][3] = g[4][2] = true; return g; }
    case 'Arrow Up': { const g = empty(); for (let r = 0; r < 5; r++) g[r][2] = true; g[1][1] = g[1][3] = g[0][0] = g[0][4] = true; return g; }
    case 'Pyramid': { const g = empty(); g[0][2] = true; g[1][1] = g[1][2] = g[1][3] = true; for (let c = 0; c < 5; c++) g[2][c] = true; return g; }
    case 'U Shape': { const g = empty(); for (let r = 0; r < 5; r++) { g[r][0] = true; g[r][4] = true; } for (let c = 0; c < 5; c++) g[4][c] = true; return g; }
    default: return Array.from({ length: 5 }, () => Array(5).fill(true));
  }
}

/** Check horizontal line wins */
export function checkHorizontalWin(numbers: number[][], marked: Set<number>): boolean {
  for (let r = 0; r < 5; r++) {
    let complete = true;
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) continue;
      if (!marked.has(numbers[r]?.[c] ?? -1)) { complete = false; break; }
    }
    if (complete) return true;
  }
  return false;
}

/** Check vertical line wins */
export function checkVerticalWin(numbers: number[][], marked: Set<number>): boolean {
  for (let c = 0; c < 5; c++) {
    let complete = true;
    for (let r = 0; r < 5; r++) {
      if (r === 2 && c === 2) continue;
      if (!marked.has(numbers[r]?.[c] ?? -1)) { complete = false; break; }
    }
    if (complete) return true;
  }
  return false;
}

/** Check diagonal wins */
export function checkDiagonalWin(numbers: number[][], marked: Set<number>): boolean {
  let d1 = true, d2 = true;
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // free space
    if (!marked.has(numbers[i]?.[i] ?? -1)) d1 = false;
    if (!marked.has(numbers[i]?.[4 - i] ?? -1)) d2 = false;
  }
  return d1 || d2;
}

/** Get winning cell coordinates for highlighting */
export function getWinningCells(
  numbers: number[][],
  marked: Set<number>,
  pattern: string
): [number, number][] {
  const cells = getPatternCells(pattern);
  const result: [number, number][] = [];
  const isMarked = (r: number, c: number) => {
    if (r === 2 && c === 2) return true;
    return marked.has(numbers[r]?.[c] ?? -1);
  };

  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      if (cells[r][c]) result.push([r, c]);

  const allMarked = result.every(([r, c]) => isMarked(r, c));
  return allMarked ? result : [];
}
