import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { BirthdayScreen } from '@/features/birthday';
import { claimBirthday } from '@/features/birthday/data/birthday-store';
import { useAuthSession } from '@/features/auth/presentation';

export default function BirthdayRoute() {
  const router = useRouter();
  const { user } = useAuthSession();

  const handleContinue = useCallback(async () => {
    if (user?.email) {
      await claimBirthday(user.email);
    }
    router.replace('/chat');
  }, [router, user?.email]);

  return <BirthdayScreen onContinue={handleContinue} />;
}
