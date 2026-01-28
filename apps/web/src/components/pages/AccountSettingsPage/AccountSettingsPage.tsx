"use client";

import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetcher } from "@/lib/api";
import useSWR from "swr";
import UsernameCard from "./components/UsernameCard";
import DisplayNameCard from "./components/DisplayNameCard";
import AvatarCard from "./components/AvatarCard";
import BioCard from "./components/BioCard";
import EmailCard from "./components/EmailCard";
import PasswordCard from "./components/PasswordCard";
import AccountInfoCard from "./components/AccountInfoCard";
import DangerZoneCard from "./components/DangerZoneCard";

interface ProfileData {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  created_at: string;
}

export default function AccountSettingsPage() {
  const { user } = useAuth();

  const { data: profileData, mutate: mutateProfile } = useSWR<{
    profile: ProfileData | null;
    needsSetup?: boolean;
  }>("/user/profile", authenticatedFetcher);

  const profile = profileData?.profile;

  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Please sign in to access account settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account details and security
        </p>
      </header>

      <AvatarCard
        avatarUrl={profile?.avatar_url}
        onUpdate={() => mutateProfile()}
      />

      <DisplayNameCard
        displayName={profile?.display_name}
        onUpdate={() => mutateProfile()}
      />

      <UsernameCard
        username={profile?.username}
        onUpdate={() => mutateProfile()}
      />

      <BioCard bio={profile?.bio} onUpdate={() => mutateProfile()} />

      <EmailCard
        email={user.email}
        emailConfirmedAt={user.email_confirmed_at}
      />

      <PasswordCard />

      <AccountInfoCard
        userId={user.id}
        provider={user.app_metadata?.provider}
        createdAt={user.created_at}
      />

      <DangerZoneCard />
    </div>
  );
}
