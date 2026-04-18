import { Link, useNavigate } from "@tanstack/react-router";
import { Boxes, LayoutDashboard, Warehouse, Package, BookOpen, LogOut, Plus, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/catalog", label: "Catalog", icon: BookOpen },
] as const;

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Boxes className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">PalletCount</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/pallets/new">
              <Plus className="h-4 w-4" /> New pallet
            </Link>
          </Button>
          <Button asChild size="icon" className="sm:hidden">
            <Link to="/pallets/new" aria-label="New pallet">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
          <span className="hidden text-xs text-muted-foreground lg:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out" className="hidden md:inline-flex">
            <LogOut className="h-4 w-4" />
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {navItems.map((n) => {
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      activeProps={{ className: "bg-accent" }}
                      activeOptions={{ exact: n.to === "/" }}
                    >
                      <Icon className="h-4 w-4" />
                      {n.label}
                    </Link>
                  );
                })}
                <button
                  onClick={handleSignOut}
                  className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
                <p className="mt-4 px-3 text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
