'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';

interface SubscriptionContextType {
    isPremium: boolean;
    isTrial: boolean;
    subscriptionStatus: 'Trial' | 'Premium' | 'Expired' | 'Free';
    expiryDate: string | null;
    daysRemaining: number;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isPremium: false,
    isTrial: false,
    subscriptionStatus: 'Free',
    expiryDate: null,
    daysRemaining: 0
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user, userProfile } = useAuth(); // Get userProfile
    const [isPremium, setIsPremium] = useState(false);
    const [isTrial, setIsTrial] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<'Trial' | 'Premium' | 'Expired' | 'Free'>('Free');
    const [expiryDate, setExpiryDate] = useState<string | null>(null);
    const [daysRemaining, setDaysRemaining] = useState(0);

    useEffect(() => {
        if (!user || !userProfile) return;

        let activeUnsubscribe: (() => void) | null = null;
        let isCancelled = false;

        const init = async () => {
            const ownerId = userProfile.ownerId || user.uid;
            let isAppOwner = false;

            // 1. Check if CURRENT user is the App Owner
            if (user.email === 'wdbyakt@gmail.com' ||
                (userProfile?.role as string) === 'admin' ||
                user.uid === 'Lswb0erMZFUvbBCFfRXrwPwaPW93' // Hardcoded App Owner UID
            ) {
                isAppOwner = true;
            }

            // 2. If Staff, check if their OWNER is the App Owner
            if (!isAppOwner && userProfile.ownerId) {
                // Check against Hardcoded App Owner UID
                if (userProfile.ownerId === 'Lswb0erMZFUvbBCFfRXrwPwaPW93') {
                    console.log('✅ Staff of App Owner detected (UID Match)');
                    isAppOwner = true;
                } else {
                    // Fallback to profile fetch (might fail due to permissions)
                    try {
                        console.log('🔍 Checking owner profile for staff (Static Import):', userProfile.ownerId);
                        const profileRef = ref(database, `users/${ownerId}/profile`);

                        // We need 'get' for one-time check, but we only imported 'onValue'.
                        // Let's use a Promise wrapper around onValue for a single read to avoid adding 'get' to imports if not there,
                        // OR just add 'get' to the top imports.
                        // Checking file... 'onValue' is imported. Let's refer to 'get' from firebase/database if needed or use onValue once.
                        // Actually, let's just use the dynamic import for 'get' only, but keep database static.

                        const { get } = await import('firebase/database');
                        const profileSnap = await get(profileRef);

                        if (profileSnap.exists()) {
                            const ownerProfile = profileSnap.val();
                            console.log('🔍 Owner Profile Found:', { email: ownerProfile.email });
                            if (ownerProfile.email === 'wdbyakt@gmail.com') {
                                isAppOwner = true;
                            }
                        } else {
                            console.log('⚠️ Owner Profile NOT found at:', `users/${ownerId}/profile`);
                        }
                    } catch (e) {
                        console.error('Failed to check owner admin status:', e);
                    }
                }
            }

            if (isCancelled) return;

            // 3. Grant Premium if App Owner
            if (isAppOwner) {
                console.log('✅ App Owner Context Detected - Force Premium');
                setIsPremium(true);
                setSubscriptionStatus('Premium');
                setDaysRemaining(3650); // 10 years
                const nextDecade = new Date();
                nextDecade.setFullYear(nextDecade.getFullYear() + 10);
                setExpiryDate(nextDecade.toISOString());
                return;
            }

            // 4. Standard Subscription Listener (if not app owner)
            const subRef = ref(database, `subscriptions/${ownerId}`);

            const unsub = onValue(subRef, (snapshot) => {
                if (isCancelled) return;

                const data = snapshot.val();
                const now = new Date();
                let status: 'Trial' | 'Premium' | 'Expired' | 'Free' = 'Free';
                let premium = false;
                let trial = false;
                let expiryStr: string | null = null;
                let remaining = 0;

                console.log('🔍 Subscription Data:', {
                    path: `subscriptions/${ownerId}`,
                    exists: snapshot.exists(),
                    isPremium: data?.isPremium
                });

                // Check Premium
                if (data && data.isPremium) {
                    const expiry = new Date(data.expiryDate);
                    if (expiry > now) {
                        premium = true;
                        status = 'Premium';
                        expiryStr = data.expiryDate;
                        remaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    }
                }

                // Check Trial (only if not premium)
                if (!premium) {
                    const createdTime = user.metadata?.creationTime
                        ? new Date(user.metadata.creationTime).getTime()
                        : 0;

                    if (createdTime > 0) {
                        const accountAge = now.getTime() - createdTime;
                        const trialDuration = 14 * 24 * 60 * 60 * 1000;
                        if (accountAge < trialDuration) {
                            trial = true;
                            status = 'Trial';
                            remaining = 14 - Math.floor(accountAge / (24 * 60 * 60 * 1000));
                        } else {
                            status = 'Expired';
                        }
                    } else {
                        trial = true;
                        status = 'Trial';
                        remaining = 14;
                    }
                }

                setIsPremium(premium);
                setIsTrial(trial);
                setSubscriptionStatus(status);
                setExpiryDate(expiryStr);
                setDaysRemaining(remaining);
            });

            activeUnsubscribe = () => unsub();
        };

        init();

        return () => {
            isCancelled = true;
            if (activeUnsubscribe) activeUnsubscribe();
        };
    }, [user, userProfile]);

    return (
        <SubscriptionContext.Provider value={{ isPremium, isTrial, subscriptionStatus, expiryDate, daysRemaining }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export const useSubscription = () => useContext(SubscriptionContext);
