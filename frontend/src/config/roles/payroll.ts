import { pick } from "../library";
import { r, type Role } from "../types";

export const payroll: Role = {
  slug: "payroll",
  title: "Payroll Manager",
  count: "1 user",
  use: "Payroll runs, advances and deductions.",
  layout: "desktop",
  pages: [
    {
      slug: "home",
      title: "Home — Payroll Overview",
      summary: "Draft content; the roles doc defines no dashboard for this role.",
      ref: "§7.6, §7.7",
      phase: "phase1",
      draft: true,
      requirements: [
        r("Current period state (not generated, open, closed)", "§5.5"),
        r("Drivers in transition this period", "§7.7"),
        r("Advances repaying and instalment deductions due", "§5.2"),
        r("Gross and net for the period, in KD to three decimals", "§7.6"),
        r("Periods reopened, with reasons", "§7.7"),
      ],
      future: [],
      shell: { kpis: ["Period status", "Drivers in run", "In transition", "Net (KD)"] },
    },
    pick("operations", "payroll"),
    pick("operations", "advances"),
    {
      slug: "pay-parameters",
      title: "Pay Parameters",
      summary: "Rates and targets per driver and per contract.",
      ref: "§7.6",
      phase: "phase1",
      requirements: [
        r("Target and rate parameters are contract and driver configuration, never constants in code", "§7.6"),
        r("Base salary, overtime component, food allowance, accommodation allowance, incentive rates and targets", "§7.6"),
        r("Bonus rates entered in fils", "§0, §7.6"),
        r("HR enters the initial values at onboarding; only the Payroll Manager edits them afterwards", "decision"),
        r("Every change recorded in the audit log with a reason", "§5.5"),
        r("Retroactive changes do not alter closed payroll periods", "§3.5"),
      ],
      future: [],
      shell: { columns: ["Worker", "Base (KD)", "Overtime (KD)", "Food (KD)", "Accommodation (KD)", "Target", "Effective from"], actions: ["Edit parameters"] },
    },
    pick("operations", "payroll-config"),
  ],
};
