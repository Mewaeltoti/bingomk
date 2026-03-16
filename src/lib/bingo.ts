// Generate a random bingo cartela
export function generateCartela(): number[][] {
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ];

  const cartela: number[][] = [];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const nums: number[] = [];
    while (nums.length < 5) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(n)) nums.push(n);
    }
    cartela.push(nums);
  }
  // Free space at center
  cartela[2][2] = 0;
  return cartela;
}

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];

export const PATTERNS: Record<string, string> = {
  'Full House': 'All numbers marked',
  'Single Line H': 'Any horizontal line',
  'Single Line V': 'Any vertical line',
  'Single Line D': 'Any diagonal line',
  'Two Lines': 'Any two complete lines',
  'Four Corners': 'All four corner cells',
  'X Shape': 'Both diagonals',
  'T Shape': 'First row + middle column',
  'L Shape': 'First column + last row',
  'Cross': 'Middle row + middle column',
  'Frame': 'All border cells',
  'Postage Stamp': 'Any 2x2 corner block',
  'Small Diamond': 'Diamond in center',
  'Arrow Up': 'Arrow pointing up',
  'Pyramid': 'Triangle from top center',
  'U Shape': 'First col + last col + last row',
};

export type PatternName = keyof typeof PATTERNS;

// Generate a set of cartelas for the store
export function generateCartelaSet(count: number): { id: string; numbers: number[][]; price: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cartela-${i + 1}`,
    numbers: generateCartela(),
    price: 20,
  }));
}
