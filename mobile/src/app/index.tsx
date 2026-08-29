import { useRouter } from 'expo-router';

import { WelcomeScreen } from '@/features/welcome/presentation/welcome-screen/welcome-screen';

export default function WelcomeRoute() {
  const router = useRouter();

  return (
    <WelcomeScreen
      onContinue={() => {
        router.push('/auth');
      }}
    />
  );
}
