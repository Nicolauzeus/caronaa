import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useAuth } from "@/lib/auth-context";

export function StsFormLink(props: ComponentProps<typeof Link>) {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return <Link {...props} />;
}
