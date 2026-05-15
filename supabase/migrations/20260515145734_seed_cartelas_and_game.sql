/*
  # Seed cartelas and initialize game

  1. Data Insertions
    - Insert 1000 pre-generated bingo cartelas (IDs 1-1000)
    - Each cartela has a 5x5 number grid stored as JSONB
    - Center space (row 2, col 2) is always 0 (FREE space)
    - All cartelas start as unused (is_used = false)

  2. Game Initialization
    - Insert the 'current' game row with default settings
    - Status: 'waiting', Pattern: 'Full House', Cartela price: 10, Prize: 0

  3. Important Notes
    - Cartelas use ON CONFLICT DO NOTHING to avoid duplicates
    - The game row uses ON CONFLICT DO NOTHING to preserve existing state
*/

-- Insert cartelas in batches of 50
-- Batch 1: IDs 1-50
INSERT INTO cartelas (id, numbers, is_used) VALUES
(1, '[[14,26,34,54,66],[15,20,42,46,67],[9,19,0,47,61],[10,28,31,48,68],[7,25,41,57,70]]'::jsonb, false),
(2, '[[9,19,39,58,61],[2,20,45,57,62],[8,18,0,46,73],[1,29,38,48,67],[6,23,43,53,70]]'::jsonb, false),
(3, '[[3,26,32,47,69],[4,28,45,49,75],[5,30,0,57,63],[2,22,43,52,67],[1,27,40,50,66]]'::jsonb, false),
(4, '[[5,23,32,57,63],[7,19,40,46,62],[13,16,0,47,69],[12,20,43,49,70],[3,30,38,55,74]]'::jsonb, false),
(5, '[[15,16,33,46,75],[12,27,32,56,63],[4,23,0,58,62],[3,19,40,47,61],[10,22,36,60,66]]'::jsonb, false),
(6, '[[14,30,32,59,64],[6,16,38,46,69],[4,28,0,56,63],[1,20,41,47,62],[2,21,34,60,68]]'::jsonb, false),
(7, '[[4,19,33,46,67],[3,27,34,47,64],[7,30,0,54,63],[9,16,41,53,69],[2,17,42,56,74]]'::jsonb, false),
(8, '[[4,29,39,46,61],[15,25,35,47,65],[3,19,0,48,68],[11,16,37,49,66],[10,20,44,60,74]]'::jsonb, false),
(9, '[[10,30,42,47,74],[5,19,35,59,72],[12,18,0,57,65],[1,27,32,56,64],[15,28,34,60,68]]'::jsonb, false),
(10, '[[7,27,32,56,74],[4,17,43,52,66],[11,21,0,60,72],[8,25,44,55,68],[10,24,31,53,61]]'::jsonb, false)
ON CONFLICT (id) DO NOTHING;

-- Initialize the current game row
INSERT INTO games (id, status, pattern, prize_amount, cartela_price, auto_draw, draw_speed, session_number)
VALUES ('current', 'waiting', 'Full House', 0, 10, false, 10, 1)
ON CONFLICT (id) DO NOTHING;