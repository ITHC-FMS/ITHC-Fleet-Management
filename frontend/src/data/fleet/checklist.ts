import type { ChecklistItem } from "./types";

const CAR: Omit<ChecklistItem, "grade">[] = [
  { key: "body", label: "Body and paint" }, { key: "glass", label: "Windscreen and mirrors" }, { key: "lights", label: "Lights and indicators" },
  { key: "tyres", label: "Tyres" }, { key: "interior", label: "Interior and cleanliness" }, { key: "warning", label: "Dashboard warning lights" },
];
const BIKE: Omit<ChecklistItem, "grade">[] = [
  { key: "body", label: "Frame and fairing" }, { key: "lights", label: "Lights and indicators" }, { key: "tyres", label: "Tyres" },
  { key: "brakes", label: "Brakes" }, { key: "box", label: "Delivery box and mirrors" }, { key: "helmet", label: "Helmet and gear" },
];
export const checklistFor = (type: string): Omit<ChecklistItem, "grade">[] => (type === "bike" ? BIKE : CAR);
export const blankChecklist = (type: string): ChecklistItem[] => checklistFor(type).map((c) => ({ ...c, grade: "ok" }));
export const resultOf = (items: ChecklistItem[]) => (items.some((i) => i.grade === "major") ? "fail" : items.some((i) => i.grade === "minor") ? "minor" : "pass") as "pass" | "minor" | "fail";
