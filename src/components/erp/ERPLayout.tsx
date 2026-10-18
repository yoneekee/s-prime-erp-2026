/**
 * ERPLayout – Root layout shell.
 * Renders sidebar (desktop) or Sheet drawer (mobile), top header, and footer.
 */
import { useState, useRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ERPSidebar from "./ERPSidebar";
import { Bell, User, Sun, Moon, Info, CheckCircle2, AlertTriangle, X, LogOut, Settings, UserCircle, Menu, RotateCcw } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEMO_USERS, type DemoRole } from "@/lib/constants";
import { useSlips } from "@/hooks/use-slip-store";
import { getRecentActivity, getSlipDetailPath, getActivityType, isActivityUnread } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format-utils";

import { slipStore } from "@/services/mock-store";
import { itemStore, employeeStore, locationStore } from "@/services/master-store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Notification {
  id: string;
  type: "info" | "success" | "warning";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

function readNotificationState() {
  let readAt = sessionStorage.getItem("erp_notif_read_at");
  if (!readAt) {
    readAt = new Date().toISOString();
    sessionStorage.setItem("erp_notif_read_at", readAt);
  }
  let readKeys: string[] = [];
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem("erp_notif_read_keys") ?? "[]");
    if (Array.isArray(saved)) readKeys = saved.filter((key): key is string => typeof key === "string");
  } catch { /* 破損した既読キーは空として扱う */ }
  return { readAt, readKeys };
}

const notifIcon = (type: Notification["type"]) => {
  switch (type) {
    case "success": return <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />;
    case "warning": return <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />;
    default: return <Info className="w-3.5 h-3.5 text-info flex-shrink-0" />;
  }
};

interface ERPLayoutProps {
  children: React.ReactNode;
}

const ERPLayout = ({ children }: ERPLayoutProps) => {
  const { theme, toggleTheme } = useTheme();
  const { user, currentUser, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const slips = useSlips();
  const [readState, setReadState] = useState(readNotificationState);
  const notifications = getRecentActivity(slips, 10).map(entry => ({
    id: entry.key,
    type: getActivityType(entry.label),
    title: entry.label,
    message: `${entry.slipNo}：${entry.empName}（${entry.role}）が${entry.label}しました`,
    time: formatDateTime(entry.procAt.replace(" ", "T")),
    read: !isActivityUnread(entry, readState.readAt, readState.readKeys),
    path: getSlipDetailPath(entry),
  }));
  const panelRef = useRef<HTMLDivElement>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const readAt = new Date().toISOString();
    sessionStorage.setItem("erp_notif_read_at", readAt);
    sessionStorage.removeItem("erp_notif_read_keys");
    setReadState({ readAt, readKeys: [] });
  };

  const openNotification = (notification: typeof notifications[number]) => {
    const readKeys = [...new Set([...readState.readKeys, notification.id])];
    sessionStorage.setItem("erp_notif_read_keys", JSON.stringify(readKeys));
    setReadState(prev => ({ ...prev, readKeys }));
    setNotifOpen(false);
    navigate(notification.path);
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userPanelRef.current && !userPanelRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (notifOpen || userMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, userMenuOpen]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        {/* Desktop sidebar – hidden on mobile */}
        {!isMobile && <ERPSidebar />}

        {/* Mobile Sheet drawer */}
        {isMobile && (
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>メニュー</SheetTitle>
              </SheetHeader>
              <ERPSidebar onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-40 h-12 flex items-center justify-between border-b border-border px-4 bg-background flex-shrink-0">
            <div className="flex items-center gap-3">
              {isMobile ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              ) : (
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              )}
              {/* デモ用ロール切替 */}
              {currentUser && (
                <div className="flex items-center gap-1.5">
                  <span className="hidden md:inline text-[10px] text-muted-foreground whitespace-nowrap">デモ用ロール切替</span>
                  <Select
                    value={currentUser.role}
                    onValueChange={(v) => {
                      const next = DEMO_USERS.find((u) => u.role === v);
                      switchRole(v as DemoRole);
                      if (next) toast.success(`ロールを「${next.roleLabel}」に切り替えました`);
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[150px] text-xs border-border bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_USERS.map((u) => (
                        <SelectItem key={u.role} value={u.role} className="text-xs">
                          {u.roleLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="hidden lg:inline text-xs font-medium text-foreground whitespace-nowrap">
                    {currentUser.roleLabel}：{currentUser.empName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="h-7 px-2.5 gap-1.5 relative rounded-full bg-secondary ring-1 ring-border shadow-sm hover:bg-secondary/80 hover:opacity-90 text-xs"
              >
                {theme === "dark" ? <Moon className="w-3.5 h-3.5 text-primary" /> : <Sun className="w-3.5 h-3.5 text-warning" />}
                <span className="hidden sm:inline text-[10px] font-medium">{theme === "dark" ? "ダーク" : "ライト"}</span>
              </Button>

              {/* Notification Bell */}
              <div className="relative" ref={panelRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="通知"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground relative"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {notifOpen && (
                  <div className="absolute right-0 top-9 w-80 max-w-[calc(100vw-2rem)] border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-slide-up bg-background">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">通知</span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto p-0 text-xs text-primary hover:underline">
                            すべて既読
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" aria-label="通知を閉じる" onClick={() => setNotifOpen(false)} className="h-6 w-6 text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-muted-foreground">通知はありません</div>
                      ) : (
                        notifications.map((n) => (
                          <Button
                            variant="ghost"
                            key={n.id}
                            className={`h-auto w-full rounded-none text-left whitespace-normal flex items-start justify-start gap-2.5 px-4 py-2.5 border-b border-border last:border-b-0 transition-colors hover:bg-muted ${
                              !n.read ? "bg-secondary" : "bg-background"
                            }`}
                            onClick={() => openNotification(n)}
                          >
                            <div className="mt-0.5">{notifIcon(n.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground">{n.title}</span>
                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                              <span className="text-[10px] text-muted-foreground/70 mt-0.5">{n.time}</span>
                            </div>
                          </Button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={userPanelRef}>
                <button aria-label="ユーザーメニュー"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-primary" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-9 w-64 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-slide-up">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">マイアカウント</span>
                      <button onClick={() => setUserMenuOpen(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{currentUser?.empName || user?.name || "ユーザー"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {currentUser ? `${currentUser.deptName} · ${currentUser.roleLabel}` : user?.email || ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        設定
                      </button>
                      <Button variant="ghost" onClick={() => { setUserMenuOpen(false); setResetOpen(true); }} className="justify-start gap-2.5 w-full px-4 py-2 text-xs rounded-none">
                        <RotateCcw className="w-3.5 h-3.5" /> デモデータ初期化
                      </Button>
                      <button
                        onClick={() => { logout(); navigate("/login", { replace: true }); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-destructive hover:bg-secondary/50 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        ログアウト
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4">
            {children}
          </main>

          <footer className="h-10 flex items-center justify-between px-4 border-t border-border bg-background text-[11px] text-muted-foreground flex-shrink-0">
            <span>© {new Date().getFullYear()} S-Prime ERP</span>
            <span>v1.0.0</span>
          </footer>
        </div>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>デモデータ初期化</AlertDialogTitle>
            <AlertDialogDescription>すべてのデモデータを初期状態に戻します。よろしいですか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              try {
                slipStore.reset(); itemStore.reset(); employeeStore.reset(); locationStore.reset();
                toast.success("デモデータを初期化しました"); navigate("/");
              } catch { toast.error("初期化に失敗しました"); }
            }}>初期化する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">ユーザー設定</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{currentUser?.empName || user?.name || "ユーザー"}</p>
                <p className="text-xs text-muted-foreground">ID: {user?.email || ""}</p>
              </div>
            </div>

            <Separator />

            {/* 現在の操作者情報 (読取専用) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">氏名</Label>
                <Input value={currentUser?.empName ?? "-"} readOnly className="h-9 text-sm bg-muted/50" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">部署</Label>
                <Input value={currentUser?.deptName ?? "-"} readOnly className="h-9 text-sm bg-muted/50" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ロール</Label>
                <Input value={currentUser?.roleLabel ?? "-"} readOnly className="h-9 text-sm bg-muted/50" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">テーマ</p>
                <p className="text-[11px] text-muted-foreground">画面の明るさを変更します</p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme} className="h-8 text-xs gap-1.5">
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === "dark" ? "ライトモード" : "ダークモード"}
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={() => setSettingsOpen(false)}>閉じる</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default ERPLayout;
