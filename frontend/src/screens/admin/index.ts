import type { ScreenMap } from "../types";
import AdminHomeScreen from "./home";
import AssignmentAuditScreen from "./assignment-audit";
import AttendanceScreen from "./attendance";
import AttendanceSummaryScreen from "./attendance-summary";
import ClientsScreen from "./clients";
import CompanyScreen from "./company";
import GoLiveImportScreen from "./go-live-import";
import NotificationsScreen from "./notifications";
import AccountScreen from "./platform/account";
import { FirstLoginScreen, ForgotPasswordScreen, SignInScreen } from "./platform/auth-previews";
import RoadmapScreen from "./platform/roadmap";
import RulesScreen from "./platform/rules";
import TechnicalScreen from "./platform/technical";
import RolesScreen from "./roles";
import ManagerUsersScreen from "./users";
import WorkerAcknowledgeScreen from "./worker-acknowledge";
import WorkerShiftScreen from "./worker-shift";
import WorkerVehicleScreen from "./worker-vehicle";

/** Keys: "<role>/<page>" (role-specific) or "<poolRole>/<page>" source key from pick() (shared). */
export const adminScreens: ScreenMap = {
  "admin/home": AdminHomeScreen,
  "admin/clients": ClientsScreen,
  "admin/users": ManagerUsersScreen,
  "admin/roles": RolesScreen,
  "admin/company": CompanyScreen,
  "admin/assignment-audit": AssignmentAuditScreen,
  "admin/go-live-import": GoLiveImportScreen,
  "admin/notifications": NotificationsScreen,
  "finance/notifications": NotificationsScreen,
  "fleet/notifications": NotificationsScreen,
  "hr/notifications": NotificationsScreen,
  "housing/notifications": NotificationsScreen,
  "supervisor/attendance": AttendanceScreen,
  "supervisor/summary": AttendanceSummaryScreen,
  "worker/shift": WorkerShiftScreen,
  "worker/vehicle": WorkerVehicleScreen,
  "worker/acknowledge": WorkerAcknowledgeScreen,
  "platform/rules": RulesScreen,
  "platform/technical": TechnicalScreen,
  "platform/roadmap": RoadmapScreen,
  "platform/account": AccountScreen,
  "platform/sign-in": SignInScreen,
  "platform/forgot-password": ForgotPasswordScreen,
  "platform/first-login": FirstLoginScreen,
};
