import {Body,Controller,Get,Post,Param,Req,Res,ForbiddenException} from '@nestjs/common';
import {DbService} from '../db.service';
import {DemoProfilesService} from '../demo-profiles.service';
@Controller('justice/demo-profiles')
export class DemoProfilesController{
 constructor(private db:DbService){}
 private admin(req:any){if(req.admin?.role!=='super_admin')throw new ForbiddenException('Super administrator required.');}
 @Get('public') publicLogins(@Res({passthrough:true}) res:any){res.setHeader('Cache-Control','no-store');return new DemoProfilesService(this.db).publicLogins();}
 @Get('me') own(@Req() req:any){if(!req.admin?.demo_role_id)throw new ForbiddenException('Demo account required.');return new DemoProfilesService(this.db).own(req.admin.id,req.admin.demo_role_id);}
 @Post('me/task') ownTask(@Body() b:any,@Req() req:any){if(!req.admin?.demo_role_id)throw new ForbiddenException('Demo account required.');return new DemoProfilesService(this.db).ownTask(req.admin.id,req.admin.demo_role_id,b,req.admin.email);}
 @Post('logins') provision(@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).provision(req.admin.email);}
 @Post(':role/reset-login') reset(@Param('role') role:string,@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).provision(req.admin.email,role);}
 @Get() list(@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).list();}
 @Post() seed(@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).seed(req.admin.email);}
 @Post(':role/task') task(@Param('role') role:string,@Body() b:any,@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).task(role,b,req.admin.email);}
}
