import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LinkTokenService } from './link-token.service.js';
import { OtpService } from './otp.service.js';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, LinkTokenService],
  exports: [JwtModule, LinkTokenService, AuthService],
})
export class AuthModule {}
