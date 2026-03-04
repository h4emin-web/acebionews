import { useState, memo, useCallback } from "react";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLogin: (name: string) => Promise<void>;
}

export const LoginDialog = memo(({ open, onClose, onLogin }: LoginDialogProps) => {
  const [loginName, setLoginName] = useState("");

  const handleLogin = useCallback(async () => {
    if (!loginName.trim()) return;
    await onLogin(loginName.trim());
    setLoginName("");
  }, [loginName, onLogin]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  }, [handleLogin]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginName(e.target.value);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl p-6 w-80 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">로그인</h3>
        <input
          type="text"
          placeholder="이름을 입력하세요"
          value={loginName}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
          autoFocus
        />
        <p className="text-[10px] text-muted-foreground mb-4">
          이름을 입력하면 자동으로 접속됩니다
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleLogin}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            접속
          </button>
        </div>
      </div>
    </div>
  );
});

LoginDialog.displayName = "LoginDialog";
