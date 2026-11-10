import type { ScreenMap } from "../types";
import AdvancesScreen from "./AdvancesScreen";
import AssignmentsScreen from "./AssignmentsScreen";
import { OpsHome, PayrollHome } from "./HomeScreens";
import ImportsScreen from "./ImportsScreen";
import OffboardingScreen from "./OffboardingScreen";
import OrdersScreen from "./OrdersScreen";
import PayParametersScreen from "./PayParametersScreen";
import PayrollConfigScreen from "./PayrollConfigScreen";
import PayrollScreen from "./PayrollScreen";
import PerformanceScreen from "./PerformanceScreen";
import ReportsScreen from "./ReportsScreen";
import ScheduleScreen from "./ScheduleScreen";
import WorkersScreen from "./WorkersScreen";

/** Keys: "<role>/<page>" (role-specific) or "<poolRole>/<page>" source key from pick() (shared). */
export const opsScreens: ScreenMap = {
  "operations/home": OpsHome,
  "payroll/home": PayrollHome,
  "payroll/pay-parameters": PayParametersScreen,
  "operations/orders": OrdersScreen,
  "operations/assignments": AssignmentsScreen,
  "operations/schedule": ScheduleScreen,
  "operations/imports": ImportsScreen,
  "operations/reports": ReportsScreen,
  "operations/performance": PerformanceScreen,
  "operations/workers": WorkersScreen,
  "operations/payroll": PayrollScreen,
  "operations/advances": AdvancesScreen,
  "operations/payroll-config": PayrollConfigScreen,
  "operations/offboarding": OffboardingScreen,
};
