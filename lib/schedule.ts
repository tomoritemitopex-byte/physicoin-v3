import { BUILDINGS, LEVELS } from "@/lib/campus";

// Grid ↔ timetable translation.
// Order 6: row = period (6 slots), col = hall (6 of 8 buildings, first 6).
// rank = BUILDINGS index % order, reg = LEVELS index % order.
// Cell (r,c) holds the class pinned to that hall at that time.
// Score 0 = no hall double-booked (col Latin), no period double-booked
// (row Latin), no duplicate course pair.

export const PERIODS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

export function buildingsForOrder(order: number) {
  return BUILDINGS.slice(0, Math.min(order, BUILDINGS.length));
}

export function cellMeta(order: number, row: number, col: number) {
  const b = buildingsForOrder(order)[col];
  return { period: PERIODS[row] ?? `${8 + row * 2}:00`, hall: b?.code ?? `HALL_${col}`, building: b };
}

export type ScheduleCell = {
  row: number;
  col: number;
  period: string;
  hall: string;
  building_id: string;
  programme: string;
  level: string;
};

export function gridToSchedule(gridHex: string, order: number): ScheduleCell[] {
  // Nibble hex: 2*N*N chars, rank first N*N then reg.
  const cells: ScheduleCell[] = [];
  const blds = buildingsForOrder(order);
  for (let r = 0; r < order; r++) {
    for (let c = 0; c < order; c++) {
      const rank = parseInt(gridHex[r * order + c], 16);
      const reg = parseInt(gridHex[order * order + r * order + c], 16);
      const b = blds[c];
      const lvl = LEVELS[reg % LEVELS.length];
      cells.push({
        row: r,
        col: c,
        period: PERIODS[r] ?? `${8 + r * 2}:00`,
        hall: b?.code ?? `HALL_${c}`,
        building_id: b?.id ?? `hall_${c}`,
        programme: b ? b.code : `PROG_${rank}`,
        level: lvl,
      });
    }
  }
  return cells;
}
