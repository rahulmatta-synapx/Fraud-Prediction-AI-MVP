import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  FileSearch, 
  Plus,
  AlertTriangle,
  BarChart3,
  HelpCircle,
} from "lucide-react";

const mainItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "All Claims",
    url: "/claims",
    icon: FileSearch,
  },
  {
    title: "Submit Claim",
    url: "/submit",
    icon: Plus,
  },
];

const analysisItems = [
  {
    title: "High Risk",
    url: "/claims?risk=high",
    icon: AlertTriangle,
  },
  {
    title: "Statistics",
    url: "/stats",
    icon: BarChart3,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="flex-shrink-0">
              <img 
                src="/synapx logo sidebar.png" 
                alt="Synapx Logo" 
                className="h-8 w-8 object-contain"
              />
            </div>
            <div className="mt-1">
              <img 
                src="/synapx text sidebar.png" 
                alt="Synapx" 
                className="h-5 w-auto mt-0.5 mb-1"
              />
              <p className="text-xs text-sidebar-foreground/70">Fraud Prediction AI Agent</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Analysis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="nav-help">
              <Link href="/help">
                <HelpCircle />
                <span>Help / Manual</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="text-xs text-sidebar-foreground/50 mt-4 px-2">
          AI-assisted decision support for fraud analysis. All final decisions are made by investigators.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
