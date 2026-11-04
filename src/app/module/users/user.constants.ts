export const USER_ROLE = {
  supper_admin: 'supper_admin',
  admin: 'admin',
  retail: 'retail',
  wholesale: 'wholesale',
};

export const ADMIN_ROLES = [USER_ROLE.supper_admin, USER_ROLE.admin] as const;

export const CUSTOMER_ROLES = [USER_ROLE.retail, USER_ROLE.wholesale] as const;

export const AUTH_ROLES = [
  USER_ROLE.supper_admin,
  USER_ROLE.admin,
  USER_ROLE.retail,
  USER_ROLE.wholesale,
] as const;

export const Role = ['supper_admin', 'admin', 'retail', 'wholesale'];

export const userSearchableFields = ['name', 'email', 'phoneNumber'];
