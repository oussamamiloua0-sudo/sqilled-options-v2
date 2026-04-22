'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';

function PostHogIdentifyInner() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      const sessionKey = 'sqilled_session_count';
      const prev = parseInt(localStorage.getItem(sessionKey) ?? '0');
      const sessionNumber = prev + 1;
      localStorage.setItem(sessionKey, String(sessionNumber));
      const daysSinceSignup = user.createdAt
        ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        first_name: user.firstName,
        last_name: user.lastName,
        avatar: user.imageUrl,
        created_at: user.createdAt,
        session_number: sessionNumber,
        days_since_signup: daysSinceSignup,
      });
    } else {
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}

export function PostHogIdentify() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <PostHogIdentifyInner />;
}
