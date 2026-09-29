import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber('GB')
  phone_number: string;

  @IsString()
  @Length(4, 8)
  code: string;
}
