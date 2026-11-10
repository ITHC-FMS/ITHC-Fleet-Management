import type { ScreenMap } from "../types";
import { withFleet } from "./boot";
import DeskHome from "./desk/home";
import HandoverScreen from "./desk/handover";
import InspectionScreen from "./desk/inspection";
import OfflineScreen from "./desk/offline";
import IncidentScreen from "./desk/incident";
import DamagedScreen from "./service/damaged";
import JobsScreen from "./service/jobs";
import ReturnScreen from "./service/return";
import VehiclesScreen from "./ops/vehicles";
import LocationsScreen from "./ops/locations";
import FuelScreen from "./ops/fuel";
import TransportScreen from "./ops/transport";
import UtilisationScreen from "./utilisation";
import FleetHome from "./mgr/home";
import LessorsScreen from "./mgr/lessors";
import VehicleAssignmentsScreen from "./mgr/vehicle-assignments";
import InspectionsScreen from "./mgr/inspections";
import DocumentsScreen from "./mgr/documents";
import DeskUsersScreen from "./mgr/desk-users";

/** Keys: "<role>/<page>" (role-specific) or "<poolRole>/<page>" source key from pick() (shared). */
export const fleetScreens: ScreenMap = {
  // shared, by source key
  "handover/handover": withFleet(HandoverScreen),
  "handover/inspection": withFleet(InspectionScreen),
  "handover/offline": withFleet(OfflineScreen),
  "handover/incident": withFleet(IncidentScreen),
  "fleet/damaged": withFleet(DamagedScreen),
  "fleet/jobs": withFleet(JobsScreen),
  "fleet/return": withFleet(ReturnScreen),
  "operations/vehicles": withFleet(VehiclesScreen),
  "operations/locations": withFleet(LocationsScreen),
  "operations/fuel": withFleet(FuelScreen),
  "operations/transport": withFleet(TransportScreen),
  "principal/utilisation": withFleet(UtilisationScreen),
  // role-specific
  "handover/home": withFleet(DeskHome),
  "fleet/home": withFleet(FleetHome),
  "fleet/lessors": withFleet(LessorsScreen),
  "fleet/vehicle-assignments": withFleet(VehicleAssignmentsScreen),
  "fleet/inspections": withFleet(InspectionsScreen),
  "fleet/documents": withFleet(DocumentsScreen),
  "fleet/desk-users": withFleet(DeskUsersScreen),
};
