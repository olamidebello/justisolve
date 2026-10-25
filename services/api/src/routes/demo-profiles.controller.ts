import {Body,Controller,Get,Post,Param,Req,ForbiddenException} from '@nestjs/common';
import {DbService} from '../db.service';
import {DemoProfilesService} from '../demo-profiles.service';
@Controller('justice/demo-profiles')
export class DemoProfilesController{
 constructor(private db:DbService){}
 private admin(req:any){if(req.admin?.role!=='super_admin')throw new ForbiddenException('Super administrator required.');}
 @Get() list(@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).list();}
 @Post() seed(@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).seed(req.admin.email);}
 @Post(':role/task') task(@Param('role') role:string,@Body() b:any,@Req() req:any){this.admin(req);return new DemoProfilesService(this.db).task(role,b,req.admin.email);}
}
