import { AuthForm } from '@/components/AuthForm';
import { AuthScreen } from '@/components/AuthScreen';

export default function SignupScreen() {
  return (
    <AuthScreen>
      <AuthForm mode="signup" />
    </AuthScreen>
  );
}
