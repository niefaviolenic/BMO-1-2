import { useRouter } from 'expo-router';

import { BirthdayScreen } from '@/features/birthday';

export default function BirthdayRoute() {
  const router = useRouter();

  return (
    <BirthdayScreen
      onContinue={() => {
        router.replace('/chat');
      }}
    />
  );
}
