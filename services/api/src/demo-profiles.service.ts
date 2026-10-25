import {BadRequestException,NotFoundException} from '@nestjs/common';
import {DbService} from './db.service';
import {JUSTICE_ROLES} from './justice-catalog';
export class DemoProfilesService{
 constructor(private db:DbService){}
 async seed(actor:string){
  const c=await this.db.pool.connect();let created=0;
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736197)');
   for(const [i,role] of JUSTICE_ROLES.entries()){
    const number=String(i+1).padStart(3,'0');
    const profile={name:'Demo Professional '+number,email:role.id+'@demo.justisolve.invalid',role:role.label,category:role.category,jurisdiction:'Fictional demonstration jurisdiction',organization:'JustiSolve Demo Justice Center',credential_status:'Synthetic example — no professional license or appointment verified',duties:role.duties,biography:'Fictional profile for learning the '+role.label+' workspace. No real person, office, client or case is represented.',sample_case:{reference:'DEMO-'+number,title:'Training matter '+number,court:'Fictional Training Court',confidentiality:'Demo data only',summary:'Synthetic records for practicing assigned procedures. All statements and outcomes are fictional; no official action occurs.'},tasks:role.workflow.map((title,n)=>({id:n+1,title,status:'pending'}))};
    const row=await c.query('INSERT INTO justice_demo_profiles(role_id,profile) VALUES($1,$2) ON CONFLICT(role_id) DO NOTHING RETURNING role_id',[role.id,profile]);created+=row.rows.length;
   }
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'demo_profiles_seeded','demo','role_catalog',$2)",[actor,{created,catalog_roles:JUSTICE_ROLES.length}]);await c.query('COMMIT');return {created,catalog_roles:JUSTICE_ROLES.length};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async list(){return {catalog_roles:JUSTICE_ROLES.length,profiles:(await this.db.query('SELECT role_id,profile,updated_at FROM justice_demo_profiles ORDER BY role_id')).rows};}
 async task(role:string,b:any,actor:string){
  if(!Number.isInteger(b.task_id)||b.task_id<1||b.task_id>5||!['pending','in_progress','completed'].includes(b.status))throw new BadRequestException('Choose a demo task and valid status.');
  const c=await this.db.pool.connect();try{await c.query('BEGIN');const row=(await c.query('SELECT profile FROM justice_demo_profiles WHERE role_id=$1 FOR UPDATE',[role])).rows[0];if(!row)throw new NotFoundException('Demo profile not found.');const profile=row.profile;profile.tasks=profile.tasks.map((t:any)=>t.id===b.task_id?{...t,status:b.status}:t);await c.query('UPDATE justice_demo_profiles SET profile=$2,updated_at=now() WHERE role_id=$1',[role,profile]);await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'demo_task_updated','demo',$2,$3)",[actor,role,{task_id:b.task_id,status:b.status}]);await c.query('COMMIT');return {saved:true};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
