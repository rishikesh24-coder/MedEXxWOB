import { useSelector } from 'react-redux';

/**
 * Centralized Role-Based Access Control (RBAC) definitions for the MedEx frontend prototype.
 * NOTE: This provides frontend authorization UX only. Backend authorization would still be required in production.
 */
export const ROLES = {
  HOSPITAL: 'hospital',
  ADMIN: 'admin',
  GUEST: 'guest',
};

export const PERMISSIONS = {
  // Hospital specific operations
  MANAGE_INVENTORY: [ROLES.HOSPITAL],
  REQUEST_MEDICINE: [ROLES.HOSPITAL],
  APPROVE_REQUESTS: [ROLES.HOSPITAL],
  DISPOSE_WASTE: [ROLES.HOSPITAL],
  BROWSE_MARKETPLACE: [ROLES.HOSPITAL],
  VIEW_TRADE_HISTORY: [ROLES.HOSPITAL],
  MANAGE_PAYMENTS: [ROLES.HOSPITAL],
  VIEW_HOSPITAL_REPORTS: [ROLES.HOSPITAL],

  // Admin / Supervisory specific operations
  VERIFY_HOSPITALS: [ROLES.ADMIN],
  AUDIT_LOGISTICS: [ROLES.ADMIN],
  SUPERVISE_DRUG_DIRECTORY: [ROLES.ADMIN],
  ACCESS_ADMIN_PANEL: [ROLES.ADMIN],
  VIEW_ADMIN_FEEDBACK: [ROLES.ADMIN],
  VIEW_NATIONAL_METRICS: [ROLES.ADMIN],

  // Shared authenticated operations
  EXPORT_DATA: [ROLES.HOSPITAL, ROLES.ADMIN],
  MANAGE_PROFILE: [ROLES.HOSPITAL, ROLES.ADMIN],
  VIEW_NOTIFICATIONS: [ROLES.HOSPITAL, ROLES.ADMIN],
  SEARCH_GLOBAL: [ROLES.HOSPITAL, ROLES.ADMIN],
};

/**
 * Checks if a given role has permission to perform an action.
 * @param {string} role - The current user's role
 * @param {string} permission - The permission constant to verify
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  if (!role || !permission) return false;
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
};

/**
 * React hook to access role permissions in components.
 */
export const usePermissions = () => {
  const { role, isAuthenticated, user } = useSelector((state) => state.auth);

  const check = (permission) => hasPermission(role, permission);

  return {
    role,
    user,
    isAuthenticated,
    can: check,
    canManageInventory: check(PERMISSIONS.MANAGE_INVENTORY),
    canRequestMedicine: check(PERMISSIONS.REQUEST_MEDICINE),
    canApproveRequests: check(PERMISSIONS.APPROVE_REQUESTS),
    canDisposeWaste: check(PERMISSIONS.DISPOSE_WASTE),
    canBrowseMarketplace: check(PERMISSIONS.BROWSE_MARKETPLACE),
    canVerifyHospitals: check(PERMISSIONS.VERIFY_HOSPITALS),
    canAuditLogistics: check(PERMISSIONS.AUDIT_LOGISTICS),
    canSuperviseDirectory: check(PERMISSIONS.SUPERVISE_DRUG_DIRECTORY),
    canExportData: check(PERMISSIONS.EXPORT_DATA),
    isHospital: role === ROLES.HOSPITAL,
    isAdmin: role === ROLES.ADMIN,
  };
};

export default hasPermission;
