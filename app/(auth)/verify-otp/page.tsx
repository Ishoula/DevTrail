import VerifyOTPForm from './verify-otp-form';

type SearchParams = Promise<{
  email?: string | string[];
  type?: string | string[];
}>;

type VerificationType = 'REGISTER' | 'RESET_PASSWORD';

function firstValue(value: string | string[] | undefined, fallback = '') {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function normalizeVerificationType(
  value: string | string[] | undefined,
): VerificationType {
  return firstValue(value) === 'RESET_PASSWORD' ? 'RESET_PASSWORD' : 'REGISTER';
}

export default async function VerifyOTPPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  return (
    <VerifyOTPForm
      email={firstValue(params.email)}
      verificationType={normalizeVerificationType(params.type)}
    />
  );
}
