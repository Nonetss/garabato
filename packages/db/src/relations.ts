import { defineRelations } from "drizzle-orm"
import * as schema from "#schema"

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session(),
    accounts: r.many.account(),
    members: r.many.member(),
    teamMembers: r.many.teamMember(),
    invitationsSent: r.many.invitation(),
    apikeys: r.many.apikey(),
    comments: r.many.comments(),
    collections: r.many.collection(),
    teams: r.many.team({
      from: r.user.id.through(r.teamMember.userId),
      to: r.team.id.through(r.teamMember.teamId),
    }),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
    activeOrganization: r.one.organization({
      from: r.session.activeOrganizationId,
      to: r.organization.id,
      optional: true,
    }),
    activeTeam: r.one.team({
      from: r.session.activeTeamId,
      to: r.team.id,
      optional: true,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  organization: {
    members: r.many.member(),
    teams: r.many.team(),
    invitations: r.many.invitation(),
    roles: r.many.organizationRole(),
  },
  organizationRole: {
    organization: r.one.organization({
      from: r.organizationRole.organizationId,
      to: r.organization.id,
    }),
  },
  team: {
    organization: r.one.organization({
      from: r.team.organizationId,
      to: r.organization.id,
    }),
    teamMembers: r.many.teamMember(),
    invitations: r.many.invitation(),
    users: r.many.user({
      from: r.team.id.through(r.teamMember.teamId),
      to: r.user.id.through(r.teamMember.userId),
    }),
  },
  teamMember: {
    team: r.one.team({
      from: r.teamMember.teamId,
      to: r.team.id,
    }),
    user: r.one.user({
      from: r.teamMember.userId,
      to: r.user.id,
    }),
  },
  member: {
    organization: r.one.organization({
      from: r.member.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({
      from: r.member.userId,
      to: r.user.id,
    }),
  },
  invitation: {
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),
    inviter: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
    team: r.one.team({
      from: r.invitation.teamId,
      to: r.team.id,
      optional: true,
    }),
  },
  apikey: {
    user: r.one.user({
      from: r.apikey.referenceId,
      to: r.user.id,
    }),
  },
  cronJob: {
    runs: r.many.cronRun(),
  },
  cronRun: {
    job: r.one.cronJob({
      from: r.cronRun.jobId,
      to: r.cronJob.id,
    }),
  },
  comments: {
    author: r.one.user({
      from: r.comments.authorId,
      to: r.user.id,
    }),
  },
  collection: {
    owner: r.one.user({
      from: r.collection.ownerId,
      to: r.user.id,
    }),
    items: r.many.collectionItem(),
  },
  collectionItem: {
    collection: r.one.collection({
      from: r.collectionItem.collectionId,
      to: r.collection.id,
    }),
  },
}))
