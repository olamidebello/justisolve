import { Body, Controller, Get, Post, Patch, Delete, Param, Req, Res, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { randomBytes,randomUUID } from 'crypto';
import axios from 'axios';
import {JUSTICE_ROLES} from '../justice-catalog';
import { DbService } from '../db.service';
import { digest, passwordHash, passwordMatches, secretMatches } from '../auth';

function accountInput(b:any){if(!b||typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>254||typeof b.name!=='string'||!b.name.trim()||b.name.length>200||typeof b.password!=='string'||b.password.length<14||b.password.length>200)throw new BadRequestException('Name, valid email and password of 14–200 characters required.');}
@Controller('admin')
export class AdminController {
 constructor(private db:DbService){}
 private async audit(actor:string,action:string,id:any,meta:any={}){await this.db.query('INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,$2,$3,$4,$5)',[actor,action,'administration',String(id),meta]);}
 @Get('auth/status') async status(){return {setupRequired:Number((await this.db.query('SELECT count(*) n FROM platform_accounts')).rows[0].n)===0};}
 @Post('auth/bootstrap') async bootstrap(@Body() b:any){
  if(!secretMatches(b.setupToken||'',process.env.ADMIN_SETUP_TOKEN||''))throw new UnauthorizedException('Invalid setup token.');accountInput(b);
  const hash=await passwordHash(b.password);const c=await this.db.pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736192)');if(Number((await c.query('SELECT count(*) n FROM platform_accounts')).rows[0].n))throw new ConflictException('Setup already completed.');
   const r=await c.query('INSERT INTO platform_accounts(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email,name,role',[b.email.toLowerCase().trim(),b.name.trim(),hash]);await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES($1,'bootstrap','administration',$2)",[b.email,String(r.rows[0].id)]);for(const source of ['courtlistener','scotus','ca5'])await c.query("INSERT INTO news_campaigns(name,source,provider,max_items) VALUES($1,$2,$3,1)",['Public opinions — '+source,source,'ollama:'+(process.env.OLLAMA_MODEL||'llama3.2:3b')]);await c.query('COMMIT');return r.rows[0];
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 @Post('auth/login') async login(@Body() b:any,@Res({passthrough:true}) res:any){
  if(typeof b.password!=='string'||b.password.length>200||typeof b.email!=='string')throw new UnauthorizedException('Invalid credentials.');
  const a=(await this.db.query('SELECT * FROM platform_accounts WHERE email=$1 AND active=true',[b.email.toLowerCase().trim()])).rows[0];
  const valid=await passwordMatches(b.password,a?.password_hash||'dummy:'+('00'.repeat(64)));if(!a||!valid)throw new UnauthorizedException('Invalid credentials.');if(!a.email_verified&&!a.admin_approved)throw new UnauthorizedException('Your account is pending email verification or administrator approval.');
  const token=randomBytes(32).toString('hex');await this.db.query("DELETE FROM platform_sessions WHERE expires_at<now()");await this.db.query("INSERT INTO platform_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[digest(token),a.id]);
  res.cookie('justisolve_session',token,{httpOnly:true,secure:process.env.COOKIE_SECURE!=='false',sameSite:'strict',maxAge:8*3600000,path:'/api'});res.setHeader('Cache-Control','no-store');await this.audit(a.email,'login',a.id);return {id:a.id,email:a.email,name:a.name,role:a.demo_role_id?'user':a.role,demo_role_id:a.demo_role_id||null};
 }
 @Get('auth/me') me(@Req() req:any){return req.admin;}
 @Post('auth/logout') async logout(@Req() req:any,@Res({passthrough:true}) res:any){const token=String(req.headers.cookie||'').match(/(?:^|;\s*)justisolve_session=([a-f0-9]{64})/)?.[1];if(token)await this.db.query('DELETE FROM platform_sessions WHERE token_hash=$1',[digest(token)]);res.clearCookie('justisolve_session',{path:'/api',httpOnly:true,secure:process.env.COOKIE_SECURE!=='false',sameSite:'strict'});return {ok:true};}
 @Get('accounts') async accounts(){
  const [accounts,roles,members]=await Promise.all([
   this.db.query('SELECT a.id,a.email,a.name,a.role,a.active,a.email_verified,a.admin_approved,a.demo_role_id,a.profile,a.created_at,coalesce(w.balance_cents,0) balance_cents FROM platform_accounts a LEFT JOIN commerce_wallets w ON w.account_id=a.id WHERE a.deleted_at IS NULL ORDER BY a.id'),
   this.db.query('SELECT account_id,role_id,status,organization,jurisdiction,license_valid_until FROM justice_roles ORDER BY role_id'),
   this.db.query('SELECT m.account_id,m.role,m.active,o.id org_id,o.name,o.kind,o.active organization_active FROM justice_org_members m JOIN justice_orgs o ON o.id=m.org_id ORDER BY o.name,o.id')
  ]);
  const catalog=new Map(JUSTICE_ROLES.map(r=>[r.id,r]));
  const workspaceDescriptions:Record<string,string>={owner:'Owns the workspace and manages membership, settings and ownership transfers.',admin:'Manages permitted workspace members and settings.',counsel:'Participates as counsel in explicitly assigned matters.',staff:'Supports assigned workspace and case tasks.',client:'Uses permitted client services and explicitly assigned matters.',pro_se:'Manages self-represented work within assigned case permissions.'};
  return accounts.rows.map(a=>({...a,system_role_description:a.demo_role_id?'Restricted training login: access only to its own fictional profile and practice workflow.':a.role==='super_admin'?'Manages platform users, credits, integrations, configuration and feature controls. Private case content still requires assigned access.':'Uses personal tools and explicitly assigned workspace and case access; cannot administer the platform.',
   professional_roles:roles.rows.filter(r=>String(r.account_id)===String(a.id)).map(r=>{const definition=catalog.get(r.role_id);return {role_id:r.role_id,label:definition?.label||r.role_id,group:definition?.group||'unknown',category:definition?.category||'Unrecognized professional roles',description:definition?.duties||'No catalog description is available for this role.',status:r.status,organization:r.organization,jurisdiction:r.jurisdiction,credential_review_required:!!definition?.license_profession,credential_review_current:!!r.license_valid_until&&new Date(r.license_valid_until).getTime()>Date.now(),credential_valid_until:r.license_valid_until};}),
   demo_role:a.demo_role_id?catalog.get(a.demo_role_id)||null:null,
   workspace_memberships:members.rows.filter(m=>String(m.account_id)===String(a.id)).map(m=>({org_id:m.org_id,name:m.name,kind:m.kind,role:m.role,active:m.active,organization_active:m.organization_active,description:workspaceDescriptions[m.role]||'Access follows the assigned workspace role.'}))
  }));
 }
 @Post('accounts/:id/reset-link') async resetLink(@Param('id') id:string,@Req() req:any,@Res({passthrough:true}) res:any){
  if(!/^\d+$/.test(id))throw new BadRequestException('Valid account ID required.');
  const origin=new URL(process.env.PUBLIC_APP_URL||'https://justisolve.com');if(origin.protocol!=='https:'||origin.username||origin.password)throw new BadRequestException('Configure a valid HTTPS public application URL.');
  const token=randomBytes(32).toString('hex'),c=await this.db.pool.connect();
  try{await c.query('BEGIN');const account=(await c.query('SELECT id,email FROM platform_accounts WHERE id=$1 AND active=true FOR UPDATE',[id])).rows[0];if(!account)throw new BadRequestException('Active account not found.');
   await c.query('DELETE FROM platform_account_tokens WHERE account_id=$1',[id]);
   await c.query("INSERT INTO platform_account_tokens(token_hash,account_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",[digest(token),id]);
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES($1,'admin_reset_link_issued','account',$2)",[req.admin.email,String(id)]);await c.query('COMMIT');res.setHeader('Cache-Control','no-store');
   return {email:account.email,reset_url:origin.origin+'/#'+new URLSearchParams({action:'reset',token}).toString(),expires_in_minutes:30};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 @Post('accounts/:id/approve') async approve(@Param('id') id:string,@Req() req:any){
  if(!/^\d+$/.test(id))throw new BadRequestException('Valid account ID required.');
  const c=await this.db.pool.connect();try{
   await c.query('BEGIN');const row=(await c.query("UPDATE platform_accounts SET admin_approved=true WHERE id=$1 AND role='user' AND active=true RETURNING id,email,name,role,active,email_verified,admin_approved",[id])).rows[0];
   if(!row)throw new BadRequestException('Active user account not found.');
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'account_approved','account',$2,$3)",[req.admin.email,String(id),{email_verified:row.email_verified}]);await c.query('COMMIT');return row;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 private profileInput(value:any){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new BadRequestException('Valid profile required.');
  const limits:Record<string,number>={phone:40,organization:200,jurisdiction:200,country:100,timezone:80,biography:2000};const clean:any={};
  for(const [key,val] of Object.entries(value)){if(!limits[key]||typeof val!=='string'||val.length>limits[key])throw new BadRequestException('Invalid profile field: '+key);clean[key]=val.trim();}return clean;
 }
 private async revoke(c:any,id:string){await c.query('DELETE FROM platform_sessions WHERE account_id=$1',[id]);await c.query('DELETE FROM platform_account_tokens WHERE account_id=$1',[id]);await c.query('UPDATE platform_api_keys SET revoked_at=coalesce(revoked_at,now()) WHERE account_id=$1',[id]);}
 @Post('accounts') async add(@Body() b:any,@Req() req:any){
  accountInput(b);if(!['user','super_admin'].includes(b.role))throw new BadRequestException('Valid role required.');const profile=this.profileInput(b.profile||{}),hash=await passwordHash(b.password),c=await this.db.pool.connect();
  try{await c.query('BEGIN');const r=await c.query("INSERT INTO platform_accounts(email,name,password_hash,role,email_verified,admin_approved,profile) VALUES($1,$2,$3,$4,false,true,$5) RETURNING id,email,name,role,active",[b.email.toLowerCase().trim(),b.name.trim(),hash,b.role,profile]);
   await c.query("INSERT INTO phone_accounts(account_id,context_key) VALUES($1,$2)",[r.rows[0].id,'personal:'+r.rows[0].id]);
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'account_created','account',$2,$3)",[req.admin.email,String(r.rows[0].id),{role:b.role,admin_approved:true}]);await c.query('COMMIT');return r.rows[0];
  }catch(e){await c.query('ROLLBACK');if(e.code==='23505')throw new ConflictException('Account exists.');throw e;}finally{c.release();}
 }
 @Patch('accounts/:id') async account(@Param('id') id:string,@Body() b:any,@Req() req:any){
  if(!/^\d+$/.test(id)||!b||!Object.keys(b).length)throw new BadRequestException('Account and changes required.');
  const allowed=['name','email','password','role','active','admin_approved','profile'];if(Object.keys(b).some(k=>!allowed.includes(k)))throw new BadRequestException('Unsupported account field.');
  if(b.name!==undefined&&(typeof b.name!=='string'||!b.name.trim()||b.name.length>200))throw new BadRequestException('Valid name required.');
  if(b.email!==undefined&&(typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email.trim())||b.email.length>254))throw new BadRequestException('Valid email required.');
  if(b.role!==undefined&&!['user','super_admin'].includes(b.role))throw new BadRequestException('Valid role required.');
  for(const key of ['active','admin_approved'])if(b[key]!==undefined&&typeof b[key]!=='boolean')throw new BadRequestException('Boolean state required.');
  if(b.password!==undefined&&(typeof b.password!=='string'||b.password.length<14||b.password.length>200))throw new BadRequestException('Password must be 14–200 characters.');
  const profile=b.profile===undefined?undefined:this.profileInput(b.profile),hash=b.password===undefined?undefined:await passwordHash(b.password),c=await this.db.pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736194)');
   const target=(await c.query('SELECT * FROM platform_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];if(!target)throw new BadRequestException('Account not found.');
   const role=b.role??target.role,active=b.active??target.active,email=b.email===undefined?target.email:b.email.trim().toLowerCase(),changedEmail=email!==target.email;
   if(id===String(req.admin.id)&&(!active||role!=='super_admin'||!(b.admin_approved??target.admin_approved)&&(changedEmail||!target.email_verified)))throw new BadRequestException('You cannot remove your own administrator access.');
   if(target.demo_role_id&&(role!=='user'||b.email!==undefined&&b.email.trim().toLowerCase()!==target.email))throw new BadRequestException('Demo logins must retain their restricted role and email.');
   if(target.role==='super_admin'&&target.active&&(!active||role!=='super_admin')&&Number((await c.query("SELECT count(*) n FROM platform_accounts WHERE active=true AND role='super_admin' AND demo_role_id IS NULL AND deleted_at IS NULL")).rows[0].n)<=1)throw new BadRequestException('At least one administrator must remain active.');
   const row=(await c.query('UPDATE platform_accounts SET name=$2,email=$3,role=$4,active=$5,admin_approved=$6,email_verified=$7,password_hash=$8,profile=$9 WHERE id=$1 RETURNING id,email,name,role,active,email_verified,admin_approved,profile',[id,b.name===undefined?target.name:b.name.trim(),email,role,active,b.admin_approved??target.admin_approved,changedEmail?false:target.email_verified,hash??target.password_hash,profile===undefined?target.profile:{...target.profile,...profile}])).rows[0];
   if(hash||changedEmail||role!==target.role||!active||b.admin_approved===false&&target.admin_approved)await this.revoke(c,id);
   if(!active)await c.query('UPDATE phone_accounts SET next_attempt=now() WHERE account_id=$1',[id]);
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'account_updated','account',$2,$3)",[req.admin.email,id,{fields:Object.keys(b).filter(k=>k!=='password'),password_changed:!!hash,email_changed:changedEmail}]);await c.query('COMMIT');return row;
  }catch(e){await c.query('ROLLBACK');if(e.code==='23505')throw new ConflictException('Email already belongs to another account.');throw e;}finally{c.release();}
 }
 @Delete('accounts/:id') async removeAccount(@Param('id') id:string,@Body() b:any,@Req() req:any){
  if(!/^\d+$/.test(id)||typeof b?.confirm_email!=='string'||typeof b?.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000)throw new BadRequestException('Confirm the account email and provide a deletion reason.');
  if(id===String(req.admin.id))throw new BadRequestException('You cannot delete your current account.');
  const c=await this.db.pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736194)');
   const target=(await c.query('SELECT * FROM platform_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];if(!target)throw new BadRequestException('Account not found.');
   if(b.confirm_email.trim().toLowerCase()!==target.email)throw new BadRequestException('The confirmation email does not match.');
   if(target.role==='super_admin'&&target.active&&Number((await c.query("SELECT count(*) n FROM platform_accounts WHERE active=true AND role='super_admin' AND demo_role_id IS NULL AND deleted_at IS NULL")).rows[0].n)<=1)throw new BadRequestException('At least one administrator must remain active.');
   if((await c.query('SELECT id FROM justice_orgs WHERE owner_id=$1 AND active=true LIMIT 1',[id])).rows.length)throw new ConflictException('Transfer ownership of active workspaces before deleting this user.');
   await this.revoke(c,id);
   await c.query("UPDATE platform_accounts SET active=false,deleted_at=now(),name='Deleted user',email=$2,password_hash=$3,email_verified=false,admin_approved=false,role='user',profile='{}' WHERE id=$1",[id,'deleted-'+id+'-'+randomUUID()+'@deleted.justisolve.invalid',randomBytes(48).toString('hex')]);
   await c.query('UPDATE justice_org_members SET active=false WHERE account_id=$1',[id]);await c.query("UPDATE justice_roles SET status='revoked',license_claim='{}',license_version='',license_check_lease=NULL,license_next_check=NULL,license_valid_until=NULL,license_manual_until=NULL WHERE account_id=$1",[id]);
   await c.query("UPDATE justice_org_invites SET status='revoked' WHERE email=$1 AND status='pending'",[target.email]);
   await c.query('UPDATE pacer_access SET enabled=false WHERE account_id=$1',[id]);await c.query('UPDATE phone_accounts SET next_attempt=now() WHERE account_id=$1',[id]);
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'account_deleted','account',$2,$3)",[req.admin.email,id,{reason:b.reason.trim(),linked_records_retained:true}]);await c.query('COMMIT');return {deleted:true,linked_records_retained:true};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 @Get('organizations') async organizations(){return (await this.db.query('SELECT * FROM tenants ORDER BY tenant_id')).rows;}
 @Post('organizations') async org(@Body() b:any,@Req() req:any){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!/^[-a-z0-9]{2,60}$/.test(b.slug))throw new BadRequestException('Name and lowercase slug required.');const r=await this.db.query('INSERT INTO tenants(name,slug) VALUES($1,$2) RETURNING *',[b.name.trim(),b.slug]);await this.audit(req.admin.email,'organization_created',r.rows[0].tenant_id);return r.rows[0];}
 @Patch('organizations/:id') async orgState(@Param('id') id:string,@Body() b:any,@Req() req:any){if(!['active','suspended'].includes(b.status))throw new BadRequestException('Invalid status');const r=await this.db.query('UPDATE tenants SET status=$2 WHERE tenant_id=$1 RETURNING *',[id,b.status]);await this.audit(req.admin.email,'organization_status',id,{status:b.status});return r.rows[0];}
 @Get('overview') async overview(){return (await this.db.query("SELECT (SELECT count(*) FROM platform_accounts WHERE deleted_at IS NULL) accounts,(SELECT count(*) FROM tenants) organizations,(SELECT count(*) FROM news_campaigns) campaigns,(SELECT count(*) FROM news_posts WHERE status='published') published_posts,(SELECT count(*) FROM policy_requests WHERE status='open') open_requests")).rows[0];}
 @Get('resources') async resources(){const checks=await Promise.all([['AI',()=>axios.get((process.env.AI_BASE_URL||'http://ai:8000')+'/health',{timeout:5000})],['Database',()=>this.db.query('SELECT 1')]].map(async([name,fn]:any)=>{try{await fn();return {name,status:'available'};}catch{return {name,status:'unavailable'};}}));return checks;}
 @Get('audit') async auditList(){return (await this.db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200')).rows;}
 @Get('requests') async requests(){return (await this.db.query('SELECT * FROM policy_requests ORDER BY created_at DESC LIMIT 200')).rows;}
 @Patch('requests/:id') async closeRequest(@Param('id') id:string,@Body() b:any,@Req() req:any){if(!['open','resolved'].includes(b.status))throw new BadRequestException();const r=await this.db.query('UPDATE policy_requests SET status=$2 WHERE id=$1 RETURNING *',[id,b.status]);await this.audit(req.admin.email,'policy_request_status',id,{status:b.status});return r.rows[0];}
}
