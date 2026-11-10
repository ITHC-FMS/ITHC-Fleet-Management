import type { ScreenMap } from "../types";
import ClientHome from "./client/ClientHome";
import Bench from "./client/Bench";
import ContactLog from "./client/ContactLog";
import Pipeline from "./client/Pipeline";
import Placements from "./client/Placements";
import Renewals from "./client/Renewals";
import SeatFill from "./client/SeatFill";
import DocumentsAll, { HrDocuments } from "./Documents";
import HousingHome from "./housing/HousingHome";
import Leases from "./housing/Leases";
import Occupancy from "./housing/Occupancy";
import Properties from "./housing/Properties";
import Stays from "./housing/Stays";
import Supervisors from "./housing/Supervisors";
import HrHome from "./HrHome";
import Watchlist from "./Watchlist";

/** Keys: "<role>/<page>" (role-specific) or "<poolRole>/<page>" source key from pick() (shared). */
export const peopleScreens: ScreenMap = {
  // shared, by source key
  "housing/properties": Properties,
  "housing/occupancy": Occupancy,
  "housing/leases": Leases,
  "housing/documents": DocumentsAll,
  "client/placements": Placements,
  "client/pipeline": Pipeline,
  "client/seat-fill": SeatFill,
  "client/bench": Bench,
  "client/contact-log": ContactLog,
  "client/renewals": Renewals,
  // role-specific
  "housing/home": HousingHome,
  "housing/stays": Stays,
  "housing/supervisors": Supervisors,
  "hr/home": HrHome,
  "hr/documents": HrDocuments,
  "hr/watchlist": Watchlist,
  "admin/watchlist": Watchlist,
  "client/home": ClientHome,
};
