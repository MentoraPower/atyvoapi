import { useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Settings, Users, FileCode } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  onClick?: () => void;
}

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "contatos", label: "Contatos", icon: Users },
  { key: "formulario", label: "Criar Formulário", icon: FileCode },
  { key: "configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    collapseTimer.current = setTimeout(() => setExpanded(false), 80);
  }, []);

  // Mobile: bottom tabs
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#ffffff08] bg-background/95 backdrop-blur-md">
        <div className="flex justify-around py-2 px-4">
          {menuItems.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed top-0 left-0 h-screen z-50 bg-background border-r border-[#00000010] flex flex-col"
      style={{
        width: expanded ? 208 : 60,
        transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Spacer */}
      <div className="h-8" />

      {/* Menu items */}
      <nav className="flex flex-col gap-1 mt-4">
        {menuItems.map((item) => {
          const isActive = activeTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`relative flex items-center py-3 rounded-lg transition-colors overflow-hidden ${isActive
                ? "text-foreground bg-[#00000009]"
                : "text-muted-foreground hover:text-foreground hover:bg-[#00000005]"
                }`}
              style={{
                marginLeft: 8,
                marginRight: 8,
                paddingLeft: 13,
                justifyContent: "flex-start",
                gap: expanded ? 12 : 0,
                transition: "gap 400ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              {/* Active indicator */}
              {isActive && (
                <div
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
                  style={{
                    background:
                      "linear-gradient(to top, #9747FF 0%, #FF2689 57%, #FF9C2B 100%)",
                  }}
                />
              )}
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span
                className="text-[14px] font-medium whitespace-nowrap"
                style={{
                  opacity: expanded ? 1 : 0,
                  width: expanded ? "auto" : 0,
                  transition: "opacity 300ms ease, width 400ms cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
