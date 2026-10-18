import { createContext, useContext, useState, useEffect, useSyncExternalStore, ReactNode } from "react";
import { DEMO_USERS, type DemoRole } from "@/lib/constants";
import { employeeStore } from "@/services/master-store";

/** デモ用の現在操作者 (ロール切替で変更) */
export interface CurrentUser {
  empId: number;
  empName: string;
  deptName: string;
  role: DemoRole;
  roleLabel: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: { name: string; email: string } | null;
  currentUser: CurrentUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: DemoRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_KEY = "erp_current_role";
const DEFAULT_ROLE: DemoRole = "APPLICANT";

function readStoredRole(): DemoRole {
  const saved = sessionStorage.getItem(ROLE_KEY);
  return DEMO_USERS.some((u) => u.role === saved) ? (saved as DemoRole) : DEFAULT_ROLE;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem("erp_logged_in") === "true";
  });
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    const saved = sessionStorage.getItem("erp_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [role, setRole] = useState<DemoRole>(readStoredRole);

  // 氏名・部署は社員マスタから empId で解決する (重複保持しない)
  const employees = useSyncExternalStore(employeeStore.subscribe, employeeStore.getSnapshot, employeeStore.getSnapshot);
  const demoDef = DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[0];
  const emp = employees.find((e) => e.empId === demoDef.empId);
  const currentUser: CurrentUser | null = isLoggedIn
    ? {
        empId: demoDef.empId,
        empName: emp?.empName ?? "-",
        deptName: emp?.deptName ?? "-",
        role: demoDef.role,
        roleLabel: demoDef.roleLabel,
      }
    : null;

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username && password) {
      const u = { name: username, email: username };
      setUser(u);
      setIsLoggedIn(true);
      // ログイン後のデフォルトロールは申請者
      setRole(DEFAULT_ROLE);
      sessionStorage.setItem("erp_logged_in", "true");
      sessionStorage.setItem("erp_user", JSON.stringify(u));
      sessionStorage.setItem(ROLE_KEY, DEFAULT_ROLE);
      sessionStorage.setItem("erp_notif_read_at", new Date().toISOString());
      sessionStorage.removeItem("erp_notif_read_keys");
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setRole(DEFAULT_ROLE);
    sessionStorage.removeItem("erp_logged_in");
    sessionStorage.removeItem("erp_user");
    sessionStorage.removeItem(ROLE_KEY);
  };

  const switchRole = (next: DemoRole) => {
    setRole(next);
    sessionStorage.setItem(ROLE_KEY, next);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, currentUser, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
