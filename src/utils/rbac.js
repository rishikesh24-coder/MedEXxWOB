/**
 * Centralized Role-Based Access Control (RBAC) & Permissions Utility
 * MedEx Healthcare Logistics Platform
 * 
 * IMPORTANT: In this frontend demonstration prototype, permissions are enforced
 * in client state to prevent unauthorized UI navigation and state manipulation.
 * True security authorization MUST be enforced on the authoritative backend server.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  HOSPITAL: 'hospital',
});

/**
 * Validates if the given role string is a recognized system role
 * @param {string} role 
 * @returns {boolean}
 */
export function isValidRole(role) {
  return role === ROLES.ADMIN || role === ROLES.HOSPITAL;
}

/**
 * Checks if a user has Admin role
 * @param {string|object} userOrRole 
 * @returns {boolean}
 */
export function canAccessAdmin(userOrRole) {
  const role = typeof userOrRole === 'object' ? userOrRole?.role : userOrRole;
  return role === ROLES.ADMIN;
}

/**
 * Checks if a user has Hospital role
 * @param {string|object} userOrRole 
 * @returns {boolean}
 */
export function canAccessHospital(userOrRole) {
  const role = typeof userOrRole === 'object' ? userOrRole?.role : userOrRole;
  return role === ROLES.HOSPITAL;
}

/**
 * Hospital-specific permission guards
 */
export function canManageInventory(userOrRole) {
  return canAccessHospital(userOrRole);
}

export function canApproveRequests(userOrRole) {
  return canAccessHospital(userOrRole);
}

export function canManageWaste(userOrRole) {
  return canAccessHospital(userOrRole);
}

export function canViewMarketplace(userOrRole) {
  return canAccessHospital(userOrRole);
}

/**
 * Admin-specific supervisory permission guards
 */
export function canVerifyHospitals(userOrRole) {
  return canAccessAdmin(userOrRole);
}

export function canSuperviseLogistics(userOrRole) {
  return canAccessAdmin(userOrRole);
}

export function canInspectPlatformAudit(userOrRole) {
  return canAccessAdmin(userOrRole);
}

/**
 * Generic permission evaluator
 * @param {object} user - Current user object
 * @param {string} requiredRole - 'admin' | 'hospital'
 * @returns {boolean}
 */
export function hasRequiredRole(user, requiredRole) {
  if (!user || !user.role) return false;
  if (!isValidRole(user.role)) return false;
  if (!requiredRole) return true;
  return user.role === requiredRole;
}
