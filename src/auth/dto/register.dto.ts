import { IsEnum, IsOptional, IsPhoneNumber, IsString } from 'class-validator';

// Property names are snake_case to match the wire format used throughout
// qcab_api.yaml and every client (the Flutter app's ApiClient included) —
// this must stay consistent with the OpenAPI contract, not TS convention.
export class RegisterDto {
  @IsPhoneNumber('GB')
  phone_number: string;

  @IsEnum(['rider', 'driver'])
  role: 'rider' | 'driver';

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
