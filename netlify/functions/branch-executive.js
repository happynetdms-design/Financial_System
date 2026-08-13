const { requireUser, adminClient, json } = require('./_lib/supabase');
const { getAccess, roleOnBranch } = require('./_lib/rbac');
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const admin=adminClient(); const {user,error}=await requireUser(event); if(error)return json(401,{error});
 try{
  const access=await getAccess(admin,user.id); if(!access.isHeadOffice)return json(403,{error:'Head Office access required.'});
  const {data,error:e}=await admin.from('hfms_branch_executive_position').select('*').order('revenue_kes',{ascending:false}); if(e)throw e;
  return json(200,{branches:data||[]});
 }catch(e){return json(500,{error:e.message});}
};
