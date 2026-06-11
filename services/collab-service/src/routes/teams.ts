/**
 * teams routes â€?Team management + member management
 *
 * P0 D4 â€?collab-service teams endpoints
 * Auth: requireAuth() + teamRoleCheck
 *
 * Endpoints:
 *   GET    /api/v1/teams                       â€?List user's teams
 *   POST   /api/v1/teams                       â€?Create team
 *   GET    /api/v1/teams/:id/members           â€?List members
 *   POST   /api/v1/teams/:id/members           â€?Add member
 *   PATCH  /api/v1/teams/:id                   â€?Update team (owner only)
 *   DELETE /api/v1/teams/:id                   â€?Delete team (owner only)
 *   POST   /api/v1/teams/:id/invitations       â€?Create invitation
 *   POST   /api/v1/teams/:id/invitations/:invId/accept â€?Accept invitation
 *   GET    /api/v1/teams/:id/invitations       â€?List invitations
 *   DELETE /api/v1/teams/:id/members/:userId   â€?Remove member
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireRole, getUser } from "@manhuaworks/shared";
import { ah, HttpError } from "../middleware/error.js";
import { query, withTransaction } from "../config/db.js";
import { logger } from "../config/logger.js";

export const teamsRouter = Router();

// All endpoints require auth
teamsRouter.use(requireAuth());

// Helper: check team owner
async function getTeamOwner(teamId: string): Promise<{ owner_id: string; name: string } | null> {
  const r = await query<{ owner_id: string; name: string }>(
    "SELECT owner_id, name FROM teams WHERE id = $1 LIMIT 1",
    [teamId]
  );
  return r.rows[0] ?? null;
}

async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const r = await query<{ 1: number }>(
    "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
    [teamId, userId]
  );
  return (r.rowCount ?? 0) > 0;
}

// ====================== GET /api/v1/teams ======================
teamsRouter.get("/", ah(async (req: Request, res: Response) => {
  const callerId = req.user!.id;
  const r = await query(
    `SELECT DISTINCT t.id, t.name, t.owner_id, t.created_at
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     WHERE t.owner_id = $1 OR tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [callerId]
  );
  res.json({ code: 0, message: "ok", data: { items: r.rows, total: r.rowCount ?? 0 } });
}));

// ====================== POST /api/v1/teams ======================
const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

teamsRouter.post("/", ah(async (req: Request, res: Response) => {
  const callerId = req.user!.id;
  const body = CreateTeamSchema.parse(req.body);
  const r = await query(
    `INSERT INTO teams (name, description, owner_id) VALUES ($1, $2, $3)
     RETURNING id, name, description, owner_id, created_at`,
    [body.name, body.description ?? null, callerId]
  );
  // Auto-add owner as member
  await query(
    "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'admin')",
    [r.rows[0].id, callerId]
  );
  res.status(201).json({ code: 0, message: "created", data: r.rows[0] });
}));

// ====================== POST /api/v1/teams/:id/members ======================
const AddMemberSchema = z.object({
  userId: z.string().uuid("invalid userId"),
  role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
});

teamsRouter.post("/:id/members", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found", "Team " + teamId + " not found");

  // Only owner/admin can add members
  const isOwner = team.owner_id === callerId;
  const isAdmin = (req.user!.role ?? 0) >= 5;
  if (!isOwner && !isAdmin) {
    throw new HttpError(403, "forbidden", "only team owner can add members");
  }

  const body = AddMemberSchema.parse(req.body);

  // Check if already member
  const existing = await query<{ 1: number }>(
    "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
    [teamId, body.userId]
  );
  if ((existing.rowCount ?? 0) > 0) {
    throw new HttpError(409, "already_member", "user is already a team member");
  }

  // Check invitee exists
  const invitee = await query<{ id: string; display_name: string }>(
    "SELECT id, display_name FROM users WHERE id = $1 LIMIT 1",
    [body.userId]
  );
  if ((invitee.rowCount ?? 0) === 0) {
    throw new HttpError(404, "user_not_found");
  }

  const member = await query(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
     RETURNING id, team_id, user_id, role, joined_at`,
    [teamId, body.userId, body.role]
  );

  res.status(201).json({ code: 0, message: "member_added", data: member.rows[0] });
}));

// ====================== GET /api/v1/teams/:id/members ======================
teamsRouter.get("/:id/members", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found", "Team " + teamId + " not found");

  // Must be member to see members
  if (team.owner_id !== callerId && !(await isTeamMember(teamId, callerId))) {
    throw new HttpError(403, "forbidden", "not a team member");
  }

  const r = await query(
    `SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.joined_at
     FROM team_members tm
     WHERE tm.team_id = $1
     ORDER BY tm.joined_at ASC`,
    [teamId]
  );

  res.json({
    code: 0,
    message: "ok",
    data: { team: { id: teamId, name: team.name, owner_id: team.owner_id }, members: r.rows, total: r.rowCount ?? 0 },
  });
}));

// ====================== PATCH /api/v1/teams/:id ======================
teamsRouter.patch("/:id", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found");
  if (team.owner_id !== callerId) {
    throw new HttpError(403, "forbidden", "only team owner can update");
  }

  const { name, description } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (name !== undefined) { updates.push("name = $" + (i++)); values.push(name); }
  if (description !== undefined) { updates.push("description = $" + (i++)); values.push(description); }

  if (updates.length === 0) {
    throw new HttpError(400, "no_fields", "no fields to update");
  }

  values.push(teamId);
  const r = await query(
    "UPDATE teams SET " + updates.join(", ") + " WHERE id = $" + i + " RETURNING id, name, description, owner_id, updated_at",
    values
  );

  res.json({ code: 0, message: "updated", data: r.rows[0] });
}));

// ====================== DELETE /api/v1/teams/:id ======================
teamsRouter.delete("/:id", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found");
  if (team.owner_id !== callerId) {
    throw new HttpError(403, "forbidden", "only team owner can delete");
  }

  await query("DELETE FROM teams WHERE id = $1", [teamId]);
  res.json({ code: 0, message: "deleted", data: { id: teamId } });
}));

// ====================== POST /api/v1/teams/:id/invitations ======================
teamsRouter.post("/:id/invitations", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found");
  if (team.owner_id !== callerId) {
    throw new HttpError(403, "forbidden", "only team owner can invite");
  }

  const body = z.object({
    email: z.string().email().optional(),
    userId: z.string().uuid().optional(),
    role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
  }).refine((d) => d.email || d.userId, { message: "email or userId required" }).parse(req.body);

  // Check invitee exists if userId provided
  let inviteeId = body.userId ?? null;
  let inviteeEmail = body.email ?? null;
  if (body.userId) {
    const u = await query<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE id = $1 LIMIT 1", [body.userId]
    );
    if ((u.rowCount ?? 0) === 0) throw new HttpError(404, "user_not_found");
    inviteeEmail = u.rows[0].email;
  }

  const r = await query(
    `INSERT INTO team_invitations (team_id, inviter_id, invitee_email, invitee_id, role, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, team_id, inviter_id, invitee_email, invitee_id, role, status, created_at`,
    [teamId, callerId, inviteeEmail, inviteeId, body.role]
  );

  res.status(201).json({ code: 0, message: "invitation_created", data: r.rows[0] });
}));

// ====================== POST /api/v1/teams/:id/invitations/:invId/accept ======================
teamsRouter.post("/:id/invitations/:invId/accept", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const invId = req.params.invId;
  const callerId = req.user!.id;

  const inv = await query<{ id: string; team_id: string; invitee_id: string | null; role: string; status: string }>(
    "SELECT * FROM team_invitations WHERE id = $1 AND team_id = $2 LIMIT 1", [invId, teamId]
  );
  if ((inv.rowCount ?? 0) === 0) throw new HttpError(404, "invitation_not_found");
  if (inv.rows[0].status !== "pending") throw new HttpError(400, "invitation_not_pending");
  if (inv.rows[0].invitee_id && inv.rows[0].invitee_id !== callerId) {
    throw new HttpError(403, "forbidden", "invitation is for another user");
  }

  // Accept: update status + add member
  await query("UPDATE team_invitations SET status = 'accepted', updated_at = now() WHERE id = $1", [invId]);
  await query(
    "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (team_id, user_id) DO NOTHING",
    [teamId, callerId, inv.rows[0].role]
  );

  res.json({ code: 0, message: "invitation_accepted", data: { teamId, userId: callerId } });
}));

// ====================== DELETE /api/v1/teams/:id/members/:userId ======================
teamsRouter.delete("/:id/members/:userId", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const targetUserId = req.params.userId;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found");

  // Owner/admin can remove; self can leave
  const isOwner = team.owner_id === callerId;
  const isAdmin = (req.user!.role ?? 0) >= 5;
  const isSelf = targetUserId === callerId;

  if (!isOwner && !isAdmin && !isSelf) {
    throw new HttpError(403, "forbidden", "only team owner can remove members");
  }
  if (isSelf && team.owner_id === callerId) {
    throw new HttpError(400, "cannot_remove_owner", "team owner cannot remove themselves");
  }

  const r = await query(
    "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING id",
    [teamId, targetUserId]
  );
  if ((r.rowCount ?? 0) === 0) throw new HttpError(404, "member_not_found");

  res.json({ code: 0, message: "member_removed", data: { teamId, userId: targetUserId } });
}));

// ====================== GET /api/v1/teams/:id/invitations ======================
teamsRouter.get("/:id/invitations", ah(async (req: Request, res: Response) => {
  const teamId = req.params.id;
  const callerId = req.user!.id;

  const team = await getTeamOwner(teamId);
  if (!team) throw new HttpError(404, "team_not_found");
  if (team.owner_id !== callerId) {
    throw new HttpError(403, "forbidden", "only team owner can view invitations");
  }

  const r = await query(
    `SELECT id, team_id, inviter_id, invitee_email, invitee_id, role, status, created_at
     FROM team_invitations
     WHERE team_id = $1
     ORDER BY created_at DESC`,
    [teamId]
  );

  res.json({ code: 0, message: "ok", data: { items: r.rows, total: r.rowCount ?? 0 } });
}));

export default teamsRouter;
