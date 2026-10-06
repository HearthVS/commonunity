import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Music2, Brain, Activity, Leaf, Eye, ClipboardList,
  BookOpen, PlayCircle, PenLine, FlaskConical, Layers,
  Info, BookMarked, ChevronLeft, ChevronRight, Menu, X, Users, Sparkles, ShoppingBag, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import NexusPanel from "./NexusPanel";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "./AuthGate";

const NAV_GROUPS = [
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Instruments", icon: Music2 },
      { href: "/inventory/audit", label: "Gap Audit", icon: ShoppingBag },
    ]
  },
  {
    label: "Atlases",
    items: [
      { href: "/chakras", label: "Chakra Atlas", icon: Brain },
      { href: "/biofield", label: "Biofield Atlas", icon: Activity },
      { href: "/ayurveda", label: "Ayurveda & Elements", icon: Leaf },
      { href: "/centers", label: "Centers (Gurdjieff)", icon: Eye },
      { href: "/koshas", label: "Koshas (7 Sheaths)", icon: Layers },
      { href: "/subtle-bodies", label: "Subtle Bodies", icon: Sparkles },
    ]
  },
  {
    label: "Session",
    items: [
      { href: "/clients", label: "Client Profiles", icon: Users },
      { href: "/questionnaire", label: "In-Person Form", icon: ClipboardList },
      { href: "/protocols", label: "Protocol Library", icon: BookOpen },
      { href: "/sessions", label: "Session Log", icon: PenLine },
    ]
  },
  {
    label: "Audio",
    items: [
      { href: "/composer", label: "Soundscape Composer", icon: PlayCircle },
    ]
  },
  {
    label: "Reference",
    items: [
      { href: "/why-om", label: "Why OM", icon: Info },
      { href: "/guide", label: "Practitioner Guide", icon: BookMarked },
      { href: "/sources", label: "Sources & Licensing", icon: FlaskConical },
    ]
  }
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const isActive = (href: string) => {
    if (href === "/inventory" && (location === "/" || location === "/inventory")) return true;
    if (href === "/inventory/audit") return location === "/inventory/audit";
    return location.startsWith(href) && href !== "/inventory";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative z-40 flex flex-col h-full border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border flex-shrink-0">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-7 h-7 om-logo-glow" fill="none">
              {/* OM symbol simplified as SVG */}
              <circle cx="16" cy="16" r="15" stroke="hsl(239,84%,67%)" strokeWidth="1.5" fill="none" opacity="0.3"/>
              <text x="16" y="22" textAnchor="middle" fontSize="18" fill="hsl(239,84%,67%)" fontFamily="serif" className="om-symbol">ॐ</text>
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-700 text-foreground leading-tight truncate" style={{fontWeight:700}}>CommonUnity</span>
              <span className="text-xs text-muted-foreground leading-tight">Tuner</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors hidden md:block flex-shrink-0"
          >
            {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-2 mb-1 text-[10px] font-600 text-muted-foreground uppercase tracking-widest" style={{fontWeight:600}}>
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-all duration-150",
                        active
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={16} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer links to CommonUnity ecosystem */}
        {!collapsed && (
          <div className="border-t border-border p-3 flex flex-col gap-1">
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <Layers size={12}/> CommonUnity Compass
            </a>
            <a href="/studio.html" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <Layers size={12}/> CommonUnity Studio
            </a>
            <button
              onClick={() => logout(queryClient)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-left"
            >
              <LogOut size={12}/> Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu size={20}/>
          </button>
          <span className="text-sm font-semibold">CommonUnity Tuner</span>
          <span className="text-muted-foreground ml-1 om-symbol text-lg">ॐ</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Nexus AI — persistent across all pages */}
      <NexusPanel />
    </div>
  );
}
