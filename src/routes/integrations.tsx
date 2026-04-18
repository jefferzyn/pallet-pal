import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Plus, Settings, Unplug } from "lucide-react";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations — PalletPal" }] }),
  component: () => (
    <RequireAuth>
      <IntegrationsPage />
    </RequireAuth>
  ),
});

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: "inventory" | "erp" | "accounting" | "ecommerce";
}

function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "shopify",
      name: "Shopify",
      description: "Sync inventory levels and pallet counts with Shopify",
      icon: "🛍️",
      connected: false,
      category: "ecommerce",
    },
    {
      id: "woocommerce",
      name: "WooCommerce",
      description: "Connect to WooCommerce for real-time inventory sync",
      icon: "📦",
      connected: false,
      category: "ecommerce",
    },
    {
      id: "quickbooks",
      name: "QuickBooks",
      description: "Integrate with QuickBooks for accounting and inventory",
      icon: "💼",
      connected: false,
      category: "accounting",
    },
    {
      id: "netsuite",
      name: "NetSuite",
      description: "Enterprise ERP integration for complete visibility",
      icon: "🏢",
      connected: false,
      category: "erp",
    },
    {
      id: "api",
      name: "Custom API",
      description: "Build custom integrations using our REST API",
      icon: "🔌",
      connected: false,
      category: "inventory",
    },
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConnect = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setApiKey("");
    setWebhookUrl("");
    setDialogOpen(true);
  };

  const handleSaveConnection = async () => {
    if (!selectedIntegration) return;

    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setSaving(true);
    try {
      // Simulate saving connection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIntegrations(
        integrations.map((int) =>
          int.id === selectedIntegration.id ? { ...int, connected: true } : int,
        ),
      );

      toast.success(`Connected to ${selectedIntegration.name}!`);
      setDialogOpen(false);
    } catch (error) {
      toast.error("Failed to connect integration");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = (integration: Integration) => {
    setIntegrations(
      integrations.map((int) => (int.id === integration.id ? { ...int, connected: false } : int)),
    );
    toast.success(`Disconnected from ${integration.name}`);
  };

  const categories = ["inventory", "erp", "accounting", "ecommerce"] as const;
  const categoryLabels = {
    inventory: "Inventory Management",
    erp: "Enterprise Resource Planning",
    accounting: "Accounting & Finance",
    ecommerce: "E-commerce Platforms",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect PalletPal with your inventory, accounting, and e-commerce systems.
        </p>
      </div>

      {/* API Documentation Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔌</span> API Access
          </CardTitle>
          <CardDescription>
            Use our REST API to build custom integrations or sync data programmatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Base URL</Label>
              <code className="block bg-white rounded p-2 text-sm mt-1 border">
                https://tanstack-start-app.workers.dev/api
              </code>
            </div>
            <div>
              <Label className="text-sm font-medium">Documentation</Label>
              <Button variant="outline" size="sm" className="mt-2">
                View API Docs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations by Category */}
      {categories.map((category) => {
        const categoryIntegrations = integrations.filter((int) => int.category === category);
        if (categoryIntegrations.length === 0) return null;

        return (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-4">{categoryLabels[category]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryIntegrations.map((integration) => (
                <Card
                  key={integration.id}
                  className={`transition ${
                    integration.connected
                      ? "border-green-200 bg-green-50"
                      : "hover:border-primary/50"
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{integration.icon}</span>
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          {integration.connected && (
                            <Badge variant="outline" className="mt-1 bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">{integration.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      {integration.connected ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setDialogOpen(true);
                            }}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Settings
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-600 hover:text-red-700"
                            onClick={() => handleDisconnect(integration)}
                          >
                            <Unplug className="h-3 w-3 mr-1" />
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Dialog open={dialogOpen && selectedIntegration?.id === integration.id}>
                          <DialogTrigger asChild>
                            <Button className="w-full" onClick={() => handleConnect(integration)}>
                              <Plus className="h-3 w-3 mr-1" />
                              Connect
                            </Button>
                          </DialogTrigger>
                          {selectedIntegration?.id === integration.id && (
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Connect {integration.name}</DialogTitle>
                                <DialogDescription>
                                  Enter your {integration.name} API credentials to get started.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="api-key">API Key</Label>
                                  <Input
                                    id="api-key"
                                    placeholder="Paste your API key"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    type="password"
                                  />
                                </div>
                                {integration.category !== "ecommerce" && (
                                  <div className="space-y-2">
                                    <Label htmlFor="webhook">Webhook URL (Optional)</Label>
                                    <Input
                                      id="webhook"
                                      placeholder="https://your-domain.com/webhook"
                                      value={webhookUrl}
                                      onChange={(e) => setWebhookUrl(e.target.value)}
                                    />
                                  </div>
                                )}
                                <div className="rounded-lg bg-amber-50 p-3 flex gap-2">
                                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-amber-700">
                                    Your API key is stored securely and never shared with third
                                    parties.
                                  </p>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveConnection} disabled={saving}>
                                  {saving ? "Connecting..." : "Connect"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          )}
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Set up webhooks to receive real-time updates when pallets are counted or inventory
            changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook Events</Label>
            <div className="space-y-2">
              {["pallet.counted", "pallet.confirmed", "inventory.synced"].map((event) => (
                <div key={event} className="flex items-center gap-2">
                  <input type="checkbox" id={event} defaultChecked className="rounded" />
                  <label htmlFor={event} className="text-sm cursor-pointer">
                    {event}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
