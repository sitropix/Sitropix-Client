-- Staff team invites: persist intended role until signup completes.
ALTER TABLE "invites" ADD COLUMN "invited_role" "Role";
