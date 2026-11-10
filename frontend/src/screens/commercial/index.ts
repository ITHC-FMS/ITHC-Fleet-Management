import type { ScreenMap } from "../types";
import AllModules from "./AllModules";
import ApprovalsScreen from "./ApprovalsScreen";
import AuditLogScreen from "./AuditLogScreen";
import CashScreen from "./CashScreen";
import CeoHome from "./CeoHome";
import ContactLogScreen from "./ContactLogScreen";
import ContractsScreen from "./ContractsScreen";
import CostsScreen from "./CostsScreen";
import DocumentsScreen from "./DocumentsScreen";
import FinanceHome from "./FinanceHome";
import LossMakingScreen from "./LossMakingScreen";
import MarginScreen from "./MarginScreen";
import PnlScreen from "./PnlScreen";
import ReconciliationScreen from "./ReconciliationScreen";
import RevenueScreen from "./RevenueScreen";
import SignedScreen from "./SignedScreen";
import StoresScreen from "./StoresScreen";
import TcoScreen from "./TcoScreen";

/** Keys: "<role>/<page>" (role-specific) or "<poolRole>/<page>" source key from pick() (shared). */
export const commercialScreens: ScreenMap = {
  "operations/contracts": ContractsScreen,
  "operations/revenue": RevenueScreen,
  "operations/cash": CashScreen,
  "operations/stores": StoresScreen,
  "principal/margin": MarginScreen,
  "principal/group-pnl": PnlScreen,
  "principal/vehicle-tco": TcoScreen,
  "principal/loss-making": LossMakingScreen,
  "principal/contact-log": ContactLogScreen,
  "principal/audit-log": AuditLogScreen,
  "ceo/home": CeoHome,
  "ceo/approvals": ApprovalsScreen,
  "ceo/all-modules": AllModules,
  "finance/home": FinanceHome,
  "finance/signed": SignedScreen,
  "finance/reconciliation": ReconciliationScreen,
  "finance/costs": CostsScreen,
  "finance/documents": DocumentsScreen,
};
