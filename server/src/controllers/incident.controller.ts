import { Request, Response } from 'express';
import { Incident, IncidentStatus } from '../models/Incident';
import { AuditLog } from '../models/AuditLog';
import { notifyManagers, notifyUsers } from '../services/notificationService';

const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  DETECTED: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['RESPONDING', 'RESOLVED'],
  RESPONDING: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export async function listIncidents(req: Request, res: Response) {
  try {
    const incidents = await Incident.find({}).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load incidents' });
  }
}

export async function createIncident(req: Request, res: Response) {
  try {
    const { incident_type, severity = 'CRITICAL', location, description } = req.body ?? {};
    if (!incident_type || !location || !description) {
      res.status(422).json({ success: false, message: 'incident_type, location and description are required' });
      return;
    }
    const incident = await Incident.create({
      incident_id: `INC-${Date.now().toString(36).toUpperCase()}`,
      incident_type: String(incident_type).slice(0, 120),
      severity: severity === 'HIGH' ? 'HIGH' : 'CRITICAL',
      location: String(location).slice(0, 160),
      description: String(description).slice(0, 2000),
      detected_by: req.user?.name ?? 'Authenticated user',
      assigned_roles: ['MANAGER', 'SECURITY', 'STAFF'],
      actions: [{ actor: req.user?.name ?? 'System', status: 'NOTE', note: 'Incident detected; emergency procedure required.', at: new Date() }],
    });

    await notifyUsers({
      roles: ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'SECURITY'],
      type: 'CRITICAL_INCIDENT',
      priority: 'CRITICAL',
      title: `Critical incident at ${incident.location}`,
      message: `${incident.incident_type}: ${incident.description}. Follow the resort's configured emergency procedure; do not wait for this app to contact emergency responders.`,
      sourceType: 'Incident',
      sourceId: incident.incident_id,
      metadata: { location: incident.location, severity: incident.severity },
    });
    await AuditLog.create({
      user_name: req.user?.name ?? 'System',
      user_role: req.user?.role,
      action_type: 'INCIDENT_DETECTED',
      entity_type: 'Incident',
      entity_id: incident.incident_id,
      new_state: { status: incident.status, severity: incident.severity, location: incident.location },
    });
    res.status(201).json({ success: true, data: incident });
  } catch (error) {
    console.error('Incident creation failed:', error);
    res.status(500).json({ success: false, message: 'Unable to create incident' });
  }
}

export async function updateIncident(req: Request, res: Response) {
  try {
    const incident = await Incident.findOne({ incident_id: req.params.id });
    if (!incident) {
      res.status(404).json({ success: false, message: 'Incident not found' });
      return;
    }
    const nextStatus = req.body?.status as IncidentStatus | undefined;
    if (!nextStatus || !transitions[incident.status].includes(nextStatus)) {
      res.status(422).json({ success: false, message: `Invalid incident transition from ${incident.status}` });
      return;
    }
    const actor = req.user?.name ?? 'Authenticated user';
    const now = new Date();
    const note = String(req.body?.note ?? `Incident moved to ${nextStatus}`).slice(0, 500);
    incident.status = nextStatus;
    incident.actions.push({ actor, status: nextStatus, note, at: now });
    if (nextStatus === 'ACKNOWLEDGED') {
      incident.acknowledged_by = actor;
      incident.acknowledged_at = now;
    }
    if (nextStatus === 'RESPONDING') incident.response_started_at = now;
    if (nextStatus === 'RESOLVED') incident.resolved_at = now;
    if (nextStatus === 'CLOSED') incident.closed_at = now;
    await incident.save();

    await notifyUsers({
      roles: nextStatus === 'CLOSED' ? ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'] : ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'SECURITY'],
      type: 'INCIDENT_STATUS_CHANGED',
      priority: nextStatus === 'RESOLVED' || nextStatus === 'CLOSED' ? 'HIGH' : 'CRITICAL',
      title: `Incident ${incident.incident_id}: ${nextStatus}`,
      message: `${actor} recorded ${nextStatus.toLowerCase()} for ${incident.incident_type} at ${incident.location}. ${note}`,
      sourceType: 'Incident',
      sourceId: incident.incident_id,
    });
    await AuditLog.create({
      user_name: actor,
      user_role: req.user?.role,
      action_type: 'INCIDENT_STATUS_CHANGED',
      entity_type: 'Incident',
      entity_id: incident.incident_id,
      original_state: { status: transitions[incident.status]?.[0] },
      new_state: { status: nextStatus, note },
    });
    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('Incident update failed:', error);
    res.status(500).json({ success: false, message: 'Unable to update incident' });
  }
}
