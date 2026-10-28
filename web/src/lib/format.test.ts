import { describe, expect, test } from "vitest";
import {
  amountToInput,
  formatDate,
  formatMoney,
  keyToMonthInput,
  monthInputToKey,
  monthLabel,
  monthLongLabel,
  parseAmount,
  shiftMonthKey,
  todayISO,
} from "./format";

const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatMoney", () => {
  test("pt-PT com vírgula decimal e euro no fim", () => {
    expect(plain(formatMoney(205.6))).toBe("205,60 €");
    expect(plain(formatMoney("1175.6"))).toBe("1175,60 €");
    expect(plain(formatMoney(12345.678))).toBe("12 345,68 €");
    expect(plain(formatMoney(-730.23))).toBe("-730,23 €");
    expect(formatMoney(null)).toBe("—");
  });
});

describe("parseAmount", () => {
  test.each([
    ["12,5", 12.5],
    ["12.50", 12.5],
    ["1 234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234", 1234],
    ["€ 3", 3],
    ["0,995", 1],
    ["-30", -30],
  ])("%s → %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  test.each(["", "abc", "1,2,3", "12,", ",5x"])("rejeita %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  test("amountToInput devolve vírgula", () => {
    expect(amountToInput(40.97)).toBe("40,97");
    expect(amountToInput("3")).toBe("3,00");
  });
});

describe("datas e meses", () => {
  test("dd/mm/aaaa", () => {
    expect(formatDate("2026-10-28")).toBe("28/10/2026");
    expect(formatDate(null)).toBe("—");
  });

  test("hoje no fuso de Lisboa, mesmo perto da meia-noite UTC", () => {
    expect(todayISO("Europe/Lisbon", new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-28");
    expect(todayISO("Europe/Lisbon", new Date("2026-07-31T23:30:00Z"))).toBe("2026-08-01");
  });

  test("rótulos e deslocação de meses", () => {
    expect(monthLabel(202611)).toBe("Nov 26");
    expect(monthLongLabel(202701)).toBe("janeiro de 2027");
    expect(shiftMonthKey(202612, 1)).toBe(202701);
    expect(shiftMonthKey(202701, -1)).toBe(202612);
    expect(monthInputToKey("2026-11")).toBe(202611);
    expect(keyToMonthInput(202610)).toBe("2026-10");
  });
});
