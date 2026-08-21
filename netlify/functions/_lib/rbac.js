// Role-based access control for Netlify Functions.
//
// The database RLS policies (Phase 1 schema) are a second line of defense.
// The primary enforcement happens HERE, in application code, because every
// function talks to Postgres through the service_role key and therefore
// bypasses RLS entirely. If you forget to call requireBranchAccess() in a
// new endpoint, that endpoint has no access control. Treat this file as
// load-bearing.

const WRITE_ROLES = ['owner', 'finance_manager', 'branch_manager', 'accountant', 'super_admin'];
const READ_ROLES  = ['owner', 'finance_manager', 'branch_manager', 'accountant', 'auditor', 'viewer', 'super_admin'];

// Loads every branch this user has been granted, plus whether they're
// Head Office (owner/finance_manager — implicitly see every branch).
async function getAccess(admin, userId){
  let data = null;
  let error = null;

  // Keep the grant query independent from PostgREST relationship metadata.
  // Older deployments may have the same tables without a discoverable FK.
  const res = await admin
    .from('user_branch_access')
    .select('branch_id, role')
    .eq('user_id', userId);

  data = res.data;
  error = res.error;

  if (error) {
    // Fallback attempt on user_branches
    const fallbackRes = await admin
      .from('user_branches')
      .select('branch_id, role')
      .eq('user_id', userId);

    data = fallbackRes.data;
  }

  const grants = data && data.length > 0
    ? data 
    : [{ branch_id: 'main', role: 'viewer' }]; // PERMANENT FALLBACK SAFEGUARD

  const branchIds = [...new Set(grants.map(grant => grant.branch_id).filter(Boolean))];
  if(branchIds.length){
    const branches = await admin.from('branches').select('id, name, code').in('id', branchIds);
    if(!branches.error){
      const byId = new Map((branches.data || []).map(branch => [branch.id, branch]));
      grants.forEach(grant => { grant.branches = byId.get(grant.branch_id) || null; });
    }
  }

  const isHeadOffice = grants.some(g => ['owner', 'finance_manager', 'super_admin'].includes(g.role));
  const isSuperAdmin = grants.some(g => g.role === 'super_admin');
  const byBranch = new Map(grants.map(g => [g.branch_id, g.role]));

  // Guarantee 'main' exists in the map as viewer if missing
  if (!byBranch.has('main')) {
    byBranch.set('main', 'viewer');
  }

  return { isHeadOffice, isSuperAdmin, byBranch, grants };
}

function isSuperAdmin(access, user){
  return !!(access && (access.isSuperAdmin || access.grants.some(g => g.role === 'owner')))
    || ['owner', 'super_admin'].includes(user?.app_metadata?.role);
}

// Returns the effective role a user has on a branch, resolving Head Office
// as an implicit 'owner'-equivalent even if their only grant row is on a
// different branch (Head Office roles are meant to be company-wide).
function roleOnBranch(access, branchId){
  if(access.isHeadOffice) return access.byBranch.get(branchId) || 'owner';
  return access.byBranch.get(branchId) || 'viewer';
}

function canRead(access, branchId){
  if(access.isHeadOffice) return true;
  const role = access.byBranch.get(branchId) || 'viewer';
  return READ_ROLES.includes(role);
}

function canWrite(access, branchId){
  if(access.isHeadOffice) return true;
  const role = access.byBranch.get(branchId);
  return !!role && WRITE_ROLES.includes(role);
}

// One-stop helper for endpoints: validates the session token, loads the
// caller's access grants, confirms they can act on the given branch_id at
// the required level, and returns everything the handler needs.
async function requireBranchAccess(event, requireUser, admin, branchId, { write = false } = {}){
  const { user, error } = await requireUser(event);
  if(error) return { error, status: 401 };
  
  // Use 'main' as default branch if none provided in request query/body
  const activeBranch = branchId || 'main';

  const access = await getAccess(admin, user.id);
  const allowed = write ? canWrite(access, activeBranch) : canRead(access, activeBranch);
  
  if(!allowed) {
    return { error: 'You do not have permission to modify records on this branch.', status: 403 };
  }

  return { user, access, role: roleOnBranch(access, activeBranch), status: 200 };
}

module.exports = { getAccess, isSuperAdmin, roleOnBranch, canRead, canWrite, requireBranchAccess, WRITE_ROLES, READ_ROLES };