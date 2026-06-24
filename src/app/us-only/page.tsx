import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "US Only — Plantet" };

export default function UsOnlyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>US Only (For Now)</CardTitle>
          <CardDescription>
            Plantet is currently available in the United States only. We&apos;re working on expanding — check back soon!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, you may be connected through a VPN or proxy. Disable it and try signing up again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
