import mongoose from 'mongoose';
import { Notification, NotificationPriority } from '../models/Notification';
import { User } from '../models/User';
import { StaffRoster } from '../models/StaffRoster';

export interface NotificationInput {
  title: string;
  message: string;
  type: string;
  priority?: NotificationPriority;
  sourceType: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  roles?: string[];
  departments?: string[];
  assignedNames?: string[];
  userIds?: string[];
}

/**
 * Notifications are fan-out records, not broadcast strings. Recipients are
 * resolved from the same User/StaffRoster relationship used for authorization.
 * A failed notification write must not roll back a core operational action.
 */
export async function notifyUsers(input: NotificationInput): Promise<void> {
  try {
    const recipients = new Map<string, { user: any; department?: string }>();
    const roles = new Set((input.roles ?? []).map((value) => value.toUpperCase()));
    const departments = new Set((input.departments ?? []).map((value) => value.toLowerCase()));

    const users = await User.find({ isActive: true }).select('_id name role department staffId');
    const assignedNames = new Set(input.assignedNames ?? []);
    let assignedStaffIds = new Set<string>();
    if (assignedNames.size > 0) {
      const staff = await StaffRoster.find({ name: { $in: [...assignedNames] } }).select('_id name');
      assignedStaffIds = new Set(staff.map((item) => item._id.toString()));
    }

    for (const user of users) {
      const userDepartment = String(user.department ?? '').toLowerCase();
      const matchesRole = roles.has(String(user.role).toUpperCase());
      const matchesDepartment = departments.has(userDepartment);
      const matchesName = assignedNames.has(user.name);
      const matchesStaff = user.staffId && assignedStaffIds.has(user.staffId.toString());
      const explicitlySelected = input.userIds?.includes(user._id.toString());
      if (matchesRole || matchesDepartment || matchesName || matchesStaff || explicitlySelected) {
        recipients.set(user._id.toString(), { user, department: user.department });
      }
    }

    if (recipients.size === 0 && input.userIds?.length) {
      for (const id of input.userIds) {
        if (mongoose.isValidObjectId(id)) {
          recipients.set(id, { user: { _id: id, role: 'STAFF' } });
        }
      }
    }

    if (recipients.size === 0) return;
    await Notification.insertMany([...recipients.values()].map(({ user, department }) => ({
      recipient_user_id: user._id,
      recipient_role: user.role,
      department: department ?? input.departments?.[0],
      type: input.type,
      priority: input.priority ?? 'MEDIUM',
      title: input.title,
      message: input.message,
      source_type: input.sourceType,
      source_id: input.sourceId,
      metadata: input.metadata,
    })));
  } catch (error) {
    console.error('Notification fan-out failed:', error);
  }
}

export const notifyManagers = (input: Omit<NotificationInput, 'roles'>) => notifyUsers({
  ...input,
  roles: ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'],
});

export const notifyDepartment = (department: string, input: Omit<NotificationInput, 'departments'>) => notifyUsers({
  ...input,
  departments: [department],
});
