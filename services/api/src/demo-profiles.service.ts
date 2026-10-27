import {BadRequestException,NotFoundException,ForbiddenException,ConflictException} from '@nestjs/common';
import {randomBytes} from 'crypto';
import {passwordHash} from './auth';
import {DbService} from './db.service';
import {JUSTICE_ROLES} from './justice-catalog';
export class DemoProfilesService{
 constructor(private db:DbService){}
 async seed(actor:string){
  const c=await this.db.pool.connect();let created=0;
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736197)');
   for(const [i,role] of JUSTICE_ROLES.entries()){
    const number=String(i+1).padStart(3,'0');
    const profile={...this.details(role),name:'Demo Professional '+number,email:role.id+'@demo.justisolve.invalid',role:role.label,category:role.category,jurisdiction:'Fictional demonstration jurisdiction',organization:'JustiSolve Demo Justice Center',credential_status:'Synthetic example — no professional license or appointment verified',duties:role.duties,biography:'Fictional profile for learning the '+role.label+' workspace. No real person, office, client or case is represented.',sample_case:{reference:'DEMO-'+number,title:'Training matter '+number,court:'Fictional Training Court',confidentiality:'Demo data only',summary:'Synthetic records for practicing assigned procedures. All statements and outcomes are fictional; no official action occurs.'},tasks:role.workflow.map((title,n)=>({id:n+1,title,status:'pending'}))};
    const row=await c.query('INSERT INTO justice_demo_profiles(role_id,profile) VALUES($1,$2) ON CONFLICT(role_id) DO NOTHING RETURNING role_id',[role.id,profile]);created+=row.rows.length;
    await c.query('UPDATE justice_demo_profiles SET profile=$2::jsonb || profile WHERE role_id=$1',[role.id,JSON.stringify(this.details(role))]);
   }
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'demo_profiles_seeded','demo','role_catalog',$2)",[actor,{created,catalog_roles:JUSTICE_ROLES.length}]);await c.query('COMMIT');return {created,catalog_roles:JUSTICE_ROLES.length};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 private details(role:any){return {display_name:role.label+' Demo',account_type:'individual',country:'Fictional demonstration country',region:'Training district',city:'Demo City',address:'Training Center, Fictional Campus',postal_code:'DEMO',timezone:'America/Chicago',language:'English',contact_email:role.id+'@demo.justisolve.invalid',phone:'Not provisioned — demo only',professional_summary:'Synthetic '+role.label+' profile for practicing role-specific duties.',specializations:[role.category],experience:'Fictional training experience only',education:'Demonstration curriculum; no real qualification asserted',license_number:'None — synthetic profile',availability:'Training workspace available on demand',preferences:{notifications:false,paid_services:false,external_integrations:false}};}
 async provision(actor:string,rotateRole?:string,publicPassword?:string){
  await this.seed(actor);
  if(rotateRole&&!JUSTICE_ROLES.some(r=>r.id===rotateRole))throw new BadRequestException('Unknown demo role.');
  const credentials:any[]=[];const c=await this.db.pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736197)');
   if(!Number((await c.query("SELECT count(*) n FROM platform_accounts WHERE role='super_admin' AND active=true AND demo_role_id IS NULL")).rows[0].n))throw new ConflictException('Create an active super administrator before provisioning demo logins.');
   for(const role of JUSTICE_ROLES.filter(r=>!rotateRole||r.id===rotateRole)){
    const row=(await c.query('SELECT profile,account_id FROM justice_demo_profiles WHERE role_id=$1 FOR UPDATE',[role.id])).rows[0];
    if(row.account_id&&!rotateRole&&!publicPassword)continue;
    const password=publicPassword||randomBytes(24).toString('base64url'),hash=await passwordHash(password);let account;
    if(row.account_id){
     account=(await c.query("UPDATE platform_accounts SET password_hash=$2 WHERE id=$1 AND demo_role_id=$3 AND role='user' RETURNING id,email,name",[row.account_id,hash,role.id])).rows[0];
     if(!account)throw new ConflictException('Demo mapping is inconsistent; no account was changed.');
     await c.query('DELETE FROM platform_sessions WHERE account_id=$1',[account.id]);
     await c.query('DELETE FROM platform_account_tokens WHERE account_id=$1',[account.id]);
    }else{
     account=(await c.query("INSERT INTO platform_accounts(email,name,password_hash,role,email_verified,admin_approved,demo_role_id) VALUES($1,$2,$3,'user',false,true,$4) ON CONFLICT DO NOTHING RETURNING id,email,name",[row.profile.email,row.profile.name,hash,role.id])).rows[0];
     if(!account)throw new ConflictException('Demo email or role already belongs to an account. No existing account was adopted.');
     await c.query('UPDATE justice_demo_profiles SET account_id=$2 WHERE role_id=$1',[role.id,account.id]);
    }
    if(publicPassword)await c.query('INSERT INTO public_demo_logins(role_id,account_id,public_password,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(role_id) DO UPDATE SET account_id=EXCLUDED.account_id,public_password=EXCLUDED.public_password,password_hash=EXCLUDED.password_hash',[role.id,account.id,password,hash]);
    credentials.push({role_id:role.id,role:role.label,name:account.name,email:account.email,password});
   }
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'demo_logins_provisioned','demo','role_catalog',$2)",[actor,{count:credentials.length,rotation:!!rotateRole}]);
   await c.query('COMMIT');return {created:credentials.length,credentials,notice:'Save passwords now. Only password hashes are stored. Demo accounts access only their own fictional training workspace.'};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async publicLogins(){
  const rows=(await this.db.query("SELECT p.role_id,a.email,p.public_password password FROM public_demo_logins p JOIN platform_accounts a ON a.id=p.account_id AND a.demo_role_id=p.role_id AND a.password_hash=p.password_hash WHERE a.role='user' AND a.active=true AND a.deleted_at IS NULL AND (a.email_verified=true OR a.admin_approved=true) ORDER BY p.role_id")).rows;
  const catalog=new Map(JUSTICE_ROLES.map(r=>[r.id,r]));
  return {notice:'Shared synthetic training accounts only. Progress is shared with other testers. No real case access or paid integrations.',accounts:rows.filter(r=>catalog.has(r.role_id)).map(r=>({...r,role:catalog.get(r.role_id)!.label,category:catalog.get(r.role_id)!.category}))};
 }
 async own(accountId:any,role:string){
  const row=(await this.db.query('SELECT role_id,profile,updated_at FROM justice_demo_profiles WHERE account_id=$1 AND role_id=$2',[accountId,role])).rows[0];
  if(!row)throw new ForbiddenException('This demo profile is unavailable.');return row;
 }
 async ownTask(accountId:any,role:string,b:any,actor:string){await this.own(accountId,role);return this.task(role,b,actor);}
 async list(){return {catalog_roles:JUSTICE_ROLES.length,profiles:(await this.db.query('SELECT role_id,profile,updated_at,account_id FROM justice_demo_profiles ORDER BY role_id')).rows};}
 async task(role:string,b:any,actor:string){
  if(!Number.isInteger(b.task_id)||b.task_id<1||b.task_id>5||!['pending','in_progress','completed'].includes(b.status))throw new BadRequestException('Choose a demo task and valid status.');
  const c=await this.db.pool.connect();try{await c.query('BEGIN');const row=(await c.query('SELECT profile FROM justice_demo_profiles WHERE role_id=$1 FOR UPDATE',[role])).rows[0];if(!row)throw new NotFoundException('Demo profile not found.');const profile=row.profile;profile.tasks=profile.tasks.map((t:any)=>t.id===b.task_id?{...t,status:b.status}:t);await c.query('UPDATE justice_demo_profiles SET profile=$2,updated_at=now() WHERE role_id=$1',[role,profile]);await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'demo_task_updated','demo',$2,$3)",[actor,role,{task_id:b.task_id,status:b.status}]);await c.query('COMMIT');return {saved:true};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
